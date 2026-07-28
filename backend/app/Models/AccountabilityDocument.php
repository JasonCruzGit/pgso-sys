<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class AccountabilityDocument extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'acknowledgment_number',
        'document_type',
        'custodian_user_id',
        'department_id',
        'material_release_id',
        'assignment_date',
        'fund_code',
        'fund_name',
        'obr_reference',
        'mr_reference',
        'assigned_by',
        'status',
        'notes',
    ];

    protected function casts(): array
    {
        return ['assignment_date' => 'date'];
    }

    public function custodian(): BelongsTo
    {
        return $this->belongsTo(User::class, 'custodian_user_id');
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function materialRelease(): BelongsTo
    {
        return $this->belongsTo(MaterialRelease::class);
    }

    public function assigner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }

    public function items(): HasMany
    {
        return $this->hasMany(AssetAssignment::class, 'accountability_document_id');
    }
}
