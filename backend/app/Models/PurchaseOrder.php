<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class PurchaseOrder extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'po_number', 'purchase_request_id', 'supplier_id', 'status',
        'total_amount', 'expected_delivery_date', 'delivery_location',
        'payment_terms', 'contact_person',
        'issued_by', 'issued_date', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'total_amount' => 'decimal:2',
            'expected_delivery_date' => 'date',
            'issued_date' => 'date',
        ];
    }

    public function purchaseRequest(): BelongsTo { return $this->belongsTo(PurchaseRequest::class); }
    public function supplier(): BelongsTo { return $this->belongsTo(Supplier::class); }
    public function issuer(): BelongsTo { return $this->belongsTo(User::class, 'issued_by'); }
    public function items(): HasMany { return $this->hasMany(PurchaseOrderItem::class); }
    public function deliveryReceipts(): HasMany { return $this->hasMany(DeliveryReceipt::class); }
}
