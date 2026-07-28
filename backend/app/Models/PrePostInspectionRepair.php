<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class PrePostInspectionRepair extends Model
{
    use SoftDeletes;

    public const EQUIPMENT_CATEGORIES = [
        'heavy_equipment',
        'pick_up',
        'motorcycle',
        'van',
        'truck',
        'ambulance',
        'coaster',
        'bus',
        'seacraft',
        'office_it_equipment',
        'others',
    ];

    protected $fillable = [
        'control_number',
        'form_date',
        'pre_inspection',
        'pre_inspection_date',
        'post_inspection',
        'post_inspection_date',
        'equipment_category',
        'equipment_category_notes',
        'property_no',
        'type',
        'brand',
        'model',
        'engine_no',
        'chassis_no',
        'serial_no',
        'plate_no',
        'date_of_acquisition',
        'date_of_last_repair',
        'location_of_eqpt',
        'date_of_request',
        'office',
        'requisitioner',
        'requisitioner_signature_path',
        'approved_name',
        'approved_position',
        'approval_date',
        'inspector_1',
        'inspector_2',
        'inspector_3',
        'prepared_by',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'form_date' => 'date',
            'pre_inspection' => 'boolean',
            'pre_inspection_date' => 'date',
            'post_inspection' => 'boolean',
            'post_inspection_date' => 'date',
            'date_of_acquisition' => 'date',
            'date_of_last_repair' => 'date',
            'date_of_request' => 'date',
            'approval_date' => 'date',
        ];
    }

    public function preparer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'prepared_by');
    }
}
