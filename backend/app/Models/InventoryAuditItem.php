<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryAuditItem extends Model
{
    protected $fillable = [
        'inventory_audit_id', 'inventory_item_id', 'expected_quantity',
        'actual_quantity', 'variance', 'condition', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'expected_quantity' => 'decimal:2',
            'actual_quantity' => 'decimal:2',
            'variance' => 'decimal:2',
        ];
    }

    public function audit(): BelongsTo
    {
        return $this->belongsTo(InventoryAudit::class, 'inventory_audit_id');
    }

    public function inventoryItem(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class);
    }
}
