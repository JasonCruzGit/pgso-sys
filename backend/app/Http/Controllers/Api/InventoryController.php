<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Models\StockAdjustment;
use App\Services\AssetSyncService;
use App\Services\AuditService;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\Response;

class InventoryController extends Controller
{
    public function __construct(
        private AuditService $audit,
        private NotificationService $notifications,
        private AssetSyncService $assetSync,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $items = InventoryItem::with(['category', 'categories', 'supplier'])
            ->when($request->search, fn ($q, $s) => $q->where(function ($q) use ($s) {
                $q->where('name', 'ilike', "%{$s}%")
                    ->orWhere('item_code', 'ilike', "%{$s}%")
                    ->orWhere('property_number', 'ilike', "%{$s}%")
                    ->orWhere('serial_number', 'ilike', "%{$s}%");
            }))
            ->when($request->category_id, fn ($q, $id) => $q->inCategory((int) $id))
            ->when($request->status, fn ($q, $s) => $q->where('status', $s))
            ->when($request->has('is_consumable'), fn ($q) => $q->where('is_consumable', $request->boolean('is_consumable')))
            ->when($request->boolean('low_stock'), fn ($q) => $q->whereColumn('quantity', '<=', 'reorder_level')->where('quantity', '>', 0))
            ->when($request->boolean('out_of_stock'), fn ($q) => $q->where('quantity', '<=', 0))
            ->latest()
            ->paginate($request->integer('per_page', 15));

        return response()->json($items);
    }

    public function catalog(Request $request): JsonResponse
    {
        $items = InventoryItem::with(['category:id,name,code', 'categories:id,name,code'])
            ->where('status', 'available')
            ->where('is_consumable', true)
            ->where('quantity', '>', 0)
            ->when($request->search, fn ($q, $s) => $q->where(function ($q) use ($s) {
                $q->where('name', 'ilike', "%{$s}%")
                    ->orWhere('item_code', 'ilike', "%{$s}%");
            }))
            ->when($request->category_id, fn ($q, $id) => $q->inCategory((int) $id))
            ->orderBy('name')
            ->paginate($request->integer('per_page', 24));

        return response()->json($items->through(fn (InventoryItem $item) => [
            'id' => $item->id,
            'item_code' => $item->item_code,
            'name' => $item->name,
            'description' => $item->description,
            'category' => $item->category,
            'categories' => $item->categories,
            'unit_of_measure' => $item->unit_of_measure,
            'quantity' => (float) $item->quantity,
            'storage_location' => $item->storage_location,
            'has_photo' => filled($item->photo_path),
        ]));
    }

