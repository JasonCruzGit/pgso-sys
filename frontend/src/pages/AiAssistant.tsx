import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bot, Send, Mic, Loader2, Trash2, MessageSquare, Sparkles,
  Package, BarChart3, FileText, User, Plus,
} from 'lucide-react';
import api from '../api/client';
import toast from 'react-hot-toast';
import type { AiChatMessage, AiConversation } from '../types';
import AiMessageContent from '../components/AiMessageContent';
import { AnalyticsGlowRing } from '../components/analytics/AnalyticsUi';
import { useAuth } from '../context/AuthContext';

const capabilities = [
  { icon: Package, title: 'Stock levels', desc: 'On-hand, low stock, and reorder alerts' },
  { icon: BarChart3, title: 'Trends', desc: 'Consumption, procurement, and utilization' },
  { icon: FileText, title: 'Reports', desc: 'Compliance summaries and accountability' },
  { icon: Sparkles, title: 'Forecasts', desc: 'AI-driven replenishment suggestions' },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function AiAssistant() {
  const { user } = useAuth();
  const firstName = user?.name?.split(' ')[0] ?? 'there';
  const [input, setInput] = useState('');
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [listening, setListening] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: status } = useQuery({
    queryKey: ['ai-status'],
    queryFn: () => api.get('/ai/status').then((r) => r.data),
  });

  const { data: conversations } = useQuery({
    queryKey: ['ai-conversations'],
    queryFn: () => api.get('/ai/conversations').then((r) => r.data.data as AiConversation[]),
  });

  const { data: suggested } = useQuery({
    queryKey: ['ai-suggested'],
    queryFn: () => api.get('/ai/suggested-questions').then((r) => r.data.questions as string[]),
  });

  const chatMutation = useMutation({
    mutationFn: (message: string) =>
      api.post('/ai/chat', { message, conversation_id: conversationId }).then((r) => r.data),
    onSuccess: (data) => {
      setConversationId(data.conversation_id);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.message, created_at: new Date().toISOString() },
      ]);
      queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
    },
    onError: () => toast.error('Failed to get AI response'),
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatMutation.isPending]);

  const handleSend = (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || chatMutation.isPending) return;

    setMessages((prev) => [
      ...prev,
      { role: 'user', content: message, created_at: new Date().toISOString() },
    ]);
    setInput('');
    chatMutation.mutate(message);
  };

  const loadConversation = async (id: number) => {
    const { data } = await api.get(`/ai/conversations/${id}`);
    setConversationId(id);
    setMessages(data.messages);
    setShowHistory(false);
  };

  const startNewChat = () => {
    setConversationId(null);
    setMessages([]);
    setShowHistory(false);
  };

  const deleteConversation = async (id: number) => {
    await api.delete(`/ai/conversations/${id}`);
    queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
    if (conversationId === id) startNewChat();
    toast.success('Conversation deleted');
  };

  const startVoiceInput = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SpeechRecognitionCtor = w.SpeechRecognition ?? w.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      toast.error('Voice input is not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'en-PH';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      toast.error('Voice recognition failed');
    };
    recognition.onresult = (event: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
    };

    recognition.start();
  };

  const hasChat = messages.length > 0 || chatMutation.isPending;

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] flex-col lg:min-h-[calc(100vh-14rem)]">
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center sm:p-4" onClick={() => setShowHistory(false)}>
          <div className="max-h-[80vh] w-full rounded-t-3xl bg-white p-5 sm:max-w-md sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <p className="font-bold text-slate-900">Past conversations</p>
              <button type="button" onClick={startNewChat} className="text-sm font-semibold text-palawan-600">New chat</button>
            </div>
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {(conversations ?? []).map((c) => (
                <div key={c.id} className="group flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => loadConversation(c.id)}
                    className={`min-w-0 flex-1 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                      conversationId === c.id ? 'bg-palawan-50 text-palawan-800' : 'hover:bg-slate-50'
                    }`}
                  >
                    <p className="truncate font-medium">{c.title}</p>
                    <p className="text-xs text-slate-400">{new Date(c.updated_at).toLocaleDateString()}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteConversation(c.id)}
                    className="rounded-lg p-2 text-slate-300 hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {(conversations ?? []).length === 0 && (
                <p className="py-8 text-center text-sm text-slate-400">No conversations yet</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <button
            type="button"
            onClick={() => setShowHistory(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
            aria-label="Conversation history"
          >
            <MessageSquare size={18} />
          </button>
          <div className="text-center">
            <p className="text-sm font-bold text-slate-900">AI Assistant</p>
            <p className="text-[11px] text-slate-500">
              {status?.configured ? 'Online' : 'Configure API key'}
            </p>
          </div>
          <button
            type="button"
            onClick={startNewChat}
            className="flex h-9 w-9 items-center justify-center rounded-full text-palawan-600 hover:bg-palawan-50"
            aria-label="New chat"
          >
            <Plus size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {!hasChat && (
            <div className="flex flex-col items-center py-6 text-center sm:py-10">
              <AnalyticsGlowRing icon={Bot} />
              <p className="mt-5 text-sm text-slate-500">{getGreeting()}, {firstName}</p>
              <h2 className="mt-1 max-w-xs text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                What can I help you today?
              </h2>

              <div className="mt-8 grid w-full max-w-lg gap-3 sm:grid-cols-2">
                {capabilities.map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="analytics-feature-card text-left">
                    <Icon size={20} className="text-palawan-600" strokeWidth={1.75} />
                    <p className="mt-3 text-sm font-bold text-slate-900">{title}</p>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{desc}</p>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex w-full max-w-lg flex-wrap justify-center gap-2">
                {(suggested ?? []).slice(0, 4).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => handleSend(q)}
                    className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-palawan-50 hover:text-palawan-800"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`mb-3 flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                msg.role === 'user' ? 'bg-palawan-600 text-white' : 'bg-slate-100 text-palawan-700'
              }`}>
                {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
              </div>
              <div className={`max-w-[85%] rounded-3xl px-4 py-3 text-sm sm:max-w-[75%] ${
                msg.role === 'user'
                  ? 'bg-palawan-600 text-white shadow-sm'
                  : 'border border-slate-100 bg-white text-slate-800 shadow-sm'
              }`}>
                <AiMessageContent content={msg.content} role={msg.role} />
              </div>
            </div>
          ))}

          {chatMutation.isPending && (
            <div className="mb-3 flex gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-palawan-700">
                <Bot size={14} />
              </div>
              <div className="flex items-center gap-2 rounded-3xl border border-slate-100 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
                <Loader2 size={16} className="animate-spin text-palawan-600" />
                Analyzing inventory data...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-slate-100 bg-white px-4 py-3 safe-bottom">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="analytics-composer"
          >
            <button
              type="button"
              onClick={startVoiceInput}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition ${
                listening ? 'bg-red-100 text-red-600' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
              }`}
              title="Voice input"
            >
              <Mic size={18} />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask me anything..."
              className="min-w-0 flex-1 border-0 bg-transparent py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim() || chatMutation.isPending}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-palawan-600 text-white transition hover:bg-palawan-700 disabled:opacity-50"
            >
              {chatMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
