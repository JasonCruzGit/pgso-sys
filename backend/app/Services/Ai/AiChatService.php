<?php

namespace App\Services\Ai;

use App\Models\AiConversation;
use App\Models\AiMessage;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Support\Str;

class AiChatService
{
    private const MAX_TOOL_ITERATIONS = 5;

    public function __construct(
        private OpenAiService $openAi,
        private AiFunctionService $functions,
        private AiSecurityService $security,
        private AuditService $audit,
    ) {}

    public function chat(User $user, string $message, ?int $conversationId = null): array
    {
        if ($this->security->isPromptInjection($message)) {
            return [
                'conversation_id' => $conversationId,
                'message' => 'Your request could not be processed for security reasons. Please rephrase your inventory question.',
                'blocked' => true,
            ];
        }

        $conversation = $conversationId
            ? AiConversation::where('user_id', $user->id)->findOrFail($conversationId)
            : AiConversation::create(['user_id' => $user->id, 'title' => Str::limit($message, 60)]);

        if ($conversation->title === 'New conversation' || $conversation->messages()->count() === 0) {
            $conversation->update(['title' => Str::limit($message, 60)]);
        }

        AiMessage::create([
            'ai_conversation_id' => $conversation->id,
            'role' => 'user',
            'content' => $message,
        ]);

        $tools = $this->functions->getToolDefinitions($user);
        $messages = $this->buildMessageHistory($conversation, $user);

        $totalTokens = 0;
        $iterations = 0;

        while ($iterations < self::MAX_TOOL_ITERATIONS) {
            $iterations++;
            $response = $this->openAi->chat($messages, $tools);
            $totalTokens += $response['tokens'];

            if (empty($response['tool_calls'])) {
                $assistantContent = $response['content'] ?? 'I could not generate a response. Please try again.';

                AiMessage::create([
                    'ai_conversation_id' => $conversation->id,
                    'role' => 'assistant',
                    'content' => $assistantContent,
                    'tokens_used' => $totalTokens,
                ]);

                $conversation->touch();

                $this->audit->log('query', 'ai', "AI chat: {$conversation->title}", newValues: [
                    'conversation_id' => $conversation->id,
                    'tokens' => $totalTokens,
                ]);

                return [
                    'conversation_id' => $conversation->id,
                    'message' => $assistantContent,
                    'tokens_used' => $totalTokens,
                ];
            }

            $messages[] = [
                'role' => 'assistant',
                'content' => $response['content'],
                'tool_calls' => $response['tool_calls'],
            ];

            foreach ($response['tool_calls'] as $toolCall) {
                $functionName = $toolCall['function']['name'] ?? '';
                $args = json_decode($toolCall['function']['arguments'] ?? '{}', true) ?? [];

                $result = $this->functions->execute($user, $functionName, $args);

                AiMessage::create([
                    'ai_conversation_id' => $conversation->id,
                    'role' => 'tool',
                    'content' => json_encode($result),
                    'metadata' => ['function' => $functionName, 'tool_call_id' => $toolCall['id'] ?? null],
                ]);

                $messages[] = [
                    'role' => 'tool',
                    'tool_call_id' => $toolCall['id'],
                    'content' => json_encode($result),
                ];
            }
        }

        $fallback = 'I reached the maximum analysis depth. Please ask a more specific question.';

        AiMessage::create([
            'ai_conversation_id' => $conversation->id,
            'role' => 'assistant',
            'content' => $fallback,
            'tokens_used' => $totalTokens,
        ]);

        return [
            'conversation_id' => $conversation->id,
            'message' => $fallback,
            'tokens_used' => $totalTokens,
        ];
    }

    public function suggestedQuestions(User $user): array
    {
        $base = [
            'How many items are currently low in stock?',
            'What is the total inventory value?',
            'Which items need replenishment this month?',
            'Show me dead stock items.',
            'Generate a monthly inventory summary.',
        ];

        if ($user->hasPermission('assets.view') || $user->hasPermission('property.view')) {
            $base[] = 'Show all assets assigned to my department.';
            $base[] = 'Which equipment is due for maintenance?';
        }

        if ($user->hasPermission('procurement.view') || $user->hasPermission('procurement.*')) {
            $base[] = 'Generate procurement recommendations for this month.';
            $base[] = 'Show supplier performance report.';
        }

        if ($user->hasPermission('ai.analytics') || $user->hasPermission('ai.*')) {
            $base[] = 'Forecast inventory for the next 30 days.';
            $base[] = 'Generate executive summary for this quarter.';
        }

        return array_slice($base, 0, 8);
    }

    private function buildMessageHistory(AiConversation $conversation, User $user): array
    {
        $messages = [
            ['role' => 'system', 'content' => $this->security->buildSystemPrompt($user)],
        ];

        $history = $conversation->messages()
            ->whereIn('role', ['user', 'assistant'])
            ->orderBy('created_at')
            ->limit(20)
            ->get();

        foreach ($history as $msg) {
            $messages[] = ['role' => $msg->role, 'content' => $msg->content];
        }

        return $messages;
    }
}
