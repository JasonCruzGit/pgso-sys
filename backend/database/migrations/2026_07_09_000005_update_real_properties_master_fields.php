<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('real_properties', function (Blueprint $table) {
            $table->string('account_name')->nullable()->after('id');
            $table->string('property_no', 50)->nullable()->after('account_name');
            $table->string('article', 100)->nullable()->after('property_no');
            $table->string('location', 500)->nullable()->after('description');
            $table->decimal('qty', 14, 2)->default(1)->after('location');
            $table->string('uom', 30)->default('unit')->after('qty');
            $table->decimal('unit_cost', 16, 2)->nullable()->after('uom');
            $table->decimal('acquisition_cost', 16, 2)->nullable()->after('unit_cost');
            $table->string('office', 255)->nullable()->after('status');
            $table->string('obr_no', 100)->nullable()->after('office');
            $table->string('source', 100)->nullable()->after('remarks');
        });

        $rows = DB::table('real_properties')->orderBy('id')->get();

        foreach ($rows as $row) {
            $location = collect([$row->address, $row->barangay, $row->municipality])
                ->filter(fn ($part) => filled($part))
                ->implode(', ');

            $article = match ($row->property_type ?? '') {
                'hospital' => 'Hospital',
                'health_facility' => 'Health Facility',
                'provincial_office' => 'Provincial Office',
                'capitol_building' => 'Capitol Building',
                'school' => 'School',
                'warehouse' => 'Warehouse',
                'sports_facility' => 'Sports Facility',
                'park' => 'Park',
                'correctional' => 'Correctional Facility',
                default => 'Real Property',
            };

            DB::table('real_properties')->where('id', $row->id)->update([
                'account_name' => $row->name,
                'property_no' => $row->property_code,
                'article' => $article,
                'location' => $location !== '' ? $location : null,
                'qty' => 1,
                'uom' => 'unit',
                'acquisition_cost' => $row->estimated_value,
                'office' => $row->managing_office,
                'source' => 'legacy_registry',
            ]);
        }

        DB::statement('ALTER TABLE real_properties ALTER COLUMN account_name SET NOT NULL');
        DB::statement('ALTER TABLE real_properties ALTER COLUMN property_no SET NOT NULL');

        Schema::table('real_properties', function (Blueprint $table) {
            $table->dropUnique(['property_code']);
            $table->dropIndex(['property_type']);
            $table->dropIndex(['municipality']);
            $table->dropColumn([
                'property_code',
                'name',
                'property_type',
                'address',
                'municipality',
                'barangay',
                'land_area_sqm',
                'building_area_sqm',
                'estimated_value',
                'managing_office',
                'contact_person',
                'contact_number',
            ]);
        });

        Schema::table('real_properties', function (Blueprint $table) {
            $table->unique('property_no');
            $table->index('article');
            $table->index('office');
        });
    }

    public function down(): void
    {
        Schema::table('real_properties', function (Blueprint $table) {
            $table->string('property_code', 50)->nullable();
            $table->string('name')->nullable();
            $table->string('property_type', 50)->nullable();
            $table->string('address')->nullable();
            $table->string('municipality', 100)->nullable();
            $table->string('barangay', 100)->nullable();
            $table->decimal('land_area_sqm', 14, 2)->nullable();
            $table->decimal('building_area_sqm', 14, 2)->nullable();
            $table->decimal('estimated_value', 16, 2)->nullable();
            $table->string('managing_office')->nullable();
            $table->string('contact_person')->nullable();
            $table->string('contact_number', 30)->nullable();
        });

        $rows = DB::table('real_properties')->orderBy('id')->get();

        foreach ($rows as $row) {
            DB::table('real_properties')->where('id', $row->id)->update([
                'property_code' => $row->property_no,
                'name' => $row->account_name,
                'property_type' => 'other',
                'managing_office' => $row->office,
                'estimated_value' => $row->acquisition_cost,
            ]);
        }

        Schema::table('real_properties', function (Blueprint $table) {
            $table->dropUnique(['property_no']);
            $table->dropIndex(['article']);
            $table->dropIndex(['office']);
            $table->dropColumn([
                'account_name',
                'property_no',
                'article',
                'location',
                'qty',
                'uom',
                'unit_cost',
                'acquisition_cost',
                'office',
                'obr_no',
                'source',
            ]);
            $table->unique('property_code');
            $table->index('property_type');
            $table->index('municipality');
        });
    }
};
