<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class MaterialRelease extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'mr_number', 'recipient_user_id', 'department_id', 'purpose',
        'released_by', 'release_date', 'issuance_request_id', 'source', 'notes',
        'status', 'draft_items',
    ];

    protected function casts(): array
    {
        return [
            'release_date' => 'datetime',
            'draft_items' => 'array',
        ];
    }

    public function recipient(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recipient_user_id');
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function releaser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'released_by');
    }

    public function issuanceRequest(): BelongsTo
    {
        return $this->belongsTo(IssuanceRequest::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(MaterialReleaseItem::class);
    }
}
