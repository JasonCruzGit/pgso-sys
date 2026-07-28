<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryAudit;
use App\Models\InventoryItem;
use App\Services\AuditService;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class InventoryAuditController extends Controller
{
    public function __construct(
        private AuditService $audit,
        private NotificationService $notifications,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $audits = InventoryAudit::with('starter')
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->latest()
            ->paginate($request->integer('per_page', 15));

        return response()->json($audits);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
            'category_id' => ['nullable', 'exists:categories,id'],
        ]);

        return DB::transaction(function () use ($data) {
            $audit = InventoryAudit::create([
                'audit_number' => 'AUD-'.now()->format('Ymd').'-'.strtoupper(Str::random(4)),
                'title' => $data['title'],
                'status' => 'in_progress',
                'started_by' => auth('api')->id(),
                'notes' => $data['notes'] ?? null,
            ]);

            $items = InventoryItem::when($data['category_id'] ?? null, fn ($q, $id) => $q->inCategory((int) $id))->get();

            foreach ($items as $item) {
                $audit->items()->create([
                    'inventory_item_id' => $item->id,
                    'expected_quantity' => $item->quantity,
                ]);
            }

            $this->audit->log('create', 'inventory_audit', "Started audit {$audit->audit_number}");

            return response()->json($audit->load('items.inventoryItem'), 201);
        });
    }

    public function show(InventoryAudit $inventoryAudit): JsonResponse
    {
        return response()->json($inventoryAudit->load(['starter', 'items.inventoryItem.category']));
    }

    public function verify(Request $request, InventoryAudit $inventoryAudit): JsonResponse
    {
        $data = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.id' => ['required', 'exists:inventory_audit_items,id'],
            'items.*.actual_quantity' => ['required', 'numeric', 'min:0'],
            'items.*.condition' => ['nullable', 'in:excellent,good,fair,poor,damaged'],
            'items.*.notes' => ['nullable', 'string'],
        ]);

        $hasVariance = false;

        foreach ($data['items'] as $itemData) {
            $line = $inventoryAudit->items()->findOrFail($itemData['id']);
            $variance = $itemData['actual_quantity'] - $line->expected_quantity;
            if ($variance != 0) {
                $hasVariance = true;
            }
            $line->update([
                'actual_quantity' => $itemData['actual_quantity'],
                'variance' => $variance,
                'condition' => $itemData['condition'] ?? null,
                'notes' => $itemData['notes'] ?? null,
            ]);
        }

        if ($hasVariance) {
            $user = auth('api')->user();
            $this->notifications->notify(
                collect([$user]),
                'inventory_discrepancy',
                'Inventory Discrepancy Detected',
                "Variance found during audit {$inventoryAudit->audit_number}.",
                ['audit_id' => $inventoryAudit->id],
            );
        }

        return response()->json($inventoryAudit->fresh()->load('items.inventoryItem'));
    }

    public function complete(InventoryAudit $inventoryAudit): JsonResponse
    {
        $inventoryAudit->update(['status' => 'completed', 'completed_at' => now()]);
        $this->audit->log('update', 'inventory_audit', "Completed audit {$inventoryAudit->audit_number}");

        return response()->json($inventoryAudit->load('items.inventoryItem'));
    }

    public function varianceReport(InventoryAudit $inventoryAudit): JsonResponse
    {
        $variances = $inventoryAudit->items()
            ->with('inventoryItem')
            ->whereNotNull('variance')
            ->where('variance', '!=', 0)
            ->get();

        $missing = $inventoryAudit->items()
            ->with('inventoryItem')
            ->where('variance', '<', 0)
            ->get();

        $damaged = $inventoryAudit->items()
            ->with('inventoryItem')
            ->where('condition', 'damaged')
            ->get();

        return response()->json([
            'audit' => $inventoryAudit,
            'variances' => $variances,
            'missing_assets' => $missing,
            'damaged_assets' => $damaged,
        ]);
    }
}
