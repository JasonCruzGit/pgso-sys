<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class CondemnationRecord extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'condemnation_number', 'asset_id', 'inspection_id', 'findings',
        'status', 'recommended_by', 'approved_by', 'approval_date',
    ];

    protected function casts(): array
    {
        return ['approval_date' => 'date'];
    }

    public function asset(): BelongsTo { return $this->belongsTo(Asset::class); }
    public function inspection(): BelongsTo { return $this->belongsTo(Inspection::class); }
    public function recommender(): BelongsTo { return $this->belongsTo(User::class, 'recommended_by'); }
    public function approver(): BelongsTo { return $this->belongsTo(User::class, 'approved_by'); }
}
