<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class AssetAssignment extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'assignment_number', 'asset_id', 'accountability_document_id', 'material_release_id', 'material_release_item_id',
        'received_item_id', 'custodian_user_id', 'department_id',
        'assigned_by', 'assignment_date', 'document_type', 'acknowledgment_number',
        'qr_verification_data', 'digital_signature_path', 'status', 'notes',
    ];

    protected function casts(): array
    {
        return ['assignment_date' => 'date'];
    }

    public function asset(): BelongsTo { return $this->belongsTo(Asset::class); }
    public function accountabilityDocument(): BelongsTo { return $this->belongsTo(AccountabilityDocument::class); }
    public function materialRelease(): BelongsTo { return $this->belongsTo(MaterialRelease::class); }
    public function materialReleaseItem(): BelongsTo { return $this->belongsTo(MaterialReleaseItem::class); }
    public function receivedItem(): BelongsTo { return $this->belongsTo(ReceivedItem::class); }
    public function custodian(): BelongsTo { return $this->belongsTo(User::class, 'custodian_user_id'); }
    public function department(): BelongsTo { return $this->belongsTo(Department::class); }
    public function assigner(): BelongsTo { return $this->belongsTo(User::class, 'assigned_by'); }
}
