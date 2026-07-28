<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class PurchaseRequest extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'pr_number', 'department_id', 'requested_by', 'title', 'description',
        'date_needed', 'mode_of_procurement', 'budget_allocation_id',
        'total_estimated_cost', 'status', 'approved_by', 'rejection_reason',
        'submitted_at', 'approved_at', 'attachment_path',
    ];

    protected function casts(): array
    {
        return [
            'total_estimated_cost' => 'decimal:2',
            'date_needed' => 'date',
            'submitted_at' => 'datetime',
            'approved_at' => 'datetime',
        ];
    }

    public function department(): BelongsTo { return $this->belongsTo(Department::class); }
    public function requester(): BelongsTo { return $this->belongsTo(User::class, 'requested_by'); }
    public function approver(): BelongsTo { return $this->belongsTo(User::class, 'approved_by'); }
    public function budgetAllocation(): BelongsTo { return $this->belongsTo(BudgetAllocation::class); }
    public function items(): HasMany { return $this->hasMany(PurchaseRequestItem::class); }
    public function purchaseOrders(): HasMany { return $this->hasMany(PurchaseOrder::class); }
}
