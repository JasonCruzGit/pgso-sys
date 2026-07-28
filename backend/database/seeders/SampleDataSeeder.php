<?php

namespace Database\Seeders;

use App\Models\BudgetAllocation;
use App\Models\Category;
use App\Models\Department;
use App\Models\InventoryItem;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\PurchaseRequest;
use App\Models\PurchaseRequestItem;
use App\Models\StockReceipt;
use App\Models\StockReceiptItem;
use App\Models\Supplier;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class SampleDataSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(SupplierSeeder::class);

        $gso = Department::where('code', 'GSO')->first();
        $officer = User::where('email', 'officer@gso.palawan.gov.ph')->first();
        $admin = User::where('email', 'admin@gso.palawan.gov.ph')->first();

        if (! $gso || ! $officer) {
            return;
        }

        $suppliers = Supplier::orderBy('name')->get()->keyBy('name');
        $categories = Category::all()->keyBy('code');

        $extraItems = [
            ['item_code' => 'OS-003', 'name' => 'Stapler (Heavy Duty)', 'category' => 'OS', 'uom' => 'unit', 'qty' => 25, 'reorder' => 10, 'cost' => 450, 'supplier' => 'El Nido Office & School Supplies'],
            ['item_code' => 'OS-004', 'name' => 'Folder (Legal Size)', 'category' => 'OS', 'uom' => 'pack', 'qty' => 80, 'reorder' => 30, 'cost' => 95, 'supplier' => 'Limestone Coast General Merchandise'],
            ['item_code' => 'ICT-002', 'name' => 'Laser Printer', 'category' => 'ICT', 'uom' => 'unit', 'qty' => 6, 'reorder' => 2, 'cost' => 18500, 'supplier' => 'Northern Palawan ICT Solutions'],
            ['item_code' => 'ICT-003', 'name' => 'Network Switch 24-Port', 'category' => 'ICT', 'uom' => 'unit', 'qty' => 4, 'reorder' => 1, 'cost' => 12000, 'supplier' => 'Northern Palawan ICT Solutions'],
            ['item_code' => 'FUR-002', 'name' => 'Filing Cabinet (4-Drawer)', 'category' => 'FUR', 'uom' => 'unit', 'qty' => 10, 'reorder' => 3, 'cost' => 6500, 'supplier' => 'El Nido Furniture & Fixtures'],
            ['item_code' => 'MNT-001', 'name' => 'Electric Drill Set', 'category' => 'MNT', 'uom' => 'set', 'qty' => 3, 'reorder' => 1, 'cost' => 4200, 'supplier' => 'El Nido Industrial & Hardware Supply'],
            ['item_code' => 'EMG-002', 'name' => 'Fire Extinguisher (ABC 10lbs)', 'category' => 'EMG', 'uom' => 'unit', 'qty' => 12, 'reorder' => 5, 'cost' => 2800, 'supplier' => 'El Nido Medical & Safety Supplies'],
            ['item_code' => 'VEH-001', 'name' => 'Motor Oil (4L)', 'category' => 'VEH', 'uom' => 'bottle', 'qty' => 20, 'reorder' => 8, 'cost' => 650, 'supplier' => 'Palawan Island Auto Center — El Nido'],
        ];

        foreach ($extraItems as $item) {
            $cat = $categories->get($item['category']);
            $supplier = $suppliers->get($item['supplier']);
            if (! $cat) {
                continue;
            }

            InventoryItem::updateOrCreate(
                ['item_code' => $item['item_code']],
                [
                    'name' => $item['name'],
                    'category_id' => $cat->id,
                    'unit_of_measure' => $item['uom'],
                    'quantity' => $item['qty'],
                    'reorder_level' => $item['reorder'],
                    'unit_cost' => $item['cost'],
                    'supplier_id' => $supplier?->id,
                    'storage_location' => 'PGP PGSO Warehouse, Provincial Capitol, Puerto Princesa City, Palawan',
                    'date_acquired' => now()->subMonths(2),
                    'condition' => 'good',
                    'status' => 'available',
                    'is_asset' => false,
                    'created_by' => $admin?->id ?? $officer->id,
                    'updated_by' => $admin?->id ?? $officer->id,
                ],
            );
        }

        $fiscalYear = now()->format('Y');

        foreach (Department::where('is_active', true)->get() as $dept) {
            BudgetAllocation::updateOrCreate(
                ['department_id' => $dept->id, 'fiscal_year' => $fiscalYear, 'category' => 'General Supplies'],
                [
                    'description' => 'Annual allocation for office and general supplies',
                    'allocated_amount' => 500000,
                    'spent_amount' => rand(80000, 220000),
                ],
            );
        }

        if (PurchaseRequest::count() === 0) {
            $pr = PurchaseRequest::create([
                'pr_number' => 'PR-'.now()->format('Ymd').'-SAMP',
                'department_id' => $gso->id,
                'requested_by' => $officer->id,
                'title' => 'Q1 Office Supplies Replenishment',
                'description' => 'Restocking of bond paper, ballpens, and folders for GSO offices at the Municipal Hall, El Nido.',
                'total_estimated_cost' => 45000,
                'status' => 'approved',
                'approved_by' => $admin?->id,
                'submitted_at' => now()->subDays(10),
                'approved_at' => now()->subDays(7),
            ]);

            PurchaseRequestItem::create([
                'purchase_request_id' => $pr->id,
                'description' => 'A4 Bond Paper (Ream)',
                'quantity' => 100,
                'unit_cost' => 280,
            ]);

            PurchaseRequestItem::create([
                'purchase_request_id' => $pr->id,
                'description' => 'Ballpen (Blue) — Box of 50',
                'quantity' => 30,
                'unit_cost' => 120,
            ]);

            $ictSupplier = $suppliers->get('Northern Palawan ICT Solutions');
            if ($ictSupplier) {
                $po = PurchaseOrder::create([
                    'po_number' => 'PO-'.now()->format('Ymd').'-SAMP',
                    'purchase_request_id' => $pr->id,
                    'supplier_id' => $ictSupplier->id,
                    'status' => 'issued',
                    'total_amount' => 111000,
                    'issued_by' => $admin?->id ?? $officer->id,
                    'issued_date' => now()->subDays(5),
                    'notes' => 'ICT equipment upgrade for GSO records section, Municipal Hall, El Nido.',
                ]);

                PurchaseOrderItem::create([
                    'purchase_order_id' => $po->id,
                    'description' => 'Laser Printer',
                    'quantity_ordered' => 3,
                    'quantity_received' => 0,
                    'unit_cost' => 18500,
                ]);

                PurchaseOrderItem::create([
                    'purchase_order_id' => $po->id,
                    'description' => 'Network Switch 24-Port',
                    'quantity_ordered' => 4,
                    'quantity_received' => 0,
                    'unit_cost' => 12000,
                ]);
            }
        }

        if (StockReceipt::count() <= 1) {
            $officeSupplier = $suppliers->get('El Nido Office & School Supplies');
            if ($officeSupplier) {
                $receipt = StockReceipt::create([
                    'receipt_number' => 'RCV-'.now()->format('Ymd').'-'.strtoupper(Str::random(4)),
                    'purchase_order_number' => 'PO-'.now()->format('Y').'-001',
                    'supplier_id' => $officeSupplier->id,
                    'delivery_receipt_number' => 'DR-2024-0892',
                    'receiving_date' => now()->subDays(3),
                    'received_by' => $officer->id,
                    'notes' => 'Sample delivery — office supplies batch for PGP PGSO.',
                ]);

                $bondPaper = InventoryItem::where('item_code', 'OS-001')->first();
                if ($bondPaper) {
                    StockReceiptItem::create([
                        'stock_receipt_id' => $receipt->id,
                        'inventory_item_id' => $bondPaper->id,
                        'quantity_received' => 50,
                        'unit_cost' => 280,
                    ]);
                }
            }
        }
    }
}
