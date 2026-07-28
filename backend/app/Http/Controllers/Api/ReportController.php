<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\AssetAssignment;
use App\Models\BudgetAllocation;
use App\Models\Inspection;
use App\Models\InventoryItem;
use App\Models\InventoryReconciliation;
use App\Models\IssuanceRequest;
use App\Models\MaintenanceRecord;
use App\Models\PurchaseOrder;
use App\Models\PurchaseRequest;
use App\Models\RepairRecord;
use App\Models\StockAdjustment;
use App\Models\StockTransaction;
use App\Models\Supplier;
use App\Services\ExportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    public function __construct(private ExportService $export) {}

    public function currentInventory(Request $request)
    {
        $items = InventoryItem::with(['category', 'supplier'])
            ->when($request->category_id, fn ($q, $id) => $q->inCategory((int) $id))
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->orderBy('item_code')
            ->get()
            ->map(fn ($i) => [
                $i->item_code,
                $i->property_number ?? '',
                $i->name,
                $i->category?->name ?? '',
                $i->unit_of_measure,
                $i->quantity,
                $i->unit_cost,
                $i->quantity * $i->unit_cost,
                $i->status,
                $i->storage_location ?? '',
            ]);

        $headers = ['Item Code', 'Property No.', 'Name', 'Category', 'UOM', 'Qty', 'Unit Cost', 'Total Cost', 'Status', 'Location'];

        return $this->exportResponse($request, $items, $headers, 'current_inventory', 'reports.inventory');
    }

    public function stockCard(Request $request, InventoryItem $inventoryItem)
    {
        $adjustments = StockAdjustment::with('adjuster')
            ->where('inventory_item_id', $inventoryItem->id)
            ->orderBy('created_at')
            ->get()
            ->map(fn ($a) => [
                $a->created_at->format('Y-m-d H:i'),
                $a->adjustment_type,
                $a->quantity_before,
                $a->quantity_change,
                $a->quantity_after,
                $a->reason,
                $a->adjuster?->name ?? '',
            ]);

        $headers = ['Date', 'Type', 'Qty Before', 'Change', 'Qty After', 'Reason', 'Adjusted By'];

        return $this->exportResponse($request, $adjustments, $headers, "stock_card_{$inventoryItem->item_code}", 'reports.stock-card', [
            'item' => $inventoryItem->load('category'),
            'rows' => $adjustments,
            'headers' => $headers,
        ]);
    }

    public function issuanceReport(Request $request)
    {
        $query = IssuanceRequest::with(['department', 'requester', 'items.inventoryItem'])
            ->where('status', 'released')
            ->when($request->from, fn ($q, $d) => $q->whereDate('date_issued', '>=', $d))
            ->when($request->to, fn ($q, $d) => $q->whereDate('date_issued', '<=', $d))
            ->when($request->department_id, fn ($q, $id) => $q->where('department_id', $id));

        $rows = $query->get()->map(fn ($r) => [
            $r->request_number,
            $r->department?->name ?? '',
            $r->requester?->name ?? '',
            $r->date_issued?->format('Y-m-d') ?? '',
            $r->items->sum('quantity_issued'),
            $r->purpose,
        ]);

        $headers = ['Request No.', 'Department', 'Requested By', 'Date Issued', 'Total Qty', 'Purpose'];

        return $this->exportResponse($request, $rows, $headers, 'issuance_report', 'reports.issuance');
    }

    public function assetRegistry(Request $request)
    {
        $assets = Asset::with(['inventoryItem', 'custodian', 'department'])
            ->get()
            ->map(fn ($a) => [
                $a->property_number,
                $a->inventoryItem?->name ?? '',
                $a->department?->name ?? '',
                $a->custodian?->name ?? '',
                $a->location ?? '',
                $a->condition,
                $a->last_inspection_date?->format('Y-m-d') ?? '',
            ]);

        $headers = ['Property No.', 'Item', 'Department', 'Custodian', 'Location', 'Condition', 'Last Inspection'];

        return $this->exportResponse($request, $assets, $headers, 'asset_registry', 'reports.assets');
    }

    public function disposalReport(Request $request)
    {
        $items = InventoryItem::with('category')
            ->where('status', 'disposed')
            ->get()
            ->map(fn ($i) => [
                $i->item_code,
                $i->property_number ?? '',
                $i->name,
                $i->category?->name ?? '',
                $i->quantity,
                $i->unit_cost,
            ]);

        $headers = ['Item Code', 'Property No.', 'Name', 'Category', 'Qty', 'Unit Cost'];

        return $this->exportResponse($request, $items, $headers, 'disposal_report', 'reports.disposal');
    }

    public function stockInReport(Request $request)
    {
        $rows = StockTransaction::with(['inventoryItem', 'supplier', 'performer'])
            ->where('type', 'stock_in')
            ->when($request->from, fn ($q, $d) => $q->whereDate('created_at', '>=', $d))
            ->when($request->to, fn ($q, $d) => $q->whereDate('created_at', '<=', $d))
            ->latest()
            ->get()
            ->map(fn ($t) => [
                $t->transaction_number,
                $t->inventoryItem?->name ?? '',
                $t->quantity,
                $t->supplier?->name ?? '',
                $t->delivery_receipt_number ?? '',
                $t->purchase_order_number ?? '',
                $t->created_at->format('Y-m-d'),
                $t->performer?->name ?? '',
            ]);
        $headers = ['Transaction No.', 'Item', 'Qty', 'Supplier', 'DR No.', 'PO No.', 'Date', 'Officer'];

        return $this->exportResponse($request, $rows, $headers, 'stock_in_report', 'reports.generic');
    }

    public function stockOutReport(Request $request)
    {
        $rows = StockTransaction::with(['inventoryItem', 'department', 'recipient', 'performer'])
            ->where('type', 'stock_out')
            ->when($request->from, fn ($q, $d) => $q->whereDate('created_at', '>=', $d))
            ->when($request->to, fn ($q, $d) => $q->whereDate('created_at', '<=', $d))
            ->latest()
            ->get()
            ->map(fn ($t) => [
                $t->transaction_number,
                $t->inventoryItem?->name ?? '',
                $t->quantity,
                $t->department?->name ?? '',
                $t->recipient?->name ?? '',
                $t->purpose ?? '',
                $t->created_at->format('Y-m-d'),
                $t->performer?->name ?? '',
            ]);
        $headers = ['Transaction No.', 'Item', 'Qty', 'Office', 'Recipient', 'Purpose', 'Date', 'Officer'];

        return $this->exportResponse($request, $rows, $headers, 'stock_out_report', 'reports.generic');
    }

    public function reconciliationReport(Request $request)
    {
        $rows = InventoryReconciliation::with(['starter', 'items.inventoryItem'])
            ->where('status', 'completed')
            ->latest()
            ->get()
            ->flatMap(fn ($r) => $r->items->map(fn ($i) => [
                $r->reconciliation_number,
                $i->inventoryItem?->name ?? '',
                $i->system_quantity,
                $i->physical_quantity,
                $i->shortage,
                $i->overage,
                $i->variance,
                $r->completed_at?->format('Y-m-d') ?? '',
            ]));
        $headers = ['Reconciliation No.', 'Item', 'System Qty', 'Physical Qty', 'Shortage', 'Overage', 'Variance', 'Completed'];

        return $this->exportResponse($request, $rows, $headers, 'reconciliation_report', 'reports.generic');
    }

    public function assetAssignmentReport(Request $request)
    {
        $rows = AssetAssignment::with(['asset.inventoryItem', 'custodian', 'department'])
            ->latest('assignment_date')
            ->get()
            ->map(fn ($a) => [
                $a->assignment_number,
                $a->acknowledgment_number,
                $a->document_type,
                $a->asset?->property_number ?? '',
                $a->asset?->inventoryItem?->name ?? '',
                $a->custodian?->name ?? '',
                $a->department?->name ?? '',
                $a->assignment_date->format('Y-m-d'),
                $a->status,
            ]);
        $headers = ['Assignment No.', 'Ack. No.', 'Doc Type', 'Property No.', 'Item', 'Custodian', 'Department', 'Date', 'Status'];

        return $this->exportResponse($request, $rows, $headers, 'asset_assignment_report', 'reports.generic');
    }

    public function parReport(Request $request, AssetAssignment $assetAssignment)
    {
        $a = $assetAssignment->load(['asset.inventoryItem', 'custodian', 'department', 'assigner']);
        $rows = [[
            $a->acknowledgment_number,
            $a->asset?->property_number ?? '',
            $a->asset?->inventoryItem?->name ?? '',
            $a->custodian?->name ?? '',
            $a->department?->name ?? '',
            $a->assignment_date->format('Y-m-d'),
            $a->qr_verification_data ?? '',
        ]];
        $headers = ['PAR No.', 'Property No.', 'Item', 'Custodian', 'Department', 'Date', 'QR Data'];

        return $this->exportResponse($request, collect($rows), $headers, "par_{$a->acknowledgment_number}", 'reports.generic', ['title' => 'Property Acknowledgment Receipt']);
    }

    public function icsReport(Request $request, AssetAssignment $assetAssignment)
    {
        return $this->parReport($request, $assetAssignment);
    }

    public function maintenanceReport(Request $request)
    {
        $rows = MaintenanceRecord::with(['asset.inventoryItem', 'performer'])
            ->latest()
            ->get()
            ->map(fn ($m) => [
                $m->maintenance_number,
                $m->asset?->property_number ?? '',
                $m->asset?->inventoryItem?->name ?? '',
                $m->type,
                $m->scheduled_date?->format('Y-m-d') ?? '',
                $m->completed_date?->format('Y-m-d') ?? '',
                $m->service_provider ?? '',
                $m->cost,
                $m->status,
            ]);
        $headers = ['Maint. No.', 'Property No.', 'Item', 'Type', 'Scheduled', 'Completed', 'Provider', 'Cost', 'Status'];

        return $this->exportResponse($request, $rows, $headers, 'maintenance_report', 'reports.generic');
    }

    public function repairReport(Request $request)
    {
        $rows = RepairRecord::with(['asset.inventoryItem', 'recorder'])
            ->latest()
            ->get()
            ->map(fn ($r) => [
                $r->repair_number,
                $r->asset?->property_number ?? '',
                $r->asset?->inventoryItem?->name ?? '',
                $r->service_provider ?? '',
                $r->repair_date->format('Y-m-d'),
                $r->cost,
                $r->description ?? '',
                $r->recorder?->name ?? '',
            ]);
        $headers = ['Repair No.', 'Property No.', 'Item', 'Provider', 'Date', 'Cost', 'Description', 'Recorded By'];

        return $this->exportResponse($request, $rows, $headers, 'repair_report', 'reports.generic');
    }

    public function inspectionReport(Request $request)
    {
        $rows = Inspection::with(['asset.inventoryItem', 'inspector'])
            ->latest()
            ->get()
            ->map(fn ($i) => [
                $i->inspection_number,
                $i->asset?->property_number ?? '',
                $i->asset?->inventoryItem?->name ?? '',
                $i->scheduled_date->format('Y-m-d'),
                $i->completed_date?->format('Y-m-d') ?? '',
                $i->condition ?? '',
                $i->status,
                $i->inspector?->name ?? '',
            ]);
        $headers = ['Inspection No.', 'Property No.', 'Item', 'Scheduled', 'Completed', 'Condition', 'Status', 'Inspector'];

        return $this->exportResponse($request, $rows, $headers, 'inspection_report', 'reports.generic');
    }

    public function procurementStatusReport(Request $request)
    {
        $prs = PurchaseRequest::with('department')->get()->map(fn ($p) => [
            'PR', $p->pr_number, $p->title, $p->department?->name ?? '', $p->status, $p->total_estimated_cost, $p->created_at->format('Y-m-d'),
        ]);
        $pos = PurchaseOrder::with('supplier')->get()->map(fn ($p) => [
            'PO', $p->po_number, $p->supplier?->name ?? '', '', $p->status, $p->total_amount, $p->created_at->format('Y-m-d'),
        ]);
        $rows = $prs->merge($pos);
        $headers = ['Type', 'Number', 'Title/Supplier', 'Department', 'Status', 'Amount', 'Date'];

        return $this->exportResponse($request, $rows, $headers, 'procurement_status_report', 'reports.generic');
    }

    public function supplierReport(Request $request)
    {
        $rows = Supplier::withCount('inventoryItems')->get()->map(fn ($s) => [
            $s->name,
            $s->contact_person ?? '',
            $s->email ?? '',
            $s->phone ?? '',
            $s->performance_rating ?? '',
            $s->total_deliveries,
            $s->is_active ? 'Active' : 'Inactive',
        ]);
        $headers = ['Name', 'Contact', 'Email', 'Phone', 'Rating', 'Deliveries', 'Status'];

        return $this->exportResponse($request, $rows, $headers, 'supplier_report', 'reports.generic');
    }

    public function budgetUtilizationReport(Request $request)
    {
        $rows = BudgetAllocation::with('department')->get()->map(fn ($b) => [
            $b->department?->name ?? '',
            $b->fiscal_year,
            $b->category ?? '',
            $b->allocated_amount,
            $b->spent_amount,
            $b->remaining_amount,
        ]);
        $headers = ['Department', 'Fiscal Year', 'Category', 'Allocated', 'Spent', 'Remaining'];

        return $this->exportResponse($request, $rows, $headers, 'budget_utilization_report', 'reports.generic');
    }

    private function exportResponse(Request $request, $rows, array $headers, string $filename, string $pdfView, array $pdfData = [])
    {
        $format = $request->query('format', 'json');

        if ($format === 'csv') {
            return $this->export->toCsv(collect($rows), $headers, $filename);
        }
        if ($format === 'excel') {
            return $this->export->toExcel(collect($rows), $headers, $filename);
        }
        if ($format === 'pdf') {
            return $this->export->toPdf($pdfView, array_merge($pdfData, [
                'title' => str_replace('_', ' ', ucfirst($filename)),
                'headers' => $headers,
                'rows' => $rows,
                'generatedAt' => now()->format('F d, Y h:i A'),
            ]), $filename);
        }

        return response()->json(['headers' => $headers, 'data' => $rows]);
    }
}
