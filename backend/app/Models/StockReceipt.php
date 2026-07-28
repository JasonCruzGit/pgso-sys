<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class StockReceipt extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'receipt_number', 'purchase_order_number', 'purchase_order_id', 'supplier_id',
        'delivery_receipt_number', 'receiving_date', 'received_by',
        'notes', 'document_path',
    ];

    protected function casts(): array
    {
        return ['receiving_date' => 'date'];
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function receiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(StockReceiptItem::class);
    }
}
