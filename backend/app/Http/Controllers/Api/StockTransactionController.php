<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Batch;
use App\Models\InventoryItem;
use App\Models\StockTransaction;
use App\Services\AuditService;
use App\Services\NotificationService;
use App\Traits\GeneratesReference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StockTransactionController extends Controller
{
    use GeneratesReference;

    public function __construct(
        private AuditService $audit,
        private NotificationService $notifications,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $transactions = StockTransaction::with([
            'inventoryItem', 'batch', 'supplier', 'department',
            'recipient', 'approvingOfficer', 'performer',
        ])
            ->when($request->type, fn ($q, $t) => $q->where('type', $t))
            ->when($request->search, fn ($q, $s) => $q->where('transaction_number', 'ilike', "%{$s}%")
                ->orWhereHas('inventoryItem', fn ($q) => $q->where('name', 'ilike', "%{$s}%")))
            ->latest()
            ->paginate($request->integer('per_page', 15));

        return response()->json($transactions);
    }

    public function storeStockIn(Request $request): JsonResponse
    {
        $data = $request->validate([
            'inventory_item_id' => ['required', 'exists:inventory_items,id'],
            'quantity' => ['required', 'numeric', 'min:0.01'],
            'unit_cost' => ['nullable', 'numeric', 'min:0'],
            'supplier_id' => ['nullable', 'exists:suppliers,id'],
            'delivery_receipt_number' => ['nullable', 'string', 'max:50'],
            'purchase_order_number' => ['nullable', 'string', 'max:50'],
            'batch_id' => ['nullable', 'exists:batches,id'],
            'batch' => ['nullable', 'array'],
            'batch.batch_number' => ['required_with:batch', 'string', 'max:50'],
            'batch.lot_number' => ['nullable', 'string', 'max:50'],
            'batch.manufacturing_date' => ['nullable', 'date'],
            'batch.expiration_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string'],
        ]);

        return DB::transaction(function () use ($data) {
            $item = InventoryItem::lockForUpdate()->findOrFail($data['inventory_item_id']);
            $batchId = $data['batch_id'] ?? null;

            if (! $batchId && ! empty($data['batch'])) {
                $batch = Batch::create([
                    'inventory_item_id' => $item->id,
                    'batch_number' => $data['batch']['batch_number'],
                    'lot_number' => $data['batch']['lot_number'] ?? null,
                    'manufacturing_date' => $data['batch']['manufacturing_date'] ?? null,
                    'expiration_date' => $data['batch']['expiration_date'] ?? null,
                    'quantity' => $data['quantity'],
                ]);
                $batchId = $batch->id;
            } elseif ($batchId) {
                $batch = Batch::lockForUpdate()->findOrFail($batchId);
                $batch->increment('quantity', $data['quantity']);
            }

            $item->increment('quantity', $data['quantity']);
            if (isset($data['unit_cost'])) {
                $item->update(['unit_cost' => $data['unit_cost'], 'updated_by' => auth('api')->id()]);
            } else {
                $item->update(['updated_by' => auth('api')->id()]);
            }

            $transaction = StockTransaction::create([
                'transaction_number' => $this->generateReference('STK-IN', 'stock_transactions', 'transaction_number'),
                'type' => 'stock_in',
                'inventory_item_id' => $item->id,
                'batch_id' => $batchId,
                'quantity' => $data['quantity'],
                'unit_cost' => $data['unit_cost'] ?? $item->unit_cost,
                'supplier_id' => $data['supplier_id'] ?? null,
                'delivery_receipt_number' => $data['delivery_receipt_number'] ?? null,
                'purchase_order_number' => $data['purchase_order_number'] ?? null,
                'performed_by' => auth('api')->id(),
                'notes' => $data['notes'] ?? null,
            ]);

            if ($item->fresh()->isLowStock()) {
                $this->notifications->notifyLowStock($item);
            }

            $this->audit->log('create', 'stock_transaction', "Stock in {$transaction->transaction_number}", newValues: $transaction->toArray());
            $this->notifications->notifyStockTransaction(
                'stock_in',
                $transaction->transaction_number,
                $item->name,
                (float) $data['quantity'],
                $item->unit_of_measure,
            );

            return response()->json($transaction->load(['inventoryItem', 'batch', 'supplier', 'performer']), 201);
        });
    }

    public function storeStockOut(Request $request): JsonResponse
    {
        $data = $request->validate([
            'inventory_item_id' => ['required', 'exists:inventory_items,id'],
            'quantity' => ['required', 'numeric', 'min:0.01'],
            'department_id' => ['nullable', 'exists:departments,id'],
            'recipient_user_id' => ['nullable', 'exists:users,id'],
            'purpose' => ['nullable', 'string', 'max:1000'],
            'approving_officer_id' => ['nullable', 'exists:users,id'],
            'batch_id' => ['nullable', 'exists:batches,id'],
            'notes' => ['nullable', 'string'],
        ]);

        return DB::transaction(function () use ($data) {
            $item = InventoryItem::lockForUpdate()->findOrFail($data['inventory_item_id']);

            if ($item->quantity < $data['quantity']) {
                return response()->json([
                    'message' => "Insufficient stock for {$item->name}. Available: {$item->quantity}",
                ], 422);
            }

            if (! empty($data['batch_id'])) {
                $batch = Batch::lockForUpdate()->findOrFail($data['batch_id']);
                if ($batch->quantity < $data['quantity']) {
                    return response()->json([
                        'message' => "Insufficient batch quantity. Available: {$batch->quantity}",
                    ], 422);
                }
                $batch->decrement('quantity', $data['quantity']);
            }

            $item->decrement('quantity', $data['quantity']);
            $item->update(['updated_by' => auth('api')->id()]);

            $transaction = StockTransaction::create([
                'transaction_number' => $this->generateReference('STK-OUT', 'stock_transactions', 'transaction_number'),
                'type' => 'stock_out',
                'inventory_item_id' => $item->id,
                'batch_id' => $data['batch_id'] ?? null,
                'quantity' => $data['quantity'],
                'unit_cost' => $item->unit_cost,
                'department_id' => $data['department_id'] ?? null,
                'recipient_user_id' => $data['recipient_user_id'] ?? null,
                'purpose' => $data['purpose'] ?? null,
                'approving_officer_id' => $data['approving_officer_id'] ?? null,
                'performed_by' => auth('api')->id(),
                'notes' => $data['notes'] ?? null,
            ]);

            if ($item->fresh()->isLowStock()) {
                $this->notifications->notifyLowStock($item);
            }

            $this->audit->log('create', 'stock_transaction', "Stock out {$transaction->transaction_number}", newValues: $transaction->toArray());
            $this->notifications->notifyStockTransaction(
                'stock_out',
                $transaction->transaction_number,
                $item->name,
                (float) $data['quantity'],
                $item->unit_of_measure,
            );

            return response()->json($transaction->load(['inventoryItem', 'batch', 'department', 'recipient', 'performer']), 201);
        });
    }

    public function replenishmentRecommendations(): JsonResponse
    {
        $items = InventoryItem::with('category')
            ->where('status', 'available')
            ->whereColumn('quantity', '<=', 'reorder_level')
            ->orderBy('quantity')
            ->get()
            ->map(fn ($item) => [
                'id' => $item->id,
                'item_code' => $item->item_code,
                'name' => $item->name,
                'category' => $item->category?->name,
                'quantity' => (float) $item->quantity,
                'reorder_level' => (float) $item->reorder_level,
                'recommended_qty' => max((float) $item->reorder_level * 2 - (float) $item->quantity, (float) $item->reorder_level),
                'unit_cost' => (float) $item->unit_cost,
                'estimated_cost' => max((float) $item->reorder_level * 2 - (float) $item->quantity, (float) $item->reorder_level) * (float) $item->unit_cost,
                'supplier_id' => $item->supplier_id,
            ]);

        return response()->json(['data' => $items]);
    }
}
