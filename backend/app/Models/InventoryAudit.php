<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class InventoryAudit extends Model
{
    use SoftDeletes;

    protected $fillable = ['audit_number', 'title', 'status', 'started_by', 'completed_at', 'notes'];

    protected function casts(): array
    {
        return ['completed_at' => 'datetime'];
    }

    public function starter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'started_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(InventoryAuditItem::class);
    }
}
