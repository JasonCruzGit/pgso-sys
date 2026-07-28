<?php

namespace App\Services\Gps;

class MqttGpsAdapter implements GpsAdapterInterface
{
    public function providerKey(): string
    {
        return 'mqtt';
    }

    public function fetchPositions(): array
    {
        // MQTT subscriber runs as a dedicated worker; adapter normalizes messages pushed here.
        return [];
    }

    public function parseInbound(array $payload): ?GpsPositionDto
    {
        return app(RestGpsAdapter::class)->parseInbound($payload);
    }
}
