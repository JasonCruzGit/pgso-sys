<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\CondemnationRecord;
use App\Services\AuditService;
use App\Traits\GeneratesReference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CondemnationRecordController extends Controller
{
    use GeneratesReference;

    public function __construct(private AuditService $audit) {}

    public function index(Request $request): JsonResponse
    {
        $records = CondemnationRecord::with(['asset.inventoryItem', 'inspection', 'recommender', 'approver'])
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->when($request->asset_id, fn ($q, $id) => $q->where('asset_id', $id))
            ->when($request->search, fn ($q, $s) => $q->where('condemnation_number', 'ilike', "%{$s}%"))
            ->latest()
            ->paginate($request->integer('per_page', 15));

        return response()->json($records);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'asset_id' => ['required', 'exists:assets,id'],
            'inspection_id' => ['nullable', 'exists:inspections,id'],
            'findings' => ['required', 'string'],
        ]);

        $record = CondemnationRecord::create([
            'condemnation_number' => $this->generateReference('CON-', 'condemnation_records', 'condemnation_number'),
            'asset_id' => $data['asset_id'],
            'inspection_id' => $data['inspection_id'] ?? null,
            'findings' => $data['findings'],
            'status' => 'recommended',
            'recommended_by' => auth('api')->id(),
        ]);

        $this->audit->log('create', 'condemnation', "Recommended condemnation {$record->condemnation_number}", newValues: $record->toArray());

        return response()->json($record->load(['asset.inventoryItem', 'inspection', 'recommender']), 201);
    }

    public function approve(CondemnationRecord $condemnationRecord): JsonResponse
    {
        if ($condemnationRecord->status !== 'recommended') {
            return response()->json(['message' => 'Only recommended condemnations can be approved.'], 422);
        }

        $condemnationRecord->update([
            'status' => 'approved',
            'approved_by' => auth('api')->id(),
            'approval_date' => now()->toDateString(),
        ]);

        $asset = Asset::findOrFail($condemnationRecord->asset_id);
        $asset->update(['condition' => 'unserviceable']);

        $this->audit->log('approval', 'condemnation', "Approved condemnation {$condemnationRecord->condemnation_number}");

        return response()->json($condemnationRecord->fresh()->load(['asset.inventoryItem', 'inspection', 'recommender', 'approver']));
    }
}
