<?php

namespace App\Services;

use App\Models\FleetGpsPosition;
use App\Models\FleetVehicle;
use App\Services\Gps\GpsAdapterFactory;
use App\Services\Gps\GpsPositionDto;
use App\Services\Gps\SimulatedGpsAdapter;
use Illuminate\Support\Carbon;

class FleetGpsService
{
    public const IDLE_SPEED_KMH = 3;

    public const OFFLINE_MINUTES = 10;

    public function __construct(
        private GpsAdapterFactory $adapters,
        private NotificationService $notifications,
    ) {}

    public function ingest(GpsPositionDto $dto, ?string $provider = null): ?FleetVehicle
    {
        $vehicle = FleetVehicle::query()
            ->where('gps_device_id', $dto->deviceId)
            ->orWhere('plate_number', $dto->deviceId)
            ->first();

        if (! $vehicle) {
            return null;
        }

        $recordedAt = Carbon::parse($dto->recordedAt ?? now());
        $speed = (float) ($dto->speed ?? 0);
        $isStop = $speed < self::IDLE_SPEED_KMH && ($dto->ignition === 'off' || $speed < 0.5);

        FleetGpsPosition::create([
            'fleet_vehicle_id' => $vehicle->id,
            'latitude' => $dto->latitude,
            'longitude' => $dto->longitude,
            'speed' => $dto->speed,
            'heading' => $dto->heading,
            'altitude' => $dto->altitude,
            'satellites' => $dto->satellites,
            'engine_status' => $dto->engineStatus,
            'ignition' => $dto->ignition,
            'is_stop' => $isStop,
            'address' => $dto->address,
            'provider' => $provider ?? $vehicle->gps_provider,
            'raw_payload' => $dto->raw ?: null,
            'recorded_at' => $recordedAt,
        ]);

        $motion = $this->detectMotionStatus($speed, $dto->ignition, $recordedAt);
        $wasOffline = $vehicle->gps_status === 'offline' || $vehicle->motion_status === 'offline';

        $vehicle->update([
            'last_latitude' => $dto->latitude,
            'last_longitude' => $dto->longitude,
            'last_speed' => $dto->speed,
            'last_heading' => $dto->heading,
            'engine_status' => $dto->engineStatus ?? $vehicle->engine_status,
            'last_gps_at' => $recordedAt,
            'last_address' => $dto->address ?? $vehicle->last_address,
            'gps_status' => 'online',
            'motion_status' => $motion,
        ]);

        if ($wasOffline === false && $motion === 'offline') {
            $this->notifyOfflineDuringTrip($vehicle->fresh());
        }

        return $vehicle->fresh(['driver', 'department']);
    }

    public function ingestFromProvider(string $provider, array $payload): ?FleetVehicle
    {
        $adapter = $this->adapters->make($provider);
        $dto = $adapter->parseInbound($payload);

        return $dto ? $this->ingest($dto, $provider) : null;
    }

    public function refreshSimulatedVehicles(): int
    {
        $simulated = FleetVehicle::query()
            ->where('is_active', true)
            ->where(function ($q) {
                $q->where('gps_provider', 'simulated')
                    ->orWhereNull('gps_provider');
            })
            ->whereNotNull('gps_device_id')
            ->get();

        /** @var SimulatedGpsAdapter $adapter */
        $adapter = $this->adapters->make('simulated');
        $count = 0;

        foreach ($simulated as $vehicle) {
            $dto = $adapter->simulateForDevice(
                $vehicle->gps_device_id,
                $vehicle->last_latitude ? (float) $vehicle->last_latitude : null,
                $vehicle->last_longitude ? (float) $vehicle->last_longitude : null,
            );
            $this->ingest($dto, 'simulated');
            $count++;
        }

        $this->markStaleOffline();

        return $count;
    }

    public function markStaleOffline(): int
    {
        $cutoff = now()->subMinutes(self::OFFLINE_MINUTES);
        $vehicles = FleetVehicle::query()
            ->where('is_active', true)
            ->where(function ($q) use ($cutoff) {
                $q->whereNull('last_gps_at')->orWhere('last_gps_at', '<', $cutoff);
            })
            ->where('motion_status', '!=', 'offline')
            ->get();

        foreach ($vehicles as $vehicle) {
            $vehicle->update([
                'gps_status' => 'offline',
                'motion_status' => 'offline',
            ]);
            $this->notifyOfflineDuringTrip($vehicle);
        }

        return $vehicles->count();
    }

    public function detectMotionStatus(float $speed, ?string $ignition, Carbon $recordedAt): string
    {
        if ($recordedAt->lt(now()->subMinutes(self::OFFLINE_MINUTES))) {
            return 'offline';
        }

        if ($speed >= self::IDLE_SPEED_KMH) {
            return 'moving';
        }

        if ($ignition === 'off' || $speed < 0.5) {
            return 'parked';
        }

        return 'idle';
    }

    /**
     * Haversine distance in kilometers.
     *
     * @param  iterable<FleetGpsPosition>  $positions
     */
    public function routeDistanceKm(iterable $positions): float
    {
        $points = collect($positions)->values();
        $distance = 0.0;

        for ($i = 1; $i < $points->count(); $i++) {
            $a = $points[$i - 1];
            $b = $points[$i];
            $distance += $this->haversineKm(
                (float) $a->latitude,
                (float) $a->longitude,
                (float) $b->latitude,
                (float) $b->longitude,
            );
        }

        return round($distance, 2);
    }

    private function haversineKm(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $earth = 6371;
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);
        $a = sin($dLat / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon / 2) ** 2;

        return $earth * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }

    private function notifyOfflineDuringTrip(FleetVehicle $vehicle): void
    {
        $active = $vehicle->schedules()
            ->where('status', 'ongoing')
            ->exists();

        if (! $active) {
            return;
        }

        $officers = \App\Models\User::query()
            ->whereHas('role', fn ($q) => $q->whereIn('slug', ['system_administrator', 'gso_inventory_officer', 'fleet_officer']))
            ->where('is_active', true)
            ->get();

        $this->notifications->notify(
            $officers,
            'fleet_gps_offline',
            'Vehicle Offline During Trip',
            "{$vehicle->name} ({$vehicle->plate_number}) lost GPS signal during an active trip.",
            ['fleet_vehicle_id' => $vehicle->id],
        );
    }
}
