<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class IssuanceRequest extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'request_number', 'mr_number', 'department_id', 'requested_by', 'approved_by',
        'issued_by', 'status', 'purpose', 'date_requested', 'date_approved',
        'date_issued', 'notes', 'rejection_reason',
    ];

    protected function casts(): array
    {
        return [
            'date_requested' => 'datetime',
            'date_approved' => 'datetime',
            'date_issued' => 'datetime',
        ];
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function issuer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'issued_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(IssuanceItem::class);
    }
}
