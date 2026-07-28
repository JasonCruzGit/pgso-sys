<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fleet_vehicles', function (Blueprint $table) {
            $table->date('insurance_issued_at')->nullable()->after('insurance_status');
            $table->string('insurance_certificate_number', 100)->nullable()->after('insurance_issued_at');
            $table->decimal('insurance_sum_insured', 14, 2)->nullable()->after('insurance_certificate_number');
            $table->string('insurance_broker', 150)->nullable()->after('insurance_sum_insured');
            $table->string('insurance_contact_person', 120)->nullable()->after('insurance_broker');
            $table->string('insurance_contact_phone', 40)->nullable()->after('insurance_contact_person');
            $table->string('insurance_remarks', 255)->nullable()->after('insurance_contact_phone');
        });
    }

    public function down(): void
    {
        Schema::table('fleet_vehicles', function (Blueprint $table) {
            $table->dropColumn([
                'insurance_issued_at',
                'insurance_certificate_number',
                'insurance_sum_insured',
                'insurance_broker',
                'insurance_contact_person',
                'insurance_contact_phone',
                'insurance_remarks',
            ]);
        });
    }
};
