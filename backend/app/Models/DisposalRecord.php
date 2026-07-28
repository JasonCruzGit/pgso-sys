<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class DisposalRecord extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'disposal_number', 'asset_id', 'inventory_item_id', 'recommendation_date',
        'reason', 'status', 'recommended_by', 'approved_by', 'disposal_date', 'notes',
    ];

    protected function casts(): array
    {
        return [
            'recommendation_date' => 'date',
            'disposal_date' => 'date',
        ];
    }

    public function asset(): BelongsTo { return $this->belongsTo(Asset::class); }
    public function inventoryItem(): BelongsTo { return $this->belongsTo(InventoryItem::class); }
    public function recommender(): BelongsTo { return $this->belongsTo(User::class, 'recommended_by'); }
    public function approver(): BelongsTo { return $this->belongsTo(User::class, 'approved_by'); }
}
