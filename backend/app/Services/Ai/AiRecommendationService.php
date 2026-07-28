<?php

namespace App\Services\Ai;

use App\Models\Asset;
use App\Models\InventoryItem;
use Illuminate\Support\Facades\DB;

class AiRecommendationService
{
    public function __construct(
        private AiForecastService $forecast,
    ) {}

    public function all(): array
    {
        return [
            'reorder' => $this->reorder(),
            'procurement' => $this->procurement([]),
            'asset_replacement' => $this->assetReplacement(),
            'maintenance' => $this->maintenance(),
            'warehouse_optimization' => $this->warehouseOptimization(),
        ];
    }

    public function procurement(array $args): array
    {
        $items = InventoryItem::with(['category:id,name', 'supplier:id,name'])
            ->where('status', 'available')
            ->whereColumn('quantity', '<=', 'reorder_level')
            ->orderBy('quantity')
            ->limit(30)
            ->get();

        $recommendations = $items->map(function ($item) {
            $forecast = $this->forecast->forecastItem($item, 30);
            $recommendedQty = $forecast['suggested_reorder_quantity'];
            $estimatedCost = $recommendedQty * (float) $item->unit_cost;

            return [
                'item_code' => $item->item_code,
                'name' => $item->name,
                'category' => $item->category?->name,
                'current_quantity' => (float) $item->quantity,
                'recommended_quantity' => $recommendedQty,
                'estimated_cost' => round($estimatedCost, 2),
                'preferred_supplier' => $item->supplier?->name,
                'urgency' => (float) $item->quantity <= 0 ? 'critical' : 'high',
                'projected_stockout_date' => $forecast['projected_stockout_date'],
                'message' => $this->reorderMessage($item->name, $forecast),
            ];
        });

        return [
            'month' => $args['month'] ?? now()->format('Y-m'),
            'total_estimated_budget' => round($recommendations->sum('estimated_cost'), 2),
            'recommendations' => $recommendations->values(),
        ];
    }

    private function reorder(): array
    {
        return $this->procurement([])['recommendations']->toArray();
    }

    private function assetReplacement(): array
    {
        $assets = Asset::with('inventoryItem:id,name,item_code,date_acquired')
            ->where(function ($q) {
                $q->where('condition', 'unserviceable')
                    ->orWhere('condition', 'poor')
                    ->orWhere('next_inspection_date', '<', now());
            })
            ->limit(20)
            ->get();

        $oldAssets = Asset::with('inventoryItem:id,name,date_acquired')
            ->whereHas('inventoryItem', fn ($q) => $q->where('date_acquired', '<', now()->subYears(5)))
            ->limit(20)
            ->get();

        $combined = $assets->merge($oldAssets)->unique('id');

        return [
            'count' => $combined->count(),
            'recommendations' => $combined->map(fn ($a) => [
                'property_number' => $a->property_number,
                'name' => $a->inventoryItem?->name,
                'condition' => $a->condition,
                'acquired' => $a->inventoryItem?->date_acquired?->toDateString(),
                'reason' => $a->condition === 'unserviceable'
                    ? 'Unserviceable — recommend disposal evaluation per COA guidelines'
                    : 'Exceeded useful life — recommend replacement evaluation',
            ])->values(),
        ];
    }

    private function maintenance(): array
    {
        $due = Asset::with('inventoryItem:id,name')
            ->where('next_inspection_date', '<=', now()->addDays(30))
            ->whereNotNull('next_inspection_date')
            ->limit(20)
            ->get();

        return [
            'count' => $due->count(),
            'recommendations' => $due->map(fn ($a) => [
                'property_number' => $a->property_number,
                'name' => $a->inventoryItem?->name,
                'next_inspection_date' => $a->next_inspection_date?->toDateString(),
                'message' => "Inspection due for {$a->property_number} — schedule maintenance per GSO policy.",
            ])->values(),
        ];
    }

    private function warehouseOptimization(): array
    {
        $locations = InventoryItem::where('status', 'available')
            ->whereNotNull('storage_location')
            ->groupBy('storage_location')
            ->selectRaw('storage_location, COUNT(*) as item_count, SUM(quantity * unit_cost) as value')
            ->orderByDesc('value')
            ->limit(10)
            ->get();

        $unlocated = InventoryItem::where('status', 'available')
            ->where(function ($q) {
                $q->whereNull('storage_location')->orWhere('storage_location', '');
            })
            ->count();

        $suggestions = [];
        if ($unlocated > 0) {
            $suggestions[] = "{$unlocated} items have no storage location assigned. Update locations for warehouse traceability.";
        }

        $topLocation = $locations->first();
        if ($topLocation && $topLocation->item_count > 50) {
            $suggestions[] = "Location '{$topLocation->storage_location}' holds {$topLocation->item_count} items (₱".number_format($topLocation->value, 2)."). Consider zone-based organization.";
        }

        return [
            'locations' => $locations,
            'unlocated_items' => $unlocated,
            'suggestions' => $suggestions,
        ];
    }

    private function reorderMessage(string $name, array $forecast): string
    {
        $days = $forecast['days_until_stockout'];
        $qty = $forecast['suggested_reorder_quantity'];

        if ($days === null) {
            return "{$name} is below reorder level. Recommended reorder quantity: {$qty} units.";
        }

        return "{$name} is expected to run out within {$days} days. Recommended reorder quantity: {$qty} units.";
    }
}
