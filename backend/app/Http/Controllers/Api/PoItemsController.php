<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PurchaseOrder;
use App\Models\ReceivedItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PoItemsController extends Controller
{
    public function lookup(Request $request): JsonResponse
    {
        $data = $request->validate([
            'po_number' => ['required', 'string', 'max:100'],
        ]);

        $q = trim((string) $data['po_number']);
        if ($q === '') {
            return response()->json(['message' => 'PO number is required.'], 422);
        }

        $purchaseOrder = PurchaseOrder::query()
            ->with([
                'supplier:id,name',
                'items:id,purchase_order_id,inventory_item_id,description,unit_of_measure,quantity_ordered,quantity_received,unit_cost',
                'items.inventoryItem:id,name,item_code,property_number,unit_of_measure',
                'purchaseRequest:id,department_id',
                'purchaseRequest.department:id,name',
            ])
            ->whereRaw('LOWER(po_number) = ?', [mb_strtolower($q)])
            ->first();

        if (! $purchaseOrder) {
            $purchaseOrder = PurchaseOrder::query()
                ->with([
                    'supplier:id,name',
                    'items:id,purchase_order_id,inventory_item_id,description,unit_of_measure,quantity_ordered,quantity_received,unit_cost',
                    'items.inventoryItem:id,name,item_code,property_number,unit_of_measure',
                    'purchaseRequest:id,department_id',
                    'purchaseRequest.department:id,name',
                ])
                ->where('po_number', 'ilike', "%{$q}%")
                ->orderByDesc('id')
                ->first();
        }

        $poNumber = $purchaseOrder?->po_number ?? $q;

        $receivedItems = ReceivedItem::query()
            ->select([
                'id',
                'air_number',
                'dr_number',
                'po_number',
                'line_number',
                'description',
                'unit_of_measure',
                'quantity_ordered',
                'quantity_delivered',
                'quantity_accepted',
                'quantity_on_hand',
                'unit_cost',
                'total_cost',
                'supplier_name',
                'requisitioning_office',
                'storage_location',
                'acceptance_date',
                'status',
            ])
            ->where(function ($builder) use ($q, $purchaseOrder, $poNumber) {
                $builder->whereRaw('LOWER(po_number) = ?', [mb_strtolower($poNumber)]);

                if (strcasecmp((string) $poNumber, $q) !== 0) {
                    $builder->orWhereRaw('LOWER(po_number) = ?', [mb_strtolower($q)]);
                }

                if ($purchaseOrder) {
                    $builder->orWhereHas(
                        'acceptanceInspectionReport',
                        fn ($air) => $air->where('purchase_order_id', $purchaseOrder->id)
                    );
                }
            })
            ->orderBy('air_number')
            ->orderBy('line_number')
            ->limit(2000)
            ->get()
            ->map(fn (ReceivedItem $item) => [
                'id' => $item->id,
                'air_number' => $item->air_number,
                'dr_number' => $item->dr_number,
                'po_number' => $item->po_number,
                'line_number' => $item->line_number,
                'description' => $item->description,
                'unit_of_measure' => $item->unit_of_measure,
                'quantity_ordered' => $item->quantity_ordered,
                'quantity_delivered' => $item->quantity_delivered,
                'quantity_accepted' => $item->quantity_accepted,
                'quantity_on_hand' => $item->quantity_on_hand,
                'unit_cost' => $item->unit_cost,
                'total_cost' => $item->total_cost,
                'supplier_name' => $item->supplier_name,
                'requisitioning_office' => $item->requisitioning_office,
                'storage_location' => $item->storage_location,
                'acceptance_date' => $item->acceptance_date,
                'status' => $item->status,
            ])
            ->values();

        $orderedItems = ($purchaseOrder?->items ?? collect())->map(function ($item) {
            return [
                'id' => $item->id,
                'source' => 'purchase_order',
                'description' => $item->description ?: $item->inventoryItem?->name,
                'unit_of_measure' => $item->unit_of_measure ?: $item->inventoryItem?->unit_of_measure,
                'quantity_ordered' => $item->quantity_ordered,
                'quantity_received' => $item->quantity_received,
                'unit_cost' => $item->unit_cost,
                'total_cost' => (float) $item->quantity_ordered * (float) $item->unit_cost,
                'item_code' => $item->inventoryItem?->item_code,
                'property_number' => $item->inventoryItem?->property_number,
            ];
        })->values();

        return response()->json([
            'query' => $q,
            'matched_po_number' => $purchaseOrder?->po_number ?? ($receivedItems->first()['po_number'] ?? null),
            'purchase_order' => $purchaseOrder ? [
                'id' => $purchaseOrder->id,
                'po_number' => $purchaseOrder->po_number,
                'status' => $purchaseOrder->status,
                'total_amount' => $purchaseOrder->total_amount,
                'issued_date' => $purchaseOrder->issued_date,
                'expected_delivery_date' => $purchaseOrder->expected_delivery_date,
                'supplier' => $purchaseOrder->supplier ? [
                    'id' => $purchaseOrder->supplier->id,
                    'name' => $purchaseOrder->supplier->name,
                ] : null,
                'department' => $purchaseOrder->purchaseRequest?->department?->name,
            ] : null,
            'ordered_items' => $orderedItems,
            'received_items' => $receivedItems,
        ]);
    }
}
