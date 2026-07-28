<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\AssetAssignment;
use App\Models\User;
use App\Services\AuditService;
use App\Traits\GeneratesReference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AssetAssignmentController extends Controller
{
    use GeneratesReference;

    public function __construct(private AuditService $audit) {}

    public function index(Request $request): JsonResponse
    {
        $assignments = AssetAssignment::with(['asset.inventoryItem', 'custodian', 'department', 'assigner'])
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->when($request->asset_id, fn ($q, $id) => $q->where('asset_id', $id))
            ->when($request->search, fn ($q, $s) => $q->where('assignment_number', 'ilike', "%{$s}%")
                ->orWhere('acknowledgment_number', 'ilike', "%{$s}%"))
            ->latest('assignment_date')
            ->paginate($request->integer('per_page', 15));

        return response()->json($assignments);
    }

    public function custodians(Request $request): JsonResponse
    {
        $employees = User::with('department:id,name')
            ->where('is_active', true)
            ->when($request->search, fn ($q, $s) => $q->where(function ($q) use ($s) {
                $q->where('name', 'ilike', "%{$s}%")
                    ->orWhere('email', 'ilike', "%{$s}%")
                    ->orWhere('employee_id', 'ilike', "%{$s}%");
            }))
            ->when($request->department_id, fn ($q, $id) => $q->where('department_id', $id))
            ->orderBy('name')
            ->limit(200)
            ->get(['id', 'name', 'email', 'employee_id', 'department_id']);

        return response()->json(['data' => $employees]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'asset_id' => ['required', 'exists:assets,id'],
            'custodian_user_id' => ['required', 'exists:users,id'],
            'department_id' => ['required', 'exists:departments,id'],
            'assignment_date' => ['required', 'date'],
            'document_type' => ['required', 'in:par,ics'],
            'location' => ['nullable', 'string', 'max:255'],
            'condition' => ['nullable', 'in:excellent,good,fair,poor,damaged'],
            'notes' => ['nullable', 'string'],
        ]);

        return DB::transaction(function () use ($data) {
            $asset = Asset::with('inventoryItem')->findOrFail($data['asset_id']);

            $activeAssignment = AssetAssignment::where('asset_id', $asset->id)
                ->where('status', 'active')
                ->exists();

            if ($activeAssignment) {
                return response()->json(['message' => 'Asset already has an active assignment.'], 422);
            }

            $ackPrefix = strtoupper($data['document_type']);
            $acknowledgmentNumber = $this->generateReference("{$ackPrefix}-", 'asset_assignments', 'acknowledgment_number');

            $qrVerificationData = json_encode([
                'acknowledgment_number' => $acknowledgmentNumber,
                'document_type' => $data['document_type'],
                'property_number' => $asset->property_number,
                'item_name' => $asset->inventoryItem?->name,
                'custodian_id' => $data['custodian_user_id'],
                'department_id' => $data['department_id'],
                'assignment_date' => $data['assignment_date'],
            ]);

            $assignment = AssetAssignment::create([
                'assignment_number' => $this->generateReference('ASN-', 'asset_assignments', 'assignment_number'),
                'asset_id' => $asset->id,
                'custodian_user_id' => $data['custodian_user_id'],
                'department_id' => $data['department_id'],
                'assigned_by' => auth('api')->id(),
                'assignment_date' => $data['assignment_date'],
                'document_type' => $data['document_type'],
                'acknowledgment_number' => $acknowledgmentNumber,
                'qr_verification_data' => $qrVerificationData,
                'status' => 'active',
                'notes' => $data['notes'] ?? null,
            ]);

            $asset->update([
                'custodian_user_id' => $data['custodian_user_id'],
                'department_id' => $data['department_id'],
                'location' => $data['location'] ?? $asset->location,
                'condition' => $data['condition'] ?? $asset->condition,
            ]);

            $qrData = json_decode($asset->qr_code_data, true) ?? [];
            $qrData['location'] = $asset->location;
            $qrData['custodian_id'] = $asset->custodian_user_id;
            $qrData['condition'] = $asset->condition;
            $asset->update(['qr_code_data' => json_encode($qrData)]);

            $this->audit->log('create', 'asset_assignment', "Assigned asset {$asset->property_number}", newValues: $assignment->toArray());

            return response()->json($assignment->load(['asset.inventoryItem', 'custodian', 'department', 'assigner']), 201);
        });
    }

    public function show(AssetAssignment $assetAssignment): JsonResponse
    {
        return response()->json($assetAssignment->load(['asset.inventoryItem', 'custodian', 'department', 'assigner']));
    }

    public function returnAsset(AssetAssignment $assetAssignment): JsonResponse
    {
        if ($assetAssignment->status !== 'active') {
            return response()->json(['message' => 'Only active assignments can be returned.'], 422);
        }

        return DB::transaction(function () use ($assetAssignment) {
            $assetAssignment->update(['status' => 'returned']);

            $asset = Asset::findOrFail($assetAssignment->asset_id);
            $asset->update(['custodian_user_id' => null]);

            $this->audit->log('update', 'asset_assignment', "Returned assignment {$assetAssignment->assignment_number}");

            return response()->json($assetAssignment->fresh()->load(['asset.inventoryItem', 'custodian', 'department']));
        });
    }

    public function employeeAccountability(User $user): JsonResponse
    {
        $active = AssetAssignment::with(['asset.inventoryItem', 'department'])
            ->where('custodian_user_id', $user->id)
            ->where('status', 'active')
            ->get();

        $history = AssetAssignment::with(['asset.inventoryItem', 'department'])
            ->where('custodian_user_id', $user->id)
            ->latest('assignment_date')
            ->limit(50)
            ->get();

        return response()->json([
            'employee' => $user->only(['id', 'name', 'email', 'employee_id']),
            'active_assignments' => $active,
            'history' => $history,
        ]);
    }
}
