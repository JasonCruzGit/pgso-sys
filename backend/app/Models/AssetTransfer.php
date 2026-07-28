<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class AssetTransfer extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'transfer_number', 'asset_id', 'from_user_id', 'to_user_id',
        'from_department_id', 'to_department_id', 'transferred_by', 'transfer_date', 'reason',
    ];

    protected function casts(): array
    {
        return ['transfer_date' => 'date'];
    }

    public function asset(): BelongsTo { return $this->belongsTo(Asset::class); }
    public function fromUser(): BelongsTo { return $this->belongsTo(User::class, 'from_user_id'); }
    public function toUser(): BelongsTo { return $this->belongsTo(User::class, 'to_user_id'); }
    public function fromDepartment(): BelongsTo { return $this->belongsTo(Department::class, 'from_department_id'); }
    public function toDepartment(): BelongsTo { return $this->belongsTo(Department::class, 'to_department_id'); }
    public function transferrer(): BelongsTo { return $this->belongsTo(User::class, 'transferred_by'); }
}
