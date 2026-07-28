<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class BorrowingLog extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'borrow_number', 'asset_id', 'borrower_user_id', 'department_id', 'authorized_by',
        'borrow_date', 'expected_return_date', 'actual_return_date', 'status',
        'condition_on_borrow', 'condition_on_return', 'purpose',
    ];

    protected function casts(): array
    {
        return [
            'borrow_date' => 'date',
            'expected_return_date' => 'date',
            'actual_return_date' => 'date',
        ];
    }

    public function asset(): BelongsTo { return $this->belongsTo(Asset::class); }
    public function borrower(): BelongsTo { return $this->belongsTo(User::class, 'borrower_user_id'); }
    public function department(): BelongsTo { return $this->belongsTo(Department::class); }
    public function authorizer(): BelongsTo { return $this->belongsTo(User::class, 'authorized_by'); }
}
