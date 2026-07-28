<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fleet_vehicles', function (Blueprint $table) {
            $table->date('registration_issued_at')->nullable()->after('registration_status');
            $table->string('engine_number', 100)->nullable()->after('registration_issued_at');
            $table->string('chassis_number', 100)->nullable()->after('engine_number');
            $table->string('registration_classification', 80)->nullable()->after('chassis_number');
            $table->string('registration_series', 80)->nullable()->after('registration_classification');
            $table->decimal('registration_gross_weight', 10, 2)->nullable()->after('registration_series');
            $table->decimal('registration_net_weight', 10, 2)->nullable()->after('registration_gross_weight');
            $table->string('registration_piston_displacement', 50)->nullable()->after('registration_net_weight');
            $table->string('registration_lto_office', 120)->nullable()->after('registration_piston_displacement');
            $table->string('registration_owner_name', 150)->nullable()->after('registration_lto_office');
            $table->decimal('registration_amount_paid', 12, 2)->nullable()->after('registration_owner_name');
        });
    }

    public function down(): void
    {
        Schema::table('fleet_vehicles', function (Blueprint $table) {
            $table->dropColumn([
                'registration_issued_at',
                'engine_number',
                'chassis_number',
                'registration_classification',
                'registration_series',
                'registration_gross_weight',
                'registration_net_weight',
                'registration_piston_displacement',
                'registration_lto_office',
                'registration_owner_name',
                'registration_amount_paid',
            ]);
        });
    }
};
