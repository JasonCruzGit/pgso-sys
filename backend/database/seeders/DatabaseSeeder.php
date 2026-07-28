<?php

namespace Database\Seeders;

use App\Enums\RoleSlug;
use App\Models\Category;
use App\Models\Department;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $roles = collect(RoleSlug::cases())->map(fn (RoleSlug $role) => Role::updateOrCreate(
            ['slug' => $role->value],
            [
                'name' => $role->displayName(),
                'description' => "Role: {$role->value}",
                'permissions' => $role->permissions(),
            ],
        ));

        $departments = collect([
            ['name' => 'Provincial General Services Office', 'code' => 'PGSO'],
            ['name' => "Provincial Governor's Office", 'code' => 'PGO'],
            ['name' => 'Provincial Health Office', 'code' => 'PHO'],
            ['name' => 'Provincial Veterinarian Office', 'code' => 'PVO'],
            ['name' => 'Provincial Engineering Office', 'code' => 'PEO'],
            ['name' => 'Provincial Accountant Office', 'code' => 'PACCO'],
            ['name' => 'Provincial Budget Office', 'code' => 'PBO'],
            ['name' => 'Provincial Agriculture Office', 'code' => 'PAO'],
        ])->map(fn ($d) => Department::updateOrCreate(
            ['code' => $d['code']],
            [...$d, 'is_active' => true],
        ));

        collect([
            ['name' => 'Office Supplies', 'code' => 'OS'],
            ['name' => 'ICT Equipment', 'code' => 'ICT'],
            ['name' => 'Furniture & Fixtures', 'code' => 'FUR'],
            ['name' => 'Fuel & Lubricants', 'code' => 'FL'],
            ['name' => 'Vehicles & Fleet', 'code' => 'VEH'],
            ['name' => 'Maintenance Equipment', 'code' => 'MNT'],
            ['name' => 'Emergency & Safety', 'code' => 'EMG'],
        ])->each(fn ($c) => Category::updateOrCreate(
            ['code' => $c['code']],
            [...$c, 'is_active' => true],
        ));

        $this->call(SupplierSeeder::class);

        $adminRole = $roles->firstWhere('slug', RoleSlug::Admin->value);
        $officerRole = $roles->firstWhere('slug', RoleSlug::InventoryOfficer->value);
        $deptRole = $roles->firstWhere('slug', RoleSlug::DepartmentUser->value);
        $auditorRole = $roles->firstWhere('slug', RoleSlug::Auditor->value);
        $fleetRole = $roles->firstWhere('slug', RoleSlug::FleetOfficer->value);
        $documentRole = $roles->firstWhere('slug', RoleSlug::DocumentTracking->value);
        $documentAdminRole = $roles->firstWhere('slug', RoleSlug::DocumentTrackingAdmin->value);

        $pgso = $departments->firstWhere('code', 'PGSO');
        $pvo = $departments->firstWhere('code', 'PVO');
        $pacco = $departments->firstWhere('code', 'PACCO');

        User::updateOrCreate(
            ['email' => 'admin@gso.palawan.gov.ph'],
            [
            'name' => 'System Administrator',
            'email' => 'admin@gso.palawan.gov.ph',
            'password' => Hash::make('Admin@12345'),
            'role_id' => $adminRole->id,
            'department_id' => $pgso->id,
            'employee_id' => 'PGSO-ADM-001',
            'is_active' => true,
            'password_changed_at' => now(),
        ]);

        User::updateOrCreate(
            ['email' => 'officer@gso.palawan.gov.ph'],
            [
            'name' => 'Mercy M. Bontao, MPA',
            'email' => 'officer@gso.palawan.gov.ph',
            'password' => Hash::make('Officer@12345'),
            'role_id' => $officerRole->id,
            'department_id' => $pgso->id,
            'employee_id' => 'PGSO-SUP-001',
            'is_active' => true,
            'password_changed_at' => now(),
        ]);

        User::updateOrCreate(
            ['email' => 'auditor@gso.palawan.gov.ph'],
            [
            'name' => 'Yolanda L. Caabay',
            'email' => 'auditor@gso.palawan.gov.ph',
            'password' => Hash::make('Auditor@12345'),
            'role_id' => $auditorRole->id,
            'department_id' => $pgso->id,
            'employee_id' => 'PGSO-AUD-001',
            'is_active' => true,
            'password_changed_at' => now(),
        ]);

        User::updateOrCreate(
            ['email' => 'fleet@gso.palawan.gov.ph'],
            [
            'name' => 'Fleet Operations Officer',
            'email' => 'fleet@gso.palawan.gov.ph',
            'password' => Hash::make('Fleet@12345'),
            'role_id' => $fleetRole->id,
            'department_id' => $pgso->id,
            'employee_id' => 'PGSO-FLT-001',
            'is_active' => true,
            'password_changed_at' => now(),
        ]);

        User::updateOrCreate(
            ['email' => 'documents@gso.palawan.gov.ph'],
            [
            'name' => 'Document Tracking Officer',
            'email' => 'documents@gso.palawan.gov.ph',
            'password' => Hash::make('Docs@12345'),
            'role_id' => $documentRole->id,
            'document_task_division' => 'incoming_outgoing',
            'department_id' => $pgso->id,
            'employee_id' => 'PGSO-DOC-001',
            'is_active' => true,
            'password_changed_at' => now(),
        ]);

        User::updateOrCreate(
            ['email' => 'docs.admin@gso.palawan.gov.ph'],
            [
            'name' => 'Document Tracking Admin',
            'email' => 'docs.admin@gso.palawan.gov.ph',
            'password' => Hash::make('DocsAdmin@12345'),
            'role_id' => $documentAdminRole->id,
            'department_id' => $pgso->id,
            'employee_id' => 'PGSO-DOC-ADM-001',
            'is_active' => true,
            'password_changed_at' => now(),
        ]);

        User::updateOrCreate(
            ['email' => 'kenneth.panganiban@pvo.palawan.gov.ph'],
            [
            'name' => 'Kenneth M. Panganiban',
            'email' => 'kenneth.panganiban@pvo.palawan.gov.ph',
            'password' => Hash::make('Employee@12345'),
            'role_id' => $deptRole->id,
            'department_id' => $pvo->id,
            'employee_id' => 'PVO-8721-014',
            'is_active' => true,
            'password_changed_at' => now(),
        ]);

        User::updateOrCreate(
            ['email' => 'virna.devera@pacco.palawan.gov.ph'],
            [
            'name' => 'Virna Asuncion M. De Vera',
            'email' => 'virna.devera@pacco.palawan.gov.ph',
            'password' => Hash::make('Employee@12345'),
            'role_id' => $deptRole->id,
            'department_id' => $pacco->id,
            'employee_id' => 'PACCO-ACC-021',
            'is_active' => true,
            'password_changed_at' => now(),
        ]);

        User::updateOrCreate(
            ['email' => 'jay.garciano@pacco.palawan.gov.ph'],
            [
            'name' => 'Jay Emmanuel C. Garciano',
            'email' => 'jay.garciano@pacco.palawan.gov.ph',
            'password' => Hash::make('Employee@12345'),
            'role_id' => $deptRole->id,
            'department_id' => $pacco->id,
            'employee_id' => 'PACCO-SAO-008',
            'is_active' => true,
            'password_changed_at' => now(),
        ]);

        User::updateOrCreate(
            ['email' => 'jason.cruz@pgso.palawan.gov.ph'],
            [
            'name' => 'Jason R. Cruz',
            'email' => 'jason.cruz@pgso.palawan.gov.ph',
            'password' => Hash::make('Employee@12345'),
            'role_id' => $deptRole->id,
            'department_id' => $pgso->id,
            'employee_id' => 'PGSO-ICT-003',
            'is_active' => true,
            'password_changed_at' => now(),
        ]);

        User::updateOrCreate(
            ['email' => 'dept@gso.palawan.gov.ph'],
            [
            'name' => 'Department End-User (Demo)',
            'email' => 'dept@gso.palawan.gov.ph',
            'password' => Hash::make('Dept@12345'),
            'role_id' => $deptRole->id,
            'department_id' => $pgso->id,
            'employee_id' => 'PGSO-DEMO-001',
            'is_active' => true,
            'password_changed_at' => now(),
        ]);

        $this->call(PgsoFormalDataSeeder::class);
        $this->call(RealPropertySeeder::class);
        $this->call(FleetSeeder::class);
        $this->call(DocumentTrackingSeeder::class);
    }
}
