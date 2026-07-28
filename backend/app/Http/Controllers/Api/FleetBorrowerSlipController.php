<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FleetBorrowerSlip;
use App\Models\FleetVehicle;
use App\Services\ExportService;
use App\Traits\GeneratesReference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FleetBorrowerSlipController extends Controller
{
    use GeneratesReference;

    public function __construct(private ExportService $export) {}

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request);
        $user = $request->user();

        $slip = FleetBorrowerSlip::create([
            ...$data,
            'slip_number' => $this->generateReference('FBS-', 'fleet_borrower_slips', 'slip_number'),
            'requester_id' => $data['requester_id'] ?? $user->id,
            'created_by' => $user->id,
            'updated_by' => $user->id,
        ]);

        return response()->json($slip->load(['department', 'requester']), 201);
    }

    public function show(FleetBorrowerSlip $fleetBorrowerSlip): JsonResponse
    {
        return response()->json($fleetBorrowerSlip->load(['department', 'requester', 'schedule']));
    }

    public function pdf(FleetBorrowerSlip $fleetBorrowerSlip)
    {
        $slip = $fleetBorrowerSlip->load(['department', 'requester']);

        return $this->export->toPdf('reports.fleet-borrower-slip', [
            'slip' => $slip,
            'generatedAt' => now()->timezone('Asia/Manila')->format('M d, Y h:i A'),
        ], 'borrower-slip-'.$slip->slip_number);
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'borrower_name' => ['required', 'string', 'max:255'],
            'department_id' => ['required', 'exists:departments,id'],
            'contact_no' => ['nullable', 'string', 'max:50'],
            'purpose' => ['required', 'string', 'max:500'],
            'destination' => ['required', 'string', 'max:255'],
            'departure_at' => ['required', 'date'],
            'expected_return_at' => ['required', 'date', 'after:departure_at'],
            'passengers' => ['nullable', 'integer', 'min:1', 'max:60'],
            'requested_vehicle_type' => ['nullable', 'string', 'in:'.implode(',', [...FleetVehicle::TYPES, 'any'])],
            'driver_needed' => ['nullable', 'boolean'],
            'preferred_driver_note' => ['nullable', 'string', 'max:255'],
            'remarks' => ['nullable', 'string'],
            'requester_id' => ['nullable', 'exists:users,id'],
        ]);
    }
}
