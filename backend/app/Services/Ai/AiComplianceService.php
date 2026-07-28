<?php

namespace App\Services\Ai;

use App\Models\AssetAssignment;
use App\Models\InventoryItem;
use App\Models\StockTransaction;
use Illuminate\Support\Facades\DB;

class AiComplianceService
{
    public function stockMovementReport(array $args): array
    {
        $from = $args['date_from'] ?? now()->subMonth()->toDateString();
        $to = $args['date_to'] ?? now()->toDateString();

        $transactions = StockTransaction::with(['inventoryItem:id,item_code,name', 'department:id,name'])
            ->whereBetween('created_at', [$from, $to])
            ->orderByDesc('created_at')
            ->limit(100)
            ->get();

        $summary = StockTransaction::whereBetween('created_at', [$from, $to])
            ->selectRaw("type, COUNT(*) as count, SUM(quantity) as total_qty, SUM(quantity * unit_cost) as total_value")
            ->groupBy('type')
            ->get();

        return [
            'report' => 'Report on Supplies and Materials Issued / Stock Movement Analysis',
            'compliance' => 'COA Guidelines on Supplies and Property Accountability',
            'period' => ['from' => $from, 'to' => $to],
            'summary' => $summary,
            'transactions' => $transactions->map(fn ($t) => [
                'date' => $t->created_at->toDateString(),
                'number' => $t->transaction_number,
                'type' => $t->type,
                'item' => $t->inventoryItem?->name,
                'quantity' => (float) $t->quantity,
                'department' => $t->department?->name,
            ]),
        ];
    }

    public function physicalCountReport(array $args): array
    {
        $items = InventoryItem::with('category:id,name')
            ->where('status', 'available')
            ->orderBy('category_id')
            ->limit(200)
            ->get();

        return [
            'report' => 'Report on Physical Count of Property, Plant and Equipment / Supplies and Materials',
            'compliance' => 'COA Circular on Physical Inventory and Inspection Report',
            'generated_at' => now()->toIso8601String(),
            'total_items' => $items->count(),
            'total_value' => round($items->sum(fn ($i) => (float) $i->quantity * (float) $i->unit_cost), 2),
            'items' => $items->map(fn ($i) => [
                'item_code' => $i->item_code,
                'property_number' => $i->property_number,
                'name' => $i->name,
                'category' => $i->category?->name,
                'book_quantity' => (float) $i->quantity,
                'physical_count' => null,
                'variance' => null,
                'unit_cost' => (float) $i->unit_cost,
                'book_value' => round((float) $i->quantity * (float) $i->unit_cost, 2),
                'location' => $i->storage_location,
                'condition' => $i->condition,
            ]),
        ];
    }

    public function parReport(int $assignmentId): array
    {
        $assignment = AssetAssignment::with([
            'asset.inventoryItem', 'custodian', 'department', 'assigner',
        ])->findOrFail($assignmentId);

        return [
            'report' => 'Property Acknowledgment Receipt (PAR)',
            'compliance' => 'COA / GSO Property Accountability Form',
            'document_type' => 'PAR',
            'property_number' => $assignment->asset?->property_number,
            'item' => $assignment->asset?->inventoryItem?->name,
            'custodian' => $assignment->custodian?->name,
            'department' => $assignment->department?->name,
            'assigned_at' => $assignment->assignment_date?->toDateString(),
            'condition' => $assignment->asset?->condition,
        ];
    }

    public function icsReport(int $assignmentId): array
    {
        $assignment = AssetAssignment::with([
            'asset.inventoryItem', 'custodian', 'department',
        ])->findOrFail($assignmentId);

        return [
            'report' => 'Inventory Custodian Slip (ICS)',
            'compliance' => 'COA / GSO Semi-Expendable Property Form',
            'document_type' => 'ICS',
            'property_number' => $assignment->asset?->property_number,
            'item' => $assignment->asset?->inventoryItem?->name,
            'quantity' => 1,
            'unit_cost' => (float) ($assignment->asset?->inventoryItem?->unit_cost ?? 0),
            'custodian' => $assignment->custodian?->name,
            'department' => $assignment->department?->name,
            'assigned_at' => $assignment->assignment_date?->toDateString(),
        ];
    }

    public function unserviceableReport(): array
    {
        $items = InventoryItem::whereIn('condition', ['unserviceable', 'damaged', 'poor'])
            ->orWhere('status', 'disposed')
            ->with('category:id,name')
            ->limit(50)
            ->get();

        return [
            'report' => 'Inventory and Inspection Report of Unserviceable Property',
            'compliance' => 'COA Guidelines on Disposal of Unserviceable Property',
            'count' => $items->count(),
            'items' => $items->map(fn ($i) => [
                'item_code' => $i->item_code,
                'name' => $i->name,
                'condition' => $i->condition,
                'quantity' => (float) $i->quantity,
                'value' => round((float) $i->quantity * (float) $i->unit_cost, 2),
            ]),
        ];
    }
}
