<?php

namespace Database\Seeders;

use App\Models\Department;
use App\Models\TrackedDocument;
use App\Models\TrackedDocumentTask;
use App\Models\User;
use Illuminate\Database\Seeder;

class DocumentTrackingSeeder extends Seeder
{
    public function run(): void
    {
        $pgso = Department::where('code', 'PGSO')->first();
        $handler = User::where('email', 'documents@gso.palawan.gov.ph')->first()
            ?? User::whereHas('role', fn ($q) => $q->where('slug', 'system_administrator'))->first();

        if (! $handler) {
            return;
        }

        $samples = [
            [
                'reference_no' => 'IN-2026-0001',
                'title' => 'Request for Vehicle Deployment — PHO',
                'description' => 'Request for Vehicle Deployment — PHO',
                'direction' => 'incoming',
                'document_type' => 'letter',
                'file_type' => 'pdf',
                'status' => 'active',
                'sender_name' => 'Provincial Health Office',
                'recipient_name' => 'PGSO Document Control',
                'instruction_for' => 'ENGR.ASA/EPB',
                'instruction_task' => 'For appropriate action. Ty',
                'received_at' => now()->subDays(5),
            ],
            [
                'reference_no' => 'IN-2026-0002',
                'title' => 'Endorsement — Property Return Clearance',
                'description' => 'Endorsement — Property Return Clearance',
                'direction' => 'incoming',
                'document_type' => 'endorsement',
                'file_type' => 'pdf',
                'status' => 'active',
                'sender_name' => 'Provincial Accountant Office',
                'recipient_name' => 'PGSO',
                'instruction_for' => 'Property Unit',
                'instruction_task' => 'Verify and process clearance.',
                'received_at' => now()->subDays(3),
            ],
            [
                'reference_no' => 'OUT-2026-0001',
                'title' => 'Notice of Inspection Schedule',
                'description' => 'Notice of Inspection Schedule',
                'direction' => 'outgoing',
                'document_type' => 'memo',
                'file_type' => 'doc',
                'status' => 'completed',
                'sender_name' => 'PGSO',
                'recipient_name' => 'All Departments',
                'released_at' => now()->subDays(8),
                'completed_at' => now()->subDays(2),
            ],
            [
                'reference_no' => 'OUT-2026-0002',
                'title' => 'Transmittal of AIR / DR Documents',
                'description' => 'Transmittal of AIR / DR Documents',
                'direction' => 'outgoing',
                'document_type' => 'report',
                'file_type' => 'pdf',
                'status' => 'active',
                'sender_name' => 'PGSO Supply',
                'recipient_name' => 'Provincial Budget Office',
                'instruction_for' => 'Budget Officer',
                'instruction_task' => 'Acknowledge receipt and file.',
                'released_at' => now()->subDay(),
            ],
            [
                'reference_no' => 'IN-2026-0003',
                'title' => 'Supplier Delivery Coordination Letter',
                'description' => 'Supplier Delivery Coordination Letter',
                'direction' => 'incoming',
                'document_type' => 'letter',
                'file_type' => 'pdf',
                'status' => 'completed',
                'sender_name' => 'ABC Trading Corp.',
                'recipient_name' => 'PGSO Receiving',
                'received_at' => now()->subDays(12),
                'completed_at' => now()->subDays(4),
            ],
            [
                'reference_no' => 'IN-2026-0004',
                'title' => 'Request for Temporary Use of Government Vehicle',
                'description' => 'Request for Temporary Use of Government Vehicle',
                'direction' => 'incoming',
                'document_type' => 'letter',
                'file_type' => 'pdf',
                'status' => 'active',
                'sender_name' => 'Provincial Engineering Office',
                'recipient_name' => 'PGSO Fleet',
                'instruction_for' => 'Fleet Officer',
                'instruction_task' => 'Schedule vehicle assignment.',
                'received_at' => now()->subDays(1),
            ],
            [
                'reference_no' => 'OUT-2026-0003',
                'title' => 'Certificate of Appearance Transmittal',
                'description' => 'Certificate of Appearance Transmittal',
                'direction' => 'outgoing',
                'document_type' => 'letter',
                'file_type' => 'pdf',
                'status' => 'completed',
                'sender_name' => 'PGSO',
                'recipient_name' => 'Provincial Governor\'s Office',
                'released_at' => now()->subDays(15),
                'completed_at' => now()->subDays(10),
            ],
        ];

        foreach ($samples as $sample) {
            $doc = TrackedDocument::updateOrCreate(
                ['reference_no' => $sample['reference_no']],
                [
                    ...$sample,
                    'responsible_user_id' => $handler->id,
                    'department_id' => $pgso?->id,
                    'created_by' => $handler->id,
                ],
            );

            if ($doc->instruction_task && $doc->tasks()->count() === 0) {
                TrackedDocumentTask::create([
                    'tracked_document_id' => $doc->id,
                    'assigned_to' => $doc->instruction_for,
                    'body' => $doc->instruction_task,
                    'received_by' => 'Document Tracking Officer',
                    'received_at' => now()->subHours(2),
                    'created_by' => $handler->id,
                ]);
            }
        }
    }
}
