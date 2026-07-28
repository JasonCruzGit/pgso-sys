<?php

namespace App\Services\Gps;

interface GpsAdapterInterface
{
    public function providerKey(): string;

    /**
     * @return list<GpsPositionDto>
     */
    public function fetchPositions(): array;

    /**
     * Normalize a raw inbound payload (webhook / TCP / MQTT message).
     */
    public function parseInbound(array $payload): ?GpsPositionDto;
}
