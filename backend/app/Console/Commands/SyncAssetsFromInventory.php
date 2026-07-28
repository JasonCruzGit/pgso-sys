<?php

namespace App\Console\Commands;

use App\Services\AssetSyncService;
use Illuminate\Console\Command;

class SyncAssetsFromInventory extends Command
{
    protected $signature = 'assets:sync-from-inventory';

    protected $description = 'Create or update asset records for all government property inventory items';

    public function handle(AssetSyncService $sync): int
    {
        $count = $sync->syncAllPropertyItems();

        $this->info("Synced {$count} property item(s) to the assets register.");

        return self::SUCCESS;
    }
}
