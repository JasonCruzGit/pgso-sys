<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AcceptanceInspectionReport;
use App\Models\DeliveryReceipt;
use App\Services\AuditService;
use App\Services\ReceivedItemSyncService;
use App\Traits\GeneratesReference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AcceptanceInspectionReportController extends Controller
{
    use GeneratesReference;

    public function __construct(
        private AuditService $audit,
        private ReceivedItemSyncService $receivedItems,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $reports = AcceptanceInspectionReport::with([
            'purchaseOrder.supplier',
            'purchaseOrder.purchaseRequest',
            'deliveryReceipt',
            'preparer',
        ])
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->when($request->search, fn ($q, $s) => $q->where(function ($q) use ($s) {
                $q->where('air_number', 'ilike', "%{$s}%")
                    ->orWhere('po_number', 'ilike', "%{$s}%")
                    ->orWhereHas('purchaseOrder', function ($q) use ($s) {
                        $q->where('po_number', 'ilike', "%{$s}%")
                            ->orWhereHas('supplier', fn ($q) => $q->where('name', 'ilike', "%{$s}%"));
                    })
                    ->orWhereHas('deliveryReceipt', fn ($q) => $q->where('dr_number', 'ilike', "%{$s}%"));
            }))
            ->latest('inspection_date')
            ->paginate($request->integer('per_page', 15));

        return response()->json($reports);
    }

    public function pendingDeliveryReceipts(): JsonResponse
    {
        $usedDrIds = AcceptanceInspectionReport::query()
            ->whereNotNull('delivery_receipt_id')
            ->pluck('delivery_receipt_id');

        $receipts = DeliveryReceipt::with([
            'purchaseOrder.supplier',
            'purchaseOrder.purchaseRequest.department',
            'purchaseOrder.items',
            'receiver',
            'stockReceipt.items.inventoryItem',
        ])
            ->where('status', 'completed')
            ->whereNotIn('id', $usedDrIds)
            ->latest('delivery_date')
            ->limit(50)
            ->get();

        return response()->json(['data' => $receipts]);
    }

    public function show(AcceptanceInspectionReport $acceptanceInspectionReport): JsonResponse
    {
        return response()->json($acceptanceInspectionReport->load([
            'purchaseOrder.supplier',
            'purchaseOrder.purchaseRequest',
            'purchaseOrder.items',
            'deliveryReceipt.receiver',
            'deliveryReceipt.stockReceipt.items.inventoryItem',
            'preparer',
        ]));
    }

    public function store(Request $request): JsonResponse
    {
        if ($request->boolean('save_as_draft')) {
            return $this->saveReport($request);
        }

        return $this->finalizeReport($request);
    }

    public function update(Request $request, AcceptanceInspectionReport $acceptanceInspectionReport): JsonResponse
    {
        if ($acceptanceInspectionReport->status !== 'draft') {
            return response()->json(['message' => 'Only draft reports can be updated.'], 422);
        }

        if ($request->boolean('save_as_draft')) {
            return $this->saveReport($request, $acceptanceInspectionReport);
        }

        return $this->finalizeReport($request, $acceptanceInspectionReport);
    }

    public function finalize(Request $request, AcceptanceInspectionReport $acceptanceInspectionReport): JsonResponse
    {
        if ($acceptanceInspectionReport->status !== 'draft') {
            return response()->json(['message' => 'Only draft reports can be finalized.'], 422);
        }

        return $this->finalizeReport($request, $acceptanceInspectionReport);
    }

    private function saveReport(Request $request, ?AcceptanceInspectionReport $report = null): JsonResponse
    {
        $this->preprocessRequest($request);
        $data = $this->validatedPayload($request, false);
        $attributes = $this->buildAttributes($data, 'draft');

        if ($report) {
            $report->update($attributes);
            $this->audit->log('update', 'acceptance_inspection_report', "Updated draft AIR {$report->air_number}");

            return response()->json($report->fresh()->load($this->defaultRelations()));
        }

        $report = AcceptanceInspectionReport::create([
            'air_number' => $this->generateReference('AIR-', 'acceptance_inspection_reports', 'air_number'),
            ...$attributes,
            'prepared_by' => auth('api')->id(),
        ]);

        $this->audit->log('create', 'acceptance_inspection_report', "Created draft AIR {$report->air_number}");

        return response()->json($report->load($this->defaultRelations()), 201);
    }

    private function finalizeReport(Request $request, ?AcceptanceInspectionReport $report = null): JsonResponse
    {
        $this->preprocessRequest($request);
        $data = $this->validatedPayload($request, true);
        $attributes = $this->buildAttributes($data, 'completed');
        $isNew = $report === null;

        if ($report) {
            $report->update($attributes);
        } else {
            $report = AcceptanceInspectionReport::create([
                'air_number' => $this->generateReference('AIR-', 'acceptance_inspection_reports', 'air_number'),
                ...$attributes,
                'prepared_by' => auth('api')->id(),
            ]);
        }

        $action = $isNew ? 'Created' : 'Finalized';
        $this->audit->log('update', 'acceptance_inspection_report', "{$action} AIR {$report->air_number}");

        $this->receivedItems->syncFromReport($report->fresh());

        return response()->json($report->load($this->defaultRelations()), $isNew ? 201 : 200);
    }

    private function validatedPayload(Request $request, bool $finalize): array
    {
        return $request->validate([
            'delivery_receipt_id' => ['nullable', 'exists:delivery_receipts,id'],
            'purchase_order_id' => ['nullable', 'exists:purchase_orders,id'],
            'po_number' => ['nullable', 'string', 'max:100'],
            'inspection_date' => [$finalize ? 'required' : 'nullable', 'date'],
            'acceptance_date' => ['nullable', 'date'],
            'place_of_delivery' => ['nullable', 'string', 'max:255'],
            'inspector_name' => ['nullable', 'string', 'max:255'],
            'inspector_position' => ['nullable', 'string', 'max:255'],
            'accepted_by_name' => ['nullable', 'string', 'max:255'],
            'accepted_by_position' => ['nullable', 'string', 'max:255'],
            'supply_officer_name' => ['nullable', 'string', 'max:255'],
            'supply_officer_position' => ['nullable', 'string', 'max:255'],
            'inspection_result' => ['nullable', 'string', 'in:accepted,accepted_with_reservation,rejected'],
            'findings' => ['nullable', 'string'],
            'remarks' => ['nullable', 'string'],
            'po_date' => ['nullable', 'date'],
            'invoice_number' => ['nullable', 'string', 'max:100'],
            'invoice_date' => ['nullable', 'date'],
            'requisitioning_office' => ['nullable', 'string', 'max:255'],
            'obligation_request_no' => ['nullable', 'string', 'max:100'],
            'abc_amount' => ['nullable', 'numeric', 'min:0'],
            'amount' => ['nullable', 'numeric', 'min:0'],
            'remarks_for_use_of' => ['nullable', 'string'],
            'acceptance_complete' => ['nullable', 'boolean'],
            'acceptance_partial' => ['nullable', 'boolean'],
            'acceptance_spec_accepted' => ['nullable', 'boolean'],
            'inspection_correct' => ['nullable', 'boolean'],
            'items' => [$finalize ? 'required' : 'nullable', 'array', 'min:1'],
            'items.*.description' => ['required_with:items', 'string', 'max:500'],
            'items.*.unit_of_measure' => ['nullable', 'string', 'max:30'],
            'items.*.quantity_ordered' => ['nullable', 'numeric', 'min:0'],
            'items.*.quantity_delivered' => ['nullable', 'numeric', 'min:0'],
            'items.*.quantity_accepted' => ['nullable', 'numeric', 'min:0'],
            'items.*.unit_cost' => ['nullable', 'numeric', 'min:0'],
            'items.*.remarks' => ['nullable', 'string', 'max:500'],
        ]);
    }

    private function buildAttributes(array $data, string $status): array
    {
        if (! empty($data['delivery_receipt_id'])) {
            $dr = DeliveryReceipt::findOrFail($data['delivery_receipt_id']);
            $data['purchase_order_id'] = $data['purchase_order_id'] ?? $dr->purchase_order_id;
            $data['po_number'] = $data['po_number'] ?? $dr->po_number;
        }

        if (empty($data['items']) && ! empty($data['delivery_receipt_id'])) {
            $data['items'] = $this->itemsFromDeliveryReceipt((int) $data['delivery_receipt_id']);
        }

        if (empty($data['place_of_delivery']) && ! empty($data['delivery_receipt_id'])) {
            $dr = DeliveryReceipt::find($data['delivery_receipt_id']);
            $data['place_of_delivery'] = $dr?->delivery_location;
        }

        if (empty($data['inspector_name']) && ! empty($data['delivery_receipt_id'])) {
            $dr = DeliveryReceipt::find($data['delivery_receipt_id']);
            $data['inspector_name'] = $dr?->inspector_name;
        }

        if (empty($data['requisitioning_office']) && ! empty($data['purchase_order_id'])) {
            $po = \App\Models\PurchaseOrder::with('purchaseRequest.department')->find($data['purchase_order_id']);
            $data['requisitioning_office'] = $po?->purchaseRequest?->department?->name;
        }

        if (empty($data['po_date']) && ! empty($data['purchase_order_id'])) {
            $po = $po ?? \App\Models\PurchaseOrder::find($data['purchase_order_id']);
            $data['po_date'] = $po?->created_at?->toDateString();
        }

        if (empty($data['po_date']) && ! empty($data['delivery_receipt_id'])) {
            $deliveryDr = DeliveryReceipt::find($data['delivery_receipt_id']);
            $data['po_date'] = $deliveryDr?->delivery_date?->toDateString();
        }

        if (empty($data['abc_amount']) && ! empty($data['delivery_receipt_id'])) {
            $abcDr = DeliveryReceipt::find($data['delivery_receipt_id']);
            $data['abc_amount'] = $abcDr?->draft_items['abc_amount'] ?? null;
        }

        if (empty($data['abc_amount']) && ! empty($data['purchase_order_id'])) {
            $po = $po ?? \App\Models\PurchaseOrder::with('purchaseRequest')->find($data['purchase_order_id']);
            $data['abc_amount'] = $po?->purchaseRequest?->total_estimated_cost ?? $po?->total_amount;
        }

        if (empty($data['amount']) && ! empty($data['items'])) {
            $data['amount'] = collect($data['items'])->sum(
                fn ($item) => (float) ($item['quantity_accepted'] ?? 0) * (float) ($item['unit_cost'] ?? 0)
            );
        }

        if (empty($data['amount']) && ! empty($data['delivery_receipt_id'])) {
            $amountDr = DeliveryReceipt::find($data['delivery_receipt_id']);
            $data['amount'] = $amountDr?->draft_items['amount'] ?? null;
        }

        if (empty($data['invoice_number']) && ! empty($data['delivery_receipt_id'])) {
            $invoiceDr = DeliveryReceipt::find($data['delivery_receipt_id']);
            $data['invoice_number'] = $invoiceDr?->supplier_reference_number;
        }

        return [
            'purchase_order_id' => $data['purchase_order_id'] ?? null,
            'po_number' => $data['po_number'] ?? null,
            'delivery_receipt_id' => $data['delivery_receipt_id'] ?? null,
            'po_date' => $data['po_date'] ?? null,
            'invoice_number' => $data['invoice_number'] ?? null,
            'invoice_date' => $data['invoice_date'] ?? null,
            'requisitioning_office' => $data['requisitioning_office'] ?? null,
            'obligation_request_no' => $data['obligation_request_no'] ?? null,
            'inspection_date' => $data['inspection_date'] ?? now()->toDateString(),
            'acceptance_date' => $data['acceptance_date'] ?? ($status === 'completed' ? now()->toDateString() : null),
            'place_of_delivery' => $data['place_of_delivery'] ?? null,
            'inspector_name' => $data['inspector_name'] ?? null,
            'inspector_position' => $data['inspector_position'] ?? 'Inspection Officer',
            'accepted_by_name' => $data['accepted_by_name'] ?? null,
            'accepted_by_position' => $data['accepted_by_position'] ?? 'Property Officer',
            'supply_officer_name' => $data['supply_officer_name'] ?? null,
            'supply_officer_position' => $data['supply_officer_position'] ?? 'Property Officer',
            'inspection_result' => $data['inspection_result'] ?? 'accepted',
            'findings' => $data['findings'] ?? null,
            'remarks' => $data['remarks'] ?? null,
            'abc_amount' => $data['abc_amount'] ?? null,
            'amount' => $data['amount'] ?? null,
            'remarks_for_use_of' => $data['remarks_for_use_of'] ?? null,
            'acceptance_complete' => (bool) ($data['acceptance_complete'] ?? false),
            'acceptance_partial' => (bool) ($data['acceptance_partial'] ?? false),
            'acceptance_spec_accepted' => (bool) ($data['acceptance_spec_accepted'] ?? false),
            'inspection_correct' => (bool) ($data['inspection_correct'] ?? false),
            'items' => $data['items'] ?? [],
            'status' => $status,
        ];
    }

    private function itemsFromDeliveryReceipt(int $deliveryReceiptId): array
    {
        $dr = DeliveryReceipt::with(['purchaseOrder.items', 'stockReceipt.items.inventoryItem'])->findOrFail($deliveryReceiptId);

        if ($dr->stockReceipt?->items?->isNotEmpty()) {
            return $dr->stockReceipt->items->map(function ($item) use ($dr) {
                $poItem = $dr->purchaseOrder?->items?->firstWhere('inventory_item_id', $item->inventory_item_id);

                return [
                    'description' => $item->inventoryItem?->name ?? $poItem?->description ?? '—',
                    'unit_of_measure' => $item->inventoryItem?->unit_of_measure ?? $poItem?->unit_of_measure ?? 'unit',
                    'quantity_ordered' => (float) ($poItem?->quantity_ordered ?? $item->quantity_received),
                    'quantity_delivered' => (float) $item->quantity_received,
                    'quantity_accepted' => (float) $item->quantity_received,
                    'unit_cost' => (float) ($item->unit_cost ?? $poItem?->unit_cost ?? 0),
                    'remarks' => 'Satisfactory',
                ];
            })->values()->all();
        }

        return collect($dr->draft_items['items'] ?? [])
            ->reject(fn ($item) => $this->isSummaryImportRow($item))
            ->map(function ($item) {
            return [
                'description' => $item['description'] ?? '—',
                'unit_of_measure' => $item['unit_of_measure'] ?? 'unit',
                'quantity_ordered' => (float) ($item['quantity_ordered'] ?? 0),
                'quantity_delivered' => (float) ($item['quantity_received'] ?? 0),
                'quantity_accepted' => (float) ($item['quantity_received'] ?? 0),
                'unit_cost' => (float) ($item['unit_cost'] ?? 0),
                'remarks' => 'Satisfactory',
            ];
        })->values()->all();
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

    private function defaultRelations(): array
    {
        return [
            'purchaseOrder.supplier',
            'purchaseOrder.purchaseRequest',
            'deliveryReceipt.receiver',
            'preparer',
        ];
    }

    private function preprocessRequest(Request $request): void
    {
        if ($request->filled('delivery_receipt_id') && ! $request->filled('purchase_order_id')) {
            $dr = DeliveryReceipt::find($request->input('delivery_receipt_id'));
            if ($dr) {
                $request->merge([
                    'purchase_order_id' => $dr->purchase_order_id,
                    'po_number' => $request->input('po_number') ?? $dr->po_number,
                ]);
            }
        }

        if ($request->filled('delivery_receipt_id') && empty($request->input('items'))) {
            $request->merge([
                'items' => $this->itemsFromDeliveryReceipt((int) $request->input('delivery_receipt_id')),
            ]);
        }
    }
}
