<?php

namespace App\Services\Ai;

use App\Models\InventoryItem;
use App\Models\StockTransaction;
use Illuminate\Support\Collection;

class AiForecastService
{
    public function forecast(array $args): array
    {
        $horizon = in_array($args['horizon_days'] ?? 30, [30, 60, 90, 365], true)
            ? (int) ($args['horizon_days'] ?? 30)
            : 30;

        $query = InventoryItem::with('category:id,name')
            ->where('status', 'available')
            ->where('is_consumable', true);

        if (! empty($args['item_code'])) {
            $query->where('item_code', $args['item_code']);
        }

        $items = $query->limit(30)->get();
        $forecasts = $items->map(fn ($item) => $this->forecastItem($item, $horizon));

        return [
            'horizon_days' => $horizon,
            'forecasts' => $forecasts->values(),
        ];
    }

    public function forecastItem(InventoryItem $item, int $horizonDays = 30): array
    {
        $consumption = $this->dailyConsumptionRate($item);
        $currentQty = (float) $item->quantity;
        $reorderLevel = (float) $item->reorder_level;

        $daysUntilStockout = $consumption > 0 ? (int) floor($currentQty / $consumption) : null;
        $projectedConsumption = round($consumption * $horizonDays, 2);
        $projectedStock = max(0, $currentQty - $projectedConsumption);

        $suggestedReorderQty = max($reorderLevel * 2 - $projectedStock, $reorderLevel);
        $suggestedReorderDate = $daysUntilStockout !== null
            ? now()->addDays(max(0, $daysUntilStockout - 14))->toDateString()
            : null;

        $dataPoints = StockTransaction::where('inventory_item_id', $item->id)
            ->where('type', 'stock_out')
            ->where('created_at', '>=', now()->subMonths(12))
            ->count();
        $confidence = min(95, max(30, 30 + ($dataPoints * 5)));

        return [
            'item_code' => $item->item_code,
            'name' => $item->name,
            'category' => $item->category?->name,
            'current_quantity' => $currentQty,
            'daily_consumption_rate' => round($consumption, 3),
            'horizon_days' => $horizonDays,
            'expected_consumption' => $projectedConsumption,
            'projected_stock' => round($projectedStock, 2),
            'projected_stockout_date' => $daysUntilStockout !== null
                ? now()->addDays($daysUntilStockout)->toDateString()
                : 'N/A (no consumption history)',
            'days_until_stockout' => $daysUntilStockout,
            'suggested_reorder_quantity' => round($suggestedReorderQty, 2),
            'suggested_reorder_date' => $suggestedReorderDate,
            'confidence_score' => $confidence,
        ];
    }

    private function dailyConsumptionRate(InventoryItem $item): float
    {
        $periods = [90, 180, 365];
        $rates = [];

        foreach ($periods as $days) {
            $total = StockTransaction::where('inventory_item_id', $item->id)
                ->where('type', 'stock_out')
                ->where('created_at', '>=', now()->subDays($days))
                ->sum('quantity');

            if ($total > 0) {
                $rates[] = (float) $total / $days;
            }
        }

        if (empty($rates)) {
            return 0;
        }

        // Weight recent periods more heavily
        return array_sum($rates) / count($rates);
    }
}
