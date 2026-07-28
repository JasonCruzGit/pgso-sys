<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\Inspection;
use App\Services\AuditService;
use App\Traits\GeneratesReference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class InspectionController extends Controller
{
    use GeneratesReference;

    public function __construct(private AuditService $audit) {}

    public function index(Request $request): JsonResponse
    {
        $inspections = Inspection::with(['asset.inventoryItem', 'inventoryItem', 'inspector'])
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->when($request->asset_id, fn ($q, $id) => $q->where('asset_id', $id))
            ->when($request->search, fn ($q, $s) => $q->where('inspection_number', 'ilike', "%{$s}%"))
            ->latest('scheduled_date')
            ->paginate($request->integer('per_page', 15));

        return response()->json($inspections);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'asset_id' => ['nullable', 'exists:assets,id', 'required_without:inventory_item_id'],
            'inventory_item_id' => ['nullable', 'exists:inventory_items,id', 'required_without:asset_id'],
            'scheduled_date' => ['required', 'date'],
            'findings' => ['nullable', 'string'],
        ]);

        $inspection = Inspection::create([
            'inspection_number' => $this->generateReference('INS-', 'inspections', 'inspection_number'),
            'asset_id' => $data['asset_id'] ?? null,
            'inventory_item_id' => $data['inventory_item_id'] ?? null,
            'inspector_id' => auth('api')->id(),
            'scheduled_date' => $data['scheduled_date'],
            'findings' => $data['findings'] ?? null,
            'status' => 'scheduled',
        ]);

        $this->audit->log('create', 'inspection', "Scheduled inspection {$inspection->inspection_number}", newValues: $inspection->toArray());

        return response()->json($inspection->load(['asset.inventoryItem', 'inventoryItem', 'inspector']), 201);
    }

    public function show(Inspection $inspection): JsonResponse
    {
        return response()->json($inspection->load(['asset.inventoryItem', 'inventoryItem', 'inspector']));
    }

    public function complete(Request $request, Inspection $inspection): JsonResponse
    {
        $data = $request->validate([
            'condition' => ['required', 'in:excellent,good,fair,poor,unserviceable'],
            'findings' => ['nullable', 'string'],
            'completed_date' => ['nullable', 'date'],
        ]);

        if ($inspection->status !== 'scheduled') {
            return response()->json(['message' => 'Only scheduled inspections can be completed.'], 422);
        }

        $completedDate = $data['completed_date'] ?? now()->toDateString();

        $inspection->update([
            'status' => 'completed',
            'condition' => $data['condition'],
            'findings' => $data['findings'] ?? $inspection->findings,
            'completed_date' => $completedDate,
        ]);

        if ($inspection->asset_id) {
            $asset = Asset::findOrFail($inspection->asset_id);
            $asset->update([
                'condition' => $data['condition'],
                'last_inspection_date' => $completedDate,
                'next_inspection_date' => Carbon::parse($completedDate)->addYear()->toDateString(),
            ]);
        }

        $this->audit->log('update', 'inspection', "Completed inspection {$inspection->inspection_number}");

        return response()->json($inspection->fresh()->load(['asset.inventoryItem', 'inventoryItem', 'inspector']));
    }
}
