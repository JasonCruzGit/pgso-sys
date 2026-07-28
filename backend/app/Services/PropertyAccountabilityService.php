<?php

namespace App\Services;

use App\Models\AcceptanceInspectionReport;
use App\Models\AccountabilityDocument;
use App\Models\Asset;
use App\Models\AssetAssignment;
use App\Models\DeliveryReceipt;
use App\Models\InventoryItem;
use App\Models\MaterialRelease;
use App\Models\MaterialReleaseItem;
use App\Models\PurchaseOrder;
use App\Models\ReceivedItem;
use InvalidArgumentException;
use App\Traits\GeneratesReference;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class PropertyAccountabilityService
{
    use GeneratesReference;

    public const ICS_PAR_THRESHOLD = 50000;

    public function pendingMrItems(): Collection
    {
        $assignedItemIds = AssetAssignment::query()
            ->whereNotNull('material_release_item_id')
            ->pluck('material_release_item_id');

        return MaterialReleaseItem::query()
            ->with([
                'materialRelease.recipient',
                'materialRelease.department',
                'materialRelease.releaser',
                'inventoryItem.category',
            ])
            ->join('material_releases', 'material_releases.id', '=', 'material_release_items.material_release_id')
            ->whereNull('material_releases.deleted_at')
            ->where('material_releases.status', 'completed')
            ->whereNotIn('material_release_items.id', $assignedItemIds)
            ->whereHas('inventoryItem', fn ($q) => $q->where('is_consumable', false))
            ->select('material_release_items.*')
            ->orderByDesc('material_releases.release_date')
            ->limit(100)
            ->get()
            ->map(fn (MaterialReleaseItem $line) => $this->formatPendingLine($line));
    }

    public function resolveDocumentType(InventoryItem $item, ?float $lineUnitCost = null): string
    {
        $unitCost = (float) ($lineUnitCost ?? $item->unit_cost ?? 0);

        return $unitCost > self::ICS_PAR_THRESHOLD ? 'par' : 'ics';
    }

    public function assignableAssets(?string $documentType = null): Collection
    {
        $assignedAssetIds = AssetAssignment::query()
            ->where('status', 'active')
            ->pluck('asset_id');

        $assets = Asset::with(['inventoryItem.category'])
            ->whereNotIn('id', $assignedAssetIds)
            ->whereHas('inventoryItem', fn ($q) => $q->where('is_consumable', false))
            ->when($documentType === 'par', fn ($q) => $q->whereHas(
                'inventoryItem',
                fn ($q) => $q->where('unit_cost', '>', self::ICS_PAR_THRESHOLD),
            ))
            ->when($documentType === 'ics', fn ($q) => $q->whereHas(
                'inventoryItem',
                fn ($q) => $q->where('unit_cost', '<=', self::ICS_PAR_THRESHOLD),
            ))
            ->orderBy('property_number')
            ->limit(200)
            ->get()
            ->map(fn (Asset $asset) => $this->formatAssignableAsset($asset));

        $registry = $this->assignableReceivedItems($documentType)
            ->map(fn (ReceivedItem $item) => $this->formatAssignableReceivedItem($item));

        return $assets
            ->concat($registry)
            ->sortBy(fn ($row) => strtolower((string) ($row['property_number'] ?? '')))
            ->values();
    }

    public function assignableReceivedItems(?string $documentType = null): Collection
    {
        $assignedReceivedIds = AssetAssignment::query()
            ->where('status', 'active')
            ->whereNotNull('received_item_id')
            ->pluck('received_item_id');

        return ReceivedItem::query()
            ->with(['acceptanceInspectionReport'])
            ->where('status', 'available')
            ->where('quantity_on_hand', '>', 0)
            ->whereNotIn('id', $assignedReceivedIds)
            // Registry items may be issued as ICS or PAR at the user's discretion
            ->orderBy('air_number')
            ->orderBy('line_number')
            ->limit(1000)
            ->get();
    }

    public function ensureInventoryAndAssetFromReceivedItem(ReceivedItem $received): Asset
    {
        $received->loadMissing(['acceptanceInspectionReport']);

        if ($received->asset_id) {
            $asset = Asset::with('inventoryItem')->find($received->asset_id);
            if ($asset) {
                return $asset;
            }
        }

        if ($received->inventory_item_id) {
            $inventoryItem = InventoryItem::find($received->inventory_item_id);
            if ($inventoryItem) {
                $inventoryItem->update([
                    'name' => $received->description,
                    'unit_cost' => $received->unit_cost,
                    'unit_of_measure' => $received->unit_of_measure,
                    'quantity' => max((float) $received->quantity_on_hand, (float) $inventoryItem->quantity),
                    'storage_location' => $received->storage_location ?? $inventoryItem->storage_location,
                    'is_asset' => true,
                    'is_consumable' => false,
                    'property_number' => $received->registryPropertyNumber(),
                    'updated_by' => auth('api')->id(),
                ]);
                $asset = app(AssetSyncService::class)->syncFromInventoryItem($inventoryItem->fresh());
                $received->update(['asset_id' => $asset->id]);

                return $asset;
            }
        }

        $propertyNumber = $received->registryPropertyNumber();
        $categoryId = \App\Models\Category::where('is_active', true)->value('id')
            ?? \App\Models\Category::query()->value('id');

        if (! $categoryId) {
            throw new InvalidArgumentException('No inventory category is configured.');
        }

        $inventoryItem = InventoryItem::create([
            'item_code' => $propertyNumber,
            'property_number' => $propertyNumber,
            'name' => $received->description,
            'description' => $received->description,
            'category_id' => $categoryId,
            'unit_of_measure' => $received->unit_of_measure ?: 'unit',
            'quantity' => $received->quantity_on_hand,
            'reorder_level' => 0,
            'unit_cost' => $received->unit_cost,
            'storage_location' => $received->storage_location ?? 'PGSO Main Warehouse',
            'date_acquired' => $received->acceptance_date ?? now()->toDateString(),
            'condition' => 'good',
            'status' => 'available',
            'is_asset' => true,
            'is_consumable' => false,
            'created_by' => auth('api')->id(),
            'updated_by' => auth('api')->id(),
        ]);

        $inventoryItem->categories()->sync([$categoryId]);

        $asset = app(AssetSyncService::class)->syncFromInventoryItem($inventoryItem->fresh());

        $received->update([
            'inventory_item_id' => $inventoryItem->id,
            'asset_id' => $asset->id,
        ]);

        return $asset->fresh(['inventoryItem']);
    }

    /**
     * @return array{fund_code: string, fund_name: string, obr_reference: ?string, mr_reference: ?string}
     */
    public function resolveFundAndObr(?MaterialRelease $mr = null, ?InventoryItem $item = null): array
    {
        $fundCode = '100';
        $fundName = 'GENERAL FUND';
        $obrReference = null;
        $mrReference = $mr?->mr_number;

        if ($item) {
            $obrReference = $this->resolveObrFromInventoryItem($item);
            $fund = $this->resolveFundFromInventoryItem($item);
            if ($fund) {
                [$fundCode, $fundName] = $fund;
            }
        }

        return [
            'fund_code' => $fundCode,
            'fund_name' => $fundName,
            'obr_reference' => $obrReference,
            'mr_reference' => $mrReference,
        ];
    }

    public function createManual(array $data): AssetAssignment
    {
        $documentType = $data['document_type'];
        if (! in_array($documentType, ['par', 'ics'], true)) {
            throw new InvalidArgumentException('Document type must be PAR or ICS.');
        }

        return DB::transaction(function () use ($data, $documentType) {
            $receivedItem = null;

            if (! empty($data['received_item_id'])) {
                $receivedItem = ReceivedItem::with('acceptanceInspectionReport')->findOrFail($data['received_item_id']);

                if (AssetAssignment::where('received_item_id', $receivedItem->id)->where('status', 'active')->exists()) {
                    throw new InvalidArgumentException('This registry item already has an active accountability record.');
                }

                if (empty($data['obr_reference'])) {
                    $data['obr_reference'] = $receivedItem->acceptanceInspectionReport?->obligation_request_no;
                }

                $asset = $this->ensureInventoryAndAssetFromReceivedItem($receivedItem);
            } else {
                $asset = Asset::with('inventoryItem')->findOrFail($data['asset_id']);
            }

            if (AssetAssignment::where('asset_id', $asset->id)->where('status', 'active')->exists()) {
                throw new InvalidArgumentException('Asset already has an active accountability record.');
            }

            $inventoryItem = $asset->inventoryItem;
            if (! $inventoryItem || $inventoryItem->is_consumable) {
                throw new InvalidArgumentException('Consumable items do not require ICS or PAR.');
            }

            $fundCode = trim((string) ($data['fund_code'] ?? '100')) ?: '100';
            $fundName = trim((string) ($data['fund_name'] ?? 'GENERAL FUND')) ?: 'GENERAL FUND';
            $obrReference = trim((string) ($data['obr_reference'] ?? '')) ?: null;
            $mrReference = trim((string) ($data['mr_reference'] ?? '')) ?: null;

            $document = $this->createDocument(
                documentType: $documentType,
                custodianUserId: (int) $data['custodian_user_id'],
                departmentId: (int) $data['department_id'],
                assignmentDate: $data['assignment_date'],
                materialRelease: null,
                inventoryItem: $inventoryItem,
                overrides: [
                    'fund_code' => $fundCode,
                    'fund_name' => $fundName,
                    'obr_reference' => $obrReference,
                    'mr_reference' => $mrReference,
                ],
            );

            $notes = trim((string) ($data['notes'] ?? ''));
            if ($mrReference !== null && $mrReference !== '') {
                $prefix = "MR Ref.: {$mrReference}";
                $notes = $notes !== '' ? "{$prefix}\n{$notes}" : $prefix;
            }

            $assignment = $this->createAssignmentLine(
                document: $document,
                asset: $asset,
                inventoryItem: $inventoryItem,
                materialRelease: null,
                materialReleaseItem: null,
                custodianUserId: (int) $data['custodian_user_id'],
                departmentId: (int) $data['department_id'],
                assignmentDate: $data['assignment_date'],
                notes: $notes !== '' ? $notes : null,
                mrReference: $mrReference,
                receivedItem: $receivedItem,
            );

            if ($receivedItem) {
                $receivedItem->update([
                    'quantity_on_hand' => 0,
                    'status' => 'depleted',
                ]);
            }

            $asset->update([
                'custodian_user_id' => $data['custodian_user_id'],
                'department_id' => $data['department_id'],
                'location' => $data['location'] ?? $asset->location ?? $inventoryItem->storage_location,
                'condition' => $data['condition'] ?? $asset->condition ?? $inventoryItem->condition ?? 'good',
            ]);

            return $assignment->load([
                'accountabilityDocument',
                'asset.inventoryItem.category',
                'custodian',
                'department',
                'assigner',
            ]);
        });
    }

    public function createFromMrItem(
        MaterialReleaseItem $line,
        ?string $documentType = null,
        ?string $location = null,
        ?string $notes = null,
    ): AssetAssignment {
        $line->load(['materialRelease', 'inventoryItem']);

        $mr = $line->materialRelease;
        if (! $mr || $mr->status !== 'completed') {
            throw new \InvalidArgumentException('Only completed material releases can be issued an ICS or PAR.');
        }

        if (! $mr->recipient_user_id || ! $mr->department_id) {
            throw new \InvalidArgumentException('Material release is missing recipient or department.');
        }

        if (AssetAssignment::where('material_release_item_id', $line->id)->exists()) {
            throw new \InvalidArgumentException('This MR line already has an ICS or PAR issued.');
        }

        $inventoryItem = $line->inventoryItem;
        if (! $inventoryItem || $inventoryItem->is_consumable) {
            throw new \InvalidArgumentException('Consumable items do not require ICS or PAR.');
        }

        return DB::transaction(function () use ($line, $mr, $inventoryItem, $documentType, $location, $notes) {
            if (! $inventoryItem->is_asset) {
                $inventoryItem->update(['is_asset' => true]);
            }

            if ($line->serial_number && blank($inventoryItem->serial_number)) {
                $inventoryItem->update(['serial_number' => $line->serial_number]);
            }

            $asset = app(AssetSyncService::class)->syncFromInventoryItem($inventoryItem->fresh());

            $activeAssignment = AssetAssignment::where('asset_id', $asset->id)
                ->where('status', 'active')
                ->exists();

            if ($activeAssignment) {
                throw new \InvalidArgumentException("Asset {$asset->property_number} already has an active accountability record.");
            }

            $docType = $documentType ?: $this->resolveDocumentType($inventoryItem, (float) $line->unit_cost);
            if (! in_array($docType, ['par', 'ics'], true)) {
                throw new \InvalidArgumentException('Document type must be PAR or ICS.');
            }

            $document = $this->findOrCreateDocumentForMr(
                materialRelease: $mr,
                documentType: $docType,
                inventoryItem: $inventoryItem,
            );

            $assignment = $this->createAssignmentLine(
                document: $document,
                asset: $asset,
                inventoryItem: $inventoryItem,
                materialRelease: $mr,
                materialReleaseItem: $line,
                custodianUserId: (int) $mr->recipient_user_id,
                departmentId: (int) $mr->department_id,
                assignmentDate: now()->toDateString(),
                notes: $notes,
                mrReference: $mr->mr_number,
            );

            $asset->update([
                'custodian_user_id' => $mr->recipient_user_id,
                'department_id' => $mr->department_id,
                'location' => $location ?? $asset->location ?? $inventoryItem->storage_location,
                'condition' => $asset->condition ?? $inventoryItem->condition ?? 'good',
            ]);

            return $assignment->load([
                'accountabilityDocument',
                'asset.inventoryItem.category',
                'custodian',
                'department',
                'assigner',
                'materialRelease',
                'materialReleaseItem',
            ]);
        });
    }

    private function findOrCreateDocumentForMr(
        MaterialRelease $materialRelease,
        string $documentType,
        InventoryItem $inventoryItem,
    ): AccountabilityDocument {
        $existing = AccountabilityDocument::query()
            ->where('material_release_id', $materialRelease->id)
            ->where('document_type', $documentType)
            ->where('custodian_user_id', $materialRelease->recipient_user_id)
            ->where('department_id', $materialRelease->department_id)
            ->where('status', 'active')
            ->first();

        if ($existing) {
            return $existing;
        }

        return $this->createDocument(
            documentType: $documentType,
            custodianUserId: (int) $materialRelease->recipient_user_id,
            departmentId: (int) $materialRelease->department_id,
            assignmentDate: now()->toDateString(),
            materialRelease: $materialRelease,
            inventoryItem: $inventoryItem,
        );
    }

    private function createDocument(
        string $documentType,
        int $custodianUserId,
        int $departmentId,
        string $assignmentDate,
        ?MaterialRelease $materialRelease,
        ?InventoryItem $inventoryItem,
        ?array $overrides = null,
    ): AccountabilityDocument {
        $ackPrefix = strtoupper($documentType);
        $acknowledgmentNumber = $this->generateReference("{$ackPrefix}-", 'accountability_documents', 'acknowledgment_number');
        $resolved = $this->resolveFundAndObr($materialRelease, $inventoryItem);

        return AccountabilityDocument::create([
            'acknowledgment_number' => $acknowledgmentNumber,
            'document_type' => $documentType,
            'custodian_user_id' => $custodianUserId,
            'department_id' => $departmentId,
            'material_release_id' => $materialRelease?->id,
            'assignment_date' => $assignmentDate,
            'fund_code' => $overrides['fund_code'] ?? $resolved['fund_code'],
            'fund_name' => $overrides['fund_name'] ?? $resolved['fund_name'],
            'obr_reference' => $overrides['obr_reference'] ?? $resolved['obr_reference'],
            'mr_reference' => $overrides['mr_reference'] ?? $resolved['mr_reference'],
            'assigned_by' => auth('api')->id(),
            'status' => 'active',
            'notes' => $overrides['notes'] ?? null,
        ]);
    }

    private function createAssignmentLine(
        AccountabilityDocument $document,
        Asset $asset,
        InventoryItem $inventoryItem,
        ?MaterialRelease $materialRelease,
        ?MaterialReleaseItem $materialReleaseItem,
        int $custodianUserId,
        int $departmentId,
        string $assignmentDate,
        ?string $notes,
        ?string $mrReference,
        ?ReceivedItem $receivedItem = null,
    ): AssetAssignment {
        return AssetAssignment::create([
            'assignment_number' => $this->generateReference('ASN-', 'asset_assignments', 'assignment_number'),
            'accountability_document_id' => $document->id,
            'asset_id' => $asset->id,
            'material_release_id' => $materialRelease?->id,
            'material_release_item_id' => $materialReleaseItem?->id,
            'received_item_id' => $receivedItem?->id,
            'custodian_user_id' => $custodianUserId,
            'department_id' => $departmentId,
            'assigned_by' => auth('api')->id(),
            'assignment_date' => $assignmentDate,
            'document_type' => $document->document_type,
            'acknowledgment_number' => $document->acknowledgment_number,
            'qr_verification_data' => json_encode([
                'acknowledgment_number' => $document->acknowledgment_number,
                'document_type' => $document->document_type,
                'property_number' => $asset->property_number,
                'item_name' => $inventoryItem->name,
                'mr_number' => $mrReference,
                'custodian_id' => $custodianUserId,
                'department_id' => $departmentId,
            ]),
            'status' => 'active',
            'notes' => $notes,
        ]);
    }

    /**
     * @return array{0: string, 1: string}|null
     */
    private function resolveFundFromInventoryItem(InventoryItem $item): ?array
    {
        $purchaseOrder = PurchaseOrder::query()
            ->whereHas('items', fn ($q) => $q->where('inventory_item_id', $item->id))
            ->with('purchaseRequest.budgetAllocation')
            ->latest('issued_date')
            ->first();

        $allocation = $purchaseOrder?->purchaseRequest?->budgetAllocation;
        if (! $allocation) {
            return null;
        }

        $fundCode = '100';
        $fundName = strtoupper(trim((string) ($allocation->category ?: $allocation->description ?: 'GENERAL FUND')));

        return [$fundCode, $fundName];
    }

    private function resolveObrFromInventoryItem(InventoryItem $item): ?string
    {
        $reports = AcceptanceInspectionReport::query()
            ->whereNotNull('obligation_request_no')
            ->where('status', 'finalized')
            ->latest('acceptance_date')
            ->limit(50)
            ->get();

        foreach ($reports as $report) {
            $items = collect($report->items ?? []);
            $matched = $items->contains(function ($row) use ($item) {
                $inventoryItemId = $row['inventory_item_id'] ?? null;
                $itemName = trim((string) ($row['item_name'] ?? $row['description'] ?? ''));

                return ($inventoryItemId && (int) $inventoryItemId === (int) $item->id)
                    || ($itemName !== '' && strcasecmp($itemName, (string) $item->name) === 0);
            });

            if ($matched) {
                return $report->obligation_request_no;
            }
        }

        $deliveryReceipt = DeliveryReceipt::query()
            ->whereHas('stockReceipt.items', fn ($q) => $q->where('inventory_item_id', $item->id))
            ->latest('delivery_date')
            ->first();

        if ($deliveryReceipt) {
            $air = AcceptanceInspectionReport::query()
                ->where('delivery_receipt_id', $deliveryReceipt->id)
                ->whereNotNull('obligation_request_no')
                ->latest('acceptance_date')
                ->first();

            if ($air) {
                return $air->obligation_request_no;
            }
        }

        return null;
    }

  /**
   * @return array<string, mixed>
   */
    private function formatPendingLine(MaterialReleaseItem $line): array
    {
        $item = $line->inventoryItem;
        $mr = $line->materialRelease;
        $unitCost = (float) ($line->unit_cost ?? $item?->unit_cost ?? 0);

        return [
            'id' => $line->id,
            'material_release_id' => $line->material_release_id,
            'mr_number' => $mr?->mr_number,
            'release_date' => $mr?->release_date,
            'purpose' => $mr?->purpose,
            'recipient' => $mr?->recipient,
            'department' => $mr?->department,
            'serial_number' => $line->serial_number ?? $item?->serial_number,
            'quantity' => $line->quantity,
            'unit_cost' => $unitCost,
            'suggested_document_type' => $item ? $this->resolveDocumentType($item, $unitCost) : 'ics',
            'inventory_item' => $item,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function formatAssignableAsset(Asset $asset): array
    {
        return [
            'id' => $asset->id,
            'source' => 'asset',
            'property_number' => $asset->property_number,
            'location' => $asset->location,
            'condition' => $asset->condition,
            'inventory_item' => $asset->inventoryItem,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function formatAssignableReceivedItem(ReceivedItem $item): array
    {
        return [
            'id' => $item->id,
            'source' => 'received_item',
            'received_item_id' => $item->id,
            'property_number' => $item->registryPropertyNumber(),
            'location' => $item->storage_location,
            'condition' => 'good',
            'air_number' => $item->air_number,
            'po_number' => $item->po_number,
            'quantity_on_hand' => $item->quantity_on_hand,
            'obr_reference' => $item->acceptanceInspectionReport?->obligation_request_no,
            'inventory_item' => [
                'name' => $item->description,
                'item_code' => $item->registryPropertyNumber(),
                'property_number' => $item->registryPropertyNumber(),
                'unit_of_measure' => $item->unit_of_measure,
                'unit_cost' => $item->unit_cost,
                'storage_location' => $item->storage_location,
                'quantity' => $item->quantity_on_hand,
            ],
        ];
    }
}
