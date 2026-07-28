<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\MessageAttachment;
use App\Services\AnnouncementService;
use App\Services\MessagingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class CommunicationController extends Controller
{
    public function __construct(
        private MessagingService $messaging,
        private AnnouncementService $announcements,
    ) {}

    public function summary(Request $request): JsonResponse
    {
        $user = $request->user();
        $this->messaging->updatePresence($user, 'online');

        $recent = $this->messaging->listConversations($user, ['per_page' => 5]);

        return response()->json([
            'unread_count' => $this->messaging->unreadCount($user),
            'recent_conversations' => $recent->items(),
            'online_users' => $this->messaging->listOnlineUsers($user),
        ]);
    }

    public function unreadCount(Request $request): JsonResponse
    {
        return response()->json(['count' => $this->messaging->unreadCount($request->user())]);
    }

    public function updatePresence(Request $request): JsonResponse
    {
        $data = $request->validate(['status' => ['required', 'in:online,offline,away,busy']]);
        $presence = $this->messaging->updatePresence($request->user(), $data['status']);

        return response()->json($presence);
    }

    public function searchUsers(Request $request): JsonResponse
    {
        $users = $this->messaging->searchUsers(
            $request->user(),
            $request->search,
            $request->integer('department_id') ?: null,
        );

        return response()->json(['data' => $users]);
    }

    public function indexConversations(Request $request): JsonResponse
    {
        $conversations = $this->messaging->listConversations($request->user(), [
            'type' => $request->type,
            'archived' => $request->boolean('archived'),
            'search' => $request->search,
            'per_page' => $request->integer('per_page') ?: null,
        ]);

        return response()->json($conversations);
    }

    public function showConversation(Conversation $conversation): JsonResponse
    {
        return response()->json($this->messaging->getConversation($conversation, auth('api')->user()));
    }

    public function storeDirect(Request $request): JsonResponse
    {
        $data = $request->validate([
            'recipient_user_id' => ['required', 'exists:users,id'],
            'context_type' => ['nullable', 'string', 'max:100'],
            'context_id' => ['nullable', 'integer'],
        ]);

        $conversation = $this->messaging->findOrCreateDirect(
            $request->user(),
            $data['recipient_user_id'],
            $data['context_type'] ?? null,
            $data['context_id'] ?? null,
        );

        return response()->json($this->messaging->getConversation($conversation, $request->user()), 201);
    }

    public function storeGroup(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'department_id' => ['nullable', 'exists:departments,id'],
            'context_type' => ['nullable', 'string', 'max:100'],
            'context_id' => ['nullable', 'integer'],
            'member_ids' => ['required', 'array', 'min:1'],
            'member_ids.*' => ['integer', 'exists:users,id'],
        ]);

        $conversation = $this->messaging->createGroup($request->user(), $data, $data['member_ids']);

        return response()->json($this->messaging->getConversation($conversation, $request->user()), 201);
    }

    public function updateGroup(Request $request, Conversation $conversation): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'department_id' => ['nullable', 'exists:departments,id'],
        ]);

        $this->messaging->updateGroup($conversation, $request->user(), $data);

        return response()->json($this->messaging->getConversation($conversation->fresh(), $request->user()));
    }

    public function addMembers(Request $request, Conversation $conversation): JsonResponse
    {
        $data = $request->validate([
            'member_ids' => ['required', 'array', 'min:1'],
            'member_ids.*' => ['integer', 'exists:users,id'],
        ]);

        $this->messaging->addGroupMembers($conversation, $request->user(), $data['member_ids']);

        return response()->json($this->messaging->getConversation($conversation->fresh(), $request->user()));
    }

    public function removeMember(Request $request, Conversation $conversation, int $userId): JsonResponse
    {
        $this->messaging->removeGroupMember($conversation, $request->user(), $userId);

        return response()->json(['message' => 'Member removed.']);
    }

    public function archiveConversation(Request $request, Conversation $conversation): JsonResponse
    {
        $this->messaging->archiveConversation($conversation, $request->user(), $request->boolean('archived', true));

        return response()->json(['message' => 'Conversation archived.']);
    }

    public function listMessages(Request $request, Conversation $conversation): JsonResponse
    {
        $messages = $this->messaging->listMessages(
            $conversation,
            $request->user(),
            $request->integer('before_id') ?: null,
        );

        $typing = $this->messaging->getTypingUsers($conversation, $request->user());

        return response()->json(['data' => $messages, 'typing' => $typing]);
    }

    public function sendMessage(Request $request, Conversation $conversation): JsonResponse
    {
        $data = $request->validate([
            'body' => ['nullable', 'string', 'max:10000'],
            'reply_to_id' => ['nullable', 'exists:messages,id'],
            'attachments' => ['nullable', 'array', 'max:5'],
            'attachments.*' => ['file', 'max:'.config('messaging.max_attachment_size_kb', 10240)],
        ]);

        $message = $this->messaging->sendMessage(
            $conversation,
            $request->user(),
            $data['body'] ?? '',
            $request->file('attachments', []),
            $data['reply_to_id'] ?? null,
        );

        return response()->json(
            $this->messaging->formatMessage($message, $request->user()),
            201,
        );
    }

    public function editMessage(Request $request, Message $message): JsonResponse
    {
        $data = $request->validate(['body' => ['required', 'string', 'max:10000']]);
        $message = $this->messaging->editMessage($message, $request->user(), $data['body']);

        return response()->json($this->messaging->formatMessage($message, $request->user()));
    }

    public function deleteMessage(Message $message): JsonResponse
    {
        $this->messaging->deleteMessage($message, auth('api')->user());

        return response()->json(['message' => 'Message deleted.']);
    }

    public function markRead(Request $request, Conversation $conversation): JsonResponse
    {
        $this->messaging->markRead(
            $conversation,
            $request->user(),
            $request->integer('up_to_message_id') ?: null,
        );

        return response()->json(['message' => 'Marked as read.']);
    }

    public function react(Request $request, Message $message): JsonResponse
    {
        $data = $request->validate(['reaction' => ['required', 'in:like,approve,acknowledge,important']]);
        $this->messaging->toggleReaction($message, $request->user(), $data['reaction']);

        return response()->json(['message' => 'Reaction updated.']);
    }

    public function typing(Request $request, Conversation $conversation): JsonResponse
    {
        $this->messaging->setTyping($conversation, $request->user());

        return response()->json(['ok' => true]);
    }

    public function searchMessages(Request $request): JsonResponse
    {
        $results = $this->messaging->searchMessages($request->user(), $request->only(['q', 'conversation_id', 'from', 'to']));

        return response()->json($results);
    }

    public function downloadAttachment(MessageAttachment $attachment)
    {
        $file = $this->messaging->downloadAttachment($attachment, auth('api')->user());

        return response()->download($file['path'], $file['name'], ['Content-Type' => $file['mime']]);
    }

    public function indexAnnouncements(Request $request): JsonResponse
    {
        $paginator = $this->announcements->listForUser($request->user());
        $paginator->getCollection()->transform(
            fn (Announcement $a) => $this->announcements->format($a, $request->user()),
        );

        return response()->json($paginator);
    }

    public function storeAnnouncement(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string'],
            'target_scope' => ['required', 'in:all,departments,roles'],
            'target_ids' => ['nullable', 'array'],
            'is_pinned' => ['boolean'],
            'expires_at' => ['nullable', 'date'],
            'requires_acknowledgement' => ['boolean'],
        ]);

        $announcement = $this->announcements->create($request->user(), $data);

        return response()->json($this->announcements->format($announcement, $request->user()), 201);
    }

    public function acknowledgeAnnouncement(Announcement $announcement): JsonResponse
    {
        $this->announcements->acknowledge($announcement, auth('api')->user());

        return response()->json(['message' => 'Acknowledged.']);
    }

    public function linkContext(Request $request): JsonResponse
    {
        $data = $request->validate([
            'context_type' => ['required', 'string', 'max:100'],
            'context_id' => ['required', 'integer'],
            'recipient_user_id' => ['nullable', 'exists:users,id'],
            'member_ids' => ['nullable', 'array'],
            'name' => ['nullable', 'string', 'max:255'],
        ]);

        $user = $request->user();

        if (! empty($data['recipient_user_id'])) {
            $conversation = $this->messaging->findOrCreateDirect(
                $user,
                $data['recipient_user_id'],
                $data['context_type'],
                $data['context_id'],
            );
        } else {
            $conversation = $this->messaging->createGroup($user, [
                'name' => $data['name'] ?? "Discussion: {$data['context_type']} #{$data['context_id']}",
                'context_type' => $data['context_type'],
                'context_id' => $data['context_id'],
            ], $data['member_ids'] ?? []);
        }

        return response()->json($this->messaging->getConversation($conversation, $user), 201);
    }
}
