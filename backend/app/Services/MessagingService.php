<?php

namespace App\Services;

use App\Models\Conversation;
use App\Models\ConversationMember;
use App\Models\Message;
use App\Models\MessageAttachment;
use App\Models\MessageReaction;
use App\Models\MessageRead;
use App\Models\User;
use App\Models\UserPresence;
use Illuminate\Http\UploadedFile;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use InvalidArgumentException;

class MessagingService
{
    public function __construct(
        private AuditService $audit,
        private NotificationService $notifications,
    ) {}

    public function updatePresence(User $user, string $status = 'online'): UserPresence
    {
        $valid = ['online', 'offline', 'away', 'busy'];
        if (! in_array($status, $valid, true)) {
            throw new InvalidArgumentException('Invalid presence status.');
        }

        return UserPresence::updateOrCreate(
            ['user_id' => $user->id],
            ['status' => $status, 'last_seen_at' => now()],
        );
    }

    public function searchUsers(User $actor, ?string $search = null, ?int $departmentId = null): Collection
    {
        return User::with(['department', 'role', 'presence'])
            ->where('is_active', true)
            ->where('id', '!=', $actor->id)
            ->when($departmentId, fn ($q, $id) => $q->where('department_id', $id))
            ->when($search, fn ($q, $s) => $q->where(function ($q) use ($s) {
                $q->where('name', 'ilike', "%{$s}%")
                    ->orWhere('email', 'ilike', "%{$s}%")
                    ->orWhere('employee_id', 'ilike', "%{$s}%");
            }))
            ->orderBy('name')
            ->limit(50)
            ->get()
            ->map(fn (User $user) => $this->formatUserBrief($user));
    }

    public function listOnlineUsers(User $actor, int $limit = 25): Collection
    {
        $cutoff = now()->subMinutes(config('messaging.online_ttl_minutes', 3));

        return User::with(['department', 'role', 'presence'])
            ->where('is_active', true)
            ->where('id', '!=', $actor->id)
            ->whereHas('presence', function ($q) use ($cutoff) {
                $q->whereIn('status', ['online', 'away', 'busy'])
                    ->where('last_seen_at', '>=', $cutoff);
            })
            ->orderBy('name')
            ->limit($limit)
            ->get()
            ->map(fn (User $user) => $this->formatUserBrief($user));
    }

    public function unreadCount(User $user): int
    {
        return $this->baseConversationQuery($user)
            ->get()
            ->sum(fn (Conversation $c) => $this->unreadForConversation($c, $user));
    }

    public function listConversations(User $user, array $filters = []): LengthAwarePaginator
    {
        $query = $this->baseConversationQuery($user)
            ->with([
                'activeMembers.user.department',
                'activeMembers.user.role',
                'messages' => fn ($q) => $q->latest()->limit(1)->with('sender'),
            ]);

        $type = $filters['type'] ?? null;
        if ($type === 'direct') {
            $query->where('type', 'direct');
        } elseif ($type === 'group') {
            $query->where('type', 'group');
        }

        if (! empty($filters['archived'])) {
            $query->where('is_archived', true);
        } else {
            $query->where('is_archived', false);
        }

        if (! empty($filters['search'])) {
            $s = $filters['search'];
            $query->where(function ($q) use ($s) {
                $q->where('name', 'ilike', "%{$s}%")
                    ->orWhereHas('messages', fn ($q) => $q->where('body_preview', 'ilike', "%{$s}%"));
            });
        }

        $paginator = $query
            ->orderByDesc('last_message_at')
            ->paginate($filters['per_page'] ?? config('messaging.conversations_per_page', 20));

        $paginator->getCollection()->transform(fn (Conversation $c) => $this->formatConversation($c, $user));

        return $paginator;
    }

    public function getConversation(Conversation $conversation, User $user): array
    {
        $this->ensureMember($conversation, $user);

        $conversation->load([
            'activeMembers.user.department',
            'activeMembers.user.role',
            'creator',
            'department',
        ]);

        return $this->formatConversation($conversation, $user, true);
    }

