<?php

use App\Enums\RoleSlug;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        foreach (RoleSlug::cases() as $roleSlug) {
            Role::updateOrCreate(
                ['slug' => $roleSlug->value],
                [
                    'name' => $roleSlug->displayName(),
                    'description' => "Role: {$roleSlug->value}",
                    'permissions' => $roleSlug->permissions(),
                ],
            );
        }
    }

    public function down(): void
    {
        Role::where('slug', RoleSlug::DocumentTrackingAdmin->value)->delete();
    }
};
