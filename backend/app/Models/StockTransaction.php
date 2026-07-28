<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class StockTransaction extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'transaction_number', 'type', 'inventory_item_id', 'batch_id', 'quantity', 'unit_cost',
        'supplier_id', 'delivery_receipt_number', 'purchase_order_number',
        'department_id', 'recipient_user_id', 'purpose', 'approving_officer_id',
        'performed_by', 'stock_receipt_id', 'issuance_request_id', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:2',
            'unit_cost' => 'decimal:2',
        ];
    }

    public function inventoryItem(): BelongsTo { return $this->belongsTo(InventoryItem::class); }
    public function batch(): BelongsTo { return $this->belongsTo(Batch::class); }
    public function supplier(): BelongsTo { return $this->belongsTo(Supplier::class); }
    public function department(): BelongsTo { return $this->belongsTo(Department::class); }
    public function recipient(): BelongsTo { return $this->belongsTo(User::class, 'recipient_user_id'); }
    public function approvingOfficer(): BelongsTo { return $this->belongsTo(User::class, 'approving_officer_id'); }
    public function performer(): BelongsTo { return $this->belongsTo(User::class, 'performed_by'); }
    public function stockReceipt(): BelongsTo { return $this->belongsTo(StockReceipt::class); }
    public function issuanceRequest(): BelongsTo { return $this->belongsTo(IssuanceRequest::class); }
}
