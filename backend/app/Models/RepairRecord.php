<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class RepairRecord extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'repair_number', 'asset_id', 'service_provider', 'repair_date',
        'cost', 'description', 'report_path', 'recorded_by',
    ];

    protected function casts(): array
    {
        return [
            'repair_date' => 'date',
            'cost' => 'decimal:2',
        ];
    }

    public function asset(): BelongsTo { return $this->belongsTo(Asset::class); }
    public function recorder(): BelongsTo { return $this->belongsTo(User::class, 'recorded_by'); }
}