    public function findOrCreateDirect(User $actor, int $recipientId, ?string $contextType = null, ?int $contextId = null): Conversation
    {
        if ($recipientId === $actor->id) {
            throw new InvalidArgumentException('Cannot message yourself.');
        }

        $recipient = User::where('is_active', true)->findOrFail($recipientId);

        $existing = Conversation::query()
            ->where('type', 'direct')
            ->whereHas('activeMembers', fn ($q) => $q->where('user_id', $actor->id))
            ->whereHas('activeMembers', fn ($q) => $q->where('user_id', $recipient->id))
            ->when($contextType, fn ($q) => $q->where('context_type', $contextType)->where('context_id', $contextId))
            ->when(! $contextType, fn ($q) => $q->whereNull('context_type')->whereNull('context_id'))
            ->first();

        if ($existing) {
            return $existing;
        }

        return DB::transaction(function () use ($actor, $recipient, $contextType, $contextId) {
            $conversation = Conversation::create([
                'type' => 'direct',
                'name' => null,
                'created_by' => $actor->id,
                'context_type' => $contextType,
                'context_id' => $contextId,
                'last_message_at' => now(),
            ]);

            foreach ([$actor, $recipient] as $member) {
                ConversationMember::create([
                    'conversation_id' => $conversation->id,
                    'user_id' => $member->id,
                    'role' => 'member',
                    'joined_at' => now(),
                ]);
            }

            $this->audit->log('create', 'messaging', "Started direct conversation #{$conversation->id}", newValues: $conversation->toArray());

            return $conversation;
        });
    }

    public function createGroup(User $actor, array $data, array $memberIds): Conversation
    {
        $memberIds = collect($memberIds)->push($actor->id)->unique()->values()->all();

        return DB::transaction(function () use ($actor, $data, $memberIds) {
            $conversation = Conversation::create([
                'type' => 'group',
                'name' => $data['name'],
                'description' => $data['description'] ?? null,
                'department_id' => $data['department_id'] ?? null,
                'context_type' => $data['context_type'] ?? null,
                'context_id' => $data['context_id'] ?? null,
                'created_by' => $actor->id,
                'last_message_at' => now(),
            ]);

            foreach ($memberIds as $userId) {
                ConversationMember::create([
                    'conversation_id' => $conversation->id,
                    'user_id' => $userId,
                    'role' => $userId === $actor->id ? 'owner' : 'member',
                    'joined_at' => now(),
                ]);
            }

            $this->audit->log('create', 'messaging', "Created group {$conversation->name}", newValues: $conversation->toArray());

            return $conversation;
        });
    }

    public function updateGroup(Conversation $conversation, User $actor, array $data): Conversation
    {
        $this->ensureOwner($conversation, $actor);

        $conversation->update([
            'name' => $data['name'] ?? $conversation->name,
            'description' => $data['description'] ?? $conversation->description,
            'department_id' => $data['department_id'] ?? $conversation->department_id,
        ]);

        $this->audit->log('update', 'messaging', "Updated group {$conversation->name}");

        return $conversation->fresh();
    }

    public function addGroupMembers(Conversation $conversation, User $actor, array $userIds): void
    {
        $this->ensureOwner($conversation, $actor);

        foreach ($userIds as $userId) {
            ConversationMember::updateOrCreate(
                ['conversation_id' => $conversation->id, 'user_id' => $userId],
                ['role' => 'member', 'joined_at' => now(), 'left_at' => null],
            );
        }

        $this->audit->log('update', 'messaging', "Added members to group {$conversation->name}");
    }

    public function removeGroupMember(Conversation $conversation, User $actor, int $userId): void
    {
        $this->ensureOwner($conversation, $actor);

        ConversationMember::where('conversation_id', $conversation->id)
            ->where('user_id', $userId)
            ->update(['left_at' => now()]);

        $this->audit->log('update', 'messaging', "Removed member from group {$conversation->name}");
    }

    public function archiveConversation(Conversation $conversation, User $user, bool $archived = true): void
    {
        $this->ensureMember($conversation, $user);
        $conversation->update(['is_archived' => $archived]);
    }

