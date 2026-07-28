<?php

namespace App\Services\Gps;

/**
 * Development / demo adapter that generates plausible movement near Puerto Princesa Capitol.
 * Positions are clamped to a land bounding box so tags do not drift into the bay / open sea.
 */
class SimulatedGpsAdapter implements GpsAdapterInterface
{
    /** Provincial Capitol, Puerto Princesa */
    public const HOME_LAT = 9.7392;

    public const HOME_LNG = 118.7353;

    /** Urban land box — keeps markers on city roads, not in Puerto Princesa Bay or Sulu Sea */
    private const LAND_MIN_LAT = 9.7280;

    private const LAND_MAX_LAT = 9.7620;

    private const LAND_MIN_LNG = 118.7220;

    private const LAND_MAX_LNG = 118.7480;

    public function providerKey(): string
    {
        return 'simulated';
    }

    public function fetchPositions(): array
    {
        return [];
    }

    public function parseInbound(array $payload): ?GpsPositionDto
    {
        return app(RestGpsAdapter::class)->parseInbound($payload);
    }

    public function simulateForDevice(string $deviceId, ?float $lat = null, ?float $lng = null): GpsPositionDto
    {
        $baseLat = $lat ?? self::HOME_LAT;
        $baseLng = $lng ?? self::HOME_LNG;

        // If last known point drifted offshore, snap back to Capitol before jittering
        if (! $this->isOnLand($baseLat, $baseLng)) {
            $baseLat = self::HOME_LAT;
            $baseLng = self::HOME_LNG;
        }

        // ~±350 m so successive refreshes stay within the city land box
        $deltaLat = mt_rand(-35, 35) / 10000;
        $deltaLng = mt_rand(-35, 35) / 10000;
        $speed = mt_rand(0, 45);

        [$nextLat, $nextLng] = $this->clampToLand($baseLat + $deltaLat, $baseLng + $deltaLng);

        return new GpsPositionDto(
            deviceId: $deviceId,
            latitude: $nextLat,
            longitude: $nextLng,
            speed: (float) $speed,
            heading: (float) mt_rand(0, 359),
            engineStatus: $speed > 0 ? 'on' : (mt_rand(0, 1) ? 'on' : 'off'),
            ignition: $speed > 0 ? 'on' : 'off',
            recordedAt: now(),
            raw: ['provider' => 'simulated'],
        );
    }

    private function isOnLand(float $lat, float $lng): bool
    {
        return $lat >= self::LAND_MIN_LAT
            && $lat <= self::LAND_MAX_LAT
            && $lng >= self::LAND_MIN_LNG
            && $lng <= self::LAND_MAX_LNG;
    }

    /** @return array{0: float, 1: float} */
    private function clampToLand(float $lat, float $lng): array
    {
        return [
            min(self::LAND_MAX_LAT, max(self::LAND_MIN_LAT, $lat)),
            min(self::LAND_MAX_LNG, max(self::LAND_MIN_LNG, $lng)),
        ];
    }
}
