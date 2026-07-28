<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountabilityDocument;
use App\Models\AssetAssignment;
use App\Models\MaterialReleaseItem;
use App\Services\AuditService;
use App\Services\PropertyAccountabilityService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;

class PropertyAccountabilityController extends Controller
{
    public function __construct(
        private PropertyAccountabilityService $accountability,
        private AuditService $audit,
    ) {}

    public function documentsIndex(Request $request): JsonResponse
    {
        $documents = AccountabilityDocument::with([
            'custodian',
            'department',
            'materialRelease',
            'assigner',
        ])
            ->withCount('items')
            ->when($request->document_type, fn ($q, $type) => $q->where('document_type', $type))
            ->when($request->status, fn ($q, $status) => $q->where('status', $status))
            ->when($request->search, fn ($q, $search) => $q->where(function ($q) use ($search) {
                $q->where('acknowledgment_number', 'ilike', "%{$search}%")
                    ->orWhere('mr_reference', 'ilike', "%{$search}%")
                    ->orWhere('obr_reference', 'ilike', "%{$search}%")
                    ->orWhereHas('custodian', fn ($q) => $q->where('name', 'ilike', "%{$search}%"))
                    ->orWhereHas('items.asset', fn ($q) => $q->where('property_number', 'ilike', "%{$search}%"));
            }))
            ->when($request->department_id, fn ($q, $id) => $q->where('department_id', $id))
            ->latest('assignment_date')
            ->latest('id')
            ->paginate($request->integer('per_page', 50));

        return response()->json($documents);
    }

    public function documentsShow(AccountabilityDocument $accountabilityDocument): JsonResponse
    {
        return response()->json(
            $accountabilityDocument->load([
                'custodian',
                'department',
                'assigner',
                'materialRelease.releaser',
                'items.asset.inventoryItem.category',
                'items.materialReleaseItem.inventoryItem',
                'items.custodian',
                'items.department',
                'items.assigner',
            ])
        );
    }

    public function index(Request $request): JsonResponse
    {
        $assignments = AssetAssignment::with([
            'accountabilityDocument',
            'asset.inventoryItem.category',
            'custodian',
            'department',
            'assigner',
            'materialRelease',
            'materialReleaseItem.inventoryItem',
        ])
            ->whereIn('document_type', ['par', 'ics'])
            ->when($request->document_type, fn ($q, $type) => $q->where('document_type', $type))
            ->when($request->status, fn ($q, $status) => $q->where('status', $status))
            ->when($request->search, fn ($q, $search) => $q->where(function ($q) use ($search) {
                $q->where('acknowledgment_number', 'ilike', "%{$search}%")
                    ->orWhere('assignment_number', 'ilike', "%{$search}%")
                    ->orWhereHas('materialRelease', fn ($q) => $q->where('mr_number', 'ilike', "%{$search}%"))
                    ->orWhereHas('custodian', fn ($q) => $q->where('name', 'ilike', "%{$search}%"))
                    ->orWhereHas('asset', fn ($q) => $q->where('property_number', 'ilike', "%{$search}%"));
            }))
            ->when($request->department_id, fn ($q, $id) => $q->where('department_id', $id))
            ->latest('assignment_date')
            ->paginate($request->integer('per_page', 15));

        return response()->json($assignments);
    }

    public function pending(): JsonResponse
    {
        return response()->json([
            'data' => $this->accountability->pendingMrItems(),
        ]);
    }

    public function assignableAssets(Request $request): JsonResponse
    {
        $request->validate([
            'document_type' => ['nullable', 'in:par,ics'],
        ]);

        return response()->json([
            'data' => $this->accountability->assignableAssets($request->document_type),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'asset_id' => ['required_without:received_item_id', 'nullable', 'exists:assets,id'],
            'received_item_id' => ['required_without:asset_id', 'nullable', 'exists:received_items,id'],
            'custodian_user_id' => ['required', 'exists:users,id'],
            'department_id' => ['required', 'exists:departments,id'],
            'assignment_date' => ['required', 'date'],
            'document_type' => ['required', 'in:par,ics'],
            'mr_reference' => ['nullable', 'string', 'max:100'],
            'obr_reference' => ['nullable', 'string', 'max:100'],
            'fund_code' => ['nullable', 'string', 'max:20'],
            'fund_name' => ['nullable', 'string', 'max:255'],
            'location' => ['nullable', 'string', 'max:255'],
            'condition' => ['nullable', 'in:excellent,good,fair,poor,damaged'],
            'notes' => ['nullable', 'string'],
        ]);

        try {
            $assignment = $this->accountability->createManual($data);
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $this->audit->log(
            'create',
            'asset_assignment',
            "Issued manual {$assignment->document_type} {$assignment->acknowledgment_number}",
            newValues: $assignment->toArray(),
        );

        return response()->json($assignment, 201);
    }

    public function show(AssetAssignment $assetAssignment): JsonResponse
    {
        if (! in_array($assetAssignment->document_type, ['par', 'ics'], true)) {
            abort(404, 'Accountability record not found.');
        }

        return response()->json(
            $assetAssignment->load([
                'accountabilityDocument',
                'asset.inventoryItem.category',
                'custodian',
                'department',
                'assigner',
                'materialRelease.releaser',
                'materialReleaseItem.inventoryItem',
            ])
        );
    }

    public function storeFromMrItem(Request $request, MaterialReleaseItem $materialReleaseItem): JsonResponse
    {
        $data = $request->validate([
            'document_type' => ['nullable', 'in:par,ics'],
            'location' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
        ]);

        try {
            $assignment = $this->accountability->createFromMrItem(
                $materialReleaseItem,
                $data['document_type'] ?? null,
                $data['location'] ?? null,
                $data['notes'] ?? null,
            );
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        $this->audit->log(
            'create',
            'asset_assignment',
            "Issued {$assignment->document_type} {$assignment->acknowledgment_number} from MR {$assignment->materialRelease?->mr_number}",
            newValues: $assignment->toArray(),
        );

        return response()->json($assignment, 201);
    }
}