    public function catalogShow(InventoryItem $inventoryItem): JsonResponse
    {
        if (! $inventoryItem->is_consumable || $inventoryItem->status !== 'available' || $inventoryItem->quantity <= 0) {
            abort(404);
        }

        $item = InventoryItem::with(['category:id,name,code', 'categories:id,name,code'])
            ->findOrFail($inventoryItem->id);

        return response()->json([
            'id' => $item->id,
            'item_code' => $item->item_code,
            'name' => $item->name,
            'description' => $item->description,
            'category' => $item->category,
            'categories' => $item->categories,
            'unit_of_measure' => $item->unit_of_measure,
            'quantity' => (float) $item->quantity,
            'reorder_level' => (float) $item->reorder_level,
            'storage_location' => $item->storage_location,
            'has_photo' => filled($item->photo_path),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $isConsumable = $request->boolean('is_asset')
            ? false
            : $request->boolean('is_consumable', true);

        $data = $request->validate([
            'item_code' => ['required', 'string', 'max:50', 'unique:inventory_items,item_code'],
            'property_number' => ['nullable', 'string', 'max:50', 'unique:inventory_items,property_number'],
            'serial_number' => [
                Rule::requiredIf(! $isConsumable),
                'nullable',
                'string',
                'max:100',
                'unique:inventory_items,serial_number',
            ],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'category_ids' => ['required', 'array', 'min:1'],
            'category_ids.*' => ['integer', 'exists:categories,id'],
            'primary_category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'unit_of_measure' => ['required', 'string', 'max:30'],
            'quantity' => ['required', 'numeric', 'min:0'],
            'reorder_level' => ['required', 'numeric', 'min:0'],
            'unit_cost' => ['required', 'numeric', 'min:0'],
            'supplier_id' => ['nullable', 'exists:suppliers,id'],
            'storage_location' => ['nullable', 'string', 'max:255'],
            'date_acquired' => ['nullable', 'date'],
            'condition' => ['required', 'in:excellent,good,fair,poor,damaged'],
            'status' => ['required', 'in:available,issued,damaged,lost,disposed'],
            'is_asset' => ['boolean'],
            'is_consumable' => ['boolean'],
            'photo' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ]);

        $categoryIds = array_values(array_unique(array_map('intval', $data['category_ids'])));
        $primaryCategoryId = isset($data['primary_category_id']) && in_array((int) $data['primary_category_id'], $categoryIds, true)
            ? (int) $data['primary_category_id']
            : $categoryIds[0];

        return DB::transaction(function () use ($request, $data, $categoryIds, $primaryCategoryId) {
            $fields = collect($data)->except(['photo', 'category_ids', 'primary_category_id'])->all();
            $fields['category_id'] = $primaryCategoryId;
            $fields['is_consumable'] = $request->boolean('is_asset')
                ? false
                : $request->boolean('is_consumable', true);

            $item = InventoryItem::create([
                ...$fields,
                'created_by' => auth('api')->id(),
                'updated_by' => auth('api')->id(),
            ]);

            $item->categories()->sync($categoryIds);

            if ($request->hasFile('photo')) {
                $item->update([
                    'photo_path' => $request->file('photo')->store('inventory-photos', 'local'),
                ]);
            }

            $item->update(['qr_code_data' => $this->buildQrData($item)]);

            if ($item->is_asset) {
                $this->assetSync->syncFromInventoryItem($item->fresh());
            }

            $this->audit->log('create', 'inventory', "Created item {$item->item_code}", newValues: $item->fresh()->toArray());

            if ($item->isLowStock()) {
                $this->notifications->notifyLowStock($item);
            }

            return response()->json(
                $this->formatItem(
                    InventoryItem::with(['category', 'categories', 'supplier', 'asset'])->findOrFail($item->id)
                ),
                201
            );
        });
    }

    public function show(InventoryItem $inventoryItem): JsonResponse
    {
        $this->ensureQrUrl($inventoryItem);

        return response()->json(
            $this->formatItem(
                InventoryItem::with(['category', 'categories', 'supplier', 'asset', 'adjustments.adjuster'])
                    ->findOrFail($inventoryItem->id)
            )
        );
    }

    public function scan(string $identifier): JsonResponse
    {
        $identifier = trim(urldecode($identifier));
        if ($identifier === '') {
            abort(404, 'Inventory item not found');
        }

        $item = InventoryItem::with(['category', 'categories', 'supplier', 'asset', 'adjustments.adjuster'])
            ->where(function ($query) use ($identifier) {
                $query->whereRaw('LOWER(property_number) = ?', [strtolower($identifier)])
                    ->orWhereRaw('LOWER(item_code) = ?', [strtolower($identifier)]);
            })
            ->first();

        if (! $item && ctype_digit($identifier)) {
            $item = InventoryItem::with(['category', 'categories', 'supplier', 'asset', 'adjustments.adjuster'])
                ->find((int) $identifier);
        }

        if (! $item) {
            abort(404, 'Inventory item not found');
        }

        $this->ensureQrUrl($item);

        return response()->json(
            $this->formatItem(
                InventoryItem::with(['category', 'categories', 'supplier', 'asset', 'adjustments.adjuster'])
                    ->findOrFail($item->id)
            )
        );
    }

    public function photo(InventoryItem $inventoryItem): Response
    {
        if (! $inventoryItem->photo_path || ! Storage::disk('local')->exists($inventoryItem->photo_path)) {
            abort(404);
        }

        return Storage::disk('local')->response($inventoryItem->photo_path);
    }

    public function update(Request $request, InventoryItem $inventoryItem): JsonResponse
    {
        $old = $inventoryItem->toArray();
        $isConsumable = $request->boolean('is_asset')
            ? false
            : ($request->has('is_consumable') ? $request->boolean('is_consumable') : $inventoryItem->is_consumable);

        $data = $request->validate([
            'item_code' => ['sometimes', 'string', 'max:50', "unique:inventory_items,item_code,{$inventoryItem->id}"],
            'property_number' => ['nullable', 'string', 'max:50', "unique:inventory_items,property_number,{$inventoryItem->id}"],
            'serial_number' => [
                Rule::requiredIf(! $isConsumable),
                'nullable',
                'string',
                'max:100',
                "unique:inventory_items,serial_number,{$inventoryItem->id}",
            ],
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'category_ids' => ['sometimes', 'array', 'min:1'],
            'category_ids.*' => ['integer', 'exists:categories,id'],
            'primary_category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'unit_of_measure' => ['sometimes', 'string', 'max:30'],
            'reorder_level' => ['sometimes', 'numeric', 'min:0'],
            'unit_cost' => ['sometimes', 'numeric', 'min:0'],
            'supplier_id' => ['nullable', 'exists:suppliers,id'],
            'storage_location' => ['nullable', 'string', 'max:255'],
            'date_acquired' => ['nullable', 'date'],
            'condition' => ['sometimes', 'in:excellent,good,fair,poor,damaged'],
            'status' => ['sometimes', 'in:available,issued,damaged,lost,disposed'],
            'is_asset' => ['boolean'],
            'is_consumable' => ['boolean'],
        ]);

        if ($request->boolean('is_asset')) {
            $data['is_consumable'] = false;
        }

        $categoryIds = isset($data['category_ids'])
            ? array_values(array_unique(array_map('intval', $data['category_ids'])))
            : null;

        if ($categoryIds) {
            $primaryCategoryId = isset($data['primary_category_id']) && in_array((int) $data['primary_category_id'], $categoryIds, true)
                ? (int) $data['primary_category_id']
                : $categoryIds[0];
            $data['category_id'] = $primaryCategoryId;
        }

        unset($data['category_ids'], $data['primary_category_id']);

        $inventoryItem->update([...$data, 'updated_by' => auth('api')->id()]);

        if ($categoryIds) {
            $inventoryItem->categories()->sync($categoryIds);
        }

        if ($inventoryItem->is_asset) {
            $this->assetSync->syncFromInventoryItem($inventoryItem->fresh());
        }

        $this->audit->log('update', 'inventory', "Updated item {$inventoryItem->item_code}", $old, $inventoryItem->fresh()->toArray());

        if ($inventoryItem->isLowStock()) {
            $this->notifications->notifyLowStock($inventoryItem);
        }

        return response()->json($inventoryItem->load('category', 'categories', 'supplier'));
    }

    public function destroy(InventoryItem $inventoryItem): JsonResponse
    {
        $inventoryItem->delete();
        $this->audit->log('delete', 'inventory', "Archived item {$inventoryItem->item_code}");

        return response()->json(['message' => 'Item archived successfully.']);
    }

    public function adjust(Request $request, InventoryItem $inventoryItem): JsonResponse
    {
        $data = $request->validate([
            'adjustment_type' => ['required', 'in:increase,decrease,correction'],
            'quantity_change' => ['required', 'numeric'],
            'reason' => ['required', 'string', 'max:500'],
        ]);

        return DB::transaction(function () use ($data, $inventoryItem) {
            $before = (float) $inventoryItem->quantity;
            $change = (float) $data['quantity_change'];

            $after = match ($data['adjustment_type']) {
                'increase' => $before + abs($change),
                'decrease' => max(0, $before - abs($change)),
                'correction' => abs($change),
            };

            $adjustment = StockAdjustment::create([
                'inventory_item_id' => $inventoryItem->id,
                'adjustment_type' => $data['adjustment_type'],
                'quantity_before' => $before,
                'quantity_change' => $after - $before,
                'quantity_after' => $after,
                'reason' => $data['reason'],
                'adjusted_by' => auth('api')->id(),
            ]);

            $inventoryItem->update(['quantity' => $after, 'updated_by' => auth('api')->id()]);
            $this->audit->log('update', 'inventory', "Stock adjustment for {$inventoryItem->item_code}", newValues: $adjustment->toArray());

            if ($inventoryItem->fresh()->isLowStock()) {
                $this->notifications->notifyLowStock($inventoryItem);
            }

            return response()->json(['item' => $inventoryItem->fresh(), 'adjustment' => $adjustment]);
        });
    }

    private function buildQrData(InventoryItem $item): string
    {
        $base = rtrim(config('app.frontend_url', 'http://localhost:5173'), '/');
        $query = 'id='.$item->id;
        if ($item->property_number) {
            $query .= '&property='.rawurlencode($item->property_number);
        }

        return "{$base}/inventory?{$query}";
    }

    private function ensureQrUrl(InventoryItem $item): void
    {
        $data = trim((string) $item->qr_code_data);
        $expected = $this->buildQrData($item);

        if (blank($data) || str_starts_with($data, '{') || $data !== $expected) {
            $item->update(['qr_code_data' => $expected]);
        }
    }

    private function formatItem(InventoryItem $item): array
    {
        $data = $item->toArray();
        $data['has_photo'] = filled($item->photo_path);

        return $data;
    }
}
