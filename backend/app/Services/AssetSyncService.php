<?php

namespace App\Services;

use App\Models\Asset;
use App\Models\InventoryItem;

class AssetSyncService
{
    public function syncFromInventoryItem(InventoryItem $item): ?Asset
    {
        if (! $item->is_asset) {
            return null;
        }

        $propertyNumber = $item->property_number ?? 'PROP-'.$item->item_code;

        if (! $item->property_number) {
            $item->update(['property_number' => $propertyNumber]);
        }

        if (blank($item->qr_code_data)) {
            $item->update(['qr_code_data' => $this->buildQrData($item, $propertyNumber)]);
        }

        $item->refresh();

        $payload = [
            'property_number' => $propertyNumber,
            'qr_code_data' => $item->qr_code_data,
            'location' => $item->storage_location,
            'condition' => $item->condition,
        ];

        $asset = Asset::where('inventory_item_id', $item->id)->first();

        if ($asset) {
            $asset->update($payload);

            return $asset->fresh();
        }

        return Asset::create([
            'inventory_item_id' => $item->id,
            ...$payload,
        ]);
    }

    public function syncAllPropertyItems(): int
    {
        $synced = 0;

        InventoryItem::where('is_asset', true)->each(function (InventoryItem $item) use (&$synced) {
            $this->syncFromInventoryItem($item);
            $synced++;
        });

        return $synced;
    }

    private function buildQrData(InventoryItem $item, string $propertyNumber): string
    {
        return json_encode([
            'property_number' => $propertyNumber,
            'item_name' => $item->name,
            'item_code' => $item->item_code,
            'location' => $item->storage_location,
            'custodian_id' => null,
        ]);
    }
}
