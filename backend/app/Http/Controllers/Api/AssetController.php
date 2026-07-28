<?php

namespace App\Http\Controllers\Api;

use App\Enums\RoleSlug;
use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\InventoryItem;
use App\Models\MaterialRelease;
use App\Models\MaterialReleaseItem;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AssetController extends Controller
{
    public function __construct(private AuditService $audit) {}

    public function index(Request $request): JsonResponse
    {
        $assets = Asset::with(['inventoryItem.category', 'inventoryItem.supplier', 'custodian', 'department'])
            ->when($request->search, fn ($q, $s) => $q->where('property_number', 'ilike', "%{$s}%")
                ->orWhereHas('inventoryItem', fn ($q) => $q->where('name', 'ilike', "%{$s}%")))
            ->latest()
            ->paginate($request->integer('per_page', 15));

        return response()->json($assets);
    }

    public function releasedItems(Request $request): JsonResponse
    {
        $items = $this->releasedItemsQuery()
            ->when($request->search, fn ($q, $s) => $q->where(function ($q) use ($s) {
                $q->where('material_releases.mr_number', 'ilike', "%{$s}%")
                    ->orWhereHas('inventoryItem', fn ($q) => $q->where('name', 'ilike', "%{$s}%")
                        ->orWhere('property_number', 'ilike', "%{$s}%")
                        ->orWhere('item_code', 'ilike', "%{$s}%")
                        ->orWhere('serial_number', 'ilike', "%{$s}%"))
                    ->orWhereHas('materialRelease.recipient', fn ($q) => $q->where('name', 'ilike', "%{$s}%"))
                    ->orWhereHas('materialRelease.department', fn ($q) => $q->where('name', 'ilike', "%{$s}%")
                        ->orWhere('code', 'ilike', "%{$s}%"));
            }))
            ->when($request->department_id && ! $this->isDepartmentEmployee(), fn ($q, $id) => $q->where('material_releases.department_id', $id))
            ->when($request->category_id, fn ($q, $id) => $q->whereHas('inventoryItem', fn ($q) => $q->where('category_id', $id)))
            ->paginate($request->integer('per_page', 15));

        return response()->json($items);
    }

    public function showReleasedItem(MaterialReleaseItem $materialReleaseItem): JsonResponse
    {
        $this->authorizeReleasedItemAccess($materialReleaseItem);

        return response()->json($materialReleaseItem->load([
            'materialRelease.recipient',
            'materialRelease.department',
            'materialRelease.releaser',
            'inventoryItem.category',
            'inventoryItem.supplier',
        ]));
    }

    public function showMaterialRelease(MaterialRelease $materialRelease): JsonResponse
    {
        $this->authorizeMaterialReleaseAccess($materialRelease);

        $hasItems = MaterialReleaseItem::query()
            ->where('material_release_id', $materialRelease->id)
            ->exists();

        if (! $hasItems) {
            abort(404, 'Material release not found.');
        }

        return response()->json(
            $materialRelease->load(['recipient', 'department', 'releaser', 'items.inventoryItem', 'issuanceRequest'])
        );
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'inventory_item_id' => ['required', 'exists:inventory_items,id'],
            'property_number' => ['required', 'string', 'max:50', 'unique:assets,property_number'],
            'custodian_user_id' => ['nullable', 'exists:users,id'],
            'department_id' => ['nullable', 'exists:departments,id'],
            'location' => ['nullable', 'string', 'max:255'],
            'condition' => ['required', 'in:excellent,good,fair,poor,damaged'],
            'next_inspection_date' => ['nullable', 'date'],
        ]);

        $item = InventoryItem::findOrFail($data['inventory_item_id']);
        $qrData = json_encode([
            'property_number' => $data['property_number'],
            'item_name' => $item->name,
            'item_code' => $item->item_code,
            'location' => $data['location'] ?? $item->storage_location,
            'custodian_id' => $data['custodian_user_id'] ?? null,
        ]);

        $asset = Asset::create([...$data, 'qr_code_data' => $qrData]);
        $item->update(['is_asset' => true, 'property_number' => $data['property_number']]);

        $this->audit->log('create', 'assets', "Created asset {$asset->property_number}", newValues: $asset->toArray());

        return response()->json($asset->load(['inventoryItem', 'custodian', 'department']), 201);
    }

    public function show(Asset $asset): JsonResponse
    {
        return response()->json($asset->load(['inventoryItem.category', 'inventoryItem.supplier', 'custodian', 'department']));
    }

    public function scan(string $propertyNumber): JsonResponse
    {
        $released = $this->releasedItemsQuery()
            ->where(function ($q) use ($propertyNumber) {
                $q->whereHas('inventoryItem', fn ($q) => $q->where('property_number', $propertyNumber))
                    ->orWhereHas('inventoryItem', fn ($q) => $q->where('item_code', $propertyNumber));
            })
            ->first();

        if ($released) {
            return response()->json($released->load([
                'materialRelease.recipient',
                'materialRelease.department',
                'materialRelease.releaser',
                'inventoryItem.category',
                'inventoryItem.supplier',
            ]));
        }

        if ($this->isDepartmentEmployee()) {
            abort(404, 'Released item not found.');
        }

        $asset = Asset::with(['inventoryItem.category', 'inventoryItem.supplier', 'custodian', 'department'])
            ->where('property_number', $propertyNumber)
            ->first();

        if ($asset) {
            return response()->json($asset);
        }

        abort(404, 'Item not found');
    }

    public function update(Request $request, Asset $asset): JsonResponse
    {
        $old = $asset->toArray();
        $data = $request->validate([
            'custodian_user_id' => ['nullable', 'exists:users,id'],
            'department_id' => ['nullable', 'exists:departments,id'],
            'location' => ['nullable', 'string', 'max:255'],
            'condition' => ['sometimes', 'in:excellent,good,fair,poor,damaged'],
            'last_inspection_date' => ['nullable', 'date'],
            'next_inspection_date' => ['nullable', 'date'],
        ]);

        $asset->update($data);

        $qrData = json_decode($asset->qr_code_data, true) ?? [];
        $qrData['location'] = $asset->location;
        $qrData['custodian_id'] = $asset->custodian_user_id;
        $qrData['condition'] = $asset->condition;
        $asset->update(['qr_code_data' => json_encode($qrData)]);

        $this->audit->log('update', 'assets', "Updated asset {$asset->property_number}", $old, $asset->fresh()->toArray());

        return response()->json($asset->load(['inventoryItem', 'custodian', 'department']));
    }

    private function releasedItemsQuery()
    {
        $query = MaterialReleaseItem::query()
            ->with([
                'materialRelease.recipient',
                'materialRelease.department',
                'materialRelease.releaser',
                'inventoryItem.category',
                'inventoryItem.supplier',
            ])
            ->join('material_releases', 'material_releases.id', '=', 'material_release_items.material_release_id')
            ->whereNull('material_releases.deleted_at')
            ->where('material_releases.status', 'completed')
            ->select('material_release_items.*')
            ->orderByDesc('material_releases.release_date');

        $user = $this->currentUser();
        if ($this->isDepartmentEmployee($user)) {
            $query->where('material_releases.recipient_user_id', $user->id);
        }

        return $query;
    }

    private function authorizeReleasedItemAccess(MaterialReleaseItem $materialReleaseItem): void
    {
        $user = $this->currentUser();
        if (! $this->isDepartmentEmployee($user)) {
            return;
        }

        $materialReleaseItem->loadMissing('materialRelease');
        if ($materialReleaseItem->materialRelease?->recipient_user_id !== $user->id) {
            abort(403, 'You do not have access to this asset.');
        }
    }

    private function authorizeMaterialReleaseAccess(MaterialRelease $materialRelease): void
    {
        $user = $this->currentUser();
        if (! $this->isDepartmentEmployee($user)) {
            return;
        }

        if ($materialRelease->recipient_user_id !== $user->id) {
            abort(403, 'You do not have access to this material release.');
        }
    }

    private function currentUser(): ?User
    {
        return auth('api')->user()?->loadMissing('role');
    }

    private function isDepartmentEmployee(?User $user = null): bool
    {
        $user ??= $this->currentUser();

        return $user?->role?->slug === RoleSlug::DepartmentUser->value;
    }
}
