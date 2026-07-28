<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class DeliveryReceipt extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'dr_number', 'status', 'purchase_order_id', 'po_number', 'stock_receipt_id',
        'delivery_date', 'supplier_reference_number', 'delivery_location',
        'delivery_condition', 'received_by', 'inspector_name', 'notes', 'draft_items',
    ];

    protected function casts(): array
    {
        return [
            'delivery_date' => 'date',
            'draft_items' => 'array',
        ];
    }

    public function purchaseOrder(): BelongsTo { return $this->belongsTo(PurchaseOrder::class); }
    public function stockReceipt(): BelongsTo { return $this->belongsTo(StockReceipt::class); }
    public function receiver(): BelongsTo { return $this->belongsTo(User::class, 'received_by'); }
}
