<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('driver_license_number', 80)->nullable()->after('phone');
            $table->string('driver_license_type', 50)->nullable()->after('driver_license_number');
            $table->date('driver_license_expiry')->nullable()->after('driver_license_type');
            $table->string('driver_license_status', 30)->nullable()->after('driver_license_expiry');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'driver_license_number',
                'driver_license_type',
                'driver_license_expiry',
                'driver_license_status',
            ]);
        });
    }
};
