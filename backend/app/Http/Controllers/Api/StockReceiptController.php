<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Models\StockReceipt;
use App\Services\AuditService;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class StockReceiptController extends Controller
{
    public function __construct(
        private AuditService $audit,
        private NotificationService $notifications,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $receipts = StockReceipt::with(['supplier', 'receiver', 'items.inventoryItem'])
            ->when($request->search, fn ($q, $s) => $q->where('receipt_number', 'ilike', "%{$s}%")
                ->orWhere('purchase_order_number', 'ilike', "%{$s}%"))
            ->latest()
            ->paginate($request->integer('per_page', 15));

        return response()->json($receipts);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'purchase_order_number' => ['required', 'string', 'max:50'],
            'supplier_id' => ['required', 'exists:suppliers,id'],
            'delivery_receipt_number' => ['required', 'string', 'max:50'],
            'receiving_date' => ['required', 'date'],
            'notes' => ['nullable', 'string'],
            'document' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:5120'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.inventory_item_id' => ['required', 'exists:inventory_items,id'],
            'items.*.quantity_received' => ['required', 'numeric', 'min:0.01'],
            'items.*.unit_cost' => ['required', 'numeric', 'min:0'],
            'items.*.brand' => ['nullable', 'string', 'max:100'],
            'items.*.model' => ['nullable', 'string', 'max:100'],
            'items.*.serial_number' => ['nullable', 'string', 'max:100'],
        ]);

        return DB::transaction(function () use ($request, $data) {
            $documentPath = null;
            if ($request->hasFile('document')) {
                $documentPath = $request->file('document')->store('receipts', 'local');
            }

            $receipt = StockReceipt::create([
                'receipt_number' => 'RCV-'.now()->format('Ymd').'-'.strtoupper(Str::random(4)),
                'purchase_order_number' => $data['purchase_order_number'],
                'supplier_id' => $data['supplier_id'],
                'delivery_receipt_number' => $data['delivery_receipt_number'],
                'receiving_date' => $data['receiving_date'],
                'received_by' => auth('api')->id(),
                'notes' => $data['notes'] ?? null,
                'document_path' => $documentPath,
            ]);

            foreach ($data['items'] as $itemData) {
                $receipt->items()->create($itemData);

                $item = InventoryItem::lockForUpdate()->findOrFail($itemData['inventory_item_id']);
                $item->increment('quantity', $itemData['quantity_received']);
                $inventoryUpdates = [
                    'unit_cost' => $itemData['unit_cost'],
                    'updated_by' => auth('api')->id(),
                ];
                foreach (['brand', 'model', 'serial_number'] as $field) {
                    if (! empty($itemData[$field])) {
                        $inventoryUpdates[$field] = $itemData[$field];
                    }
                }
                $item->update($inventoryUpdates);

                if ($item->fresh()->isLowStock()) {
                    $this->notifications->notifyLowStock($item);
                }
            }

            $this->audit->log('create', 'receiving', "Stock receipt {$receipt->receipt_number}", newValues: $receipt->toArray());

            return response()->json($receipt->load(['supplier', 'receiver', 'items.inventoryItem']), 201);
        });
    }

    public function show(StockReceipt $stockReceipt): JsonResponse
    {
        return response()->json($stockReceipt->load(['supplier', 'receiver', 'items.inventoryItem']));
    }
}
