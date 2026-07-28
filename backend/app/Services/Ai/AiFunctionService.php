<?php

namespace App\Services\Ai;

use App\Models\Asset;
use App\Models\AssetAssignment;
use App\Models\IssuanceItem;
use App\Models\InventoryItem;
use App\Models\StockTransaction;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class AiFunctionService
{
    /** @var array<string, string[]> Function name => required permissions (any match) */
    private const FUNCTION_PERMISSIONS = [
        'getInventoryStatus' => ['inventory.view', 'ai.*', 'ai.chat'],
        'getStockLevels' => ['stock.view', 'inventory.view', 'ai.*'],
        'getLowStockItems' => ['stock.view', 'inventory.view', 'ai.*', 'ai.chat'],
        'getOutOfStockItems' => ['stock.view', 'inventory.view', 'ai.*', 'ai.chat'],
        'getIssuedAssets' => ['assets.view', 'property.view', 'ai.*', 'ai.chat'],
        'getIssuedConsumables' => ['issuance.*', 'requests.view_own', 'requests.approve', 'requests.release', 'ai.*', 'ai.chat'],
        'getAssetAssignments' => ['property.view', 'assets.view', 'ai.*', 'ai.chat'],
        'getSupplierList' => ['suppliers.*', 'procurement.view', 'procurement.*', 'ai.*'],
        'getInventoryValue' => ['inventory.view', 'reports.*', 'ai.*', 'ai.analytics'],
        'generateInventoryReport' => ['reports.*', 'ai.*', 'ai.reports'],
        'forecastInventory' => ['stock.view', 'ai.*', 'ai.analytics'],
        'generateProcurementRecommendations' => ['procurement.*', 'procurement.view', 'ai.*'],
        'analyzeConsumption' => ['stock.view', 'ai.*', 'ai.analytics'],
        'detectDeadStocks' => ['inventory.view', 'stock.view', 'ai.*'],
        'generateExecutiveSummary' => ['ai.*', 'ai.analytics', 'dashboard.view'],
    ];

    public function __construct(
        private AiAnalyticsService $analytics,
        private AiForecastService $forecast,
        private AiRecommendationService $recommendations,
        private AiComplianceService $compliance,
        private AiExecutiveService $executive,
        private AiSecurityService $security,
    ) {}

    public function getToolDefinitions(User $user): array
    {
        $tools = [];
        foreach (self::FUNCTION_PERMISSIONS as $name => $permissions) {
            if ($this->userCanCall($user, $permissions)) {
                $tools[] = $this->toolSchema($name);
            }
        }

        return $tools;
    }

    public function execute(User $user, string $functionName, array $args = []): array
    {
        $permissions = self::FUNCTION_PERMISSIONS[$functionName] ?? null;
        if (! $permissions || ! $this->userCanCall($user, $permissions)) {
            return ['error' => 'Access denied: insufficient permissions for this function.'];
        }

        $result = match ($functionName) {
            'getInventoryStatus' => $this->getInventoryStatus($args),
            'getStockLevels' => $this->getStockLevels($args),
            'getLowStockItems' => $this->getLowStockItems($args),
            'getOutOfStockItems' => $this->getOutOfStockItems($args),
            'getIssuedAssets' => $this->getIssuedAssets($args, $user),
            'getIssuedConsumables' => $this->getIssuedConsumables($args, $user),
            'getAssetAssignments' => $this->getAssetAssignments($args, $user),
            'getSupplierList' => $this->getSupplierList($args),
            'getInventoryValue' => $this->getInventoryValue($args),
            'generateInventoryReport' => $this->generateInventoryReport($args),
            'forecastInventory' => $this->forecast->forecast($args),
            'generateProcurementRecommendations' => $this->recommendations->procurement($args),
            'analyzeConsumption' => $this->analytics->consumptionAnalysis($args),
            'detectDeadStocks' => $this->analytics->detectDeadStocks($args),
            'generateExecutiveSummary' => $this->executive->summary($args['period'] ?? 'monthly'),
            default => ['error' => "Unknown function: {$functionName}"],
        };

        return $this->security->sanitizeOutput($result);
    }

    private function userCanCall(User $user, array $permissions): bool
    {
        foreach ($permissions as $permission) {
            if ($user->hasPermission($permission)) {
                return true;
            }
        }

        return false;
    }

    private function getInventoryStatus(array $args): array
    {
        $query = InventoryItem::with(['category:id,name', 'supplier:id,name'])
            ->where('status', 'available');

        if (! empty($args['search'])) {
            $search = $args['search'];
            $query->where(function ($q) use ($search) {
                $q->where('name', 'ilike', "%{$search}%")
                    ->orWhere('item_code', 'ilike', "%{$search}%");
            });
        }
        if (! empty($args['category'])) {
            $query->whereHas('category', fn ($q) => $q->where('name', 'ilike', "%{$args['category']}%"));
        }
        if (isset($args['is_consumable'])) {
            $query->where('is_consumable', (bool) $args['is_consumable']);
        }

        $items = $query->limit($args['limit'] ?? 50)->get()->map(fn ($item) => [
            'item_code' => $item->item_code,
            'name' => $item->name,
            'category' => $item->category?->name,
            'quantity' => (float) $item->quantity,
            'unit' => $item->unit_of_measure,
            'reorder_level' => (float) $item->reorder_level,
            'unit_cost' => (float) $item->unit_cost,
            'location' => $item->storage_location,
            'status' => $item->isOutOfStock() ? 'out_of_stock' : ($item->isLowStock() ? 'low_stock' : 'available'),
        ]);

        return ['count' => $items->count(), 'items' => $items->values()];
    }

    private function getStockLevels(array $args): array
    {
        $query = InventoryItem::with('category:id,name')->where('status', 'available');
        if (! empty($args['item_code'])) {
            $query->where('item_code', $args['item_code']);
        }

        return [
            'items' => $query->limit(100)->get()->map(fn ($item) => [
                'item_code' => $item->item_code,
                'name' => $item->name,
                'category' => $item->category?->name,
                'quantity' => (float) $item->quantity,
                'reorder_level' => (float) $item->reorder_level,
                'unit' => $item->unit_of_measure,
            ])->values(),
        ];
    }

    private function getLowStockItems(array $args): array
    {
        $items = InventoryItem::with('category:id,name')
            ->where('status', 'available')
            ->where('quantity', '>', 0)
            ->whereColumn('quantity', '<=', 'reorder_level')
            ->when(! empty($args['category']), fn ($q) => $q->whereHas('category', fn ($c) => $c->where('name', 'ilike', "%{$args['category']}%")))
            ->orderBy('quantity')
            ->limit($args['limit'] ?? 50)
            ->get();

        return [
            'count' => $items->count(),
            'items' => $items->map(fn ($item) => [
                'item_code' => $item->item_code,
                'name' => $item->name,
                'quantity' => (float) $item->quantity,
                'reorder_level' => (float) $item->reorder_level,
                'unit' => $item->unit_of_measure,
                'category' => $item->category?->name,
            ])->values(),
        ];
    }

    private function getOutOfStockItems(array $args): array
    {
        $items = InventoryItem::with('category:id,name')
            ->where('status', 'available')
            ->where('quantity', '<=', 0)
            ->limit($args['limit'] ?? 50)
            ->get();

        return [
            'count' => $items->count(),
            'items' => $items->map(fn ($item) => [
                'item_code' => $item->item_code,
                'name' => $item->name,
                'category' => $item->category?->name,
                'reorder_level' => (float) $item->reorder_level,
            ])->values(),
        ];
    }

    private function getIssuedAssets(array $args, User $user): array
    {
        $query = Asset::with(['inventoryItem:id,name,item_code', 'custodian:id,name', 'department:id,name']);

        if (! $user->hasPermission('assets.*') && ! $user->hasPermission('ai.*')) {
            $query->where('department_id', $user->department_id);
        }
        if (! empty($args['department'])) {
            $query->whereHas('department', fn ($q) => $q->where('name', 'ilike', "%{$args['department']}%"));
        }
        if (! empty($args['search'])) {
            $search = $args['search'];
            $query->where(function ($q) use ($search) {
                $q->where('property_number', 'ilike', "%{$search}%")
                    ->orWhereHas('inventoryItem', fn ($iq) => $iq->where('name', 'ilike', "%{$search}%"));
            });
        }

        $assets = $query->limit($args['limit'] ?? 50)->get();

        return [
            'count' => $assets->count(),
            'assets' => $assets->map(fn ($a) => [
                'property_number' => $a->property_number,
                'name' => $a->inventoryItem?->name,
                'custodian' => $a->custodian?->name,
                'department' => $a->department?->name,
                'location' => $a->location,
                'condition' => $a->condition,
            ])->values(),
        ];
    }

    private function getIssuedConsumables(array $args, User $user): array
    {
        $status = $args['status'] ?? 'released';

        $query = IssuanceItem::with([
            'request.department:id,name',
            'request.requester:id,name',
            'inventoryItem:id,name,item_code,unit_of_measure,is_consumable',
        ])
            ->whereHas('inventoryItem', fn ($q) => $q->where('is_consumable', true))
            ->whereHas('request', function ($q) use ($args, $user, $status) {
                if ($status !== 'all') {
                    $q->where('status', $status);
                }
                if (! empty($args['requester'])) {
                    $q->whereHas('requester', fn ($rq) => $rq->where('name', 'ilike', "%{$args['requester']}%"));
                }
                if (! empty($args['department'])) {
                    $q->whereHas('department', fn ($dq) => $dq->where('name', 'ilike', "%{$args['department']}%"));
                }
                if (! $user->hasPermission('issuance.*') && ! $user->hasPermission('ai.*')) {
                    if ($user->hasPermission('requests.view_own')) {
                        $q->where('requested_by', $user->id);
                    } else {
                        $q->where('department_id', $user->department_id);
                    }
                }
            });

        if ($status === 'released') {
            $query->where('quantity_issued', '>', 0);
        }

        if (! empty($args['search'])) {
            $search = $args['search'];
            $query->whereHas('inventoryItem', fn ($q) => $q->where('name', 'ilike', "%{$search}%")
                ->orWhere('item_code', 'ilike', "%{$search}%"));
        }

        $lines = $query->limit($args['limit'] ?? 50)->get();

        return [
            'count' => $lines->count(),
            'items' => $lines->map(fn ($line) => [
                'request_number' => $line->request?->request_number,
                'status' => $line->request?->status,
                'requested_by' => $line->request?->requester?->name,
                'department' => $line->request?->department?->name,
                'item_code' => $line->inventoryItem?->item_code,
                'item_name' => $line->inventoryItem?->name,
                'quantity_requested' => (float) $line->quantity_requested,
                'quantity_issued' => (float) $line->quantity_issued,
                'unit' => $line->inventoryItem?->unit_of_measure,
                'date_requested' => $line->request?->date_requested?->toDateString(),
                'date_issued' => $line->request?->date_issued?->toDateString(),
                'purpose' => $line->request?->purpose,
            ])->values(),
        ];
    }

    private function getAssetAssignments(array $args, User $user): array
    {
        $query = AssetAssignment::with([
            'asset.inventoryItem:id,name,item_code',
            'custodian:id,name',
            'department:id,name',
        ])->where('status', 'active');

        if (! $user->hasPermission('property.*') && ! $user->hasPermission('ai.*')) {
            $query->where('department_id', $user->department_id);
        }
        if (! empty($args['property_number'])) {
            $query->whereHas('asset', fn ($q) => $q->where('property_number', 'ilike', "%{$args['property_number']}%"));
        }
        if (! empty($args['department'])) {
            $query->whereHas('department', fn ($q) => $q->where('name', 'ilike', "%{$args['department']}%"));
        }
        if (! empty($args['custodian'])) {
            $query->whereHas('custodian', fn ($q) => $q->where('name', 'ilike', "%{$args['custodian']}%"));
        }

        $assignments = $query->limit($args['limit'] ?? 50)->get();

        return [
            'count' => $assignments->count(),
            'assignments' => $assignments->map(fn ($a) => [
                'property_number' => $a->asset?->property_number,
                'item' => $a->asset?->inventoryItem?->name,
                'custodian' => $a->custodian?->name,
                'department' => $a->department?->name,
                'assigned_at' => $a->assignment_date?->toDateString(),
                'document_type' => $a->document_type,
            ])->values(),
        ];
    }

    private function getSupplierList(array $args): array
    {
        $suppliers = Supplier::query()
            ->when(! empty($args['search']), fn ($q) => $q->where('name', 'ilike', "%{$args['search']}%"))
            ->limit($args['limit'] ?? 50)
            ->get(['id', 'name', 'contact_person', 'email', 'phone', 'address', 'is_active']);

        return ['count' => $suppliers->count(), 'suppliers' => $suppliers];
    }

    private function getInventoryValue(array $args): array
    {
        $stats = InventoryItem::where('status', 'available')
            ->selectRaw('COUNT(*) as item_count, SUM(quantity * unit_cost) as total_value, SUM(quantity) as total_units')
            ->first();

        $byCategory = InventoryItem::join('categories', 'inventory_items.category_id', '=', 'categories.id')
            ->where('inventory_items.status', 'available')
            ->groupBy('categories.id', 'categories.name')
            ->selectRaw('categories.name as category, SUM(inventory_items.quantity * inventory_items.unit_cost) as value, COUNT(*) as items')
            ->orderByDesc('value')
            ->limit(10)
            ->get();

        return [
            'total_value' => round((float) ($stats->total_value ?? 0), 2),
            'item_count' => (int) ($stats->item_count ?? 0),
            'total_units' => round((float) ($stats->total_units ?? 0), 2),
            'by_category' => $byCategory,
        ];
    }

    private function generateInventoryReport(array $args): array
    {
        $type = $args['report_type'] ?? 'current_inventory';

        return match ($type) {
            'stock_movement' => $this->compliance->stockMovementReport($args),
            'physical_count' => $this->compliance->physicalCountReport($args),
            'valuation' => $this->getInventoryValue($args),
            'supplier_performance' => $this->analytics->supplierPerformance($args),
            default => [
                'report_type' => 'current_inventory',
                'generated_at' => now()->toIso8601String(),
                'summary' => $this->getInventoryValue($args),
                'low_stock' => $this->getLowStockItems(['limit' => 20]),
                'out_of_stock' => $this->getOutOfStockItems(['limit' => 20]),
            ],
        };
    }

    private function toolSchema(string $name): array
    {
        $schemas = [
            'getInventoryStatus' => [
                'description' => 'Search and list inventory items with stock status, categories, and locations.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'search' => ['type' => 'string', 'description' => 'Item name or code keyword'],
                        'category' => ['type' => 'string', 'description' => 'Category name filter'],
                        'is_consumable' => ['type' => 'boolean'],
                        'limit' => ['type' => 'integer'],
                    ],
                ],
            ],
            'getStockLevels' => [
                'description' => 'Get current stock levels for inventory items.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'item_code' => ['type' => 'string'],
                    ],
                ],
            ],
            'getLowStockItems' => [
                'description' => 'List items at or below reorder level that need replenishment.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'category' => ['type' => 'string'],
                        'limit' => ['type' => 'integer'],
                    ],
                ],
            ],
            'getOutOfStockItems' => [
                'description' => 'List items with zero stock.',
                'parameters' => ['type' => 'object', 'properties' => ['limit' => ['type' => 'integer']]],
            ],
            'getIssuedAssets' => [
                'description' => 'List issued non-consumable property/assets (with property numbers, PAR/ICS). Do NOT use for consumable office supplies.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'search' => ['type' => 'string'],
                        'department' => ['type' => 'string'],
                        'limit' => ['type' => 'integer'],
                    ],
                ],
            ],
            'getIssuedConsumables' => [
                'description' => 'List consumable supplies from employee issuance requests (office supplies, alcohol, paper, etc.). Use for questions about who received consumables, what was issued/released, and request details. Consumables are issued without MR/property numbers.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'requester' => ['type' => 'string', 'description' => 'Employee name who requested or received the supplies'],
                        'department' => ['type' => 'string', 'description' => 'Department name filter'],
                        'search' => ['type' => 'string', 'description' => 'Item name or code keyword'],
                        'status' => ['type' => 'string', 'enum' => ['released', 'approved', 'pending', 'all'], 'description' => 'Request status; default released (issued supplies)'],
                        'limit' => ['type' => 'integer'],
                    ],
                ],
            ],
            'getAssetAssignments' => [
                'description' => 'Get PAR/ICS accountability records — who is accountable for which property.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'property_number' => ['type' => 'string'],
                        'department' => ['type' => 'string'],
                        'custodian' => ['type' => 'string'],
                        'limit' => ['type' => 'integer'],
                    ],
                ],
            ],
            'getSupplierList' => [
                'description' => 'List registered suppliers for procurement.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'search' => ['type' => 'string'],
                        'limit' => ['type' => 'integer'],
                    ],
                ],
            ],
            'getInventoryValue' => [
                'description' => 'Calculate total inventory valuation and breakdown by category.',
                'parameters' => ['type' => 'object', 'properties' => []],
            ],
            'generateInventoryReport' => [
                'description' => 'Generate inventory reports: current_inventory, stock_movement, physical_count, valuation, supplier_performance.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'report_type' => ['type' => 'string', 'enum' => ['current_inventory', 'stock_movement', 'physical_count', 'valuation', 'supplier_performance']],
                        'date_from' => ['type' => 'string'],
                        'date_to' => ['type' => 'string'],
                    ],
                ],
            ],
            'forecastInventory' => [
                'description' => 'Forecast consumption and stockout dates for items (30/60/90/365 day horizons).',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'item_code' => ['type' => 'string'],
                        'horizon_days' => ['type' => 'integer', 'enum' => [30, 60, 90, 365]],
                    ],
                ],
            ],
            'generateProcurementRecommendations' => [
                'description' => 'Recommend items to procure with quantities and estimated costs.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'month' => ['type' => 'string', 'description' => 'Target month YYYY-MM'],
                    ],
                ],
            ],
            'analyzeConsumption' => [
                'description' => 'Analyze consumption patterns and stock movement trends.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'item_code' => ['type' => 'string'],
                        'months' => ['type' => 'integer'],
                    ],
                ],
            ],
            'detectDeadStocks' => [
                'description' => 'Find items with no stock movement (dead stock).',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'months_inactive' => ['type' => 'integer', 'description' => 'Months without movement, default 12'],
                    ],
                ],
            ],
            'generateExecutiveSummary' => [
                'description' => 'Generate executive summary for daily/weekly/monthly/quarterly/annual periods.',
                'parameters' => [
                    'type' => 'object',
                    'properties' => [
                        'period' => ['type' => 'string', 'enum' => ['daily', 'weekly', 'monthly', 'quarterly', 'annual']],
                    ],
                    'required' => ['period'],
                ],
            ],
        ];

        $schema = $schemas[$name];

        return [
            'type' => 'function',
            'function' => [
                'name' => $name,
                'description' => $schema['description'],
                'parameters' => $this->normalizeParameters($schema['parameters']),
            ],
        ];
    }

    /** @param  array<string, mixed>  $parameters */
    private function normalizeParameters(array $parameters): array
    {
        // OpenAI requires JSON Schema "properties" to be an object {}, not an array [].
        if (array_key_exists('properties', $parameters)
            && is_array($parameters['properties'])
            && $parameters['properties'] === []) {
            $parameters['properties'] = (object) [];
        }

        return $parameters;
    }
}
