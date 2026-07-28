<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WasteManagementReceiptItem extends Model
{
    protected $fillable = [
        'waste_management_receipt_id',
        'inventory_item_id',
        'description',
        'unit_of_measure',
        'quantity',
        'unit_cost',
        'item_condition',
        'disposal_reason',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:2',
            'unit_cost' => 'decimal:2',
        ];
    }

    public function receipt(): BelongsTo
    {
        return $this->belongsTo(WasteManagementReceipt::class, 'waste_management_receipt_id');
    }

    public function inventoryItem(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class);
    }
}
