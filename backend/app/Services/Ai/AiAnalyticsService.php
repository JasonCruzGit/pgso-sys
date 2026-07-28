<?php

namespace App\Services\Ai;

use App\Models\InventoryItem;
use App\Models\StockTransaction;
use App\Models\Supplier;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class AiAnalyticsService
{
    public function kpis(): array
    {
        return Cache::remember('ai:analytics:kpis', config('ai.cache_ttl'), function () {
            $items = InventoryItem::where('status', 'available');
            $totalItems = (clone $items)->count();
            $totalValue = (clone $items)->selectRaw('COALESCE(SUM(quantity * unit_cost), 0) as val')->value('val');
            $lowStock = (clone $items)->where('quantity', '>', 0)->whereColumn('quantity', '<=', 'reorder_level')->count();
            $outOfStock = (clone $items)->where('quantity', '<=', 0)->count();

            $totalAssets = DB::table('assets')->whereNull('deleted_at')->count();
            $assignedAssets = DB::table('asset_assignments')->where('status', 'active')->whereNull('deleted_at')->count();
            $assetUtilization = $totalAssets > 0 ? round(($assignedAssets / $totalAssets) * 100, 1) : 0;

            $stockOut30 = StockTransaction::where('type', 'stock_out')
                ->where('created_at', '>=', now()->subDays(30))
                ->sum('quantity');
            $stockIn30 = StockTransaction::where('type', 'stock_in')
                ->where('created_at', '>=', now()->subDays(30))
                ->sum('quantity');
            $turnoverRatio = $totalValue > 0 ? round(($stockOut30 * 30) / max($totalValue, 1), 2) : 0;

            $deadStock = $this->detectDeadStocks(['months_inactive' => 12]);

            return [
                'inventory_value' => round((float) $totalValue, 2),
                'total_stock_items' => $totalItems,
                'low_stock_count' => $lowStock,
                'out_of_stock_count' => $outOfStock,
                'asset_utilization_rate' => $assetUtilization,
                'inventory_turnover_ratio' => $turnoverRatio,
                'dead_stock_value' => $deadStock['total_value'] ?? 0,
                'dead_stock_count' => $deadStock['count'] ?? 0,
                'monthly_consumption' => round((float) $stockOut30, 2),
                'monthly_stock_in' => round((float) $stockIn30, 2),
                'fast_moving_items' => $this->fastMovingItems(5),
                'slow_moving_items' => $this->slowMovingItems(5),
                'procurement_trends' => $this->procurementTrends(),
            ];
        });
    }

    public function consumptionAnalysis(array $args): array
    {
        $months = $args['months'] ?? 6;
        $since = now()->subMonths($months);

        $query = StockTransaction::where('type', 'stock_out')
            ->where('created_at', '>=', $since)
            ->with('inventoryItem:id,item_code,name,unit_of_measure');

        if (! empty($args['item_code'])) {
            $query->whereHas('inventoryItem', fn ($q) => $q->where('item_code', $args['item_code']));
        }

        $monthly = $query->selectRaw("TO_CHAR(created_at, 'YYYY-MM') as month, SUM(quantity) as total")
            ->groupBy('month')
            ->orderBy('month')
            ->get();

        $byItem = StockTransaction::where('type', 'stock_out')
            ->where('created_at', '>=', $since)
            ->join('inventory_items', 'stock_transactions.inventory_item_id', '=', 'inventory_items.id')
            ->groupBy('inventory_items.id', 'inventory_items.item_code', 'inventory_items.name')
            ->selectRaw('inventory_items.item_code, inventory_items.name, SUM(stock_transactions.quantity) as total_consumed')
            ->orderByDesc('total_consumed')
            ->limit(20)
            ->get();

        return [
            'period_months' => $months,
            'monthly_totals' => $monthly,
            'top_consumed_items' => $byItem,
        ];
    }

    public function detectDeadStocks(array $args): array
    {
        $months = $args['months_inactive'] ?? 12;
        $cutoff = now()->subMonths($months);

        $activeItemIds = StockTransaction::where('created_at', '>=', $cutoff)
            ->distinct()
            ->pluck('inventory_item_id');

        $deadItems = InventoryItem::with('category:id,name')
            ->where('status', 'available')
            ->where('quantity', '>', 0)
            ->whereNotIn('id', $activeItemIds)
            ->limit(50)
            ->get();

        return [
            'months_inactive' => $months,
            'count' => $deadItems->count(),
            'total_value' => round($deadItems->sum(fn ($i) => (float) $i->quantity * (float) $i->unit_cost), 2),
            'items' => $deadItems->map(fn ($i) => [
                'item_code' => $i->item_code,
                'name' => $i->name,
                'quantity' => (float) $i->quantity,
                'value' => round((float) $i->quantity * (float) $i->unit_cost, 2),
                'category' => $i->category?->name,
                'location' => $i->storage_location,
            ])->values(),
        ];
    }

    public function supplierPerformance(array $args): array
    {
        $since = now()->subMonths($args['months'] ?? 12);

        $suppliers = Supplier::withCount([
            'inventoryItems as delivery_count' => fn ($q) => $q->whereHas('stockTransactions', fn ($t) => $t->where('type', 'stock_in')->where('created_at', '>=', $since)),
        ])->limit(20)->get();

        $stockBySupplier = StockTransaction::where('type', 'stock_in')
            ->where('created_at', '>=', $since)
            ->whereNotNull('supplier_id')
            ->join('suppliers', 'stock_transactions.supplier_id', '=', 'suppliers.id')
            ->groupBy('suppliers.id', 'suppliers.name')
            ->selectRaw('suppliers.name, COUNT(*) as transactions, SUM(stock_transactions.quantity * stock_transactions.unit_cost) as total_value')
            ->orderByDesc('total_value')
            ->limit(15)
            ->get();

        return [
            'period_start' => $since->toDateString(),
            'suppliers' => $stockBySupplier,
            'registered_suppliers' => $suppliers->count(),
        ];
    }

    private function fastMovingItems(int $limit): array
    {
        return StockTransaction::where('type', 'stock_out')
            ->where('created_at', '>=', now()->subDays(90))
            ->join('inventory_items', 'stock_transactions.inventory_item_id', '=', 'inventory_items.id')
            ->groupBy('inventory_items.id', 'inventory_items.item_code', 'inventory_items.name')
            ->selectRaw('inventory_items.item_code, inventory_items.name, SUM(stock_transactions.quantity) as total_out')
            ->orderByDesc('total_out')
            ->limit($limit)
            ->get()
            ->toArray();
    }

    private function slowMovingItems(int $limit): array
    {
        return InventoryItem::where('status', 'available')
            ->where('quantity', '>', 0)
            ->leftJoin('stock_transactions', function ($join) {
                $join->on('inventory_items.id', '=', 'stock_transactions.inventory_item_id')
                    ->where('stock_transactions.type', '=', 'stock_out')
                    ->where('stock_transactions.created_at', '>=', now()->subDays(90));
            })
            ->groupBy('inventory_items.id', 'inventory_items.item_code', 'inventory_items.name', 'inventory_items.quantity')
            ->selectRaw('inventory_items.item_code, inventory_items.name, inventory_items.quantity, COALESCE(SUM(stock_transactions.quantity), 0) as total_out')
            ->orderBy('total_out')
            ->limit($limit)
            ->get()
            ->toArray();
    }

    private function procurementTrends(): array
    {
        return DB::table('purchase_orders')
            ->whereNull('deleted_at')
            ->where('created_at', '>=', now()->subMonths(6))
            ->selectRaw("TO_CHAR(created_at, 'YYYY-MM') as month, COUNT(*) as count, COALESCE(SUM(total_amount), 0) as amount")
            ->groupBy('month')
            ->orderBy('month')
            ->get()
            ->toArray();
    }
}
