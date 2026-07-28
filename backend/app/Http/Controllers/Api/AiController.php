<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AiConversation;
use App\Services\Ai\AiAnalyticsService;
use App\Services\Ai\AiChatService;
use App\Services\Ai\AiComplianceService;
use App\Services\Ai\AiExecutiveService;
use App\Services\Ai\AiForecastService;
use App\Services\Ai\AiRecommendationService;
use App\Services\Ai\OpenAiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AiController extends Controller
{
    public function __construct(
        private AiChatService $chat,
        private AiAnalyticsService $analytics,
        private AiForecastService $forecast,
        private AiRecommendationService $recommendations,
        private AiExecutiveService $executive,
        private AiComplianceService $compliance,
        private OpenAiService $openAi,
    ) {}

    public function chat(Request $request): JsonResponse
    {
        $data = $request->validate([
            'message' => 'required|string|max:4000',
            'conversation_id' => 'nullable|integer|exists:ai_conversations,id',
        ]);

        $result = $this->chat->chat(
            $request->user(),
            $data['message'],
            $data['conversation_id'] ?? null,
        );

        return response()->json($result);
    }

    public function conversations(Request $request): JsonResponse
    {
        $conversations = AiConversation::where('user_id', $request->user()->id)
            ->orderByDesc('updated_at')
            ->limit(50)
            ->get(['id', 'title', 'created_at', 'updated_at']);

        return response()->json(['data' => $conversations]);
    }

    public function showConversation(Request $request, AiConversation $conversation): JsonResponse
    {
        abort_unless($conversation->user_id === $request->user()->id, 403);

        $messages = $conversation->messages()
            ->whereIn('role', ['user', 'assistant'])
            ->orderBy('created_at')
            ->get(['id', 'role', 'content', 'created_at']);

        return response()->json([
            'conversation' => $conversation->only(['id', 'title', 'created_at', 'updated_at']),
            'messages' => $messages,
        ]);
    }

    public function destroyConversation(Request $request, AiConversation $conversation): JsonResponse
    {
        abort_unless($conversation->user_id === $request->user()->id, 403);
        $conversation->delete();

        return response()->json(['message' => 'Conversation deleted']);
    }

    public function suggestedQuestions(Request $request): JsonResponse
    {
        return response()->json([
            'questions' => $this->chat->suggestedQuestions($request->user()),
        ]);
    }

    public function analytics(): JsonResponse
    {
        return response()->json($this->analytics->kpis());
    }

    public function forecast(Request $request): JsonResponse
    {
        $args = $request->validate([
            'item_code' => 'nullable|string',
            'horizon_days' => 'nullable|integer|in:30,60,90,365',
        ]);

        return response()->json($this->forecast->forecast($args));
    }

    public function recommendations(): JsonResponse
    {
        return response()->json($this->recommendations->all());
    }

    public function executiveSummary(Request $request): JsonResponse
    {
        $data = $request->validate([
            'period' => 'nullable|string|in:daily,weekly,monthly,quarterly,annual',
        ]);

        return response()->json($this->executive->summary($data['period'] ?? 'monthly'));
    }

    public function complianceReport(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type' => 'required|string|in:physical_count,stock_movement,unserviceable,par,ics',
            'assignment_id' => 'nullable|integer',
            'date_from' => 'nullable|date',
            'date_to' => 'nullable|date',
        ]);

        $report = match ($data['type']) {
            'physical_count' => $this->compliance->physicalCountReport($data),
            'stock_movement' => $this->compliance->stockMovementReport($data),
            'unserviceable' => $this->compliance->unserviceableReport(),
            'par' => $this->compliance->parReport($data['assignment_id']),
            'ics' => $this->compliance->icsReport($data['assignment_id']),
        };

        return response()->json($report);
    }

    public function status(): JsonResponse
    {
        return response()->json([
            'configured' => $this->openAi->isConfigured(),
            'model' => config('ai.openai.model'),
        ]);
    }
}
