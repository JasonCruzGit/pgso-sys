<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\FleetGpsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Public-ish ingest endpoints for GPS vendors (still auth:api or signed webhook token).
 */
class FleetGpsIngestController extends Controller
{
    public function __construct(private FleetGpsService $gps) {}

    public function webhook(Request $request, string $provider = 'webhook'): JsonResponse
    {
        $payload = $request->all();
        $vehicle = $this->gps->ingestFromProvider($provider, $payload);

        if (! $vehicle) {
            return response()->json(['message' => 'Unknown GPS device or invalid payload'], 422);
        }

        return response()->json([
            'message' => 'Position ingested',
            'vehicle' => $vehicle->only([
                'id', 'plate_number', 'motion_status', 'last_latitude', 'last_longitude', 'last_speed', 'last_gps_at',
            ]),
        ]);
    }

    public function simulate(Request $request): JsonResponse
    {
        $count = $this->gps->refreshSimulatedVehicles();

        return response()->json(['message' => "Simulated updates for {$count} vehicles", 'count' => $count]);
    }
}
