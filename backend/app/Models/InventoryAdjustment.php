<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class InventoryAdjustment extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'adjustment_number', 'inventory_item_id', 'adjustment_type',
        'quantity_before', 'quantity_change', 'quantity_after', 'reason',
        'status', 'adjusted_by', 'approved_by', 'approved_at', 'rejection_reason',
    ];

    protected function casts(): array
    {
        return [
            'quantity_before' => 'decimal:2',
            'quantity_change' => 'decimal:2',
            'quantity_after' => 'decimal:2',
            'approved_at' => 'datetime',
        ];
    }

    public function inventoryItem(): BelongsTo { return $this->belongsTo(InventoryItem::class); }
    public function adjuster(): BelongsTo { return $this->belongsTo(User::class, 'adjusted_by'); }
    public function approver(): BelongsTo { return $this->belongsTo(User::class, 'approved_by'); }
}
