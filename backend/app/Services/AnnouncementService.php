<?php

namespace App\Services;

use App\Models\Announcement;
use App\Models\AnnouncementAcknowledgement;
use App\Models\User;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

class AnnouncementService
{
    public function __construct(
        private AuditService $audit,
        private NotificationService $notifications,
    ) {}

    public function listForUser(User $user): LengthAwarePaginator
    {
        return Announcement::with(['creator', 'acknowledgements'])
            ->where(function ($q) use ($user) {
                $q->where('target_scope', 'all')
                    ->orWhere(function ($q) use ($user) {
                        $q->where('target_scope', 'departments')
                            ->whereJsonContains('target_ids', $user->department_id);
                    })
                    ->orWhere(function ($q) use ($user) {
                        $q->where('target_scope', 'roles')
                            ->whereJsonContains('target_ids', $user->role_id);
                    });
            })
            ->where(function ($q) {
                $q->whereNull('expires_at')->orWhere('expires_at', '>', now());
            })
            ->orderByDesc('is_pinned')
            ->orderByDesc('created_at')
            ->paginate(15);
    }

    public function create(User $creator, array $data): Announcement
    {
        $announcement = Announcement::create([
            'title' => $data['title'],
            'body' => $data['body'],
            'created_by' => $creator->id,
            'target_scope' => $data['target_scope'] ?? 'all',
            'target_ids' => $data['target_ids'] ?? null,
            'is_pinned' => $data['is_pinned'] ?? false,
            'expires_at' => $data['expires_at'] ?? null,
            'requires_acknowledgement' => $data['requires_acknowledgement'] ?? false,
        ]);

        $recipients = User::where('is_active', true)->get();
        if ($announcement->target_scope === 'departments' && $announcement->target_ids) {
            $recipients = $recipients->whereIn('department_id', $announcement->target_ids);
        } elseif ($announcement->target_scope === 'roles' && $announcement->target_ids) {
            $recipients = $recipients->whereIn('role_id', $announcement->target_ids);
        }

        $this->notifications->notify(
            $recipients,
            'announcement',
            $announcement->title,
            mb_substr(strip_tags($announcement->body), 0, 200),
            ['announcement_id' => $announcement->id],
        );

        $this->audit->log('create', 'messaging', "Announcement posted: {$announcement->title}", newValues: $announcement->toArray());

        return $announcement->load('creator');
    }

    public function acknowledge(Announcement $announcement, User $user): void
    {
        AnnouncementAcknowledgement::updateOrCreate(
            ['announcement_id' => $announcement->id, 'user_id' => $user->id],
            ['acknowledged_at' => now()],
        );
    }

    public function format(Announcement $announcement, User $user): array
    {
        return [
            'id' => $announcement->id,
            'title' => $announcement->title,
            'body' => $announcement->body,
            'is_pinned' => $announcement->is_pinned,
            'expires_at' => $announcement->expires_at?->toIso8601String(),
            'requires_acknowledgement' => $announcement->requires_acknowledgement,
            'acknowledged' => $announcement->acknowledgements->contains('user_id', $user->id),
            'created_at' => $announcement->created_at?->toIso8601String(),
            'creator' => $announcement->creator?->only(['id', 'name']),
        ];
    }
}
