<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Enums\RoleSlug;
use App\Models\Role;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('document_task_division', 40)->nullable()->after('role_id');
        });

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
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('document_task_division');
        });

        Role::where('slug', RoleSlug::DocumentTracking->value)->delete();
    }
};
