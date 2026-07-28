<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Models\StockTransaction;
use App\Models\WasteManagementReceipt;
use App\Models\WasteManagementReceiptItem;
use App\Services\AuditService;
use App\Traits\GeneratesReference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class WasteManagementReceiptController extends Controller
{
    use GeneratesReference;

    public function __construct(private AuditService $audit) {}

    public function index(Request $request): JsonResponse
    {
        $records = WasteManagementReceipt::with(['department', 'preparer'])
            ->withCount('items')
            ->when($request->search, function ($query, $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('wmr_number', 'ilike', "%{$search}%")
                        ->orWhereHas('department', fn ($q) => $q->where('name', 'ilike', "%{$search}%"))
                        ->orWhereHas('items', fn ($q) => $q->where('description', 'ilike', "%{$search}%"));
                });
            })
            ->latest('disposal_date')
            ->paginate($request->integer('per_page', 15));

        return response()->json($records);
    }

    public function show(WasteManagementReceipt $wasteManagementReceipt): JsonResponse
    {
        return response()->json(
            $wasteManagementReceipt->load(['department', 'preparer', 'items.inventoryItem'])
        );
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'disposal_date' => ['required', 'date'],
            'department_id' => ['required', 'exists:departments,id'],
            'disposal_location' => ['nullable', 'string', 'max:255'],
            'mode_of_disposal' => ['nullable', 'string', 'max:100'],
            'remarks' => ['nullable', 'string'],
            'witness_name' => ['nullable', 'string', 'max:255'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.inventory_item_id' => ['nullable', 'exists:inventory_items,id'],
            'items.*.description' => ['required', 'string', 'max:500'],
            'items.*.unit_of_measure' => ['nullable', 'string', 'max:30'],
            'items.*.quantity' => ['required', 'numeric', 'min:0.01'],
            'items.*.unit_cost' => ['nullable', 'numeric', 'min:0'],
            'items.*.item_condition' => ['nullable', 'string', 'max:100'],
            'items.*.disposal_reason' => ['nullable', 'string', 'max:255'],
        ]);

        return DB::transaction(function () use ($data) {
            $receipt = WasteManagementReceipt::create([
                'wmr_number' => $this->generateReference('WMR-', 'waste_management_receipts', 'wmr_number'),
                'disposal_date' => $data['disposal_date'],
                'department_id' => $data['department_id'],
                'disposal_location' => $data['disposal_location'] ?? null,
                'mode_of_disposal' => $data['mode_of_disposal'] ?? null,
                'remarks' => $data['remarks'] ?? null,
                'witness_name' => $data['witness_name'] ?? null,
                'status' => 'completed',
                'prepared_by' => auth('api')->id(),
            ]);

            foreach ($data['items'] as $itemData) {
                $line = WasteManagementReceiptItem::create([
                    'waste_management_receipt_id' => $receipt->id,
                    'inventory_item_id' => $itemData['inventory_item_id'] ?? null,
                    'description' => $itemData['description'],
                    'unit_of_measure' => $itemData['unit_of_measure'] ?? null,
                    'quantity' => $itemData['quantity'],
                    'unit_cost' => $itemData['unit_cost'] ?? 0,
                    'item_condition' => $itemData['item_condition'] ?? null,
                    'disposal_reason' => $itemData['disposal_reason'] ?? null,
                ]);

                if (! empty($itemData['inventory_item_id'])) {
                    $inventoryItem = InventoryItem::lockForUpdate()->findOrFail($itemData['inventory_item_id']);
                    $qty = (float) $itemData['quantity'];

                    if ($inventoryItem->quantity < $qty) {
                        return response()->json([
                            'message' => "Insufficient stock for {$inventoryItem->name}. Available: {$inventoryItem->quantity}",
                        ], 422);
                    }

                    $inventoryItem->decrement('quantity', $qty);
                    $inventoryItem->update(['updated_by' => auth('api')->id()]);

                    StockTransaction::create([
                        'transaction_number' => $this->generateReference('STK-OUT', 'stock_transactions', 'transaction_number'),
                        'type' => 'stock_out',
                        'inventory_item_id' => $inventoryItem->id,
                        'quantity' => $qty,
                        'unit_cost' => $itemData['unit_cost'] ?? $inventoryItem->unit_cost,
                        'department_id' => $data['department_id'],
                        'performed_by' => auth('api')->id(),
                        'notes' => "WMR {$receipt->wmr_number}: {$line->description}",
                    ]);
                }
            }

            $this->audit->log(
                'create',
                'waste_management_receipt',
                "Created WMR {$receipt->wmr_number}",
                newValues: $receipt->toArray(),
            );

            return response()->json(
                $receipt->load(['department', 'preparer', 'items.inventoryItem'])->loadCount('items'),
                201,
            );
        });
    }
}
