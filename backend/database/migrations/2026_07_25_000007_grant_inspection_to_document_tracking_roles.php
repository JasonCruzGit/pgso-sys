<?php

use App\Enums\RoleSlug;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        foreach ([RoleSlug::DocumentTracking, RoleSlug::DocumentTrackingAdmin] as $roleSlug) {
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
        foreach ([RoleSlug::DocumentTracking, RoleSlug::DocumentTrackingAdmin] as $roleSlug) {
            $permissions = array_values(array_filter(
                $roleSlug->permissions(),
                fn (string $p) => ! str_starts_with($p, 'inspection'),
            ));

            Role::where('slug', $roleSlug->value)->update([
                'permissions' => $permissions,
            ]);
        }
    }
};
