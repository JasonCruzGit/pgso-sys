<?php

namespace Database\Seeders;

use App\Enums\RoleSlug;
use App\Models\Department;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class EmployeeUserSeeder extends Seeder
{
    public function run(): void
    {
        $role = Role::where('slug', RoleSlug::DepartmentUser->value)->first();
        $mho = Department::where('code', 'MHO')->first();

        if (! $role || ! $mho) {
            return;
        }

        $employees = [
            [
                'name' => 'Maria Santos',
                'email' => 'maria.santos@mho.palawan.gov.ph',
                'employee_id' => 'EMP-005',
                'phone' => '0917-555-0101',
                'department_id' => $mho->id,
            ],
            [
                'name' => 'Jose Rivera',
                'email' => 'jose.rivera@palawan.gov.ph',
                'employee_id' => 'EMP-006',
                'phone' => '0918-555-0102',
                'department_id' => Department::where('code', 'MMO')->value('id'),
            ],
        ];

        foreach ($employees as $employee) {
            if (! $employee['department_id']) {
                continue;
            }

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
