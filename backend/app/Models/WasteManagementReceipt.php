<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class WasteManagementReceipt extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'wmr_number',
        'disposal_date',
        'department_id',
        'disposal_location',
        'mode_of_disposal',
        'remarks',
        'status',
        'prepared_by',
        'witness_name',
    ];

    protected function casts(): array
    {
        return [
            'disposal_date' => 'date',
        ];
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function preparer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'prepared_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(WasteManagementReceiptItem::class);
    }
}
