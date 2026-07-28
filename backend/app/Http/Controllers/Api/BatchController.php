<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Batch;
use App\Services\AuditService;
use App\Traits\GeneratesReference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BatchController extends Controller
{
    use GeneratesReference;

    public function __construct(private AuditService $audit) {}

    public function index(Request $request): JsonResponse
    {
        $batches = Batch::with('inventoryItem')
            ->when($request->inventory_item_id, fn ($q, $id) => $q->where('inventory_item_id', $id))
            ->when($request->boolean('expiring'), function ($q) {
                $q->whereNotNull('expiration_date')
                    ->where('expiration_date', '<=', now()->addDays(30))
                    ->where('quantity', '>', 0);
            })
            ->when($request->search, fn ($q, $s) => $q->where('batch_number', 'ilike', "%{$s}%")
                ->orWhere('lot_number', 'ilike', "%{$s}%"))
            ->latest()
            ->paginate($request->integer('per_page', 15));

        return response()->json($batches);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'inventory_item_id' => ['required', 'exists:inventory_items,id'],
            'batch_number' => ['required', 'string', 'max:50'],
            'lot_number' => ['nullable', 'string', 'max:50'],
            'manufacturing_date' => ['nullable', 'date'],
            'expiration_date' => ['nullable', 'date'],
            'quantity' => ['required', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
        ]);

        $batch = Batch::create($data);

        $this->audit->log('create', 'batch', "Created batch {$batch->batch_number}", newValues: $batch->toArray());

        return response()->json($batch->load('inventoryItem'), 201);
    }

    public function show(Batch $batch): JsonResponse
    {
        return response()->json($batch->load(['inventoryItem', 'stockTransactions']));
    }

    public function update(Request $request, Batch $batch): JsonResponse
    {
        $old = $batch->toArray();
        $data = $request->validate([
            'lot_number' => ['nullable', 'string', 'max:50'],
            'manufacturing_date' => ['nullable', 'date'],
            'expiration_date' => ['nullable', 'date'],
            'quantity' => ['sometimes', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
        ]);

        $batch->update($data);

        $this->audit->log('update', 'batch', "Updated batch {$batch->batch_number}", $old, $batch->fresh()->toArray());

        return response()->json($batch->load('inventoryItem'));
    }
}
