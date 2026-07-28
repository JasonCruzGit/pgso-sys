<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PurchaseRequest;
use App\Services\AuditService;
use App\Traits\GeneratesReference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PurchaseRequestController extends Controller
{
    use GeneratesReference;

    public function __construct(private AuditService $audit) {}

    public function index(Request $request): JsonResponse
    {
        $user = auth('api')->user();

        $requests = PurchaseRequest::with(['department', 'requester', 'approver', 'budgetAllocation', 'items.inventoryItem'])
            ->when($user->hasPermission('procurement.view_own') && ! $user->hasPermission('procurement.*'), function ($q) use ($user) {
                $q->where('requested_by', $user->id);
            })
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->when($request->pr_number, fn ($q, $n) => $q->where('pr_number', $n))
            ->when($request->department_id, fn ($q, $id) => $q->where('department_id', $id))
            ->when($request->search, fn ($q, $s) => $q->where(function ($q) use ($s) {
                $q->where('pr_number', 'ilike', "%{$s}%")
                    ->orWhere('title', 'ilike', "%{$s}%");
            }))
            ->latest()
            ->paginate($request->integer('per_page', 15));

        return response()->json($requests);
    }

    public function store(Request $request): JsonResponse
    {
        $isDraft = $request->boolean('save_as_draft');

        $data = $request->validate([
            'pr_number' => ['required', 'string', 'max:50', 'unique:purchase_requests,pr_number'],
            'department_id' => ['required', 'exists:departments,id'],
            'title' => [$isDraft ? 'nullable' : 'required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'date_needed' => ['nullable', 'date', Rule::when(! $isDraft, 'after_or_equal:today')],
            'mode_of_procurement' => ['nullable', 'string', 'max:100'],
            'budget_allocation_id' => ['nullable', 'exists:budget_allocations,id'],
            'attachment' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png,doc,docx', 'max:5120'],
            'items' => [$isDraft ? 'nullable' : 'required', 'array', $isDraft ? 'min:0' : 'min:1'],
            'items.*.inventory_item_id' => ['nullable', 'exists:inventory_items,id'],
            'items.*.description' => [$isDraft ? 'nullable' : 'required', 'string', 'max:500'],
            'items.*.unit_of_measure' => ['nullable', 'string', 'max:30'],
            'items.*.brand' => ['nullable', 'string', 'max:100'],
            'items.*.model' => ['nullable', 'string', 'max:100'],
            'items.*.serial_number' => ['nullable', 'string', 'max:100'],
            'items.*.quantity' => [$isDraft ? 'nullable' : 'required', 'numeric', 'min:0.01'],
            'items.*.unit_cost' => [$isDraft ? 'nullable' : 'required', 'numeric', 'min:0'],
        ]);

        $items = collect($data['items'] ?? [])
            ->filter(fn ($item) => filled($item['description'] ?? null)
                && filled($item['quantity'] ?? null)
                && filled($item['unit_cost'] ?? null))
            ->values()
            ->all();

        if (! $isDraft && empty($items)) {
            return response()->json(['message' => 'At least one complete line item is required.'], 422);
        }

        return DB::transaction(function () use ($request, $data, $items, $isDraft) {
            $attachmentPath = null;
            if ($request->hasFile('attachment')) {
                $attachmentPath = $request->file('attachment')->store('purchase_requests', 'local');
            }

            $totalCost = collect($items)->sum(fn ($item) => $item['quantity'] * $item['unit_cost']);

            $pr = PurchaseRequest::create([
                'pr_number' => $data['pr_number'],
                'department_id' => $data['department_id'],
                'requested_by' => auth('api')->id(),
                'title' => $data['title'] ?? 'Draft Purchase Request',
                'description' => $data['description'] ?? null,
                'date_needed' => $data['date_needed'] ?? null,
                'mode_of_procurement' => $data['mode_of_procurement'] ?? null,
                'budget_allocation_id' => $data['budget_allocation_id'] ?? null,
                'total_estimated_cost' => $totalCost,
                'status' => 'draft',
                'attachment_path' => $attachmentPath,
            ]);

            foreach ($items as $item) {
                $pr->items()->create($item);
            }

            $action = $isDraft ? 'Saved draft PR' : 'Created PR';
            $this->audit->log('create', 'purchase_request', "{$action} {$pr->pr_number}", newValues: $pr->toArray());

            return response()->json($pr->load(['department', 'requester', 'budgetAllocation', 'items.inventoryItem']), 201);
        });
    }

    public function show(PurchaseRequest $purchaseRequest): JsonResponse
    {
        return response()->json($purchaseRequest->load(['department', 'requester', 'approver', 'budgetAllocation', 'items.inventoryItem']));
    }

    public function submit(PurchaseRequest $purchaseRequest): JsonResponse
    {
        if ($purchaseRequest->status !== 'draft') {
            return response()->json(['message' => 'Only draft purchase requests can be submitted.'], 422);
        }

        $purchaseRequest->update([
            'status' => 'submitted',
            'submitted_at' => now(),
        ]);

        $this->audit->log('update', 'purchase_request', "Submitted PR {$purchaseRequest->pr_number}");

        return response()->json($purchaseRequest->fresh()->load(['department', 'requester', 'items.inventoryItem']));
    }

    public function approve(PurchaseRequest $purchaseRequest): JsonResponse
    {
        if ($purchaseRequest->status !== 'submitted') {
            return response()->json(['message' => 'Only submitted purchase requests can be approved.'], 422);
        }

        $purchaseRequest->update([
            'status' => 'approved',
            'approved_by' => auth('api')->id(),
            'approved_at' => now(),
        ]);

        $this->audit->log('approval', 'purchase_request', "Approved PR {$purchaseRequest->pr_number}");

        return response()->json($purchaseRequest->fresh()->load(['department', 'requester', 'approver', 'items.inventoryItem']));
    }

    public function reject(Request $request, PurchaseRequest $purchaseRequest): JsonResponse
    {
        $data = $request->validate(['rejection_reason' => ['required', 'string', 'max:500']]);

        if (! in_array($purchaseRequest->status, ['submitted', 'approved'])) {
            return response()->json(['message' => 'Purchase request cannot be rejected in current status.'], 422);
        }

        $purchaseRequest->update([
            'status' => 'rejected',
            'rejection_reason' => $data['rejection_reason'],
        ]);

        $this->audit->log('approval', 'purchase_request', "Rejected PR {$purchaseRequest->pr_number}");

        return response()->json($purchaseRequest->load(['department', 'requester', 'items.inventoryItem']));
    }
}
