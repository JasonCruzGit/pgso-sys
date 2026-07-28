<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $notifications = Notification::where('user_id', auth('api')->id())
            ->when($request->has('is_read'), fn ($q) => $q->where('is_read', $request->boolean('is_read')))
            ->latest()
            ->paginate($request->integer('per_page', 20));

        return response()->json($notifications);
    }

    public function markRead(Notification $notification): JsonResponse
    {
        if ($notification->user_id !== auth('api')->id()) {
            abort(403);
        }

        $notification->update(['is_read' => true]);

        return response()->json($notification);
    }

    public function markAllRead(): JsonResponse
    {
        Notification::where('user_id', auth('api')->id())->update(['is_read' => true]);

        return response()->json(['message' => 'All notifications marked as read.']);
    }

    public function unreadCount(): JsonResponse
    {
        $count = Notification::where('user_id', auth('api')->id())->where('is_read', false)->count();

        return response()->json(['count' => $count]);
    }
}
