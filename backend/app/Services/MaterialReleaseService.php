<?php

namespace App\Services;

use App\Models\InventoryItem;
use App\Models\IssuanceRequest;
use App\Models\MaterialRelease;
use App\Models\MaterialReleaseItem;
use App\Models\StockTransaction;
use App\Models\User;
use App\Traits\GeneratesReference;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class MaterialReleaseService
{
    use GeneratesReference;

    public function __construct(
        private AuditService $audit,
        private NotificationService $notifications,
    ) {}

    /**
     * @param  array<int, array{inventory_item_id: int, quantity: float|int, serial_number?: string|null}>  $items
     */
    public function saveDraft(array $data, array $items): MaterialRelease
    {
        $release = MaterialRelease::create([
            'mr_number' => $this->generateReference('MR', 'material_releases', 'mr_number'),
            'recipient_user_id' => $data['recipient_user_id'] ?? null,
            'department_id' => $data['department_id'] ?? null,
            'purpose' => $data['purpose'] ?? null,
            'released_by' => auth('api')->id(),
            'release_date' => null,
            'source' => 'direct',
            'notes' => $data['notes'] ?? null,
            'status' => 'draft',
            'draft_items' => [
                'recipient_user_id' => $data['recipient_user_id'] ?? null,
                'department_id' => $data['department_id'] ?? null,
                'purpose' => $data['purpose'] ?? null,
                'notes' => $data['notes'] ?? null,
                'items' => $items,
            ],
        ]);

        $this->audit->log('create', 'material_release', "Saved draft MR {$release->mr_number}", newValues: $release->toArray());

        return $release->load(['recipient', 'department', 'releaser', 'items.inventoryItem']);
    }

    /**
     * @param  array<int, array{inventory_item_id: int, quantity: float|int, serial_number?: string|null}>  $items
     */
    public function releaseDirect(
        User $recipient,
        int $departmentId,
        string $purpose,
        array $items,
        ?string $notes = null,
    ): MaterialRelease {
        return DB::transaction(function () use ($recipient, $departmentId, $purpose, $items, $notes) {
            $release = MaterialRelease::create([
                'mr_number' => $this->generateReference('MR', 'material_releases', 'mr_number'),
                'recipient_user_id' => $recipient->id,
                'department_id' => $departmentId,
                'purpose' => $purpose,
                'released_by' => auth('api')->id(),
                'release_date' => now(),
                'source' => 'direct',
                'notes' => $notes,
                'status' => 'completed',
            ]);

            $this->processItems($release, $items, $purpose, $departmentId, $recipient->id);

            $this->audit->log('create', 'material_release', "MR {$release->mr_number} released to {$recipient->name}", newValues: $release->toArray());
            $this->notifications->notifyRequestReleased($recipient, $release->id, $release->mr_number);

            return $release->load(['recipient', 'department', 'releaser', 'items.inventoryItem']);
        });
    }

    public function releaseFromRequest(IssuanceRequest $issuanceRequest): MaterialRelease
    {
        if ($issuanceRequest->status !== 'approved') {
            throw new \InvalidArgumentException('Only approved requests can be released.');
        }

        if ($issuanceRequest->mr_number) {
            throw new \InvalidArgumentException('This request has already been released.');
        }

        return DB::transaction(function () use ($issuanceRequest) {
            $issuanceRequest->load(['items', 'requester', 'department']);

            if ($this->requestHasOnlyConsumableItems($issuanceRequest)) {
                throw new \InvalidArgumentException('Consumable supplies do not require MR.');
            }

            $release = MaterialRelease::create([
                'mr_number' => $this->generateReference('MR', 'material_releases', 'mr_number'),
                'recipient_user_id' => $issuanceRequest->requested_by,
                'department_id' => $issuanceRequest->department_id,
                'purpose' => $issuanceRequest->purpose,
                'released_by' => auth('api')->id(),
                'release_date' => now(),
                'issuance_request_id' => $issuanceRequest->id,
                'source' => 'request',
                'notes' => $issuanceRequest->notes,
                'status' => 'completed',
            ]);

            $lineItems = $issuanceRequest->items->map(fn ($line) => [
                'inventory_item_id' => $line->inventory_item_id,
                'quantity' => (float) $line->quantity_requested,
            ])->all();

            $this->processItems(
                $release,
                $lineItems,
                $issuanceRequest->purpose,
                $issuanceRequest->department_id,
                $issuanceRequest->requested_by,
                $issuanceRequest->id,
            );

            foreach ($issuanceRequest->items as $line) {
                $line->update(['quantity_issued' => $line->quantity_requested]);
            }

            $issuanceRequest->update([
                'status' => 'released',
                'mr_number' => $release->mr_number,
                'issued_by' => auth('api')->id(),
                'date_issued' => now(),
            ]);

            $this->audit->log('update', 'issuance', "Released MR {$release->mr_number} for {$issuanceRequest->request_number}");
            if ($issuanceRequest->requester) {
                $this->notifications->notifyRequestReleased(
                    $issuanceRequest->requester,
                    $issuanceRequest->id,
                    $release->mr_number,
                );
            }

            return $release->load(['recipient', 'department', 'releaser', 'items.inventoryItem', 'issuanceRequest']);
        });
    }

    public function issueConsumablesFromRequest(IssuanceRequest $issuanceRequest): IssuanceRequest
    {
        if ($issuanceRequest->status !== 'approved') {
            throw new \InvalidArgumentException('Only approved requests can be issued.');
        }

        if ($issuanceRequest->date_issued) {
            throw new \InvalidArgumentException('This request has already been issued.');
        }

        return DB::transaction(function () use ($issuanceRequest) {
            $issuanceRequest->load(['items.inventoryItem', 'requester', 'department']);

            if (! $this->requestHasOnlyConsumableItems($issuanceRequest)) {
                throw new \InvalidArgumentException('Only consumable supply requests can be issued without MR.');
            }

            foreach ($issuanceRequest->items as $line) {
                $this->stockOutLine(
                    $line->inventoryItem,
                    (float) $line->quantity_requested,
                    $issuanceRequest->purpose,
                    $issuanceRequest->department_id,
                    $issuanceRequest->requested_by,
                    $issuanceRequest->id,
                    "Issued for {$issuanceRequest->request_number}",
                );
                $line->update(['quantity_issued' => $line->quantity_requested]);
            }

            $issuanceRequest->update([
                'status' => 'released',
                'issued_by' => auth('api')->id(),
                'date_issued' => now(),
            ]);

            $this->audit->log('update', 'issuance', "Issued consumables for {$issuanceRequest->request_number}");
            if ($issuanceRequest->requester) {
                $this->notifications->notifyRequestReleased(
                    $issuanceRequest->requester,
                    $issuanceRequest->id,
                    $issuanceRequest->request_number,
                );
            }

            return $issuanceRequest->fresh()->load(['department', 'requester', 'items.inventoryItem']);
        });
    }

    public function requestHasOnlyConsumableItems(IssuanceRequest $request): bool
    {
        $request->loadMissing('items.inventoryItem');

        return $request->items->isNotEmpty()
            && $request->items->every(
                fn ($line) => $line->inventoryItem && $line->inventoryItem->is_consumable
            );
    }

    public function requestHasNonConsumableItems(IssuanceRequest $request): bool
    {
        $request->loadMissing('items.inventoryItem');

        return $request->items->contains(
            fn ($line) => $line->inventoryItem && ! $line->inventoryItem->is_consumable
        );
    }

    /**
     * @param  array<int, array{inventory_item_id: int, quantity: float|int, serial_number?: string|null}>  $items
     */
    private function processItems(
        MaterialRelease $release,
        array $items,
        string $purpose,
        int $departmentId,
        int $recipientUserId,
        ?int $issuanceRequestId = null,
    ): void {
        foreach ($items as $line) {
            $parentItem = InventoryItem::lockForUpdate()->findOrFail($line['inventory_item_id']);
            $serialNumber = ! empty($line['serial_number']) ? trim((string) $line['serial_number']) : null;
            $item = $this->resolveInventoryForRelease($parentItem, $serialNumber);
            $qty = (float) $line['quantity'];

            $transaction = $this->stockOutLine(
                $item,
                $qty,
                $purpose,
                $departmentId,
                $recipientUserId,
                $issuanceRequestId,
                "MR {$release->mr_number}",
            );

            MaterialReleaseItem::create([
                'material_release_id' => $release->id,
                'inventory_item_id' => $item->id,
                'serial_number' => $serialNumber,
                'quantity' => $qty,
                'unit_cost' => $item->unit_cost,
                'stock_transaction_id' => $transaction->id,
            ]);
        }
    }

    private function resolveInventoryForRelease(InventoryItem $item, ?string $serialNumber): InventoryItem
    {
        if (! $serialNumber) {
            return $item;
        }

        $existing = InventoryItem::query()
            ->where('serial_number', $serialNumber)
            ->where('quantity', '>', 0)
            ->first();

        if ($existing) {
            return $existing;
        }

        if ((float) $item->quantity < 1) {
            throw new \InvalidArgumentException("Insufficient stock for {$item->name} (serial {$serialNumber}).");
        }

        $item->decrement('quantity', 1);
        $item->update(['updated_by' => auth('api')->id()]);

        $split = $item->replicate();
        $split->quantity = 1;
        $split->serial_number = $serialNumber;
        $split->item_code = $this->generateItemCodeFromDescription($item->name, $serialNumber);
        $split->is_asset = true;
        $split->is_consumable = false;
        $split->created_by = auth('api')->id();
        $split->updated_by = auth('api')->id();
        $split->save();
        $item->loadMissing('categories');
        $split->categories()->sync($item->categories->pluck('id'));

        return $split;
    }

    private function generateItemCodeFromDescription(string $description, ?string $serialNumber = null): string
    {
        $base = strtoupper(preg_replace('/[^A-Za-z0-9]+/', '-', trim($description)) ?: 'ITEM');
        $base = trim($base, '-');
        $base = Str::limit($base, 16, '');

        if ($serialNumber) {
            $serialSuffix = strtoupper(preg_replace('/[^A-Za-z0-9]+/', '', $serialNumber) ?: '');
            $serialSuffix = Str::limit($serialSuffix, 8, '');

            return $serialSuffix !== '' ? "{$base}-{$serialSuffix}" : $base;
        }

        return $base;
    }

    private function stockOutLine(
        InventoryItem $item,
        float $qty,
        string $purpose,
        int $departmentId,
        int $recipientUserId,
        ?int $issuanceRequestId,
        string $notes,
    ): StockTransaction {
        if ($item->quantity < $qty) {
            throw new \InvalidArgumentException(
                "Insufficient stock for {$item->name}. Available: {$item->quantity}"
            );
        }

        $item->decrement('quantity', $qty);
        $item->update(['updated_by' => auth('api')->id()]);

        $transaction = StockTransaction::create([
            'transaction_number' => $this->generateReference('STK-OUT', 'stock_transactions', 'transaction_number'),
            'type' => 'stock_out',
            'inventory_item_id' => $item->id,
            'quantity' => $qty,
            'unit_cost' => $item->unit_cost,
            'department_id' => $departmentId,
            'recipient_user_id' => $recipientUserId,
            'purpose' => $purpose,
            'performed_by' => auth('api')->id(),
            'issuance_request_id' => $issuanceRequestId,
            'notes' => $notes,
        ]);

        if ($item->fresh()->isLowStock()) {
            $this->notifications->notifyLowStock($item);
        }

        $this->notifications->notifyStockTransaction(
            'stock_out',
            $transaction->transaction_number,
            $item->name,
            $qty,
            $item->unit_of_measure,
        );

        return $transaction;
    }
}