    public function listMessages(Conversation $conversation, User $user, ?int $beforeId = null): array
    {
        $this->ensureMember($conversation, $user);

        $query = Message::with(['sender.department', 'attachments', 'reactions.user', 'reads.user', 'replyTo.sender', 'conversation.activeMembers'])
            ->where('conversation_id', $conversation->id)
            ->orderByDesc('id');

        if ($beforeId) {
            $query->where('id', '<', $beforeId);
        }

        $messages = $query->limit(config('messaging.messages_per_page', 30))->get()->reverse()->values();

        return $messages->map(fn (Message $m) => $this->formatMessage($m, $user))->all();
    }

    public function sendMessage(
        Conversation $conversation,
        User $sender,
        string $body,
        array $attachments = [],
        ?int $replyToId = null,
    ): Message {
        $this->ensureMember($conversation, $sender);

        if (trim($body) === '' && empty($attachments)) {
            throw new InvalidArgumentException('Message cannot be empty.');
        }

        return DB::transaction(function () use ($conversation, $sender, $body, $attachments, $replyToId) {
            $message = Message::create([
                'conversation_id' => $conversation->id,
                'sender_id' => $sender->id,
                'body' => $body,
                'body_preview' => mb_substr($body, 0, 500),
                'reply_to_id' => $replyToId,
            ]);

            foreach ($attachments as $file) {
                $this->storeAttachment($message, $sender, $file);
            }

            $conversation->update(['last_message_at' => now()]);

            $recipients = $conversation->activeMembers()
                ->where('user_id', '!=', $sender->id)
                ->with('user')
                ->get()
                ->pluck('user');

            foreach ($recipients as $recipient) {
                $this->notifications->notify(
                    $recipient,
                    'new_message',
                    'New Message',
                    "{$sender->name} sent you a message",
                    ['conversation_id' => $conversation->id, 'message_id' => $message->id],
                );
            }

            $this->audit->log('create', 'messaging', "Message sent in conversation #{$conversation->id}", newValues: ['message_id' => $message->id]);

            return $message->load(['sender', 'attachments', 'reactions', 'reads', 'conversation.activeMembers']);
        });
    }

    public function editMessage(Message $message, User $user, string $body): Message
    {
        if ($message->sender_id !== $user->id) {
            abort(403, 'You can only edit your own messages.');
        }

        $message->update([
            'body' => $body,
            'body_preview' => mb_substr($body, 0, 500),
            'is_edited' => true,
            'edited_at' => now(),
        ]);
        $this->audit->log('update', 'messaging', "Message #{$message->id} edited");

        return $message->fresh()->load(['sender', 'attachments', 'reactions', 'reads']);
    }

    public function deleteMessage(Message $message, User $user): void
    {
        if ($message->sender_id !== $user->id && ! $user->hasPermission('messaging.*')) {
            abort(403, 'You cannot delete this message.');
        }

        $message->delete();
        $this->audit->log('delete', 'messaging', "Message #{$message->id} deleted");
    }

    public function markRead(Conversation $conversation, User $user, ?int $upToMessageId = null): void
    {
        $this->ensureMember($conversation, $user);

        $query = Message::where('conversation_id', $conversation->id)
            ->where('sender_id', '!=', $user->id);

        if ($upToMessageId) {
            $query->where('id', '<=', $upToMessageId);
        }

        $messageIds = $query->pluck('id');

        foreach ($messageIds as $messageId) {
            MessageRead::updateOrCreate(
                ['message_id' => $messageId, 'user_id' => $user->id],
                ['read_at' => now()],
            );
        }

        ConversationMember::where('conversation_id', $conversation->id)
            ->where('user_id', $user->id)
            ->update(['last_read_at' => now()]);
    }

    public function toggleReaction(Message $message, User $user, string $reaction): void
    {
        $this->ensureMember($message->conversation, $user);

        $valid = ['like', 'approve', 'acknowledge', 'important'];
        if (! in_array($reaction, $valid, true)) {
            throw new InvalidArgumentException('Invalid reaction.');
        }

        $existing = MessageReaction::where('message_id', $message->id)
            ->where('user_id', $user->id)
            ->where('reaction', $reaction)
            ->first();

        if ($existing) {
            $existing->delete();
        } else {
            MessageReaction::create([
                'message_id' => $message->id,
                'user_id' => $user->id,
                'reaction' => $reaction,
            ]);
        }
    }

