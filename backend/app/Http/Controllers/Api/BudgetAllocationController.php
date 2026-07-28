<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BudgetAllocation;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BudgetAllocationController extends Controller
{
    public function __construct(private AuditService $audit) {}

    public function index(Request $request): JsonResponse
    {
        $allocations = BudgetAllocation::with('department')
            ->when($request->department_id, fn ($q, $id) => $q->where('department_id', $id))
            ->when($request->fiscal_year, fn ($q, $y) => $q->where('fiscal_year', $y))
            ->when($request->category, fn ($q, $c) => $q->where('category', $c))
            ->when($request->search, fn ($q, $s) => $q->where('description', 'ilike', "%{$s}%")
                ->orWhere('category', 'ilike', "%{$s}%"))
            ->latest()
            ->paginate($request->integer('per_page', 15));

        return response()->json($allocations);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'department_id' => ['required', 'exists:departments,id'],
            'fiscal_year' => ['required', 'string', 'max:9'],
            'category' => ['nullable', 'string', 'max:100'],
            'description' => ['nullable', 'string'],
            'allocated_amount' => ['required', 'numeric', 'min:0.01'],
        ]);

        $allocation = BudgetAllocation::create($data);

        $this->audit->log('create', 'budget_allocation', "Created budget allocation for {$allocation->fiscal_year}", newValues: $allocation->toArray());

        return response()->json($allocation->load('department'), 201);
    }

    public function show(BudgetAllocation $budgetAllocation): JsonResponse
    {
        return response()->json($budgetAllocation->load('department'));
    }

    public function update(Request $request, BudgetAllocation $budgetAllocation): JsonResponse
    {
        $old = $budgetAllocation->toArray();
        $data = $request->validate([
            'category' => ['nullable', 'string', 'max:100'],
            'description' => ['nullable', 'string'],
            'allocated_amount' => ['sometimes', 'numeric', 'min:0.01'],
            'spent_amount' => ['sometimes', 'numeric', 'min:0'],
        ]);

        $budgetAllocation->update($data);

        $this->audit->log('update', 'budget_allocation', "Updated budget allocation {$budgetAllocation->id}", $old, $budgetAllocation->fresh()->toArray());

        return response()->json($budgetAllocation->load('department'));
    }
}
