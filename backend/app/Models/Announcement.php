<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Announcement extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'title', 'body', 'created_by', 'target_scope', 'target_ids',
        'is_pinned', 'expires_at', 'requires_acknowledgement',
    ];

    protected function casts(): array
    {
        return [
            'target_ids' => 'array',
            'is_pinned' => 'boolean',
            'expires_at' => 'datetime',
            'requires_acknowledgement' => 'boolean',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function acknowledgements(): HasMany
    {
        return $this->hasMany(AnnouncementAcknowledgement::class);
    }
}
