<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class BudgetAllocation extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'department_id', 'fiscal_year', 'category', 'description',
        'allocated_amount', 'spent_amount',
    ];

    protected function casts(): array
    {
        return [
            'allocated_amount' => 'decimal:2',
            'spent_amount' => 'decimal:2',
        ];
    }

    public function department(): BelongsTo { return $this->belongsTo(Department::class); }

    public function getRemainingAmountAttribute(): float
    {
        return (float) $this->allocated_amount - (float) $this->spent_amount;
    }
}
