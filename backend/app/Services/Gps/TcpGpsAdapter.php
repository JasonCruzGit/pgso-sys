<?php

namespace App\Services\Gps;

class TcpGpsAdapter implements GpsAdapterInterface
{
    public function providerKey(): string
    {
        return 'tcp';
    }

    public function fetchPositions(): array
    {
        return [];
    }

    public function parseInbound(array $payload): ?GpsPositionDto
    {
        return app(RestGpsAdapter::class)->parseInbound($payload);
    }
}
