<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class GsoInventoryRequest extends Model
{
    use SoftDeletes;

    public const REQUEST_TYPES = [
        'clearance',
        'par',
        'ics',
        'prs',
        'wmr',
        'horm',
        'individual_property_accountability',
        'others',
    ];

    protected $fillable = [
        'control_number',
        'requested_at',
        'employee_name',
        'office_name',
        'request_type',
        'par_is_new',
        'par_is_transfer',
        'ics_is_new',
        'ics_is_transfer',
        'ics_to_name',
        'ics_employee_signature',
        'ics_office',
        'ics_position',
        'ics_id_no',
        'horm_property_or_plate',
        'others_specify',
        'purpose',
        'requester_signature',
        'contact_no',
        'pgso_instruction',
        'remarks',
        'processor_signature',
        'processor_signature_path',
        'approved_name',
        'approved_position',
        'prepared_by',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'requested_at' => 'datetime',
            'par_is_new' => 'boolean',
            'par_is_transfer' => 'boolean',
            'ics_is_new' => 'boolean',
            'ics_is_transfer' => 'boolean',
        ];
    }

    public function preparer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'prepared_by');
    }
}
