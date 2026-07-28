<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\DeliveryReceipt;
use App\Models\InventoryItem;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\StockReceipt;
use App\Models\StockTransaction;
use App\Models\Supplier;
use App\Services\AuditService;
use App\Services\NotificationService;
use App\Traits\GeneratesReference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class DeliveryReceiptController extends Controller
{
    use GeneratesReference;

    public function __construct(
        private AuditService $audit,
        private NotificationService $notifications,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $receipts = DeliveryReceipt::with(['purchaseOrder.supplier', 'stockReceipt', 'receiver'])
            ->when($request->purchase_order_id, fn ($q, $id) => $q->where('purchase_order_id', $id))
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->when($request->supplier_id, fn ($q, $id) => $q->whereHas('purchaseOrder', fn ($q) => $q->where('supplier_id', $id)))
            ->when($request->search, fn ($q, $s) => $q->where(function ($q) use ($s) {
                $q->where('dr_number', 'ilike', "%{$s}%")
                    ->orWhere('po_number', 'ilike', "%{$s}%")
                    ->orWhereHas('purchaseOrder', function ($q) use ($s) {
                        $q->where('po_number', 'ilike', "%{$s}%")
                            ->orWhereHas('supplier', fn ($q) => $q->where('name', 'ilike', "%{$s}%"));
                    });
            }))
            ->latest('delivery_date')
            ->paginate($request->integer('per_page', 15));

        return response()->json($receipts);
    }

    public function store(Request $request): JsonResponse
    {
        if ($request->boolean('save_as_draft')) {
            return $this->saveDraft($request);
        }

        return $this->completeDelivery($request);
    }

    public function update(Request $request, DeliveryReceipt $deliveryReceipt): JsonResponse
    {
        if ($deliveryReceipt->status !== 'draft') {
            return response()->json(['message' => 'Only draft delivery receipts can be updated.'], 422);
        }

        if ($request->boolean('save_as_draft')) {
            return $this->saveDraft($request, $deliveryReceipt);
        }

        return $this->completeDelivery($request, $deliveryReceipt);
    }

    public function finalize(Request $request, DeliveryReceipt $deliveryReceipt): JsonResponse
    {
        if ($deliveryReceipt->status !== 'draft') {
            return response()->json(['message' => 'Only draft delivery receipts can be finalized.'], 422);
        }

        return $this->completeDelivery($request, $deliveryReceipt);
    }

    public function show(DeliveryReceipt $deliveryReceipt): JsonResponse
    {
        return response()->json($deliveryReceipt->load([
            'purchaseOrder.supplier', 'purchaseOrder.items.inventoryItem',
            'stockReceipt.items.inventoryItem', 'receiver',
        ]));
    }

    public function importSpreadsheet(Request $request): JsonResponse
    {
        $data = $request->validate([
            'purchase_order_id' => ['nullable', 'exists:purchase_orders,id'],
            'po_number' => ['required_without:purchase_order_id', 'nullable', 'string', 'max:100'],
            'delivery_date' => ['required', 'date'],
            'supplier_reference_number' => ['nullable', 'string', 'max:100'],
            'supplier_name' => ['nullable', 'string', 'max:255'],
            'delivery_location' => ['nullable', 'string', 'max:255'],
            'inspector_name' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
            'abc_amount' => ['nullable', 'numeric', 'min:0'],
            'amount' => ['nullable', 'numeric', 'min:0'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.description' => ['required', 'string', 'max:500'],
            'items.*.unit_of_measure' => ['nullable', 'string', 'max:30'],
            'items.*.quantity_received' => ['required', 'numeric', 'min:0.01'],
            'items.*.quantity_ordered' => ['nullable', 'numeric', 'min:0'],
            'items.*.unit_cost' => ['nullable', 'numeric', 'min:0'],
        ]);

        $poQuery = PurchaseOrder::with(['supplier', 'purchaseRequest.department', 'items']);
        $po = null;
        if (! empty($data['purchase_order_id'])) {
            $po = $poQuery->find($data['purchase_order_id']);
        } elseif (! empty($data['po_number'])) {
            $po = $poQuery->where('po_number', $data['po_number'])->first();
        }

        $poNumber = trim((string) ($data['po_number'] ?? $po?->po_number ?? ''));
        if (! $po && $poNumber === '') {
            return response()->json(['message' => 'PO number is required for delivery receipt import.'], 422);
        }

        if ($po && ! in_array($po->status, ['draft', 'issued', 'partial', 'fulfilled'], true)) {
            return response()->json(['message' => 'Purchase order is not available for delivery receipt import.'], 422);
        }

        if ($po?->status === 'draft') {
            $po->update([
                'status' => 'issued',
                'issued_by' => auth('api')->id(),
                'issued_date' => $data['delivery_date'],
            ]);
            $po->refresh();
        }

        $draftPayload = [
            'supplier_reference_number' => $data['supplier_reference_number'] ?? null,
            'supplier_name' => $data['supplier_name'] ?? $po?->supplier?->name ?? null,
            'delivery_location' => $data['delivery_location'] ?? $po?->delivery_location ?? 'GSO Main Warehouse',
            'delivery_condition' => 'complete',
            'inspector_name' => $data['inspector_name'] ?? null,
            'notes' => $data['notes'] ?? 'Imported from spreadsheet',
            'trigger_stock_in' => false,
            'abc_amount' => $data['abc_amount'] ?? null,
            'amount' => $data['amount'] ?? null,
            'items' => collect($data['items'])
                ->reject(fn ($item) => $this->isSummaryImportRow($item))
                ->map(function ($item) use ($po) {
                $poItem = $po?->items->first(fn ($line) => strcasecmp($line->description, $item['description']) === 0);

                return [
                    'description' => $item['description'],
                    'unit_of_measure' => $item['unit_of_measure'] ?? $poItem?->unit_of_measure ?? 'unit',
                    'quantity_ordered' => $item['quantity_ordered'] ?? $poItem?->quantity_ordered ?? $item['quantity_received'],
                    'quantity_received' => $item['quantity_received'],
                    'unit_cost' => $item['unit_cost'] ?? $poItem?->unit_cost ?? 0,
                    'po_item_id' => $poItem?->id,
                    'inventory_item_id' => $poItem?->inventory_item_id,
                ];
            })->values()->all(),
        ];

        $deliveryReceipt = DeliveryReceipt::create([
            'dr_number' => $this->generateReference('DR-', 'delivery_receipts', 'dr_number'),
            'purchase_order_id' => $po?->id,
            'po_number' => $poNumber,
            'delivery_date' => $data['delivery_date'],
            'supplier_reference_number' => $data['supplier_reference_number'] ?? null,
            'delivery_location' => $data['delivery_location'] ?? $po?->delivery_location ?? 'GSO Main Warehouse',
            'delivery_condition' => 'complete',
            'received_by' => auth('api')->id(),
            'inspector_name' => $data['inspector_name'] ?? null,
            'notes' => $data['notes'] ?? 'Imported from spreadsheet',
            'status' => 'completed',
            'draft_items' => $draftPayload,
        ]);

        $this->audit->log('create', 'delivery_receipt', "Imported DR {$deliveryReceipt->dr_number} from spreadsheet");

        return response()->json($deliveryReceipt->load([
            'purchaseOrder.supplier',
            'purchaseOrder.purchaseRequest.department',
            'purchaseOrder.items',
            'receiver',
        ]), 201);
    }

    private function saveDraft(Request $request, ?DeliveryReceipt $deliveryReceipt = null): JsonResponse
    {
        $data = $request->validate([
            'purchase_order_id' => ['nullable', 'exists:purchase_orders,id'],
            'po_number' => ['required_without:purchase_order_id', 'nullable', 'string', 'max:100'],
            'supplier_name' => ['nullable', 'string', 'max:255'],
            'pr_reference' => ['nullable', 'string', 'max:100'],
            'delivery_date' => ['nullable', 'date'],
            'supplier_reference_number' => ['nullable', 'string', 'max:100'],
            'delivery_location' => ['nullable', 'string', 'max:255'],
            'delivery_condition' => ['nullable', 'string', 'in:complete,partial,with_discrepancy'],
            'inspector_name' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
            'trigger_stock_in' => ['nullable', 'boolean'],
            'items' => ['nullable', 'array'],
            'items.*.inventory_item_id' => ['nullable', 'integer', 'exists:inventory_items,id'],
            'items.*.po_item_id' => ['nullable', 'integer', 'exists:purchase_order_items,id'],
            'items.*.quantity_received' => ['nullable', 'numeric', 'min:0'],
            'items.*.unit_cost' => ['nullable', 'numeric', 'min:0'],
            'items.*.brand' => ['nullable', 'string', 'max:100'],
            'items.*.model' => ['nullable', 'string', 'max:100'],
            'items.*.serial_number' => ['nullable', 'string', 'max:100'],
            'items.*.serial_numbers' => ['nullable', 'array'],
            'items.*.serial_numbers.*' => ['nullable', 'string', 'max:100'],
            'items.*.description' => ['nullable', 'string', 'max:255'],
            'items.*.unit_of_measure' => ['nullable', 'string', 'max:30'],
            'items.*.quantity_ordered' => ['nullable', 'numeric', 'min:0'],
            'items.*.quantity_received_prior' => ['nullable', 'numeric', 'min:0'],
        ]);

        $poNumber = trim((string) ($data['po_number'] ?? ''));
        if (! empty($data['purchase_order_id'])) {
            $poNumber = $poNumber !== ''
                ? $poNumber
                : (PurchaseOrder::whereKey($data['purchase_order_id'])->value('po_number') ?? '');
        }

        $draftPayload = [
            'supplier_reference_number' => $data['supplier_reference_number'] ?? null,
            'supplier_name' => $data['supplier_name'] ?? null,
            'pr_reference' => $data['pr_reference'] ?? null,
            'delivery_location' => $data['delivery_location'] ?? null,
            'delivery_condition' => $data['delivery_condition'] ?? 'complete',
            'inspector_name' => $data['inspector_name'] ?? null,
            'notes' => $data['notes'] ?? null,
            'trigger_stock_in' => $request->boolean('trigger_stock_in', true),
            'items' => $data['items'] ?? [],
        ];

        $attributes = [
            'purchase_order_id' => $data['purchase_order_id'] ?? null,
            'po_number' => $poNumber !== '' ? $poNumber : null,
            'delivery_date' => $data['delivery_date'] ?? now()->toDateString(),
            'supplier_reference_number' => $data['supplier_reference_number'] ?? null,
            'delivery_location' => $data['delivery_location'] ?? null,
            'delivery_condition' => $data['delivery_condition'] ?? 'complete',
            'received_by' => auth('api')->id(),
            'inspector_name' => $data['inspector_name'] ?? null,
            'notes' => $data['notes'] ?? null,
            'status' => 'draft',
            'draft_items' => $draftPayload,
        ];

        if ($deliveryReceipt) {
            $deliveryReceipt->update($attributes);
            $this->audit->log('update', 'delivery_receipt', "Updated draft DR {$deliveryReceipt->dr_number}");

            return response()->json($deliveryReceipt->fresh()->load([
                'purchaseOrder.supplier', 'purchaseOrder.items', 'receiver',
            ]));
        }

        $deliveryReceipt = DeliveryReceipt::create([
            'dr_number' => $this->generateReference('DR-', 'delivery_receipts', 'dr_number'),
            ...$attributes,
        ]);

        $this->audit->log('create', 'delivery_receipt', "Saved draft DR {$deliveryReceipt->dr_number}");

        return response()->json($deliveryReceipt->load([
            'purchaseOrder.supplier', 'purchaseOrder.items', 'receiver',
        ]), 201);
    }

    private function completeDelivery(Request $request, ?DeliveryReceipt $deliveryReceipt = null): JsonResponse
    {
        $data = $request->validate([
            'purchase_order_id' => ['nullable', 'exists:purchase_orders,id'],
            'po_number' => ['required_without:purchase_order_id', 'nullable', 'string', 'max:100'],
            'supplier_name' => ['nullable', 'string', 'max:255'],
            'pr_reference' => ['nullable', 'string', 'max:100'],
            'delivery_date' => ['required', 'date'],
            'supplier_reference_number' => ['nullable', 'string', 'max:100'],
            'delivery_location' => ['nullable', 'string', 'max:255'],
            'delivery_condition' => ['nullable', 'string', 'in:complete,partial,with_discrepancy'],
            'inspector_name' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
            'trigger_stock_in' => ['nullable', 'boolean'],
            'items' => ['required_if:trigger_stock_in,true', 'array', 'min:1'],
            'items.*.inventory_item_id' => ['nullable', 'integer', 'exists:inventory_items,id'],
            'items.*.po_item_id' => ['nullable', 'integer', 'exists:purchase_order_items,id'],
            'items.*.description' => ['nullable', 'string', 'max:500'],
            'items.*.unit_of_measure' => ['nullable', 'string', 'max:30'],
            'items.*.quantity_received' => ['required_with:items', 'numeric', 'min:0.01'],
            'items.*.unit_cost' => ['nullable', 'numeric', 'min:0'],
            'items.*.brand' => ['nullable', 'string', 'max:100'],
            'items.*.model' => ['nullable', 'string', 'max:100'],
            'items.*.serial_number' => ['nullable', 'string', 'max:100'],
            'items.*.serial_numbers' => ['nullable', 'array'],
            'items.*.serial_numbers.*' => ['nullable', 'string', 'max:100'],
        ]);

        if (empty($data['purchase_order_id'])) {
            return $this->completeStandaloneDelivery($request, $data, $deliveryReceipt);
        }

        return DB::transaction(function () use ($request, $data, $deliveryReceipt) {
            $po = PurchaseOrder::with(['items', 'supplier', 'purchaseRequest'])->findOrFail($data['purchase_order_id']);

            if (! in_array($po->status, ['draft', 'issued', 'partial'])) {
                return response()->json(['message' => 'Delivery receipt requires an open purchase order.'], 422);
            }

            if ($po->status === 'draft') {
                $po->update([
                    'status' => 'issued',
                    'issued_by' => auth('api')->id(),
                    'issued_date' => $data['delivery_date'],
                ]);
                $po->refresh();
            }

            $isNew = $deliveryReceipt === null;

            $attributes = [
                'purchase_order_id' => $po->id,
                'po_number' => $po->po_number,
                'delivery_date' => $data['delivery_date'],
                'supplier_reference_number' => $data['supplier_reference_number'] ?? null,
                'delivery_location' => $data['delivery_location'] ?? $po->delivery_location,
                'delivery_condition' => $data['delivery_condition'] ?? 'complete',
                'received_by' => auth('api')->id(),
                'inspector_name' => $data['inspector_name'] ?? null,
                'notes' => $data['notes'] ?? null,
                'status' => 'completed',
                'draft_items' => null,
            ];

            if ($deliveryReceipt) {
                $deliveryReceipt->update($attributes);
            } else {
                $deliveryReceipt = DeliveryReceipt::create([
                    'dr_number' => $this->generateReference('DR-', 'delivery_receipts', 'dr_number'),
                    ...$attributes,
                ]);
            }

            if ($request->boolean('trigger_stock_in', true) && ! empty($data['items'])) {
                $data['items'] = $this->expandDeliveryItems($data['items']);
                $data['items'] = array_values(array_filter(
                    $data['items'],
                    fn ($item) => ! empty($item['quantity_received']) && (float) $item['quantity_received'] > 0,
                ));

                if (empty($data['items'])) {
                    return response()->json(['message' => 'Enter quantity received for at least one item.'], 422);
                }

                foreach ($data['items'] as $key => $itemData) {
                    $poItem = $this->findPoItem($po, $itemData);

                    if (empty($itemData['inventory_item_id']) && ! $poItem) {
                        return response()->json([
                            'message' => 'Could not match a purchase order line for one of the received items.',
                        ], 422);
                    }

                    if (empty($itemData['unit_cost']) && $poItem) {
                        $data['items'][$key]['unit_cost'] = $poItem->unit_cost;
                    }

                    try {
                        $data['items'][$key]['inventory_item_id'] = $this->resolveInventoryItemId($po, $itemData, $poItem);
                    } catch (\InvalidArgumentException $e) {
                        return response()->json(['message' => $e->getMessage()], 422);
                    }

                    if (empty($data['items'][$key]['unit_cost'])) {
                        return response()->json(['message' => 'Unit cost could not be determined from the purchase order.'], 422);
                    }
                }

                $stockReceipt = StockReceipt::create([
                    'receipt_number' => 'RCV-'.now()->format('Ymd').'-'.strtoupper(Str::random(4)),
                    'purchase_order_number' => $po->po_number,
                    'purchase_order_id' => $po->id,
                    'supplier_id' => $po->supplier_id,
                    'delivery_receipt_number' => $deliveryReceipt->dr_number,
                    'receiving_date' => $data['delivery_date'],
                    'received_by' => auth('api')->id(),
                    'notes' => $data['notes'] ?? null,
                ]);

                foreach ($data['items'] as $itemData) {
                    $stockReceipt->items()->create($itemData);

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

                    StockTransaction::create([
                        'transaction_number' => $this->generateReference('STK-IN', 'stock_transactions', 'transaction_number'),
                        'type' => 'stock_in',
                        'inventory_item_id' => $item->id,
                        'quantity' => $itemData['quantity_received'],
                        'unit_cost' => $itemData['unit_cost'],
                        'supplier_id' => $po->supplier_id,
                        'delivery_receipt_number' => $deliveryReceipt->dr_number,
                        'purchase_order_number' => $po->po_number,
                        'performed_by' => auth('api')->id(),
                        'stock_receipt_id' => $stockReceipt->id,
                    ]);

                    $poItem = $this->findPoItem($po, $itemData) ?? $po->items()->where('inventory_item_id', $itemData['inventory_item_id'])->first();
                    if ($poItem) {
                        $poItem->increment('quantity_received', $itemData['quantity_received']);
                    }

                    if ($item->fresh()->isLowStock()) {
                        $this->notifications->notifyLowStock($item);
                    }
                }

                $deliveryReceipt->update(['stock_receipt_id' => $stockReceipt->id]);

                $allFulfilled = $po->items->every(fn ($item) => $item->fresh()->quantity_received >= $item->quantity_ordered);
                $po->update(['status' => $allFulfilled ? 'fulfilled' : 'partial']);

                $this->audit->log('create', 'receiving', "Stock receipt from DR {$deliveryReceipt->dr_number}");
            }

            $action = $isNew ? 'Created' : 'Finalized';
            $this->audit->log('update', 'delivery_receipt', "{$action} DR {$deliveryReceipt->dr_number}", newValues: $deliveryReceipt->fresh()->toArray());

            return response()->json($deliveryReceipt->load([
                'purchaseOrder.supplier', 'purchaseOrder.items', 'stockReceipt.items.inventoryItem', 'receiver',
            ]), $isNew ? 201 : 200);
        });
    }

    private function completeStandaloneDelivery(Request $request, array $data, ?DeliveryReceipt $deliveryReceipt = null): JsonResponse
    {
        $poNumber = trim((string) ($data['po_number'] ?? ''));
        if ($poNumber === '') {
            return response()->json(['message' => 'PO reference is required.'], 422);
        }

        return DB::transaction(function () use ($request, $data, $deliveryReceipt, $poNumber) {
            $isNew = $deliveryReceipt === null;
            $triggerStockIn = $request->boolean('trigger_stock_in', true);
            $supplierId = $this->resolveSupplierId($data['supplier_name'] ?? null);
            $deliveryLocation = $data['delivery_location'] ?? 'GSO Main Warehouse';

            $draftItemsPayload = [
                'supplier_reference_number' => $data['supplier_reference_number'] ?? null,
                'supplier_name' => $data['supplier_name'] ?? null,
                'pr_reference' => $data['pr_reference'] ?? null,
                'delivery_location' => $deliveryLocation,
                'delivery_condition' => $data['delivery_condition'] ?? 'complete',
                'inspector_name' => $data['inspector_name'] ?? null,
                'notes' => $data['notes'] ?? null,
                'trigger_stock_in' => $triggerStockIn,
                'items' => $data['items'] ?? [],
            ];

            $attributes = [
                'purchase_order_id' => null,
                'po_number' => $poNumber,
                'delivery_date' => $data['delivery_date'],
                'supplier_reference_number' => $data['supplier_reference_number'] ?? null,
                'delivery_location' => $deliveryLocation,
                'delivery_condition' => $data['delivery_condition'] ?? 'complete',
                'received_by' => auth('api')->id(),
                'inspector_name' => $data['inspector_name'] ?? null,
                'notes' => $data['notes'] ?? null,
                'status' => 'completed',
                'draft_items' => $triggerStockIn ? null : $draftItemsPayload,
            ];

            if ($deliveryReceipt) {
                $deliveryReceipt->update($attributes);
            } else {
                $deliveryReceipt = DeliveryReceipt::create([
                    'dr_number' => $this->generateReference('DR-', 'delivery_receipts', 'dr_number'),
                    ...$attributes,
                ]);
            }

            if ($triggerStockIn && ! empty($data['items'])) {
                $data['items'] = $this->expandDeliveryItems($data['items']);
                $data['items'] = array_values(array_filter(
                    $data['items'],
                    fn ($item) => ! empty($item['quantity_received']) && (float) $item['quantity_received'] > 0,
                ));

                if (empty($data['items'])) {
                    return response()->json(['message' => 'Enter quantity received for at least one item.'], 422);
                }

                foreach ($data['items'] as $key => $itemData) {
                    if (empty(trim((string) ($itemData['description'] ?? '')))) {
                        return response()->json(['message' => 'Each received item must have a description.'], 422);
                    }

                    if (! array_key_exists('unit_cost', $itemData) || $itemData['unit_cost'] === '' || $itemData['unit_cost'] === null) {
                        return response()->json(['message' => 'Unit cost is required for each received item.'], 422);
                    }

                    try {
                        $data['items'][$key]['inventory_item_id'] = $this->resolveInventoryItemIdStandalone(
                            $itemData,
                            $supplierId,
                            $deliveryLocation,
                        );
                    } catch (\InvalidArgumentException $e) {
                        return response()->json(['message' => $e->getMessage()], 422);
                    }
                }

                $stockReceipt = StockReceipt::create([
                    'receipt_number' => 'RCV-'.now()->format('Ymd').'-'.strtoupper(Str::random(4)),
                    'purchase_order_number' => $poNumber,
                    'purchase_order_id' => null,
                    'supplier_id' => $supplierId,
                    'delivery_receipt_number' => $deliveryReceipt->dr_number,
                    'receiving_date' => $data['delivery_date'],
                    'received_by' => auth('api')->id(),
                    'notes' => $data['notes'] ?? null,
                ]);

                foreach ($data['items'] as $itemData) {
                    $stockReceipt->items()->create($itemData);

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

                    StockTransaction::create([
                        'transaction_number' => $this->generateReference('STK-IN', 'stock_transactions', 'transaction_number'),
                        'type' => 'stock_in',
                        'inventory_item_id' => $item->id,
                        'quantity' => $itemData['quantity_received'],
                        'unit_cost' => $itemData['unit_cost'],
                        'supplier_id' => $supplierId,
                        'delivery_receipt_number' => $deliveryReceipt->dr_number,
                        'purchase_order_number' => $poNumber,
                        'performed_by' => auth('api')->id(),
                        'stock_receipt_id' => $stockReceipt->id,
                    ]);

                    if ($item->fresh()->isLowStock()) {
                        $this->notifications->notifyLowStock($item);
                    }
                }

                $deliveryReceipt->update(['stock_receipt_id' => $stockReceipt->id]);

                $this->audit->log('create', 'receiving', "Stock receipt from DR {$deliveryReceipt->dr_number}");
            }

            $action = $isNew ? 'Created' : 'Finalized';
            $this->audit->log('update', 'delivery_receipt', "{$action} DR {$deliveryReceipt->dr_number}", newValues: $deliveryReceipt->fresh()->toArray());

            return response()->json($deliveryReceipt->load([
                'stockReceipt.items.inventoryItem', 'receiver',
            ]), $isNew ? 201 : 200);
        });
    }

    private function findPoItem(PurchaseOrder $po, array $itemData): ?PurchaseOrderItem
    {
        if (! empty($itemData['po_item_id'])) {
            $item = $po->items->firstWhere('id', $itemData['po_item_id']);
            if ($item) {
                return $item;
            }
        }

        if (! empty($itemData['inventory_item_id'])) {
            $item = $po->items->firstWhere('inventory_item_id', $itemData['inventory_item_id']);
            if ($item) {
                return $item;
            }
        }

        if (! empty($itemData['description'])) {
            return $po->items->firstWhere('description', $itemData['description']);
        }

        return null;
    }

    private function expandDeliveryItems(array $items): array
    {
        $expanded = [];

        foreach ($items as $itemData) {
            $serials = $itemData['serial_numbers'] ?? null;
            $qty = (int) floor((float) ($itemData['quantity_received'] ?? 0));
            $unit = $itemData['unit_of_measure'] ?? null;

            if (is_array($serials) && $qty > 0 && count($serials) > 0 && $this->unitUsesIndividualSerialNumbers($unit)) {
                for ($i = 0; $i < $qty; $i++) {
                    $row = $itemData;
                    unset($row['serial_numbers']);
                    $row['quantity_received'] = 1;
                    $row['serial_number'] = trim((string) ($serials[$i] ?? '')) ?: null;
                    $expanded[] = $row;
                }

                continue;
            }

            if (is_array($serials) && count($serials) > 0) {
                unset($itemData['serial_numbers']);
                $itemData['serial_number'] = trim((string) ($serials[0] ?? '')) ?: null;
            } else {
                unset($itemData['serial_numbers']);
            }

            $expanded[] = $itemData;
        }

        return $expanded;
    }

    private function unitUsesIndividualSerialNumbers(?string $unit): bool
    {
        $u = strtolower(trim($unit ?? ''));
        if ($u === '') {
            return true;
        }

        $bulkUnits = ['liter', 'liters', 'ml', 'gallon', 'gal', 'gals', 'kg', 'lot'];

        return ! in_array($u, $bulkUnits, true);
    }

    private function resolveInventoryItemId(PurchaseOrder $po, array $itemData, ?PurchaseOrderItem $poItem): int
    {
        if (! empty($itemData['inventory_item_id'])) {
            return (int) $itemData['inventory_item_id'];
        }

        $serialNumber = ! empty($itemData['serial_number']) ? trim((string) $itemData['serial_number']) : null;

        if ($serialNumber) {
            $bySerial = InventoryItem::where('serial_number', $serialNumber)->first();
            if ($bySerial) {
                return $bySerial->id;
            }

            return $this->createInventoryItemFromDelivery(
                $itemData,
                $poItem,
                $po->supplier_id,
                $po->delivery_location ?? 'GSO Main Warehouse',
                $serialNumber,
            );
        }

        if ($poItem?->inventory_item_id) {
            return (int) $poItem->inventory_item_id;
        }

        $name = $poItem?->description ?? ($itemData['description'] ?? null);
        if (! $name) {
            throw new \InvalidArgumentException('Received item is missing a description.');
        }

        $existing = InventoryItem::whereRaw('LOWER(name) = ?', [strtolower($name)])->first();
        if ($existing) {
            $poItem?->update(['inventory_item_id' => $existing->id]);

            return $existing->id;
        }

        return $this->createInventoryItemFromDelivery(
            $itemData,
            $poItem,
            $po->supplier_id,
            $po->delivery_location ?? 'GSO Main Warehouse',
            null,
            $name,
        );
    }

    private function resolveInventoryItemIdStandalone(array $itemData, ?int $supplierId, string $deliveryLocation): int
    {
        if (! empty($itemData['inventory_item_id'])) {
            return (int) $itemData['inventory_item_id'];
        }

        $serialNumber = ! empty($itemData['serial_number']) ? trim((string) $itemData['serial_number']) : null;

        if ($serialNumber) {
            $bySerial = InventoryItem::where('serial_number', $serialNumber)->first();
            if ($bySerial) {
                return $bySerial->id;
            }

            return $this->createInventoryItemFromDelivery(
                $itemData,
                null,
                $supplierId,
                $deliveryLocation,
                $serialNumber,
            );
        }

        $name = $itemData['description'] ?? null;
        if (! $name) {
            throw new \InvalidArgumentException('Received item is missing a description.');
        }

        $existing = InventoryItem::whereRaw('LOWER(name) = ?', [strtolower($name)])->first();
        if ($existing) {
            return $existing->id;
        }

        return $this->createInventoryItemFromDelivery(
            $itemData,
            null,
            $supplierId,
            $deliveryLocation,
            null,
            $name,
        );
    }

    private function resolveSupplierId(?string $name): ?int
    {
        $name = trim((string) ($name ?? ''));
        if ($name === '') {
            return null;
        }

        return Supplier::whereRaw('LOWER(name) = ?', [strtolower($name)])->value('id');
    }

    private function createInventoryItemFromDelivery(
        array $itemData,
        ?PurchaseOrderItem $poItem = null,
        ?int $supplierId = null,
        ?string $storageLocation = null,
        ?string $serialNumber = null,
        ?string $name = null,
    ): int {
        $name ??= $poItem?->description ?? ($itemData['description'] ?? null);
        if (! $name) {
            throw new \InvalidArgumentException('Received item is missing a description.');
        }

        $categoryId = Category::where('is_active', true)->value('id') ?? Category::query()->value('id');
        if (! $categoryId) {
            throw new \InvalidArgumentException('No inventory category is configured. Add a category before receiving stock.');
        }

        $hasSerial = ! empty($serialNumber);

        $item = InventoryItem::create([
            'item_code' => $this->generateItemCodeFromDescription($name, $serialNumber),
            'name' => $name,
            'description' => $name,
            'category_id' => $categoryId,
            'unit_of_measure' => $poItem?->unit_of_measure ?? $itemData['unit_of_measure'] ?? 'unit',
            'quantity' => 0,
            'reorder_level' => 0,
            'unit_cost' => $poItem?->unit_cost ?? $itemData['unit_cost'] ?? 0,
            'supplier_id' => $supplierId,
            'storage_location' => $storageLocation ?? 'GSO Main Warehouse',
            'date_acquired' => now()->toDateString(),
            'condition' => 'good',
            'status' => 'available',
            'is_asset' => $hasSerial,
            'is_consumable' => ! $hasSerial,
            'serial_number' => $serialNumber,
            'brand' => $itemData['brand'] ?? null,
            'model' => $itemData['model'] ?? null,
            'created_by' => auth('api')->id(),
            'updated_by' => auth('api')->id(),
        ]);

        $item->categories()->sync([$categoryId]);

        if (! $hasSerial) {
            $poItem?->update(['inventory_item_id' => $item->id]);
        }

        return $item->id;
    }

    private function generateItemCodeFromDescription(string $description, ?string $serialNumber = null): string
    {
        $base = strtoupper(preg_replace('/[^A-Za-z0-9]+/', '-', trim($description)) ?: 'ITEM');
        $base = trim($base, '-');
        $base = Str::limit($base, 16, '');

        if ($serialNumber) {
            $serialSuffix = strtoupper(preg_replace('/[^A-Za-z0-9]+/', '', $serialNumber) ?: '');
            $serialSuffix = Str::limit($serialSuffix, 8, '');
            if ($serialSuffix !== '') {
                $base = Str::limit($base.'-'.$serialSuffix, 24, '');
            }
        }

        $code = $base;
        $suffix = 1;
        while (InventoryItem::where('item_code', $code)->exists()) {
            $code = Str::limit($base, 20, '').'-'.$suffix++;
        }

        return $code;
    }

    private function isSummaryImportRow(array $item): bool
    {
        $unit = strtolower(trim((string) ($item['unit_of_measure'] ?? '')));
        $desc = trim((string) ($item['description'] ?? ''));

        if (preg_match('/^(abc|amount)\b/i', $unit)) {
            return true;
        }

        if (preg_match('/^(abc|amount)\b/i', $desc)) {
            return true;
        }

        if (preg_match('/^amount\b/i', $unit) && is_numeric(str_replace([',', ' '], '', $desc))) {
            return true;
        }

        if (preg_match('/^abc\b/i', $unit) && is_numeric(str_replace([',', ' '], '', $desc))) {
            return true;
        }

        return false;
    }
}
