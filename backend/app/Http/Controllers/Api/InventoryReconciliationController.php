<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryAdjustment;
use App\Models\InventoryItem;
use App\Models\InventoryReconciliation;
use App\Models\StockAdjustment;
use App\Services\AuditService;
use App\Traits\GeneratesReference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class InventoryReconciliationController extends Controller
{
    use GeneratesReference;

    public function __construct(private AuditService $audit) {}

    public function index(Request $request): JsonResponse
    {
        $reconciliations = InventoryReconciliation::with('starter')
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->when($request->search, fn ($q, $s) => $q->where('reconciliation_number', 'ilike', "%{$s}%")
                ->orWhere('title', 'ilike', "%{$s}%"))
            ->latest()
            ->paginate($request->integer('per_page', 15));

        return response()->json($reconciliations);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
            'category_id' => ['nullable', 'exists:categories,id'],
        ]);

        return DB::transaction(function () use ($data) {
            $reconciliation = InventoryReconciliation::create([
                'reconciliation_number' => $this->generateReference('REC-', 'inventory_reconciliations', 'reconciliation_number'),
                'title' => $data['title'],
                'status' => 'draft',
                'started_by' => auth('api')->id(),
                'notes' => $data['notes'] ?? null,
            ]);

            $items = InventoryItem::when($data['category_id'] ?? null, fn ($q, $id) => $q->inCategory((int) $id))->get();

            foreach ($items as $item) {
                $reconciliation->items()->create([
                    'inventory_item_id' => $item->id,
                    'system_quantity' => $item->quantity,
                ]);
            }

            $reconciliation->update(['status' => 'in_progress']);

            $this->audit->log('create', 'inventory_reconciliation', "Started reconciliation {$reconciliation->reconciliation_number}");

            return response()->json($reconciliation->load('items.inventoryItem'), 201);
        });
    }

    public function show(InventoryReconciliation $inventoryReconciliation): JsonResponse
    {
        return response()->json($inventoryReconciliation->load(['starter', 'items.inventoryItem.category']));
    }

    public function recordCounts(Request $request, InventoryReconciliation $inventoryReconciliation): JsonResponse
    {
        if ($inventoryReconciliation->status === 'completed') {
            return response()->json(['message' => 'Cannot record counts on a completed reconciliation.'], 422);
        }

        $data = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.id' => ['required', 'exists:inventory_reconciliation_items,id'],
            'items.*.physical_quantity' => ['required', 'numeric', 'min:0'],
            'items.*.notes' => ['nullable', 'string'],
        ]);

        foreach ($data['items'] as $itemData) {
            $line = $inventoryReconciliation->items()->findOrFail($itemData['id']);
            $variance = $itemData['physical_quantity'] - $line->system_quantity;
            $shortage = $variance < 0 ? abs($variance) : null;
            $overage = $variance > 0 ? $variance : null;

            $line->update([
                'physical_quantity' => $itemData['physical_quantity'],
                'variance' => $variance,
                'shortage' => $shortage,
                'overage' => $overage,
                'notes' => $itemData['notes'] ?? null,
            ]);
        }

        return response()->json($inventoryReconciliation->fresh()->load('items.inventoryItem'));
    }

    public function complete(InventoryReconciliation $inventoryReconciliation): JsonResponse
    {
        if ($inventoryReconciliation->status === 'completed') {
            return response()->json(['message' => 'Reconciliation is already completed.'], 422);
        }

        return DB::transaction(function () use ($inventoryReconciliation) {
            $userId = auth('api')->id();

            foreach ($inventoryReconciliation->items()->with('inventoryItem')->get() as $line) {
                if ($line->physical_quantity === null) {
                    continue;
                }

                $variance = (float) $line->variance;
                if ($variance == 0) {
                    continue;
                }

                $item = InventoryItem::lockForUpdate()->findOrFail($line->inventory_item_id);
                $quantityBefore = (float) $item->quantity;
                $quantityAfter = (float) $line->physical_quantity;

                InventoryAdjustment::create([
                    'adjustment_number' => $this->generateReference('ADJ-', 'inventory_adjustments', 'adjustment_number'),
                    'inventory_item_id' => $item->id,
                    'adjustment_type' => 'correction',
                    'quantity_before' => $quantityBefore,
                    'quantity_change' => $quantityAfter - $quantityBefore,
                    'quantity_after' => $quantityAfter,
                    'reason' => "Reconciliation {$inventoryReconciliation->reconciliation_number}",
                    'status' => 'approved',
                    'adjusted_by' => $userId,
                    'approved_by' => $userId,
                    'approved_at' => now(),
                ]);

                StockAdjustment::create([
                    'inventory_item_id' => $item->id,
                    'adjustment_type' => $variance > 0 ? 'increase' : 'decrease',
                    'quantity_before' => $quantityBefore,
                    'quantity_change' => $quantityAfter - $quantityBefore,
                    'quantity_after' => $quantityAfter,
                    'reason' => "Reconciliation {$inventoryReconciliation->reconciliation_number}",
                    'adjusted_by' => $userId,
                ]);

                $item->update(['quantity' => $quantityAfter, 'updated_by' => $userId]);
            }

            $inventoryReconciliation->update(['status' => 'completed', 'completed_at' => now()]);

            $this->audit->log('update', 'inventory_reconciliation', "Completed reconciliation {$inventoryReconciliation->reconciliation_number}");

            return response()->json($inventoryReconciliation->fresh()->load(['starter', 'items.inventoryItem']));
        });
    }
}
