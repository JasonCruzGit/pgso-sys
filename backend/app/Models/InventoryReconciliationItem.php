<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryReconciliationItem extends Model
{
    protected $fillable = [
        'inventory_reconciliation_id', 'inventory_item_id',
        'system_quantity', 'physical_quantity', 'shortage', 'overage', 'variance', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'system_quantity' => 'decimal:2',
            'physical_quantity' => 'decimal:2',
            'shortage' => 'decimal:2',
            'overage' => 'decimal:2',
            'variance' => 'decimal:2',
        ];
    }

    public function reconciliation(): BelongsTo { return $this->belongsTo(InventoryReconciliation::class, 'inventory_reconciliation_id'); }
    public function inventoryItem(): BelongsTo { return $this->belongsTo(InventoryItem::class); }
}
