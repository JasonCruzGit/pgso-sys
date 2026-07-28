<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RepairRecord;
use App\Services\AuditService;
use App\Traits\GeneratesReference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RepairRecordController extends Controller
{
    use GeneratesReference;

    public function __construct(private AuditService $audit) {}

    public function index(Request $request): JsonResponse
    {
        $records = RepairRecord::with(['asset.inventoryItem', 'recorder'])
            ->when($request->asset_id, fn ($q, $id) => $q->where('asset_id', $id))
            ->when($request->search, fn ($q, $s) => $q->where('repair_number', 'ilike', "%{$s}%")
                ->orWhere('service_provider', 'ilike', "%{$s}%"))
            ->latest('repair_date')
            ->paginate($request->integer('per_page', 15));

        return response()->json($records);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'asset_id' => ['required', 'exists:assets,id'],
            'service_provider' => ['nullable', 'string', 'max:255'],
            'repair_date' => ['required', 'date'],
            'cost' => ['nullable', 'numeric', 'min:0'],
            'description' => ['nullable', 'string'],
            'report' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:5120'],
        ]);

        $reportPath = null;
        if ($request->hasFile('report')) {
            $reportPath = $request->file('report')->store('repairs', 'local');
        }

        $record = RepairRecord::create([
            'repair_number' => $this->generateReference('REP-', 'repair_records', 'repair_number'),
            'asset_id' => $data['asset_id'],
            'service_provider' => $data['service_provider'] ?? null,
            'repair_date' => $data['repair_date'],
            'cost' => $data['cost'] ?? 0,
            'description' => $data['description'] ?? null,
            'report_path' => $reportPath,
            'recorded_by' => auth('api')->id(),
        ]);

        $this->audit->log('create', 'repair', "Created repair record {$record->repair_number}", newValues: $record->toArray());

        return response()->json($record->load(['asset.inventoryItem', 'recorder']), 201);
    }

    public function show(RepairRecord $repairRecord): JsonResponse
    {
        return response()->json($repairRecord->load(['asset.inventoryItem', 'recorder']));
    }
}
