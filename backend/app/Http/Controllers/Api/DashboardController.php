<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BorrowingLog;
use App\Models\BudgetAllocation;
use App\Models\Category;
use App\Models\Inspection;
use App\Models\InventoryItem;
use App\Models\IssuanceRequest;
use App\Models\MaintenanceRecord;
use App\Models\PurchaseOrder;
use App\Models\PurchaseRequest;
use App\Models\StockAdjustment;
use App\Models\StockReceipt;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function index(): JsonResponse
    {
        $totalItems = InventoryItem::count();
        $availableStock = InventoryItem::where('status', 'available')->sum('quantity');
        $lowStock = InventoryItem::where('status', 'available')
            ->whereColumn('quantity', '<=', 'reorder_level')
            ->where('quantity', '>', 0)
            ->count();
        $outOfStock = InventoryItem::where('quantity', '<=', 0)->count();
        $totalIssued = IssuanceRequest::where('status', 'released')->count();
        $inventoryValue = InventoryItem::selectRaw('SUM(quantity * unit_cost) as total')->value('total') ?? 0;

        $recentTransactions = collect()
            ->merge(
                StockReceipt::with('supplier')->latest()->limit(5)->get()->map(fn ($r) => [
                    'type' => 'receiving',
                    'reference' => $r->receipt_number,
                    'description' => "Received from {$r->supplier?->name}",
                    'date' => $r->receiving_date,
                ])
            )
            ->merge(
                IssuanceRequest::with('department')->latest()->limit(5)->get()->map(fn ($r) => [
                    'type' => 'issuance',
                    'reference' => $r->request_number,
                    'description' => "Issued to {$r->department?->name}",
                    'date' => $r->date_issued ?? $r->date_requested,
                ])
            )
            ->sortByDesc('date')
            ->take(10)
            ->values();

        $categoryDistribution = Category::withCount('inventoryItems')
            ->whereHas('inventoryItems')
            ->get()
            ->map(fn ($c) => ['name' => $c->name, 'count' => $c->inventory_items_count]);

        $monthlyMovement = StockAdjustment::selectRaw("TO_CHAR(created_at, 'YYYY-MM') as month")
            ->selectRaw('SUM(ABS(quantity_change)) as total')
            ->where('created_at', '>=', now()->subMonths(12))
            ->groupBy('month')
            ->orderBy('month')
            ->get();

        $issuanceStats = IssuanceRequest::selectRaw("TO_CHAR(date_requested, 'YYYY-MM') as month")
            ->selectRaw('COUNT(*) as total')
            ->where('status', 'released')
            ->where('date_requested', '>=', now()->subMonths(12))
            ->groupBy('month')
            ->orderBy('month')
            ->get();

        $stockItems = [
            'available' => InventoryItem::with('category')
                ->where('status', 'available')
                ->where('quantity', '>', 0)
                ->orderByDesc('quantity')
                ->get()
                ->map(fn ($item) => $this->mapStockItem($item))
                ->values(),
            'low_stock' => InventoryItem::with('category')
                ->where('status', 'available')
                ->whereColumn('quantity', '<=', 'reorder_level')
                ->where('quantity', '>', 0)
                ->orderBy('quantity')
                ->get()
                ->map(fn ($item) => $this->mapStockItem($item))
                ->values(),
            'out_of_stock' => InventoryItem::with('category')
                ->where('quantity', '<=', 0)
                ->orderBy('name')
                ->get()
                ->map(fn ($item) => $this->mapStockItem($item))
                ->values(),
        ];

        $pendingPRs = PurchaseRequest::whereIn('status', ['submitted', 'draft'])->count();
        $pendingPOs = PurchaseOrder::whereIn('status', ['draft', 'issued', 'partial'])->count();
        $upcomingInspections = Inspection::where('status', 'scheduled')
            ->whereBetween('scheduled_date', [now(), now()->addDays(30)])
            ->count();
        $scheduledMaintenance = MaintenanceRecord::where('status', 'scheduled')
            ->whereBetween('scheduled_date', [now(), now()->addDays(30)])
            ->count();
        $assetsDueReturn = BorrowingLog::where('status', 'active')
            ->where('expected_return_date', '<=', now()->addDays(7))
            ->count();

        $procurementSummary = [
            'draft_prs' => PurchaseRequest::where('status', 'draft')->count(),
            'submitted_prs' => PurchaseRequest::where('status', 'submitted')->count(),
            'approved_prs' => PurchaseRequest::where('status', 'approved')->count(),
            'open_pos' => PurchaseOrder::whereIn('status', ['issued', 'partial'])->count(),
            'fulfilled_pos' => PurchaseOrder::where('status', 'fulfilled')->count(),
        ];

        $budgetSummary = BudgetAllocation::with('department')
            ->get()
            ->groupBy('department_id')
            ->map(fn ($rows) => [
                'department' => $rows->first()->department?->name,
                'allocated' => (float) $rows->sum('allocated_amount'),
                'spent' => (float) $rows->sum('spent_amount'),
                'remaining' => (float) $rows->sum('allocated_amount') - (float) $rows->sum('spent_amount'),
            ])
            ->values();

        $lowStockItems = InventoryItem::with('category')
            ->where('status', 'available')
            ->whereColumn('quantity', '<=', 'reorder_level')
            ->where('quantity', '>', 0)
            ->orderBy('quantity')
            ->limit(8)
            ->get()
            ->map(fn ($item) => $this->mapStockItem($item));

        return response()->json([
            'stats' => [
                'total_items' => $totalItems,
                'available_stock' => (float) $availableStock,
                'low_stock_alerts' => $lowStock,
                'out_of_stock' => $outOfStock,
                'total_issued' => $totalIssued,
                'inventory_value' => (float) $inventoryValue,
                'pending_purchase_requests' => $pendingPRs,
                'pending_purchase_orders' => $pendingPOs,
                'upcoming_inspections' => $upcomingInspections,
                'scheduled_maintenance' => $scheduledMaintenance,
                'assets_due_return' => $assetsDueReturn,
            ],
            'stock_items' => $stockItems,
            'low_stock_alerts' => $lowStockItems,
            'recent_transactions' => $recentTransactions,
            'category_distribution' => $categoryDistribution,
            'monthly_movement' => $monthlyMovement,
            'issuance_statistics' => $issuanceStats,
            'procurement_summary' => $procurementSummary,
            'budget_summary' => $budgetSummary,
        ]);
    }

    private function mapStockItem(InventoryItem $item): array
    {
        return [
            'id' => $item->id,
            'item_code' => $item->item_code,
            'name' => $item->name,
            'category' => $item->category?->name,
            'quantity' => (float) $item->quantity,
            'unit_of_measure' => $item->unit_of_measure,
            'reorder_level' => (float) $item->reorder_level,
            'unit_cost' => (float) $item->unit_cost,
            'total_value' => (float) $item->total_cost,
            'storage_location' => $item->storage_location,
            'stock_status' => $item->isOutOfStock()
                ? 'out_of_stock'
                : ($item->isLowStock() ? 'low_stock' : 'available'),
        ];
    }
}
