<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReceivedItem extends Model
{
    protected $fillable = [
        'acceptance_inspection_report_id',
        'delivery_receipt_id',
        'inventory_item_id',
        'asset_id',
        'air_number',
        'dr_number',
        'po_number',
        'line_number',
        'description',
        'unit_of_measure',
        'quantity_ordered',
        'quantity_delivered',
        'quantity_accepted',
        'quantity_on_hand',
        'unit_cost',
        'total_cost',
        'supplier_name',
        'requisitioning_office',
        'storage_location',
        'acceptance_date',
        'remarks',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'quantity_ordered' => 'decimal:2',
            'quantity_delivered' => 'decimal:2',
            'quantity_accepted' => 'decimal:2',
            'quantity_on_hand' => 'decimal:2',
            'unit_cost' => 'decimal:2',
            'total_cost' => 'decimal:2',
            'acceptance_date' => 'date',
        ];
    }

    public function acceptanceInspectionReport(): BelongsTo
    {
        return $this->belongsTo(AcceptanceInspectionReport::class);
    }

    public function deliveryReceipt(): BelongsTo
    {
        return $this->belongsTo(DeliveryReceipt::class);
    }

    public function inventoryItem(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class);
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function registryPropertyNumber(): string
    {
        $suffix = str_replace('AIR-', '', $this->air_number);

        return sprintf('REG-%s-%04d', $suffix, $this->line_number);
    }
}
