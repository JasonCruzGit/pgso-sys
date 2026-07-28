<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DeliveryReceipt;
use App\Models\StockReceipt;
use App\Models\StockTransaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TrackingController extends Controller
{
    public function byPo(Request $request): JsonResponse
    {
        $data = $request->validate([
            'po_number' => ['required', 'string', 'max:100'],
        ]);

        $q = trim((string) $data['po_number']);
        if ($q === '') {
            return response()->json(['message' => 'PO number is required.'], 422);
        }

        $deliveryReceipts = DeliveryReceipt::with(['purchaseOrder.supplier', 'stockReceipt.items.inventoryItem', 'receiver'])
            ->where(function ($builder) use ($q) {
                $builder->where('po_number', 'ilike', "%{$q}%")
                    ->orWhereHas('purchaseOrder', fn ($po) => $po->where('po_number', 'ilike', "%{$q}%"));
            })
            ->latest('delivery_date')
            ->limit(25)
            ->get();

        $stockReceipts = StockReceipt::with(['supplier', 'receiver', 'items.inventoryItem'])
            ->where('purchase_order_number', 'ilike', "%{$q}%")
            ->latest('receiving_date')
            ->limit(25)
            ->get();

        $items = StockTransaction::query()
            ->select([
                'inventory_item_id',
                DB::raw("SUM(CASE WHEN type = 'stock_in' THEN quantity ELSE 0 END) as qty_in"),
                DB::raw("SUM(CASE WHEN type = 'stock_out' THEN quantity ELSE 0 END) as qty_out"),
            ])
            ->whereNotNull('purchase_order_number')
            ->where('purchase_order_number', 'ilike', "%{$q}%")
            ->groupBy('inventory_item_id')
            ->with(['inventoryItem'])
            ->orderByDesc('qty_in')
            ->limit(200)
            ->get()
            ->map(function ($row) {
                $item = $row->inventoryItem;
                return [
                    'inventory_item_id' => $row->inventory_item_id,
                    'item_code' => $item?->item_code,
                    'property_number' => $item?->property_number,
                    'name' => $item?->name,
                    'unit_of_measure' => $item?->unit_of_measure,
                    'unit_cost' => $item?->unit_cost,
                    'current_quantity' => $item?->quantity,
                    'qty_in' => (float) ($row->qty_in ?? 0),
                    'qty_out' => (float) ($row->qty_out ?? 0),
                ];
            });

        return response()->json([
            'query' => $q,
            'delivery_receipts' => $deliveryReceipts,
            'stock_receipts' => $stockReceipts,
            'items' => $items,
        ]);
    }
}

