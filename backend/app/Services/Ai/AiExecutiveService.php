<?php

namespace App\Services\Ai;

use App\Models\StockTransaction;
use Illuminate\Support\Facades\DB;

class AiExecutiveService
{
    public function __construct(
        private AiAnalyticsService $analytics,
    ) {}

    public function summary(string $period = 'monthly'): array
    {
        $range = $this->periodRange($period);
        $kpis = $this->analytics->kpis();

        $stockOut = StockTransaction::where('type', 'stock_out')
            ->whereBetween('created_at', [$range['start'], $range['end']])
            ->sum('quantity');
        $stockIn = StockTransaction::where('type', 'stock_in')
            ->whereBetween('created_at', [$range['start'], $range['end']])
            ->sum('quantity');

        $procurementCount = DB::table('purchase_orders')
            ->whereNull('deleted_at')
            ->whereBetween('created_at', [$range['start'], $range['end']])
            ->count();
        $procurementValue = DB::table('purchase_orders')
            ->whereNull('deleted_at')
            ->whereBetween('created_at', [$range['start'], $range['end']])
            ->sum('total_amount');

        $budgetAllocated = DB::table('budget_allocations')
            ->whereNull('deleted_at')
            ->sum('allocated_amount');
        $budgetUtilization = $budgetAllocated > 0
            ? round(($procurementValue / $budgetAllocated) * 100, 1)
            : 0;

        $narrative = $this->buildNarrative($period, $kpis, $stockOut, $stockIn, $procurementValue, $budgetUtilization);

        return [
            'period' => $period,
            'date_range' => $range,
            'narrative' => $narrative,
            'metrics' => [
                'inventory_value' => $kpis['inventory_value'],
                'low_stock_count' => $kpis['low_stock_count'],
                'out_of_stock_count' => $kpis['out_of_stock_count'],
                'stock_out' => round((float) $stockOut, 2),
                'stock_in' => round((float) $stockIn, 2),
                'procurement_orders' => $procurementCount,
                'procurement_value' => round((float) $procurementValue, 2),
                'budget_utilization_pct' => $budgetUtilization,
                'asset_utilization_rate' => $kpis['asset_utilization_rate'],
                'dead_stock_value' => $kpis['dead_stock_value'],
            ],
            'highlights' => $this->highlights($kpis),
        ];
    }

    private function periodRange(string $period): array
    {
        return match ($period) {
            'daily' => ['start' => now()->startOfDay(), 'end' => now()->endOfDay()],
            'weekly' => ['start' => now()->startOfWeek(), 'end' => now()->endOfWeek()],
            'quarterly' => ['start' => now()->startOfQuarter(), 'end' => now()->endOfQuarter()],
            'annual' => ['start' => now()->startOfYear(), 'end' => now()->endOfYear()],
            default => ['start' => now()->startOfMonth(), 'end' => now()->endOfMonth()],
        };
    }

    private function buildNarrative(string $period, array $kpis, float $stockOut, float $stockIn, float $procValue, float $budgetUtil): string
    {
        $periodLabel = match ($period) {
            'daily' => 'today',
            'weekly' => 'this week',
            'quarterly' => 'this quarter',
            'annual' => 'this year',
            default => 'this month',
        };

        $parts = [];
        $parts[] = "Inventory value stands at ₱".number_format($kpis['inventory_value'], 2)." across {$kpis['total_stock_items']} stock items {$periodLabel}.";

        if ($kpis['low_stock_count'] > 0 || $kpis['out_of_stock_count'] > 0) {
            $parts[] = "There are {$kpis['low_stock_count']} low-stock and {$kpis['out_of_stock_count']} out-of-stock items requiring attention.";
        }

        if ($stockOut > 0) {
            $parts[] = "Stock-out transactions totaled ".number_format($stockOut, 0)." units {$periodLabel}.";
        }

        if ($procValue > 0) {
            $parts[] = "Procurement activity reached ₱".number_format($procValue, 2)." with budget utilization at {$budgetUtil}%.";
        }

        $parts[] = "Asset utilization rate is {$kpis['asset_utilization_rate']}%.";

        if ($kpis['dead_stock_value'] > 0) {
            $parts[] = "Dead stock valued at ₱".number_format($kpis['dead_stock_value'], 2)." ({$kpis['dead_stock_count']} items) — review for disposal per COA guidelines.";
        }

        return implode(' ', $parts);
    }

    private function highlights(array $kpis): array
    {
        $highlights = [];

        if ($kpis['out_of_stock_count'] > 0) {
            $highlights[] = [
                'type' => 'alert',
                'message' => "{$kpis['out_of_stock_count']} items are completely out of stock.",
            ];
        }

        if ($kpis['fast_moving_items']) {
            $top = $kpis['fast_moving_items'][0] ?? null;
            if ($top) {
                $highlights[] = [
                    'type' => 'info',
                    'message' => "Fastest moving item: {$top['name']} ({$top['total_out']} units in 90 days).",
                ];
            }
        }

        return $highlights;
    }
}
