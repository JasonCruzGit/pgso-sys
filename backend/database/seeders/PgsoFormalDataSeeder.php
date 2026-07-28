<?php

namespace Database\Seeders;

use App\Models\BudgetAllocation;
use App\Models\Category;
use App\Models\Department;
use App\Models\InventoryItem;
use App\Models\Supplier;
use App\Models\User;
use App\Services\AssetSyncService;
use Illuminate\Database\Seeder;

class PgsoFormalDataSeeder extends Seeder
{
    public function run(): void
    {
        $categories = Category::all()->keyBy('code');
        $suppliers = Supplier::all()->keyBy('name');
        $admin = User::first();
        $warehouse = 'PGSO Main Warehouse, Provincial Capitol, Puerto Princesa City, Palawan';
        $pgp = 'PGP Provincial Capitol Compound, Puerto Princesa City, Palawan';

        $items = [
            // Fuel & lubricants (consumable)
            ['item_code' => 'FL-GAS-91', 'name' => 'Gasoline, 91 Octane Rating', 'category' => 'FL', 'uom' => 'liters', 'qty' => 450, 'reorder' => 200, 'cost' => 81.00, 'consumable' => true, 'location' => $warehouse, 'supplier' => 'Palawan Fleet Fuel Services Cooperative'],
            ['item_code' => 'FL-DIESEL-001', 'name' => 'Diesel Fuel, Automotive Grade', 'category' => 'FL', 'uom' => 'liters', 'qty' => 1200, 'reorder' => 500, 'cost' => 79.00, 'consumable' => true, 'location' => $warehouse, 'supplier' => 'Palawan Fleet Fuel Services Cooperative'],
            ['item_code' => 'FL-OIL-15W40', 'name' => 'Engine Oil, SAE 15W-40', 'category' => 'FL', 'uom' => 'gals', 'qty' => 48, 'reorder' => 20, 'cost' => 485.00, 'consumable' => true, 'location' => $warehouse, 'supplier' => 'Palawan Fleet Fuel Services Cooperative'],

            // Office supplies (consumable)
            ['item_code' => 'OS-TISSUE-001', 'name' => 'Tissue Paper, Interfold, 200 pulls', 'category' => 'OS', 'uom' => 'piece', 'qty' => 100, 'reorder' => 40, 'cost' => 50.00, 'consumable' => true, 'location' => $warehouse, 'supplier' => 'Palawan Capitol Office Supplies Trading'],
            ['item_code' => 'OS-BINDER-001', 'name' => 'Document Binder, Legal Size, 2-inch', 'category' => 'OS', 'uom' => 'piece', 'qty' => 98, 'reorder' => 30, 'cost' => 60.00, 'consumable' => true, 'location' => $warehouse, 'supplier' => 'Palawan Capitol Office Supplies Trading'],
            ['item_code' => 'OS-BOND-A4', 'name' => 'Bond Paper, A4, 80gsm (Ream)', 'category' => 'OS', 'uom' => 'ream', 'qty' => 240, 'reorder' => 80, 'cost' => 285.00, 'consumable' => true, 'location' => $warehouse, 'supplier' => 'Palawan Capitol Office Supplies Trading'],
            ['item_code' => 'OS-BALLPEN-001', 'name' => 'Ballpen, Blue Ink, Box of 50', 'category' => 'OS', 'uom' => 'box', 'qty' => 65, 'reorder' => 25, 'cost' => 125.00, 'consumable' => true, 'location' => $warehouse, 'supplier' => 'Palawan Capitol Office Supplies Trading'],
            ['item_code' => 'OS-STAPLER-001', 'name' => 'Stapler, Heavy Duty, Office Type', 'category' => 'OS', 'uom' => 'unit', 'qty' => 35, 'reorder' => 10, 'cost' => 395.00, 'consumable' => true, 'location' => $warehouse, 'supplier' => 'Palawan Capitol Office Supplies Trading'],

            // ICT equipment (non-consumable / semi-expendable)
            ['item_code' => 'ICT-RACK-SRV-001', 'name' => 'Rack Server, 2U, Dual Processor', 'category' => 'ICT', 'uom' => 'unit', 'qty' => 2, 'reorder' => 1, 'cost' => 75000.00, 'consumable' => false, 'asset' => true, 'prop' => 'PGSO-ICT-SRV-001', 'brand' => 'Dell', 'model' => 'PowerEdge R750', 'serial' => 'SRV-2025-00041', 'location' => $warehouse, 'supplier' => 'Northern Palawan ICT Solutions, Inc.'],
            ['item_code' => 'ICT-LAPTOP-001', 'name' => 'Laptop Computer, Intel Core i5, 16GB RAM', 'category' => 'ICT', 'uom' => 'unit', 'qty' => 1, 'reorder' => 1, 'cost' => 85000.00, 'consumable' => false, 'asset' => true, 'prop' => 'PVO-LAPTOP-008', 'brand' => 'Asus', 'model' => 'Vivobook 16X', 'serial' => 'NB-2026-00812', 'location' => $warehouse, 'supplier' => 'Northern Palawan ICT Solutions, Inc.'],
            ['item_code' => 'ICT-LAPTOP-002', 'name' => 'Laptop Computer, Intel Core i5, 8GB RAM', 'category' => 'ICT', 'uom' => 'unit', 'qty' => 8, 'reorder' => 2, 'cost' => 67900.00, 'consumable' => false, 'asset' => true, 'prop' => 'PGSO-LAPTOP-003', 'brand' => 'Lenovo', 'model' => 'ThinkPad E14', 'serial' => 'NB-2025-00087', 'location' => $pgp, 'supplier' => 'Northern Palawan ICT Solutions, Inc.'],
            ['item_code' => 'ICT-DESKTOP-001', 'name' => 'Desktop Computer Set, Core i5', 'category' => 'ICT', 'uom' => 'unit', 'qty' => 15, 'reorder' => 3, 'cost' => 48500.00, 'consumable' => false, 'asset' => true, 'prop' => 'PGSO-DT-015', 'brand' => 'HP', 'model' => 'ProDesk 400 G9', 'serial' => 'DT-2025-00115', 'location' => $pgp, 'supplier' => 'Northern Palawan ICT Solutions, Inc.'],
            ['item_code' => 'ICT-PRINTER-001', 'name' => 'Laser Printer, Monochrome, Network Ready', 'category' => 'ICT', 'uom' => 'unit', 'qty' => 6, 'reorder' => 2, 'cost' => 18900.00, 'consumable' => false, 'asset' => true, 'prop' => 'PGSO-PRT-006', 'brand' => 'Brother', 'model' => 'HL-L5210DN', 'serial' => 'PRT-2025-00006', 'location' => $warehouse, 'supplier' => 'Northern Palawan ICT Solutions, Inc.'],
            ['item_code' => 'ICT-NET-CAB-001', 'name' => 'Network Cabinet, 42U, Floor Standing', 'category' => 'ICT', 'uom' => 'unit', 'qty' => 1, 'reorder' => 1, 'cost' => 5000.00, 'consumable' => false, 'asset' => true, 'prop' => 'PGSO-NET-001', 'brand' => 'Toten', 'model' => '42U Standard', 'serial' => 'NC-2024-00003', 'location' => $pgp, 'supplier' => 'Northern Palawan ICT Solutions, Inc.'],

            // Furniture (non-consumable)
            ['item_code' => 'FUR-CABINET-001', 'name' => 'Filing Cabinet, 4-Drawer, Steel', 'category' => 'FUR', 'uom' => 'unit', 'qty' => 12, 'reorder' => 4, 'cost' => 6800.00, 'consumable' => false, 'asset' => true, 'prop' => 'PGSO-FUR-CAB-012', 'location' => $pgp, 'supplier' => 'Island Furniture & Fixtures Corporation'],
            ['item_code' => 'FUR-CHAIR-001', 'name' => 'Executive Office Chair, Ergonomic', 'category' => 'FUR', 'uom' => 'unit', 'qty' => 20, 'reorder' => 5, 'cost' => 8900.00, 'consumable' => false, 'asset' => true, 'prop' => 'PGSO-FUR-CHR-020', 'location' => $pgp, 'supplier' => 'Island Furniture & Fixtures Corporation'],

            // Emergency / safety
            ['item_code' => 'EMG-FA-KIT-001', 'name' => 'First Aid Kit, Standard Office Set', 'category' => 'EMG', 'uom' => 'set', 'qty' => 18, 'reorder' => 8, 'cost' => 1650.00, 'consumable' => true, 'location' => $warehouse, 'supplier' => 'Palawan Medical & Safety Trading'],
            ['item_code' => 'EMG-FIRE-EXT-001', 'name' => 'Fire Extinguisher, ABC Dry Chemical, 10 lbs', 'category' => 'EMG', 'uom' => 'unit', 'qty' => 24, 'reorder' => 10, 'cost' => 2850.00, 'consumable' => false, 'asset' => true, 'prop' => 'PGSO-SFT-EXT-024', 'location' => $pgp, 'supplier' => 'Palawan Medical & Safety Trading'],
        ];

        foreach ($items as $item) {
            $cat = $categories->get($item['category']);
            $supplier = $suppliers->get($item['supplier']);
            if (! $cat) {
                continue;
            }

            InventoryItem::create([
                'item_code' => $item['item_code'],
                'property_number' => $item['prop'] ?? null,
                'name' => $item['name'],
                'category_id' => $cat->id,
                'unit_of_measure' => $item['uom'],
                'quantity' => $item['qty'],
                'reorder_level' => $item['reorder'],
                'unit_cost' => $item['cost'],
                'supplier_id' => $supplier?->id,
                'storage_location' => $item['location'],
                'date_acquired' => now()->subMonths(rand(1, 18)),
                'condition' => 'good',
                'status' => 'available',
                'is_asset' => $item['asset'] ?? false,
                'is_consumable' => $item['consumable'],
                'brand' => $item['brand'] ?? null,
                'model' => $item['model'] ?? null,
                'serial_number' => $item['serial'] ?? null,
                'created_by' => $admin?->id,
                'updated_by' => $admin?->id,
            ]);
        }

        app(AssetSyncService::class)->syncAllPropertyItems();

        $fiscalYear = now()->format('Y');
        foreach (Department::where('is_active', true)->get() as $dept) {
            BudgetAllocation::create([
                'department_id' => $dept->id,
                'fiscal_year' => $fiscalYear,
                'category' => 'MOOE — General Fund',
                'description' => 'Maintenance and Other Operating Expenses allocation',
                'allocated_amount' => match ($dept->code) {
                    'PGSO' => 15000000,
                    'PHO', 'PVO' => 8500000,
                    'PEO' => 12000000,
                    default => 3500000,
                },
                'spent_amount' => rand(450000, 2800000),
            ]);
        }
    }
}
