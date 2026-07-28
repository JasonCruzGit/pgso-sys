<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PurchaseOrder;
use App\Models\PurchaseRequest;
use App\Services\AuditService;
use App\Traits\GeneratesReference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PurchaseOrderController extends Controller
{
    use GeneratesReference;

    public function __construct(private AuditService $audit) {}

    public function index(Request $request): JsonResponse
    {
        $orders = PurchaseOrder::with(['purchaseRequest', 'supplier', 'issuer', 'items.inventoryItem'])
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->when($request->supplier_id, fn ($q, $id) => $q->where('supplier_id', $id))
            ->when($request->search, fn ($q, $s) => $q->where(function ($q) use ($s) {
                $q->where('po_number', 'ilike', "%{$s}%")
                    ->orWhereHas('purchaseRequest', fn ($q) => $q->where('pr_number', 'ilike', "%{$s}%"));
            }))
            ->latest()
            ->paginate($request->integer('per_page', 15));

        return response()->json($orders);
    }

    public function store(Request $request): JsonResponse
    {
        $isDraft = $request->boolean('save_as_draft');

        $data = $request->validate([
            'po_number' => ['required', 'string', 'max:50', 'unique:purchase_orders,po_number'],
            'pr_number' => ['required', 'string', 'max:50', 'exists:purchase_requests,pr_number'],
            'supplier_id' => [$isDraft ? 'nullable' : 'required', 'exists:suppliers,id'],
            'expected_delivery_date' => ['nullable', 'date', Rule::when(! $isDraft, 'after_or_equal:today')],
            'delivery_location' => ['nullable', 'string', 'max:255'],
            'payment_terms' => ['nullable', 'string', 'max:100'],
            'contact_person' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
            'items' => ['nullable', 'array', $isDraft ? 'min:0' : 'min:1'],
            'items.*.inventory_item_id' => ['nullable', 'exists:inventory_items,id'],
            'items.*.description' => [$isDraft ? 'nullable' : 'required_with:items', 'string', 'max:500'],
            'items.*.unit_of_measure' => ['nullable', 'string', 'max:30'],
            'items.*.quantity_ordered' => [$isDraft ? 'nullable' : 'required_with:items', 'numeric', 'min:0.01'],
            'items.*.unit_cost' => [$isDraft ? 'nullable' : 'required_with:items', 'numeric', 'min:0'],
        ]);

        return DB::transaction(function () use ($data, $isDraft) {
            $pr = PurchaseRequest::with('items')->where('pr_number', $data['pr_number'])->firstOrFail();

            if ($pr->status !== 'approved') {
                return response()->json(['message' => 'Purchase order can only be created from an approved purchase request.'], 422);
            }

            $items = collect($data['items'] ?? [])
                ->filter(fn ($item) => filled($item['description'] ?? null)
                    && filled($item['quantity_ordered'] ?? null)
                    && filled($item['unit_cost'] ?? null))
                ->values()
                ->all();

            if (empty($items) && ! $isDraft) {
                $items = $pr->items->map(fn ($item) => [
                    'inventory_item_id' => $item->inventory_item_id,
                    'description' => $item->description,
                    'unit_of_measure' => $item->unit_of_measure,
                    'quantity_ordered' => $item->quantity,
                    'unit_cost' => $item->unit_cost,
                ])->toArray();
            }

            if (! $isDraft && empty($items)) {
                return response()->json(['message' => 'At least one complete line item is required.'], 422);
            }

            $totalAmount = collect($items)->sum(fn ($item) => $item['quantity_ordered'] * $item['unit_cost']);

            $po = PurchaseOrder::create([
                'po_number' => $data['po_number'],
                'purchase_request_id' => $pr->id,
                'supplier_id' => $data['supplier_id'] ?? null,
                'status' => 'draft',
                'total_amount' => $totalAmount,
                'expected_delivery_date' => $data['expected_delivery_date'] ?? null,
                'delivery_location' => $data['delivery_location'] ?? 'GSO Main Warehouse',
                'payment_terms' => $data['payment_terms'] ?? null,
                'contact_person' => $data['contact_person'] ?? null,
                'notes' => $data['notes'] ?? null,
            ]);

            foreach ($items as $item) {
                $po->items()->create($item);
            }

            $action = $isDraft ? 'Saved draft PO' : 'Created PO';
            $this->audit->log('create', 'purchase_order', "{$action} {$po->po_number}", newValues: $po->toArray());

            return response()->json($po->load(['purchaseRequest.department', 'purchaseRequest.requester', 'supplier', 'items.inventoryItem']), 201);
        });
    }

    public function show(PurchaseOrder $purchaseOrder): JsonResponse
    {
        return response()->json($purchaseOrder->load([
            'purchaseRequest.department', 'supplier', 'issuer', 'items.inventoryItem', 'deliveryReceipts',
        ]));
    }

    public function issue(PurchaseOrder $purchaseOrder): JsonResponse
    {
        if ($purchaseOrder->status !== 'draft') {
            return response()->json(['message' => 'Only draft purchase orders can be issued.'], 422);
        }

        $purchaseOrder->update([
            'status' => 'issued',
            'issued_by' => auth('api')->id(),
            'issued_date' => now()->toDateString(),
        ]);

        $this->audit->log('update', 'purchase_order', "Issued PO {$purchaseOrder->po_number}");

        return response()->json($purchaseOrder->fresh()->load(['purchaseRequest', 'supplier', 'issuer', 'items.inventoryItem']));
    }
}
