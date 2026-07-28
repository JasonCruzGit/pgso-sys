<?php

namespace App\Services\Gps;

class GpsPositionDto
{
    public function __construct(
        public readonly string $deviceId,
        public readonly float $latitude,
        public readonly float $longitude,
        public readonly ?float $speed = null,
        public readonly ?float $heading = null,
        public readonly ?float $altitude = null,
        public readonly ?int $satellites = null,
        public readonly ?string $engineStatus = null,
        public readonly ?string $ignition = null,
        public readonly ?string $address = null,
        public readonly ?\DateTimeInterface $recordedAt = null,
        public readonly array $raw = [],
    ) {}
}
