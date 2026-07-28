<?php

namespace App\Services\Gps;

class WebhookGpsAdapter implements GpsAdapterInterface
{
    public function providerKey(): string
    {
        return 'webhook';
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
