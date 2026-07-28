<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\DisposalRecord;
use App\Models\InventoryItem;
use App\Services\AuditService;
use App\Traits\GeneratesReference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DisposalRecordController extends Controller
{
    use GeneratesReference;

    public function __construct(private AuditService $audit) {}

    public function index(Request $request): JsonResponse
    {
        $records = DisposalRecord::with(['asset.inventoryItem', 'inventoryItem', 'recommender', 'approver'])
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->when($request->search, fn ($q, $s) => $q->where('disposal_number', 'ilike', "%{$s}%"))
            ->latest('recommendation_date')
            ->paginate($request->integer('per_page', 15));

        return response()->json($records);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'asset_id' => ['nullable', 'exists:assets,id', 'required_without:inventory_item_id'],
            'inventory_item_id' => ['nullable', 'exists:inventory_items,id', 'required_without:asset_id'],
            'recommendation_date' => ['required', 'date'],
            'reason' => ['required', 'string'],
            'notes' => ['nullable', 'string'],
        ]);

        $record = DisposalRecord::create([
            'disposal_number' => $this->generateReference('DSP-', 'disposal_records', 'disposal_number'),
            'asset_id' => $data['asset_id'] ?? null,
            'inventory_item_id' => $data['inventory_item_id'] ?? null,
            'recommendation_date' => $data['recommendation_date'],
            'reason' => $data['reason'],
            'notes' => $data['notes'] ?? null,
            'status' => 'recommended',
            'recommended_by' => auth('api')->id(),
        ]);

        $this->audit->log('create', 'disposal', "Recommended disposal {$record->disposal_number}", newValues: $record->toArray());

        return response()->json($record->load(['asset.inventoryItem', 'inventoryItem', 'recommender']), 201);
    }

    public function approve(DisposalRecord $disposalRecord): JsonResponse
    {
        if ($disposalRecord->status !== 'recommended') {
            return response()->json(['message' => 'Only recommended disposals can be approved.'], 422);
        }

        $disposalRecord->update([
            'status' => 'approved',
            'approved_by' => auth('api')->id(),
        ]);

        $this->audit->log('approval', 'disposal', "Approved disposal {$disposalRecord->disposal_number}");

        return response()->json($disposalRecord->fresh()->load(['asset.inventoryItem', 'inventoryItem', 'recommender', 'approver']));
    }

    public function complete(Request $request, DisposalRecord $disposalRecord): JsonResponse
    {
        $data = $request->validate([
            'disposal_date' => ['required', 'date'],
            'notes' => ['nullable', 'string'],
        ]);

        if ($disposalRecord->status !== 'approved') {
            return response()->json(['message' => 'Only approved disposals can be completed.'], 422);
        }

        return DB::transaction(function () use ($disposalRecord, $data) {
            $disposalRecord->update([
                'status' => 'completed',
                'disposal_date' => $data['disposal_date'],
                'notes' => $data['notes'] ?? $disposalRecord->notes,
            ]);

            if ($disposalRecord->asset_id) {
                Asset::findOrFail($disposalRecord->asset_id)->delete();
            }

            if ($disposalRecord->inventory_item_id) {
                $item = InventoryItem::lockForUpdate()->findOrFail($disposalRecord->inventory_item_id);
                $item->update(['quantity' => 0, 'status' => 'disposed', 'updated_by' => auth('api')->id()]);
            }

            $this->audit->log('update', 'disposal', "Completed disposal {$disposalRecord->disposal_number}");

            return response()->json($disposalRecord->fresh()->load(['asset.inventoryItem', 'inventoryItem', 'recommender', 'approver']));
        });
    }
}
