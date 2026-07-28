<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MaterialReleaseItem extends Model
{
    protected $fillable = [
        'material_release_id', 'inventory_item_id', 'serial_number', 'quantity', 'unit_cost', 'stock_transaction_id',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:2',
            'unit_cost' => 'decimal:2',
        ];
    }

    public function materialRelease(): BelongsTo
    {
        return $this->belongsTo(MaterialRelease::class);
    }

    public function inventoryItem(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class);
    }

    public function stockTransaction(): BelongsTo
    {
        return $this->belongsTo(StockTransaction::class);
    }

    public function accountabilityAssignment(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(AssetAssignment::class, 'material_release_item_id');
    }
}
