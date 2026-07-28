<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\AssetAssignment;
use App\Models\AssetTransfer;
use App\Services\AuditService;
use App\Traits\GeneratesReference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AssetTransferController extends Controller
{
    use GeneratesReference;

    public function __construct(private AuditService $audit) {}

    public function index(Request $request): JsonResponse
    {
        $transfers = AssetTransfer::with([
            'asset.inventoryItem', 'fromUser', 'toUser',
            'fromDepartment', 'toDepartment', 'transferrer',
        ])
            ->when($request->asset_id, fn ($q, $id) => $q->where('asset_id', $id))
            ->when($request->search, fn ($q, $s) => $q->where('transfer_number', 'ilike', "%{$s}%"))
            ->latest('transfer_date')
            ->paginate($request->integer('per_page', 15));

        return response()->json($transfers);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'asset_id' => ['required', 'exists:assets,id'],
            'to_user_id' => ['required', 'exists:users,id'],
            'to_department_id' => ['required', 'exists:departments,id'],
            'transfer_date' => ['required', 'date'],
            'reason' => ['nullable', 'string'],
        ]);

        return DB::transaction(function () use ($data) {
            $asset = Asset::findOrFail($data['asset_id']);

            $transfer = AssetTransfer::create([
                'transfer_number' => $this->generateReference('TRF-', 'asset_transfers', 'transfer_number'),
                'asset_id' => $asset->id,
                'from_user_id' => $asset->custodian_user_id,
                'to_user_id' => $data['to_user_id'],
                'from_department_id' => $asset->department_id,
                'to_department_id' => $data['to_department_id'],
                'transferred_by' => auth('api')->id(),
                'transfer_date' => $data['transfer_date'],
                'reason' => $data['reason'] ?? null,
            ]);

            AssetAssignment::where('asset_id', $asset->id)
                ->where('status', 'active')
                ->update(['status' => 'transferred']);

            $asset->update([
                'custodian_user_id' => $data['to_user_id'],
                'department_id' => $data['to_department_id'],
            ]);

            $this->audit->log('create', 'asset_transfer', "Transferred asset {$asset->property_number}", newValues: $transfer->toArray());

            return response()->json($transfer->load([
                'asset.inventoryItem', 'fromUser', 'toUser',
                'fromDepartment', 'toDepartment', 'transferrer',
            ]), 201);
        });
    }

    public function show(AssetTransfer $assetTransfer): JsonResponse
    {
        return response()->json($assetTransfer->load([
            'asset.inventoryItem', 'fromUser', 'toUser',
            'fromDepartment', 'toDepartment', 'transferrer',
        ]));
    }
}
