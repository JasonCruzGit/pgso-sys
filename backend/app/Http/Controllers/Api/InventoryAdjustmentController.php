<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryAdjustment;
use App\Models\InventoryItem;
use App\Services\AuditService;
use App\Services\NotificationService;
use App\Traits\GeneratesReference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InventoryAdjustmentController extends Controller
{
    use GeneratesReference;

    public function __construct(
        private AuditService $audit,
        private NotificationService $notifications,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $adjustments = InventoryAdjustment::with(['inventoryItem', 'adjuster', 'approver'])
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->when($request->search, fn ($q, $s) => $q->where('adjustment_number', 'ilike', "%{$s}%"))
            ->latest()
            ->paginate($request->integer('per_page', 15));

        return response()->json($adjustments);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'inventory_item_id' => ['required', 'exists:inventory_items,id'],
            'adjustment_type' => ['required', 'in:increase,decrease,correction'],
            'quantity_change' => ['required', 'numeric', 'not_in:0'],
            'reason' => ['required', 'string'],
        ]);

        return DB::transaction(function () use ($data) {
            $item = InventoryItem::findOrFail($data['inventory_item_id']);
            $quantityBefore = (float) $item->quantity;
            $quantityChange = (float) $data['quantity_change'];

            if ($data['adjustment_type'] === 'decrease' && $quantityChange > 0) {
                $quantityChange = -abs($quantityChange);
            } elseif ($data['adjustment_type'] === 'increase' && $quantityChange < 0) {
                $quantityChange = abs($quantityChange);
            }

            $adjustment = InventoryAdjustment::create([
                'adjustment_number' => $this->generateReference('ADJ-', 'inventory_adjustments', 'adjustment_number'),
                'inventory_item_id' => $item->id,
                'adjustment_type' => $data['adjustment_type'],
                'quantity_before' => $quantityBefore,
                'quantity_change' => $quantityChange,
                'quantity_after' => $quantityBefore + $quantityChange,
                'reason' => $data['reason'],
                'status' => 'pending',
                'adjusted_by' => auth('api')->id(),
            ]);

            $this->audit->log('create', 'inventory_adjustment', "Created adjustment {$adjustment->adjustment_number}", newValues: $adjustment->toArray());

            return response()->json($adjustment->load(['inventoryItem', 'adjuster']), 201);
        });
    }

    public function approve(InventoryAdjustment $inventoryAdjustment): JsonResponse
    {
        if ($inventoryAdjustment->status !== 'pending') {
            return response()->json(['message' => 'Only pending adjustments can be approved.'], 422);
        }

        return DB::transaction(function () use ($inventoryAdjustment) {
            $item = InventoryItem::lockForUpdate()->findOrFail($inventoryAdjustment->inventory_item_id);
            $quantityBefore = (float) $item->quantity;
            $newQuantity = $quantityBefore + (float) $inventoryAdjustment->quantity_change;

            if ($newQuantity < 0) {
                return response()->json([
                    'message' => "Approval would result in negative stock for {$item->name}.",
                ], 422);
            }

            $item->update(['quantity' => $newQuantity, 'updated_by' => auth('api')->id()]);

            $inventoryAdjustment->update([
                'status' => 'approved',
                'approved_by' => auth('api')->id(),
                'approved_at' => now(),
                'quantity_before' => $quantityBefore,
                'quantity_after' => $newQuantity,
            ]);

            if ($item->fresh()->isLowStock()) {
                $this->notifications->notifyLowStock($item);
            }

            $this->audit->log('approval', 'inventory_adjustment', "Approved adjustment {$inventoryAdjustment->adjustment_number}");

            return response()->json($inventoryAdjustment->fresh()->load(['inventoryItem', 'adjuster', 'approver']));
        });
    }

    public function reject(Request $request, InventoryAdjustment $inventoryAdjustment): JsonResponse
    {
        $data = $request->validate(['rejection_reason' => ['required', 'string', 'max:500']]);

        if ($inventoryAdjustment->status !== 'pending') {
            return response()->json(['message' => 'Only pending adjustments can be rejected.'], 422);
        }

        $inventoryAdjustment->update([
            'status' => 'rejected',
            'rejection_reason' => $data['rejection_reason'],
        ]);

        $this->audit->log('approval', 'inventory_adjustment', "Rejected adjustment {$inventoryAdjustment->adjustment_number}");

        return response()->json($inventoryAdjustment->load(['inventoryItem', 'adjuster']));
    }
}
