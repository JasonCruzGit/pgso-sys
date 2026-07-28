<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class TrackedDocument extends Model
{
    use SoftDeletes;

    public const DIRECTIONS = ['incoming', 'outgoing', 'routing', 'internal'];

    public const STATUSES = ['pending', 'active', 'completed', 'archived'];

    public const FILE_TYPES = ['pdf', 'doc', 'xls', 'image', 'other'];

    public const DOCUMENT_TYPES = ['letter', 'memo', 'report', 'contract', 'endorsement', 'other'];

    protected $fillable = [
        'reference_no', 'document_no', 'title', 'description', 'direction', 'document_type', 'file_type',
        'file_path', 'status', 'is_confidential', 'sender_name', 'recipient_name', 'instruction_for', 'instruction_task',
        'responsible_user_id', 'department_id', 'received_at', 'released_at', 'completed_at', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'is_confidential' => 'boolean',
            'received_at' => 'datetime',
            'released_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function responsible(): BelongsTo
    {
        return $this->belongsTo(User::class, 'responsible_user_id');
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(TrackedDocumentTask::class)->latest();
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(TrackedDocumentAttachment::class)->latest();
    }
}