    public function setTyping(Conversation $conversation, User $user): void
    {
        $this->ensureMember($conversation, $user);

        if (! Schema::hasTable('conversation_typing')) {
            return;
        }

        DB::table('conversation_typing')->updateOrInsert(
            ['conversation_id' => $conversation->id, 'user_id' => $user->id],
            ['updated_at' => now()],
        );
    }

    public function getTypingUsers(Conversation $conversation, User $user): array
    {
        if (! Schema::hasTable('conversation_typing')) {
            return [];
        }

        $ttl = config('messaging.typing_ttl_seconds', 5);
        $cutoff = now()->subSeconds($ttl);

        return DB::table('conversation_typing')
            ->join('users', 'users.id', '=', 'conversation_typing.user_id')
            ->where('conversation_typing.conversation_id', $conversation->id)
            ->where('conversation_typing.user_id', '!=', $user->id)
            ->where('conversation_typing.updated_at', '>=', $cutoff)
            ->pluck('users.name')
            ->all();
    }

    public function searchMessages(User $user, array $filters): LengthAwarePaginator
    {
        $query = Message::with(['sender', 'conversation'])
            ->whereHas('conversation.activeMembers', fn ($q) => $q->where('user_id', $user->id));

        if (! empty($filters['q'])) {
            $q = $filters['q'];
            $query->where('body_preview', 'ilike', "%{$q}%");
        }

        if (! empty($filters['conversation_id'])) {
            $query->where('conversation_id', $filters['conversation_id']);
        }

        if (! empty($filters['from'])) {
            $query->whereDate('created_at', '>=', $filters['from']);
        }

        if (! empty($filters['to'])) {
            $query->whereDate('created_at', '<=', $filters['to']);
        }

        return $query->latest()->paginate(20);
    }

    public function downloadAttachment(MessageAttachment $attachment, User $user): array
    {
        $message = $attachment->message()->with('conversation')->firstOrFail();
        $this->ensureMember($message->conversation, $user);

        if (! Storage::disk('local')->exists($attachment->file_path)) {
            abort(404, 'File not found.');
        }

        return [
            'path' => Storage::disk('local')->path($attachment->file_path),
            'name' => $attachment->file_name,
            'mime' => $attachment->mime_type,
        ];
    }

    private function storeAttachment(Message $message, User $user, UploadedFile $file): MessageAttachment
    {
        $maxKb = config('messaging.max_attachment_size_kb', 10240);
        if ($file->getSize() > $maxKb * 1024) {
            throw new InvalidArgumentException("File exceeds maximum size of {$maxKb}KB.");
        }

        $mime = $file->getMimeType() ?? 'application/octet-stream';
        $allowed = config('messaging.allowed_mime_types', []);
        if (! in_array($mime, $allowed, true)) {
            throw new InvalidArgumentException('File type not allowed.');
        }

        $path = $file->store('message-attachments', 'local');

        $attachment = MessageAttachment::create([
            'message_id' => $message->id,
            'uploaded_by' => $user->id,
            'file_name' => $file->getClientOriginalName(),
            'file_path' => $path,
            'mime_type' => $mime,
            'file_size' => $file->getSize(),
        ]);

        $this->audit->log('create', 'messaging', "File uploaded: {$attachment->file_name}");

        return $attachment;
    }

    private function baseConversationQuery(User $user)
    {
        return Conversation::query()
            ->whereHas('activeMembers', fn ($q) => $q->where('user_id', $user->id));
    }

    private function ensureMember(Conversation $conversation, User $user): ConversationMember
    {
        $member = ConversationMember::where('conversation_id', $conversation->id)
            ->where('user_id', $user->id)
            ->whereNull('left_at')
            ->first();

        if (! $member) {
            abort(403, 'You are not a member of this conversation.');
        }

        return $member;
    }

    private function ensureOwner(Conversation $conversation, User $user): void
    {
        $member = $this->ensureMember($conversation, $user);
        if ($member->role !== 'owner' && ! $user->hasPermission('messaging.*')) {
            abort(403, 'Only the group owner can perform this action.');
        }
    }

    private function unreadForConversation(Conversation $conversation, User $user): int
    {
        $member = $conversation->activeMembers->firstWhere('user_id', $user->id);
        $since = $member?->last_read_at;

        return Message::where('conversation_id', $conversation->id)
            ->where('sender_id', '!=', $user->id)
            ->when($since, fn ($q) => $q->where('created_at', '>', $since))
            ->count();
    }

