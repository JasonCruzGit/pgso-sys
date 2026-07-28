<?php

namespace App\Services\Gps;

class RestGpsAdapter implements GpsAdapterInterface
{
    public function providerKey(): string
    {
        return 'rest';
    }

    public function fetchPositions(): array
    {
        // Hook for vendor REST polling (Traccar / Flespi / custom).
        // Configure via services.gps.rest_endpoint when a provider is wired.
        return [];
    }

    public function parseInbound(array $payload): ?GpsPositionDto
    {
        $deviceId = (string) ($payload['device_id'] ?? $payload['imei'] ?? $payload['gps_device_id'] ?? '');
        $lat = $payload['latitude'] ?? $payload['lat'] ?? null;
        $lng = $payload['longitude'] ?? $payload['lng'] ?? $payload['lon'] ?? null;

        if ($deviceId === '' || $lat === null || $lng === null) {
            return null;
        }

        return new GpsPositionDto(
            deviceId: $deviceId,
            latitude: (float) $lat,
            longitude: (float) $lng,
            speed: isset($payload['speed']) ? (float) $payload['speed'] : null,
            heading: isset($payload['heading']) ? (float) $payload['heading'] : (isset($payload['course']) ? (float) $payload['course'] : null),
            altitude: isset($payload['altitude']) ? (float) $payload['altitude'] : null,
            satellites: isset($payload['satellites']) ? (int) $payload['satellites'] : null,
            engineStatus: $payload['engine_status'] ?? null,
            ignition: $payload['ignition'] ?? null,
            address: $payload['address'] ?? null,
            recordedAt: isset($payload['recorded_at']) ? new \DateTimeImmutable($payload['recorded_at']) : now(),
            raw: $payload,
        );
    }
}
