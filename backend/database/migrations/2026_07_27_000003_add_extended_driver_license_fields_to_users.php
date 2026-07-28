<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->date('driver_license_issued_at')->nullable()->after('driver_license_status');
            $table->string('driver_license_restrictions', 100)->nullable()->after('driver_license_issued_at');
            $table->string('driver_license_conditions', 100)->nullable()->after('driver_license_restrictions');
            $table->string('driver_license_blood_type', 10)->nullable()->after('driver_license_conditions');
            $table->date('driver_license_date_of_birth')->nullable()->after('driver_license_blood_type');
            $table->string('driver_license_sex', 20)->nullable()->after('driver_license_date_of_birth');
            $table->string('driver_license_nationality', 80)->nullable()->after('driver_license_sex');
            $table->string('driver_license_address', 255)->nullable()->after('driver_license_nationality');
            $table->string('driver_license_agency_code', 80)->nullable()->after('driver_license_address');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'driver_license_issued_at',
                'driver_license_restrictions',
                'driver_license_conditions',
                'driver_license_blood_type',
                'driver_license_date_of_birth',
                'driver_license_sex',
                'driver_license_nationality',
                'driver_license_address',
                'driver_license_agency_code',
            ]);
        });
    }
};
