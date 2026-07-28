<?php

namespace Database\Seeders;

use App\Models\RealProperty;
use Illuminate\Database\Seeder;

class RealPropertySeeder extends Seeder
{
    public function run(): void
    {
        $properties = [
            [
                'property_no' => 'RP-2024-PHO-001',
                'account_name' => 'Palawan Provincial Hospital',
                'article' => 'Hospital Building & Lot',
                'description' => 'Primary provincial referral hospital serving Puerto Princesa City and northern Palawan.',
                'location' => 'BM Road, Brgy. Tiniguiban, Puerto Princesa City, Palawan',
                'qty' => 1,
                'uom' => 'lot',
                'unit_cost' => 250000000,
                'acquisition_cost' => 250000000,
                'acquisition_date' => '2018-03-15',
                'status' => 'active',
                'office' => 'Provincial Health Office',
                'obr_no' => '300-24-01-18452',
                'source' => 'construction',
                'remarks' => 'Provincial government hospital under PHO supervision.',
            ],
            [
                'property_no' => 'RP-2024-CAP-001',
                'account_name' => 'Palawan Provincial Capitol Building',
                'article' => 'Capitol Building & Grounds',
                'description' => 'Main seat of the Provincial Government of Palawan.',
                'location' => 'Rizal Avenue, Brgy. Tiniguiban, Puerto Princesa City, Palawan',
                'qty' => 1,
                'uom' => 'lot',
                'acquisition_cost' => 450000000,
                'acquisition_date' => '1972-06-12',
                'status' => 'active',
                'office' => "Provincial Governor's Office",
                'obr_no' => '100-GF-LEGACY',
                'source' => 'legacy_registry',
            ],
            [
                'property_no' => 'RP-2024-PGSO-001',
                'account_name' => 'PGSO Central Warehouse & Office',
                'article' => 'Warehouse Building',
                'description' => 'Central storage and issuance facility for provincial supplies and property.',
                'location' => 'Provincial Capitol Compound, Puerto Princesa City, Palawan',
                'qty' => 1,
                'uom' => 'building',
                'acquisition_cost' => 18500000,
                'acquisition_date' => '2015-11-20',
                'status' => 'active',
                'office' => 'Provincial General Services Office',
                'obr_no' => '300-22-08-09214',
                'source' => 'construction',
            ],
            [
                'property_no' => 'RP-2024-PVO-001',
                'account_name' => 'Provincial Veterinarian Office Building',
                'article' => 'Office Building',
                'description' => 'Administrative office of the Provincial Veterinarian Office.',
                'location' => 'Capitol Site, Puerto Princesa City, Palawan',
                'qty' => 1,
                'uom' => 'building',
                'acquisition_cost' => 8200000,
                'acquisition_date' => '2019-02-08',
                'status' => 'active',
                'office' => 'Provincial Veterinarian Office',
                'obr_no' => '300-23-04-11803',
                'source' => 'construction',
            ],
            [
                'property_no' => 'RP-2024-ABR-001',
                'account_name' => 'Aborlan District Hospital',
                'article' => 'Hospital Building',
                'description' => 'District hospital for Aborlan and southern Palawan municipalities.',
                'location' => 'Poblacion, Aborlan, Palawan',
                'qty' => 1,
                'uom' => 'lot',
                'acquisition_cost' => 42000000,
                'acquisition_date' => '2016-09-01',
                'status' => 'active',
                'office' => 'Provincial Health Office',
                'obr_no' => '300-21-11-07641',
                'source' => 'construction',
            ],
            [
                'property_no' => 'RP-2024-NRT-001',
                'account_name' => 'Narra District Hospital',
                'article' => 'Hospital Building',
                'description' => 'District hospital serving Narra and central Palawan.',
                'location' => 'Poblacion, Narra, Palawan',
                'qty' => 1,
                'uom' => 'lot',
                'acquisition_cost' => 38500000,
                'acquisition_date' => '2017-04-18',
                'status' => 'active',
                'office' => 'Provincial Health Office',
                'source' => 'construction',
            ],
        ];

        foreach ($properties as $property) {
            RealProperty::create($property);
        }
    }
}
