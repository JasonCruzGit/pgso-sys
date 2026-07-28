<?php

namespace Database\Seeders;

use App\Enums\RoleSlug;
use App\Models\Department;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class ElNidoBrandingDataSeeder extends Seeder
{
    public function run(): void
    {
        $this->migrateDepartments();
        $this->migrateUserEmails();
        $this->ensureEmployeeAccounts();
    }

    private function migrateDepartments(): void
    {
        $updates = [
            'PAO' => ['name' => "Municipal Mayor's Office", 'code' => 'MMO'],
            'PHO' => ['name' => 'Municipal Health Office', 'code' => 'MHO'],
            'PEO' => ['name' => 'Municipal Engineering Office', 'code' => 'MEO'],
            'PACCO' => ['name' => 'Municipal Accounting Office', 'code' => 'MACCO'],
        ];

        foreach ($updates as $legacyCode => $data) {
            Department::where('code', $legacyCode)->update($data);
        }
    }

    private function migrateUserEmails(): void
    {
        $migrations = [
            'admin@gso.elnido.gov.ph' => 'admin@gso.palawan.gov.ph',
            'officer@gso.elnido.gov.ph' => 'officer@gso.palawan.gov.ph',
            'dept@elnido.gov.ph' => 'dept@gso.palawan.gov.ph',
            'auditor@gso.elnido.gov.ph' => 'auditor@gso.palawan.gov.ph',
            'maria.santos@mho.elnido.gov.ph' => 'maria.santos@mho.palawan.gov.ph',
            'jose.rivera@elnido.gov.ph' => 'jose.rivera@palawan.gov.ph',
        ];

        foreach ($migrations as $from => $to) {
            if (User::where('email', $from)->exists() && ! User::where('email', $to)->exists()) {
                User::where('email', $from)->update(['email' => $to]);
            }
        }
    }

    private function ensureEmployeeAccounts(): void
    {
        $role = Role::where('slug', RoleSlug::DepartmentUser->value)->first();
        $mho = Department::where('code', 'MHO')->first();
        $mmo = Department::where('code', 'MMO')->first();

        if (! $role || ! $mho) {
            return;
        }

        $employees = [
            [
                'employee_id' => 'EMP-005',
                'name' => 'Maria Santos',
                'email' => 'maria.santos@mho.palawan.gov.ph',
                'phone' => '0917-555-0101',
                'department_id' => $mho->id,
            ],
            [
                'employee_id' => 'EMP-006',
                'name' => 'Jose Rivera',
                'email' => 'jose.rivera@palawan.gov.ph',
                'phone' => '0918-555-0102',
                'department_id' => $mmo?->id ?? $mho->id,
            ],
        ];

        foreach ($employees as $employee) {
            User::updateOrCreate(
                ['employee_id' => $employee['employee_id']],
                [
                    ...$employee,
                    'password' => Hash::make('Employee@12345'),
                    'role_id' => $role->id,
                    'is_active' => true,
                    'failed_login_attempts' => 0,
                    'locked_until' => null,
                    'password_changed_at' => now(),
                ],
            );
        }
    }
}
