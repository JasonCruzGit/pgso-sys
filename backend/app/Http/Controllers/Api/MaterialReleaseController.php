<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Models\IssuanceRequest;
use App\Models\MaterialRelease;
use App\Models\MaterialReleaseItem;
use App\Models\StockReceiptItem;
use App\Models\User;
use App\Services\MaterialReleaseService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use InvalidArgumentException;

class MaterialReleaseController extends Controller
{
    public function __construct(private MaterialReleaseService $releases) {}

    public function index(Request $request): JsonResponse
    {
        $releases = MaterialRelease::with(['recipient', 'department', 'releaser', 'items.inventoryItem'])
            ->when($request->search, fn ($q, $s) => $q->where(function ($q) use ($s) {
                $q->where('mr_number', 'ilike', "%{$s}%")
                    ->orWhereHas('recipient', fn ($q) => $q->where('name', 'ilike', "%{$s}%"));
            }))
            ->when($request->department_id, fn ($q, $id) => $q->where('department_id', $id))
            ->when($request->source, fn ($q, $s) => $q->where('source', $s))
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->latest('release_date')
            ->paginate($request->integer('per_page', 15));

        return response()->json($releases);
    }

    public function show(MaterialRelease $materialRelease): JsonResponse
    {
        return response()->json(
            $materialRelease->load(['recipient', 'department', 'releaser', 'items.inventoryItem', 'issuanceRequest'])
        );
    }

    public function store(Request $request): JsonResponse
    {
        $isDraft = $request->boolean('save_as_draft');

        $data = $request->validate([
            'recipient_user_id' => [$isDraft ? 'nullable' : 'required', 'exists:users,id'],
            'department_id' => [$isDraft ? 'nullable' : 'required', 'exists:departments,id'],
            'purpose' => [$isDraft ? 'nullable' : 'required', 'string', 'max:1000'],
            'notes' => ['nullable', 'string'],
            'items' => [$isDraft ? 'nullable' : 'required', 'array', $isDraft ? 'min:0' : 'min:1'],
            'items.*.inventory_item_id' => ['required_with:items', 'exists:inventory_items,id'],
            'items.*.serial_number' => ['nullable', 'string', 'max:100'],
            'items.*.quantity' => ['required_with:items', 'numeric', 'min:0.01'],
        ]);

        $items = collect($data['items'] ?? [])
            ->filter(fn ($item) => filled($item['inventory_item_id'] ?? null)
                && filled($item['quantity'] ?? null))
            ->values()
            ->all();

        if ($isDraft) {
            return response()->json($this->releases->saveDraft($data, $items), 201);
        }

        if (empty($items)) {
            return response()->json(['message' => 'At least one item is required.'], 422);
        }

        $recipient = User::findOrFail($data['recipient_user_id']);

        foreach ($items as $itemData) {
            $inventoryItem = InventoryItem::findOrFail($itemData['inventory_item_id']);
            if ($inventoryItem->is_consumable) {
                return response()->json([
                    'message' => "Consumable items cannot be issued via MR: {$inventoryItem->name}",
                ], 422);
            }
        }

        try {
            $release = $this->releases->releaseDirect(
                $recipient,
                $data['department_id'],
                $data['purpose'],
                $items,
                $data['notes'] ?? null,
            );
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json($release, 201);
    }

    public function releaseFromRequest(IssuanceRequest $issuanceRequest): JsonResponse
    {
        $issuanceRequest->load('items.inventoryItem');

        if ($this->releases->requestHasOnlyConsumableItems($issuanceRequest)) {
            return response()->json([
                'message' => 'Consumable supplies do not require MR. Issue them from Employee Requests.',
            ], 422);
        }

        try {
            $release = $this->releases->releaseFromRequest($issuanceRequest);
        } catch (InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json($release);
    }

    public function employees(Request $request): JsonResponse
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
            ->limit(100)
            ->get(['id', 'name', 'email', 'employee_id', 'department_id']);

        return response()->json(['data' => $employees]);
    }

    public function pendingRequests(): JsonResponse
    {
        $requests = IssuanceRequest::with(['department', 'requester', 'items.inventoryItem'])
            ->where('status', 'approved')
            ->whereNull('mr_number')
            ->latest('date_approved')
            ->limit(50)
            ->get()
            ->filter(fn (IssuanceRequest $request) => $this->releases->requestHasNonConsumableItems($request))
            ->values();

        return response()->json(['data' => $requests]);
    }

    public function availableUnits(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
        ]);

