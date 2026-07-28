<?php

use App\Enums\RoleSlug;
use App\Models\Role;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        $roleSlug = RoleSlug::DocumentTrackingAdmin;

        Role::updateOrCreate(
            ['slug' => $roleSlug->value],
            [
                'name' => $roleSlug->displayName(),
                'description' => 'Receive and send incoming/outgoing documents only',
                'permissions' => $roleSlug->permissions(),
            ],
        );
    }

    public function down(): void
    {
        $roleSlug = RoleSlug::DocumentTrackingAdmin;

        Role::where('slug', $roleSlug->value)->update([
            'description' => "Role: {$roleSlug->value}",
            'permissions' => [
                'notifications.view',
                'messaging.view',
                'messaging.send',
                'documents.view',
                'documents.*',
            ],
        ]);
    }
};
