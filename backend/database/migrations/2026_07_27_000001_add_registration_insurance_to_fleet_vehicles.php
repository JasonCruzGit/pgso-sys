<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fleet_vehicles', function (Blueprint $table) {
            $table->string('cr_number', 80)->nullable()->after('notes');
            $table->string('or_number', 80)->nullable()->after('cr_number');
            $table->string('mv_file_number', 80)->nullable()->after('or_number');
            $table->date('registration_expiry')->nullable()->after('mv_file_number');
            $table->string('registration_status', 30)->nullable()->after('registration_expiry');
            $table->string('insurance_provider', 150)->nullable()->after('registration_status');
            $table->string('insurance_policy_number', 100)->nullable()->after('insurance_provider');
            $table->string('insurance_coverage_type', 80)->nullable()->after('insurance_policy_number');
            $table->date('insurance_expiry')->nullable()->after('insurance_coverage_type');
            $table->string('insurance_status', 30)->nullable()->after('insurance_expiry');
        });
    }

    public function down(): void
    {
        Schema::table('fleet_vehicles', function (Blueprint $table) {
            $table->dropColumn([
                'cr_number',
                'or_number',
                'mv_file_number',
                'registration_expiry',
                'registration_status',
                'insurance_provider',
                'insurance_policy_number',
                'insurance_coverage_type',
                'insurance_expiry',
                'insurance_status',
            ]);
        });
    }
};