        $name = trim($data['name']);
        $releasedSerials = MaterialReleaseItem::query()
            ->whereNotNull('serial_number')
            ->where('serial_number', '!=', '')
            ->whereHas('inventoryItem', fn ($q) => $q->whereRaw('LOWER(name) = ?', [strtolower($name)]))
            ->pluck('serial_number')
            ->map(fn ($serial) => trim((string) $serial))
            ->filter()
            ->unique()
            ->values()
            ->all();

        $items = InventoryItem::query()
            ->where('is_consumable', false)
            ->where('quantity', '>', 0)
            ->whereRaw('LOWER(name) = ?', [strtolower($name)])
            ->orderBy('item_code')
            ->orderBy('serial_number')
            ->get();

        $units = [];
        foreach ($items as $item) {
            $units = array_merge($units, $this->expandAssignableUnits($item, $releasedSerials));
        }

        return response()->json(['data' => $units]);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function expandAssignableUnits(InventoryItem $item, array $releasedSerials): array
    {
        $receiptLines = StockReceiptItem::query()
            ->where('inventory_item_id', $item->id)
            ->whereNotNull('serial_number')
            ->where('serial_number', '!=', '')
            ->orderBy('id')
            ->get()
            ->unique('serial_number');

        if ($receiptLines->isNotEmpty()) {
            $units = [];
            foreach ($receiptLines as $receiptLine) {
                $serial = trim((string) $receiptLine->serial_number);
                if ($serial === '' || in_array($serial, $releasedSerials, true)) {
                    continue;
                }

                $units[] = [
                    'inventory_item_id' => $item->id,
                    'serial_number' => $serial,
                    'property_number' => $item->property_number ?? $item->item_code,
                    'name' => $item->name,
                    'item_code' => $item->item_code,
                    'brand' => $receiptLine->brand ?? $item->brand,
                    'model' => $receiptLine->model ?? $item->model,
                    'quantity_available' => 1,
                    'unit_of_measure' => $item->unit_of_measure,
                ];
            }

            return $units;
        }

        $units = [];
        $qty = max((int) floor((float) $item->quantity), 0);

        if ($item->serial_number) {
            $serial = trim((string) $item->serial_number);
            if ($serial !== '' && ! in_array($serial, $releasedSerials, true) && $qty > 0) {
                $units[] = $this->formatAssignableUnit($item, 1, $serial);

                return $units;
            }
        }

        if ($qty <= 0) {
            return [];
        }

        if ($qty === 1) {
            return [$this->formatAssignableUnit($item, 1)];
        }

        for ($i = 0; $i < $qty; $i++) {
            $units[] = $this->formatAssignableUnit($item, 1);
        }

        return $units;
    }

    /**
     * @return array<string, mixed>
     */
    private function formatAssignableUnit(InventoryItem $item, int $quantity, ?string $serialNumber = null): array
    {
        return [
            'inventory_item_id' => $item->id,
            'serial_number' => $serialNumber ?? ($item->serial_number ?: null),
            'property_number' => $item->property_number ?? $item->item_code,
            'name' => $item->name,
            'item_code' => $item->item_code,
            'brand' => $item->brand,
            'model' => $item->model,
            'quantity_available' => $quantity,
            'unit_of_measure' => $item->unit_of_measure,
        ];
    }
}
