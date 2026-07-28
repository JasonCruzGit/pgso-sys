<?php

namespace App\Services\Gps;

use InvalidArgumentException;

class GpsAdapterFactory
{
    public function make(?string $provider): GpsAdapterInterface
    {
        return match ($provider) {
            'rest', null, '' => app(RestGpsAdapter::class),
            'webhook' => app(WebhookGpsAdapter::class),
            'mqtt' => app(MqttGpsAdapter::class),
            'tcp' => app(TcpGpsAdapter::class),
            'simulated', 'custom' => app(SimulatedGpsAdapter::class),
            default => throw new InvalidArgumentException("Unsupported GPS provider: {$provider}"),
        };
    }
}
