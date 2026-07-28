import { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { MessageCircle, X, ExternalLink, Loader2 } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../api/client';
import type { ConversationSummary, MessagingUser } from '../types';
import { useAuth } from '../context/AuthContext';

function presenceColor(status?: string) {
  if (status === 'online') return 'bg-emerald-500';
  if (status === 'away') return 'bg-amber-400';
  if (status === 'busy') return 'bg-red-500';
  return 'bg-slate-300';
}

function presenceLabel(status?: string) {
  if (status === 'online') return 'Online';
  if (status === 'away') return 'Away';
  if (status === 'busy') return 'Busy';
  return 'Offline';
}

export default function FloatingChatWidget() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const canMessage = hasPermission('messaging.view') || hasPermission('messaging.send') || hasPermission('messaging.*');
  const canSend = hasPermission('messaging.send') || hasPermission('messaging.*');

  useEffect(() => {
    if (!canMessage) return;
    api.post('/communications/presence', { status: 'online' }).catch(() => {});
    const ping = setInterval(() => {
      api.post('/communications/presence', { status: 'online' }).catch(() => {});
    }, 60000);
    return () => {
      clearInterval(ping);
      api.post('/communications/presence', { status: 'offline' }).catch(() => {});
    };
  }, [canMessage]);

  const { data: summary } = useQuery({
    queryKey: ['communications-summary'],
    queryFn: () => api.get('/communications/summary').then((r) => r.data),
    enabled: canMessage,
    refetchInterval: 20000,
  });

  const startChat = useMutation({
    mutationFn: (userId: number) =>
      api.post('/communications/conversations/direct', { recipient_user_id: userId }).then((r) => r.data),
    onSuccess: (conversation) => {
      navigate(`/communications?conversation=${conversation.id}`);
      setOpen(false);
    },
  });

  if (!canMessage || location.pathname.startsWith('/communications') || location.pathname === '/login') return null;

  const unread = summary?.unread_count ?? 0;
  const recent: ConversationSummary[] = summary?.recent_conversations ?? [];
  const onlineUsers: MessagingUser[] = summary?.online_users ?? [];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="floating-safe fixed z-40 flex h-12 w-12 items-center justify-center rounded-full bg-palawan-600 text-white shadow-lg shadow-palawan-900/20 transition hover:bg-palawan-700 sm:h-14 sm:w-14"
        title="Communications"
      >
        <MessageCircle size={24} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="floating-panel-safe fixed z-40 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 bg-palawan-600 px-4 py-3 text-white">
            <p className="font-semibold">Communications {unread > 0 && `(${unread})`}</p>
            <div className="flex gap-2">
              <Link to="/communications" className="rounded-lg p-1 hover:bg-white/20" title="Open full page">
                <ExternalLink size={18} />
              </Link>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 hover:bg-white/20">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Online Now ({onlineUsers.length})
              </p>
            </div>

            {onlineUsers.length === 0 ? (
              <p className="px-4 py-3 text-center text-sm text-slate-400">No employees online</p>
            ) : (
              <div className="border-b border-slate-100">
                {onlineUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    disabled={!canSend || startChat.isPending}
                    onClick={() => canSend && startChat.mutate(u.id)}
                    className="flex w-full gap-3 border-b border-slate-50 p-3 text-left hover:bg-slate-50 disabled:cursor-default disabled:opacity-70"
                  >
                    <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-palawan-100 text-xs font-bold text-palawan-700">
                      {u.name.charAt(0)}
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${presenceColor(u.presence?.status)}`}
                        title={presenceLabel(u.presence?.status)}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">{u.name}</p>
                      <p className="truncate text-xs text-slate-500">
                        {u.department?.name ?? u.role?.name ?? u.employee_id ?? 'Employee'}
                      </p>
                    </div>
                    {startChat.isPending && startChat.variables === u.id && (
                      <Loader2 size={16} className="shrink-0 animate-spin text-palawan-600" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {recent.length > 0 && (
              <>
                <div className="border-b border-slate-100 bg-slate-50 px-4 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent</p>
                </div>
                {recent.map((c) => (
                  <Link
                    key={c.id}
                    to={`/communications?conversation=${c.id}`}
                    onClick={() => setOpen(false)}
                    className="flex gap-3 border-b border-slate-50 p-3 hover:bg-slate-50"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-palawan-100 text-xs font-bold text-palawan-700">
                      {c.title.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">{c.title}</p>
                        {c.unread_count > 0 && (
                          <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">{c.unread_count}</span>
                        )}
                      </div>
                      <p className="truncate text-xs text-slate-500">{c.last_message?.body ?? '—'}</p>
                    </div>
                  </Link>
                ))}
              </>
            )}
          </div>

          <div className="border-t border-slate-100 p-3">
            <Link to="/communications" onClick={() => setOpen(false)} className="btn-primary w-full text-center text-sm">
              Open Communications
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