    private function formatConversation(Conversation $conversation, User $user, bool $detailed = false): array
    {
        $lastMessage = $conversation->messages->first();
        $otherMembers = $conversation->activeMembers
            ->filter(fn ($m) => $m->user_id !== $user->id)
            ->map(fn ($m) => $this->formatUserBrief($m->user))
            ->values();

        $title = $conversation->type === 'group'
            ? $conversation->name
            : ($otherMembers->first()['name'] ?? 'Direct Message');

        $data = [
            'id' => $conversation->id,
            'type' => $conversation->type,
            'title' => $title,
            'name' => $conversation->name,
            'description' => $conversation->description,
            'context_type' => $conversation->context_type,
            'context_id' => $conversation->context_id,
            'is_archived' => $conversation->is_archived,
            'last_message_at' => $conversation->last_message_at?->toIso8601String(),
            'unread_count' => $this->unreadForConversation($conversation, $user),
            'last_message' => $lastMessage ? [
                'id' => $lastMessage->id,
                'body' => mb_substr($lastMessage->body, 0, 120),
                'sender' => $this->formatUserBrief($lastMessage->sender),
                'created_at' => $lastMessage->created_at?->toIso8601String(),
            ] : null,
            'members' => $conversation->activeMembers->map(fn ($m) => [
                ...$this->formatUserBrief($m->user),
                'role' => $m->role,
            ])->values(),
        ];

        if ($detailed) {
            $data['department'] = $conversation->department?->only(['id', 'name', 'code']);
            $data['created_by'] = $this->formatUserBrief($conversation->creator);
        }

        return $data;
    }

    public function formatMessage(Message $message, User $viewer): array
    {
        $memberCount = $message->relationLoaded('conversation') && $message->conversation
            ? $message->conversation->activeMembers->count()
            : ConversationMember::where('conversation_id', $message->conversation_id)
                ->whereNull('left_at')
                ->count();
        $readCount = $message->reads()->count();
        $reads = $message->reads->map(fn ($r) => $this->formatUserBrief($r->user));

        $status = 'delivered';
        if ($message->sender_id === $viewer->id) {
            if ($memberCount <= 2 && $readCount > 0) {
                $status = 'seen';
            } elseif ($readCount > 0) {
                $status = 'seen';
            }
        } elseif ($message->reads->contains('user_id', $viewer->id)) {
            $status = 'seen';
        } else {
            $status = 'unread';
        }

        return [
            'id' => $message->id,
            'conversation_id' => $message->conversation_id,
            'body' => $message->body,
            'is_edited' => $message->is_edited,
            'edited_at' => $message->edited_at?->toIso8601String(),
            'created_at' => $message->created_at?->toIso8601String(),
            'status' => $status,
            'sender' => $this->formatUserBrief($message->sender),
            'reply_to' => $message->replyTo ? [
                'id' => $message->replyTo->id,
                'body' => mb_substr($message->replyTo->body, 0, 80),
                'sender' => $this->formatUserBrief($message->replyTo->sender),
            ] : null,
            'attachments' => $message->attachments->map(fn ($a) => [
                'id' => $a->id,
                'file_name' => $a->file_name,
                'mime_type' => $a->mime_type,
                'file_size' => $a->file_size,
            ])->values(),
            'reactions' => $message->reactions->map(fn ($r) => [
                'reaction' => $r->reaction,
                'user' => $this->formatUserBrief($r->user),
            ])->values(),
            'seen_by' => $reads->values(),
        ];
    }

    private function formatUserBrief(?User $user): array
    {
        if (! $user) {
            return ['id' => null, 'name' => 'Unknown'];
        }

        $presence = $user->relationLoaded('presence')
            ? $user->presence
            : UserPresence::find($user->id);

        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'employee_id' => $user->employee_id,
            'department' => $user->department?->only(['id', 'name', 'code']),
            'role' => $user->role?->only(['id', 'name', 'slug']),
            'presence' => $presence ? [
                'status' => $presence->status,
                'last_seen_at' => $presence->last_seen_at?->toIso8601String(),
            ] : ['status' => 'offline', 'last_seen_at' => null],
        ];
    }
}
