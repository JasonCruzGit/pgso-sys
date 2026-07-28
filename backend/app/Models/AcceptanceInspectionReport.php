<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class AcceptanceInspectionReport extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'air_number',
        'status',
        'purchase_order_id',
        'po_number',
        'delivery_receipt_id',
        'inspection_date',
        'acceptance_date',
        'place_of_delivery',
        'inspector_name',
        'inspector_position',
        'accepted_by_name',
        'accepted_by_position',
        'supply_officer_name',
        'supply_officer_position',
        'inspection_result',
        'findings',
        'remarks',
        'abc_amount',
        'amount',
        'remarks_for_use_of',
        'acceptance_complete',
        'acceptance_partial',
        'acceptance_spec_accepted',
        'inspection_correct',
        'po_date',
        'invoice_number',
        'invoice_date',
        'requisitioning_office',
        'obligation_request_no',
        'items',
        'prepared_by',
    ];

    protected function casts(): array
    {
        return [
            'inspection_date' => 'date',
            'acceptance_date' => 'date',
            'po_date' => 'date',
            'invoice_date' => 'date',
            'abc_amount' => 'decimal:2',
            'amount' => 'decimal:2',
            'acceptance_complete' => 'boolean',
            'acceptance_partial' => 'boolean',
            'acceptance_spec_accepted' => 'boolean',
            'inspection_correct' => 'boolean',
            'items' => 'array',
        ];
    }

    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function deliveryReceipt(): BelongsTo
    {
        return $this->belongsTo(DeliveryReceipt::class);
    }

    public function preparer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'prepared_by');
    }

    public function receivedItems(): HasMany
    {
        return $this->hasMany(ReceivedItem::class);
    }
}
