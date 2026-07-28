<?php

namespace Database\Seeders;

use App\Models\Supplier;
use Illuminate\Database\Seeder;

class SupplierSeeder extends Seeder
{
    public function run(): void
    {
        $suppliers = [
            [
                'name' => 'Palawan Capitol Office Supplies Trading',
                'contact_person' => 'Ms. Lourdes V. Mendoza',
                'email' => 'procurement@palawancapitolsupplies.gov.ph',
                'phone' => '(048) 433-2968',
                'address' => 'Rizal Avenue, Brgy. Tiniguiban, Puerto Princesa City, Palawan',
                'performance_rating' => 4.70,
                'total_deliveries' => 42,
                'notes' => 'Accredited supplier for office supplies and consumables.',
            ],
            [
                'name' => 'Northern Palawan ICT Solutions, Inc.',
                'contact_person' => 'Engr. Roberto A. Lim',
                'email' => 'sales@npict.palawan.ph',
                'phone' => '(048) 434-8812',
                'address' => 'National Highway, Brgy. San Pedro, Puerto Princesa City, Palawan',
                'performance_rating' => 4.85,
                'total_deliveries' => 24,
                'notes' => 'Authorized dealer for ICT equipment and peripherals.',
            ],
            [
                'name' => 'PGP General Merchandise & Hardware',
                'contact_person' => 'Mr. Carlo G. Mendoza',
                'email' => 'orders@pgpgeneral.ph',
                'phone' => '(048) 433-5501',
                'address' => 'BM Road, Brgy. San Pedro, Puerto Princesa City, Palawan',
                'performance_rating' => 4.40,
                'total_deliveries' => 31,
                'notes' => 'Hardware, janitorial supplies, and warehouse materials.',
            ],
            [
                'name' => 'Palawan Fleet Fuel Services Cooperative',
                'contact_person' => 'Mr. Reynaldo S. Bautista',
                'email' => 'fleetfuel@palawan.gov.ph',
                'phone' => '(048) 434-2290',
                'address' => 'Provincial Motor Pool Compound, Capitol Site, Puerto Princesa City',
                'performance_rating' => 4.60,
                'total_deliveries' => 56,
                'notes' => 'Fuel and lubricants for provincial government fleet.',
            ],
            [
                'name' => 'Island Furniture & Fixtures Corporation',
                'contact_person' => 'Ms. Ana Patricia Reyes',
                'email' => 'sales@islandfurniture.ph',
                'phone' => '(048) 434-7700',
                'address' => 'Puerto Princesa North Road, Palawan',
                'performance_rating' => 4.25,
                'total_deliveries' => 18,
                'notes' => 'Office furniture and fixtures for provincial offices.',
            ],
            [
                'name' => 'Palawan Medical & Safety Trading',
                'contact_person' => 'Dr. Leah M. Fernandez',
                'email' => 'supply@palawanmedsafety.ph',
                'phone' => '(048) 433-4410',
                'address' => 'BM Road, Puerto Princesa City, Palawan',
                'performance_rating' => 4.55,
                'total_deliveries' => 14,
                'notes' => 'Medical supplies, PPE, and safety equipment.',
            ],
        ];

        foreach ($suppliers as $data) {
            Supplier::create([...$data, 'is_active' => true]);
        }
    }
}
