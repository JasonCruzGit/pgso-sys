<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FleetGpsPosition;
use App\Models\FleetSchedule;
use App\Models\FleetVehicle;
use App\Services\AuditService;
use App\Services\FleetGpsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FleetVehicleController extends Controller
{
    public function __construct(
        private AuditService $audit,
        private FleetGpsService $gps,
    ) {}

    public function dashboard(): JsonResponse
    {
        $this->gps->markStaleOffline();

        $total = FleetVehicle::where('is_active', true)->count();
        $moving = FleetVehicle::where('motion_status', 'moving')->count();
        $idle = FleetVehicle::whereIn('motion_status', ['idle', 'parked'])->count();
        $offline = FleetVehicle::where('motion_status', 'offline')->count();
        $maintenance = FleetVehicle::where('status', 'maintenance')->count();
        $activeTrips = FleetSchedule::where('status', 'ongoing')->count();
        $upcoming = FleetSchedule::with(['vehicle', 'driver', 'department'])
            ->whereIn('status', ['scheduled', 'approved'])
            ->where('departure_at', '>=', now())
            ->orderBy('departure_at')
            ->limit(8)
            ->get();

        return response()->json([
            'total_vehicles' => $total,
            'active_trips' => $activeTrips,
            'idle_vehicles' => $idle,
            'offline_gps' => $offline,
            'moving_vehicles' => $moving,
            'under_maintenance' => $maintenance,
            'upcoming_schedules' => $upcoming,
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $vehicles = FleetVehicle::with(['driver', 'department'])
            ->when($request->search, fn ($q, $s) => $q->where(function ($q) use ($s) {
                $q->where('plate_number', 'ilike', "%{$s}%")
                    ->orWhere('name', 'ilike', "%{$s}%")
                    ->orWhere('gps_device_id', 'ilike', "%{$s}%")
                    ->orWhere('cr_number', 'ilike', "%{$s}%")
                    ->orWhere('or_number', 'ilike', "%{$s}%")
                    ->orWhere('mv_file_number', 'ilike', "%{$s}%")
                    ->orWhere('engine_number', 'ilike', "%{$s}%")
                    ->orWhere('chassis_number', 'ilike', "%{$s}%")
                    ->orWhere('registration_lto_office', 'ilike', "%{$s}%")
                    ->orWhere('insurance_provider', 'ilike', "%{$s}%")
                    ->orWhere('insurance_policy_number', 'ilike', "%{$s}%")
                    ->orWhere('insurance_certificate_number', 'ilike', "%{$s}%")
                    ->orWhere('insurance_broker', 'ilike', "%{$s}%");
            }))
            ->when($request->motion_status, fn ($q, $s) => $q->where('motion_status', $s))
            ->when($request->vehicle_type, fn ($q, $t) => $q->where('vehicle_type', $t))
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->when($request->boolean('mapable'), fn ($q) => $q->whereNotNull('last_latitude')->whereNotNull('last_longitude'))
            ->orderBy('plate_number')
            ->paginate($request->integer('per_page', 50));

        return response()->json($vehicles);
    }

    public function liveMap(Request $request): JsonResponse
    {
        $this->gps->markStaleOffline();

        if ($request->boolean('refresh_simulated')) {
            $this->gps->refreshSimulatedVehicles();
        }

        $vehicles = FleetVehicle::with(['driver', 'department'])
            ->where('is_active', true)
            ->when($request->motion_status, fn ($q, $s) => $q->where('motion_status', $s))
            ->when($request->vehicle_type, fn ($q, $t) => $q->where('vehicle_type', $t))
            ->when($request->search, fn ($q, $s) => $q->where(function ($q) use ($s) {
                $q->where('plate_number', 'ilike', "%{$s}%")
                    ->orWhere('name', 'ilike', "%{$s}%")
                    ->orWhereHas('driver', fn ($q) => $q->where('name', 'ilike', "%{$s}%"));
            }))
            ->orderBy('plate_number')
            ->get()
            ->map(function (FleetVehicle $vehicle) {
                $trip = $vehicle->schedules()
                    ->with(['requester', 'department', 'driver'])
                    ->whereIn('status', ['scheduled', 'ongoing', 'approved'])
                    ->where('expected_return_at', '>=', now())
                    ->orderBy('departure_at')
                    ->first();

                return [
                    ...$vehicle->toArray(),
                    'active_trip' => $trip,
                ];
            });

        $this->audit->log('view', 'fleet', 'Accessed live fleet GPS map');

        return response()->json(['data' => $vehicles, 'refreshed_at' => now()->toIso8601String()]);
    }

    public function show(FleetVehicle $fleetVehicle): JsonResponse
    {
        $this->audit->log('view', 'fleet', "Viewed vehicle {$fleetVehicle->plate_number}");

        $trip = $fleetVehicle->schedules()
            ->with(['requester', 'department', 'driver'])
            ->whereIn('status', ['scheduled', 'ongoing', 'approved'])
            ->where('expected_return_at', '>=', now())
            ->orderBy('departure_at')
            ->first();

        return response()->json([
            ...$fleetVehicle->load(['driver', 'department'])->toArray(),
            'active_trip' => $trip,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $vehicle = FleetVehicle::create($data);
        $this->audit->log('create', 'fleet', "Created vehicle {$vehicle->plate_number}", newValues: $vehicle->toArray());

        return response()->json($vehicle->load(['driver', 'department']), 201);
    }

    public function update(Request $request, FleetVehicle $fleetVehicle): JsonResponse
    {
        $old = $fleetVehicle->toArray();
        $fleetVehicle->update($this->validated($request, $fleetVehicle));
        $this->audit->log('update', 'fleet', "Updated vehicle {$fleetVehicle->plate_number}", oldValues: $old, newValues: $fleetVehicle->fresh()->toArray());

        return response()->json($fleetVehicle->fresh(['driver', 'department']));
    }

    public function destroy(FleetVehicle $fleetVehicle): JsonResponse
    {
        $this->audit->log('delete', 'fleet', "Deleted vehicle {$fleetVehicle->plate_number}", oldValues: $fleetVehicle->toArray());
        $fleetVehicle->delete();

        return response()->json(['message' => 'Vehicle removed']);
    }

    public function routeHistory(Request $request, FleetVehicle $fleetVehicle): JsonResponse
    {
        $data = $request->validate([
            'date' => ['nullable', 'date'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        $from = isset($data['from'])
            ? $data['from']
            : (($data['date'] ?? now()->toDateString()).' 00:00:00');
        $to = isset($data['to'])
            ? $data['to']
            : (($data['date'] ?? now()->toDateString()).' 23:59:59');

        $positions = FleetGpsPosition::query()
            ->where('fleet_vehicle_id', $fleetVehicle->id)
            ->whereBetween('recorded_at', [$from, $to])
            ->orderBy('recorded_at')
            ->get();

        $distance = $this->gps->routeDistanceKm($positions);
        $first = $positions->first();
        $last = $positions->last();
        $minutes = ($first && $last)
            ? $first->recorded_at->diffInMinutes($last->recorded_at)
            : 0;

        $stops = $positions->where('is_stop', true)->values();
        $ignitionEvents = $positions->filter(fn ($p) => in_array($p->ignition, ['on', 'off'], true))->values();

        $this->audit->log('view', 'fleet', "Viewed route history for {$fleetVehicle->plate_number}");

        return response()->json([
            'vehicle' => $fleetVehicle->only(['id', 'plate_number', 'name']),
            'from' => $from,
            'to' => $to,
            'positions' => $positions,
            'stops' => $stops,
            'ignition_events' => $ignitionEvents,
            'total_distance_km' => $distance,
            'total_travel_minutes' => $minutes,
        ]);
    }

    private function validated(Request $request, ?FleetVehicle $vehicle = null): array
    {
        $required = $vehicle ? 'sometimes' : 'required';

        $data = $request->validate([
            'plate_number' => [$required, 'string', 'max:30', 'unique:fleet_vehicles,plate_number,'.($vehicle?->id ?? 'NULL')],
            'name' => [$required, 'string', 'max:150'],
            'vehicle_type' => [$required, 'in:'.implode(',', FleetVehicle::TYPES)],
            'brand' => ['nullable', 'string', 'max:100'],
            'model' => ['nullable', 'string', 'max:100'],
            'year' => ['nullable', 'integer', 'min:1980', 'max:2100'],
            'color' => ['nullable', 'string', 'max:50'],
            'capacity' => ['nullable', 'integer', 'min:1'],
            'fuel_type' => ['nullable', 'string', 'max:50'],
            'gps_device_id' => ['nullable', 'string', 'max:100', 'unique:fleet_vehicles,gps_device_id,'.($vehicle?->id ?? 'NULL')],
            'gps_provider' => ['nullable', 'string', 'max:50'],
            'assigned_driver_id' => ['nullable', 'exists:users,id'],
            'department_id' => ['nullable', 'exists:departments,id'],
            'status' => ['nullable', 'in:'.implode(',', FleetVehicle::STATUSES)],
            'notes' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
            'cr_number' => ['nullable', 'string', 'max:80'],
            'or_number' => ['nullable', 'string', 'max:80'],
            'mv_file_number' => ['nullable', 'string', 'max:80'],
            'registration_expiry' => ['nullable', 'date'],
            'registration_status' => ['nullable', 'in:'.implode(',', FleetVehicle::DOC_STATUSES)],
            'registration_issued_at' => ['nullable', 'date'],
            'engine_number' => ['nullable', 'string', 'max:100'],
            'chassis_number' => ['nullable', 'string', 'max:100'],
            'registration_classification' => ['nullable', 'string', 'max:80'],
            'registration_series' => ['nullable', 'string', 'max:80'],
            'registration_gross_weight' => ['nullable', 'numeric', 'min:0'],
            'registration_net_weight' => ['nullable', 'numeric', 'min:0'],
            'registration_piston_displacement' => ['nullable', 'string', 'max:50'],
            'registration_lto_office' => ['nullable', 'string', 'max:120'],
            'registration_owner_name' => ['nullable', 'string', 'max:150'],
            'registration_amount_paid' => ['nullable', 'numeric', 'min:0'],
            'insurance_provider' => ['nullable', 'string', 'max:150'],
            'insurance_policy_number' => ['nullable', 'string', 'max:100'],
            'insurance_coverage_type' => ['nullable', 'string', 'max:80'],
            'insurance_expiry' => ['nullable', 'date'],
            'insurance_status' => ['nullable', 'in:'.implode(',', FleetVehicle::DOC_STATUSES)],
            'insurance_issued_at' => ['nullable', 'date'],
            'insurance_certificate_number' => ['nullable', 'string', 'max:100'],
            'insurance_sum_insured' => ['nullable', 'numeric', 'min:0'],
            'insurance_broker' => ['nullable', 'string', 'max:150'],
            'insurance_contact_person' => ['nullable', 'string', 'max:120'],
            'insurance_contact_phone' => ['nullable', 'string', 'max:40'],
            'insurance_remarks' => ['nullable', 'string', 'max:255'],
        ]);

        if (array_key_exists('registration_expiry', $data) && empty($data['registration_status'])) {
            $data['registration_status'] = $this->resolveDocStatus($data['registration_expiry'] ?? null);
        }
        if (array_key_exists('insurance_expiry', $data) && empty($data['insurance_status'])) {
            $data['insurance_status'] = $this->resolveDocStatus($data['insurance_expiry'] ?? null);
        }

        return $data;
    }

    private function resolveDocStatus(?string $expiry): ?string
    {
        if (! $expiry) {
            return 'pending';
        }

        $date = \Carbon\Carbon::parse($expiry)->startOfDay();
        $today = now()->startOfDay();

        if ($date->lt($today)) {
            return 'expired';
        }
        if ($date->lte($today->copy()->addDays(30))) {
            return 'expiring';
        }

        return 'valid';
    }
}
