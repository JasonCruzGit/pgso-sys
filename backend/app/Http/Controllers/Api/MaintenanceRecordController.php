<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MaintenanceRecord;
use App\Services\AuditService;
use App\Traits\GeneratesReference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MaintenanceRecordController extends Controller
{
    use GeneratesReference;

    public function __construct(private AuditService $audit) {}

    public function index(Request $request): JsonResponse
    {
        $records = MaintenanceRecord::with(['asset.inventoryItem', 'performer'])
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->when($request->asset_id, fn ($q, $id) => $q->where('asset_id', $id))
            ->when($request->type, fn ($q, $t) => $q->where('type', $t))
            ->when($request->search, fn ($q, $s) => $q->where('maintenance_number', 'ilike', "%{$s}%"))
            ->latest('scheduled_date')
            ->paginate($request->integer('per_page', 15));

        return response()->json($records);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'asset_id' => ['required', 'exists:assets,id'],
            'type' => ['required', 'in:preventive,corrective'],
            'scheduled_date' => ['nullable', 'date'],
            'service_provider' => ['nullable', 'string', 'max:255'],
            'cost' => ['nullable', 'numeric', 'min:0'],
            'description' => ['nullable', 'string'],
            'document' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:5120'],
        ]);

        $documentPath = null;
        if ($request->hasFile('document')) {
            $documentPath = $request->file('document')->store('maintenance', 'local');
        }

        $record = MaintenanceRecord::create([
            'maintenance_number' => $this->generateReference('MNT-', 'maintenance_records', 'maintenance_number'),
            'asset_id' => $data['asset_id'],
            'type' => $data['type'],
            'scheduled_date' => $data['scheduled_date'] ?? null,
            'service_provider' => $data['service_provider'] ?? null,
            'cost' => $data['cost'] ?? 0,
            'description' => $data['description'] ?? null,
            'document_path' => $documentPath,
            'status' => 'scheduled',
        ]);

        $this->audit->log('create', 'maintenance', "Created maintenance {$record->maintenance_number}", newValues: $record->toArray());

        return response()->json($record->load(['asset.inventoryItem', 'performer']), 201);
    }

    public function show(MaintenanceRecord $maintenanceRecord): JsonResponse
    {
        return response()->json($maintenanceRecord->load(['asset.inventoryItem', 'performer']));
    }

    public function complete(Request $request, MaintenanceRecord $maintenanceRecord): JsonResponse
    {
        $data = $request->validate([
            'completed_date' => ['nullable', 'date'],
            'cost' => ['nullable', 'numeric', 'min:0'],
            'description' => ['nullable', 'string'],
            'performed_by' => ['nullable', 'exists:users,id'],
        ]);

        if (! in_array($maintenanceRecord->status, ['scheduled', 'in_progress'])) {
            return response()->json(['message' => 'Maintenance record cannot be completed in current status.'], 422);
        }

        $maintenanceRecord->update([
            'status' => 'completed',
            'completed_date' => $data['completed_date'] ?? now()->toDateString(),
            'cost' => $data['cost'] ?? $maintenanceRecord->cost,
            'description' => $data['description'] ?? $maintenanceRecord->description,
            'performed_by' => $data['performed_by'] ?? auth('api')->id(),
        ]);

        $this->audit->log('update', 'maintenance', "Completed maintenance {$maintenanceRecord->maintenance_number}");

        return response()->json($maintenanceRecord->fresh()->load(['asset.inventoryItem', 'performer']));
    }
}
