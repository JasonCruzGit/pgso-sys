<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\IssuanceRequest;
use App\Services\AuditService;
use App\Services\MaterialReleaseService;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class IssuanceController extends Controller
{
    public function __construct(
        private AuditService $audit,
        private NotificationService $notifications,
        private MaterialReleaseService $materialReleases,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $user = auth('api')->user();

        $requests = IssuanceRequest::with(['department', 'requester', 'items.inventoryItem'])
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->when($request->department_id, fn ($q, $id) => $q->where('department_id', $id))
            ->when($user->hasPermission('requests.view_own') && ! $user->hasPermission('issuance.*'), function ($q) use ($user) {
                $q->where('requested_by', $user->id);
            })
            ->latest('date_requested')
            ->paginate($request->integer('per_page', 15));

        return response()->json($requests);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'department_id' => ['required', 'exists:departments,id'],
            'purpose' => ['required', 'string', 'max:1000'],
            'notes' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.inventory_item_id' => ['required', 'exists:inventory_items,id'],
            'items.*.quantity_requested' => ['required', 'numeric', 'min:0.01'],
        ]);

        return DB::transaction(function () use ($data) {
            $issuance = IssuanceRequest::create([
                'request_number' => 'REQ-'.now()->format('Ymd').'-'.strtoupper(Str::random(4)),
                'department_id' => $data['department_id'],
                'requested_by' => auth('api')->id(),
                'purpose' => $data['purpose'],
                'notes' => $data['notes'] ?? null,
                'status' => 'requested',
                'date_requested' => now(),
            ]);

            foreach ($data['items'] as $item) {
                $issuance->items()->create($item);
            }

            $this->audit->log('create', 'issuance', "Created request {$issuance->request_number}", newValues: $issuance->toArray());
            $this->notifications->notifyPendingApproval($issuance->id, $issuance->request_number);
            $this->notifications->notifyRequestSubmitted(
                auth('api')->user(),
                $issuance->id,
                $issuance->request_number,
            );

            return response()->json($issuance->load(['department', 'requester', 'items.inventoryItem']), 201);
        });
    }

    public function show(IssuanceRequest $issuanceRequest): JsonResponse
    {
        $this->authorizeRequest($issuanceRequest);

        return response()->json($issuanceRequest->load(['department', 'requester', 'approver', 'issuer', 'items.inventoryItem']));
    }

    public function approve(IssuanceRequest $issuanceRequest): JsonResponse
    {
        if ($issuanceRequest->status !== 'requested') {
            return response()->json(['message' => 'Request cannot be approved in current status.'], 422);
        }

        $issuanceRequest->update([
            'status' => 'approved',
            'approved_by' => auth('api')->id(),
            'date_approved' => now(),
        ]);

        $this->audit->log('approval', 'issuance', "Approved request {$issuanceRequest->request_number}");
        $issuanceRequest->load('requester');
        if ($issuanceRequest->requester) {
            $this->notifications->notifyRequestApproved(
                $issuanceRequest->requester,
                $issuanceRequest->id,
                $issuanceRequest->request_number,
            );
        }

        return response()->json($issuanceRequest->fresh()->load(['department', 'requester', 'items.inventoryItem']));
    }

    public function reject(Request $request, IssuanceRequest $issuanceRequest): JsonResponse
    {
        $data = $request->validate(['rejection_reason' => ['required', 'string', 'max:500']]);

        if (! in_array($issuanceRequest->status, ['requested', 'approved'])) {
            return response()->json(['message' => 'Request cannot be rejected in current status.'], 422);
        }

        $issuanceRequest->update([
            'status' => 'rejected',
            'rejection_reason' => $data['rejection_reason'],
        ]);

        $this->audit->log('approval', 'issuance', "Rejected request {$issuanceRequest->request_number}");
        $issuanceRequest->load('requester');
        if ($issuanceRequest->requester) {
            $this->notifications->notifyRequestRejected(
                $issuanceRequest->requester,
                $issuanceRequest->id,
                $issuanceRequest->request_number,
                $data['rejection_reason'],
            );
        }

        return response()->json($issuanceRequest);
    }

    public function release(IssuanceRequest $issuanceRequest): JsonResponse
    {
        $issuanceRequest->load('items.inventoryItem');

        if (! $this->materialReleases->requestHasNonConsumableItems($issuanceRequest)) {
            return response()->json([
                'message' => 'Consumable supplies are issued without MR. Use Issue Supplies instead.',
            ], 422);
        }

        try {
            $this->materialReleases->releaseFromRequest($issuanceRequest);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json(
            $issuanceRequest->fresh()->load(['department', 'issuer', 'requester', 'items.inventoryItem'])
        );
    }

    public function issue(IssuanceRequest $issuanceRequest): JsonResponse
    {
        try {
            $request = $this->materialReleases->issueConsumablesFromRequest($issuanceRequest);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json($request);
    }

    private function authorizeRequest(IssuanceRequest $issuanceRequest): void
    {
        $user = auth('api')->user();
        if ($user->hasPermission('issuance.*') || $user->hasPermission('*')) {
            return;
        }
        if ($issuanceRequest->requested_by !== $user->id) {
            abort(403, 'Unauthorized access to this request.');
        }
    }
}
