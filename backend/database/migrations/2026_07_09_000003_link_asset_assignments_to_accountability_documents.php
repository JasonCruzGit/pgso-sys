<?php

use App\Models\AccountabilityDocument;
use App\Models\AssetAssignment;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('asset_assignments', function (Blueprint $table) {
            $table->foreignId('accountability_document_id')
                ->nullable()
                ->after('asset_id')
                ->constrained('accountability_documents')
                ->nullOnDelete();
        });

        DB::table('asset_assignments')
            ->whereIn('document_type', ['par', 'ics'])
            ->orderBy('id')
            ->chunkById(100, function ($assignments) {
                foreach ($assignments as $assignment) {
                    $mrReference = null;
                    if ($assignment->material_release_id) {
                        $mrReference = DB::table('material_releases')
                            ->where('id', $assignment->material_release_id)
                            ->value('mr_number');
                    }

                    $documentId = DB::table('accountability_documents')->insertGetId([
                        'acknowledgment_number' => $assignment->acknowledgment_number,
                        'document_type' => $assignment->document_type,
                        'custodian_user_id' => $assignment->custodian_user_id,
                        'department_id' => $assignment->department_id,
                        'material_release_id' => $assignment->material_release_id,
                        'assignment_date' => $assignment->assignment_date,
                        'fund_code' => '100',
                        'fund_name' => 'GENERAL FUND',
                        'obr_reference' => null,
                        'mr_reference' => $mrReference,
                        'assigned_by' => $assignment->assigned_by,
                        'status' => $assignment->status === 'returned' ? 'closed' : 'active',
                        'notes' => $assignment->notes,
                        'created_at' => $assignment->created_at ?? now(),
                        'updated_at' => $assignment->updated_at ?? now(),
                    ]);

                    DB::table('asset_assignments')
                        ->where('id', $assignment->id)
                        ->update(['accountability_document_id' => $documentId]);
                }
            });

        Schema::table('asset_assignments', function (Blueprint $table) {
            $table->dropUnique(['acknowledgment_number']);
        });
    }

    public function down(): void
    {
        Schema::table('asset_assignments', function (Blueprint $table) {
            $table->unique('acknowledgment_number');
            $table->dropConstrainedForeignId('accountability_document_id');
        });

        Schema::dropIfExists('accountability_documents');
    }
};
