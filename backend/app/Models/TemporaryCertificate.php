<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class TemporaryCertificate extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'control_number',
        'request_date',
        'requester_name',
        'requester_position',
        'requester_office',
        'recipient_name',
        'recipient_position',
        'recipient_office',
        'transfer_reason',
        'conformed_name',
        'conformed_position',
        'conformed_office',
        'attested_name',
        'attested_position',
        'attested_office',
        'approved_name',
        'approved_position',
        'prepared_by',
        'status',
    ];

    protected function casts(): array
    {
        return ['request_date' => 'date'];
    }

    public function preparer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'prepared_by');
    }
}
