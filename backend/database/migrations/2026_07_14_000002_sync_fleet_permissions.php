<?php

use App\Enums\RoleSlug;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        foreach (RoleSlug::cases() as $roleSlug) {
            Role::where('slug', $roleSlug->value)->update([
                'permissions' => $roleSlug->permissions(),
            ]);
        }
    }

    public function down(): void
    {
        // Permissions are re-synced from RoleSlug; no-op rollback.
    }
};
