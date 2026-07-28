<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class RealProperty extends Model
{
    use SoftDeletes;

    public const STATUSES = ['active', 'under_construction', 'leased', 'inactive', 'disposed'];

    public const SOURCES = [
        'purchase',
        'donation',
        'construction',
        'transfer',
        'legacy_registry',
        'other',
    ];

    protected $fillable = [
        'account_name',
        'property_no',
        'article',
        'description',
        'location',
        'qty',
        'uom',
        'unit_cost',
        'acquisition_cost',
        'acquisition_date',
        'status',
        'office',
        'department_id',
        'obr_no',
        'remarks',
        'source',
    ];

    protected function casts(): array
    {
        return [
            'qty' => 'decimal:2',
            'unit_cost' => 'decimal:2',
            'acquisition_cost' => 'decimal:2',
            'acquisition_date' => 'date',
        ];
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }
}
