<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BorrowingLog;
use App\Services\AuditService;
use App\Traits\GeneratesReference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BorrowingLogController extends Controller
{
    use GeneratesReference;

    public function __construct(private AuditService $audit) {}

    public function index(Request $request): JsonResponse
    {
        BorrowingLog::where('status', 'active')
            ->where('expected_return_date', '<', now()->toDateString())
            ->update(['status' => 'overdue']);

        $logs = BorrowingLog::with(['asset.inventoryItem', 'borrower', 'department', 'authorizer'])
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->when($request->asset_id, fn ($q, $id) => $q->where('asset_id', $id))
            ->when($request->search, fn ($q, $s) => $q->where('borrow_number', 'ilike', "%{$s}%"))
            ->latest('borrow_date')
            ->paginate($request->integer('per_page', 15));

        return response()->json($logs);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'asset_id' => ['required', 'exists:assets,id'],
            'borrower_user_id' => ['required', 'exists:users,id'],
            'department_id' => ['required', 'exists:departments,id'],
            'borrow_date' => ['required', 'date'],
            'expected_return_date' => ['required', 'date', 'after_or_equal:borrow_date'],
            'condition_on_borrow' => ['required', 'in:excellent,good,fair,poor,unserviceable'],
            'purpose' => ['nullable', 'string'],
        ]);

        $log = BorrowingLog::create([
            'borrow_number' => $this->generateReference('BRW-', 'borrowing_logs', 'borrow_number'),
            'asset_id' => $data['asset_id'],
            'borrower_user_id' => $data['borrower_user_id'],
            'department_id' => $data['department_id'],
            'authorized_by' => auth('api')->id(),
            'borrow_date' => $data['borrow_date'],
            'expected_return_date' => $data['expected_return_date'],
            'condition_on_borrow' => $data['condition_on_borrow'],
            'purpose' => $data['purpose'] ?? null,
            'status' => 'active',
        ]);

        $this->audit->log('create', 'borrowing', "Created borrow record {$log->borrow_number}", newValues: $log->toArray());

        return response()->json($log->load(['asset.inventoryItem', 'borrower', 'department', 'authorizer']), 201);
    }

    public function returnBorrow(Request $request, BorrowingLog $borrowingLog): JsonResponse
    {
        $data = $request->validate([
            'condition_on_return' => ['required', 'in:excellent,good,fair,poor,unserviceable'],
            'actual_return_date' => ['nullable', 'date'],
        ]);

        if (! in_array($borrowingLog->status, ['active', 'overdue'])) {
            return response()->json(['message' => 'Borrow record is not active.'], 422);
        }

        $borrowingLog->update([
            'status' => 'returned',
            'condition_on_return' => $data['condition_on_return'],
            'actual_return_date' => $data['actual_return_date'] ?? now()->toDateString(),
        ]);

        $this->audit->log('update', 'borrowing', "Returned borrow record {$borrowingLog->borrow_number}");

        return response()->json($borrowingLog->fresh()->load(['asset.inventoryItem', 'borrower', 'department']));
    }
}
