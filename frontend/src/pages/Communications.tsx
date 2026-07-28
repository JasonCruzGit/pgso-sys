import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare, Send, Search, Users, Megaphone, Archive, Inbox,
  Plus, Paperclip, Loader2, CheckCheck, ArrowLeft, Phone, Video,
  ThumbsUp, Pencil,
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { AnnouncementItem, ChatMessage, ConversationSummary, MessagingUser } from '../types';
import toast from 'react-hot-toast';

type CommTab = 'inbox' | 'direct' | 'groups' | 'announcements' | 'archived';
type FilterChip = 'all' | 'unread' | 'groups' | 'announcements' | 'archived';

const filterChips: { id: FilterChip; label: string; icon: typeof Inbox }[] = [
  { id: 'all', label: 'All', icon: Inbox },
  { id: 'unread', label: 'Unread', icon: MessageSquare },
  { id: 'groups', label: 'Groups', icon: Users },
  { id: 'announcements', label: 'Announcements', icon: Megaphone },
  { id: 'archived', label: 'Archived', icon: Archive },
];

const reactions = ['like', 'approve', 'acknowledge', 'important'] as const;

function conversationFilter(tab: CommTab) {
  if (tab === 'direct') return { type: 'direct' };
  if (tab === 'groups') return { type: 'group' };
  if (tab === 'archived') return { archived: true };
  return {};
}

function apiTabFromFilter(filter: FilterChip): CommTab {
  if (filter === 'groups') return 'groups';
  if (filter === 'archived') return 'archived';
  if (filter === 'announcements') return 'announcements';
  return 'inbox';
}

function formatConvTime(value?: string) {
  if (!value) return '';
  const d = new Date(value);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const day = 86_400_000;
  if (diff < day && now.toDateString() === d.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase();
  }
  if (diff < day * 7) {
    return d.toLocaleDateString([], { weekday: 'long' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatDateDivider(value?: string) {
  if (!value) return '';
  const d = new Date(value);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toUpperCase();
  if (d.toDateString() === now.toDateString()) return `Today at ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday at ${time}`;
  return `${d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })} at ${time}`;
}

function groupMessagesByDate(messages: ChatMessage[]) {
  const groups: { label: string; messages: ChatMessage[] }[] = [];
  for (const m of messages) {
    const label = formatDateDivider(m.created_at);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.messages.push(m);
    else groups.push({ label, messages: [m] });
  }
  return groups;
}

function UserAvatar({ name, size = 'md', online }: { name: string; size?: 'sm' | 'md' | 'lg'; online?: boolean }) {
  const sz = { sm: 'h-9 w-9 text-xs', md: 'h-11 w-11 text-sm', lg: 'h-14 w-14 text-base' }[size];
  return (
    <div className="relative shrink-0">
      <div className={`comm-avatar ${sz}`}>{name.charAt(0).toUpperCase()}</div>
      {online && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-green-500" />}
    </div>
  );
}

export default function Communications() {
  const { user, hasPermission } = useAuth();
  const [searchParams] = useSearchParams();
  const [filter, setFilter] = useState<FilterChip>('all');
  const [selectedId, setSelectedId] = useState<number | null>(
    searchParams.get('conversation') ? Number(searchParams.get('conversation')) : null,
  );
  const [search, setSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [showNewDirect, setShowNewDirect] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupDepartmentId, setGroupDepartmentId] = useState('');
  const [groupMembers, setGroupMembers] = useState<number[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const canAnnounce = hasPermission('messaging.*') || hasPermission('users.*');
  const canSend = hasPermission('messaging.send') || hasPermission('messaging.*');
  const tab = apiTabFromFilter(filter);

  const openCreateGroup = () => {
    setShowNewDirect(false);
    setShowNewGroup(true);
    setGroupName('');
    setGroupDescription('');
    setGroupDepartmentId('');
    setGroupMembers([]);
    setUserSearch('');
  };

  useEffect(() => {
    api.post('/communications/presence', { status: 'online' }).catch(() => {});
    const ping = setInterval(() => {
      api.post('/communications/presence', { status: 'online' }).catch(() => {});
    }, 60000);
    return () => {
      clearInterval(ping);
      api.post('/communications/presence', { status: 'offline' }).catch(() => {});
    };
  }, []);

  const { data: conversations, isLoading: loadingConversations } = useQuery({
    queryKey: ['communications-conversations', tab, search],
    queryFn: () => api.get('/communications/conversations', {
      params: { ...conversationFilter(tab), search: search || undefined },
    }).then((r) => r.data),
    refetchInterval: 15000,
  });

  const { data: messages, isLoading: loadingMessages, isError: messagesError } = useQuery({
    queryKey: ['communications-messages', selectedId],
    queryFn: () => api.get(`/communications/conversations/${selectedId}/messages`).then((r) => r.data),
    enabled: !!selectedId && filter !== 'announcements',
    refetchInterval: selectedId ? 5000 : false,
  });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments', { params: { per_page: 100, is_active: true } }).then((r) => r.data),
    enabled: showNewGroup,
  });

  const { data: users, isLoading: loadingUsers } = useQuery({
    queryKey: ['communications-users', userSearch],
    queryFn: () => api.get('/communications/users/search', { params: { search: userSearch || undefined } }).then((r) => r.data.data as MessagingUser[]),
    enabled: showNewDirect || showNewGroup,
  });

  const { data: announcements } = useQuery({
    queryKey: ['communications-announcements'],
    queryFn: () => api.get('/communications/announcements').then((r) => r.data),
    enabled: filter === 'announcements',
  });

  const convList: ConversationSummary[] = conversations?.data ?? [];
  const displayConversations = filter === 'unread'
    ? convList.filter((c) => c.unread_count > 0)
    : convList;
  const selected = convList.find((c) => c.id === selectedId) ?? null;
  const chatMessages: ChatMessage[] = messages?.data ?? [];
  const messageGroups = useMemo(() => groupMessagesByDate(chatMessages), [chatMessages]);
  const typing: string[] = messages?.typing ?? [];
  const showReactions = !!(selected?.context_type && selected?.context_id);
  const mobileThreadOpen = !!selectedId && filter !== 'announcements';

  const onlineUsers = useMemo(() => {
    const map = new Map<number, MessagingUser>();
    for (const c of convList) {
      for (const m of c.members ?? []) {
        if (m.id !== user?.id && m.presence?.status === 'online' && !map.has(m.id)) {
          map.set(m.id, m);
        }
      }
    }
    return [...map.values()].slice(0, 12);
  }, [convList, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    if (selectedId) {
      api.post(`/communications/conversations/${selectedId}/read`).then(() => {
        queryClient.invalidateQueries({ queryKey: ['communications-unread'] });
        queryClient.invalidateQueries({ queryKey: ['communications-conversations'] });
      });
    }
  }, [selectedId, chatMessages.length, queryClient]);

  const sendMessage = useMutation({
    mutationFn: async (files?: FileList | null) => {
      const formData = new FormData();
      formData.append('body', messageInput);
      if (files) {
        Array.from(files).forEach((f) => formData.append('attachments[]', f));
      }
      return api.post(`/communications/conversations/${selectedId}/messages`, formData);
    },
    onSuccess: () => {
      setMessageInput('');
      queryClient.invalidateQueries({ queryKey: ['communications-messages', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['communications-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['communications-unread'] });
    },
    onError: () => toast.error('Failed to send message'),
  });

  const startDirect = useMutation({
    mutationFn: (recipientId: number) => api.post('/communications/conversations/direct', { recipient_user_id: recipientId }),
    onSuccess: (res) => {
      setShowNewDirect(false);
      setFilter('all');
      setSelectedId(res.data.id);
      queryClient.invalidateQueries({ queryKey: ['communications-conversations'] });
    },
  });

  const createGroup = useMutation({
    mutationFn: () => api.post('/communications/conversations/group', {
      name: groupName.trim(),
      description: groupDescription.trim() || undefined,
      department_id: groupDepartmentId ? Number(groupDepartmentId) : undefined,
      member_ids: groupMembers,
    }),
    onSuccess: (res) => {
      setShowNewGroup(false);
      setGroupName('');
      setGroupDescription('');
      setGroupDepartmentId('');
      setGroupMembers([]);
      setUserSearch('');
      setFilter('groups');
      setSelectedId(res.data.id);
      queryClient.invalidateQueries({ queryKey: ['communications-conversations'] });
      toast.success(`Group "${res.data.title ?? res.data.name}" created`);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message ?? 'Failed to create group');
    },
  });

  const react = useMutation({
    mutationFn: ({ messageId, reaction }: { messageId: number; reaction: string }) =>
      api.post(`/communications/messages/${messageId}/react`, { reaction }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['communications-messages', selectedId] }),
  });

  const acknowledge = useMutation({
    mutationFn: (id: number) => api.post(`/communications/announcements/${id}/acknowledge`),
    onSuccess: () => {
      toast.success('Acknowledged');
      queryClient.invalidateQueries({ queryKey: ['communications-announcements'] });
    },
  });

  const handleTyping = () => {
    if (!selectedId) return;
    api.post(`/communications/conversations/${selectedId}/typing`).catch(() => {});
  };

  const sendThumbsUp = () => {
    if (!selectedId) return;
    const formData = new FormData();
    formData.append('body', '👍');
    api.post(`/communications/conversations/${selectedId}/messages`, formData).then(() => {
      queryClient.invalidateQueries({ queryKey: ['communications-messages', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['communications-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['communications-unread'] });
    }).catch(() => toast.error('Failed to send message'));
  };

  return (
    <div className="comm-page">
      <div className="comm-shell">
        {/* Conversation list */}
        <aside className={`comm-list-panel ${mobileThreadOpen ? 'hidden md:flex' : 'flex'}`}>
          <div className="comm-list-header">
            <div className="min-w-0">
              <h1 className="text-lg font-bold tracking-tight text-slate-900">Chats</h1>
              <p className="text-xs text-slate-500">
                {filter === 'announcements'
                  ? 'Announcements'
                  : `${displayConversations.length} conversation${displayConversations.length === 1 ? '' : 's'}`}
              </p>
            </div>
            {canSend && filter !== 'announcements' && (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={openCreateGroup}
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-white hover:text-palawan-700"
                  aria-label="New group"
                  title="New group"
                >
                  <Users size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewDirect(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-palawan-600 text-white shadow-sm transition hover:bg-palawan-700"
                  aria-label="New message"
                  title="New message"
                >
                  <Pencil size={17} />
                </button>
              </div>
            )}
          </div>

          <div className="shrink-0 px-4 py-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations"
                className="comm-search"
              />
            </div>
          </div>

          {filter !== 'announcements' && canSend && (
            <div className="comm-quick-chat">
              {onlineUsers.length > 0 ? (
                <>
                  <p className="px-4 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Quick chat</p>
                  <div className="comm-stories-scroll">
                    <button
                      type="button"
                      onClick={openCreateGroup}
                      className="flex shrink-0 flex-col items-center gap-1"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-palawan-300 bg-white text-palawan-600 shadow-sm">
                        <Plus size={20} />
                      </div>
                      <span className="max-w-[4rem] truncate text-[10px] font-medium text-slate-500">New Group</span>
                    </button>
                    {onlineUsers.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => startDirect.mutate(u.id)}
                        className="flex shrink-0 flex-col items-center gap-1"
                      >
                        <UserAvatar name={u.name} size="md" online />
                        <span className="max-w-[4rem] truncate text-[10px] font-medium text-slate-500">{u.name.split(' ')[0]}</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex gap-2 px-4">
                  <button
                    type="button"
                    onClick={() => setShowNewDirect(true)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:border-palawan-200 hover:text-palawan-700"
                  >
                    <Pencil size={14} /> New message
                  </button>
                  <button
                    type="button"
                    onClick={openCreateGroup}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:border-palawan-200 hover:text-palawan-700"
                  >
                    <Users size={14} /> New group
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="comm-filter-bar">
            {filterChips.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => { setFilter(id); setSelectedId(null); }}
                className={`comm-chip ${filter === id ? 'comm-chip-active' : 'bg-white/80 hover:bg-white'}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {filter === 'announcements' ? (
              <div className="divide-y divide-slate-100">
                {canAnnounce && (
                  <div className="border-b border-slate-100 bg-slate-50 p-4">
                    <p className="mb-2 text-sm font-semibold text-slate-800">Post Announcement</p>
                    <AnnouncementForm onSuccess={() => queryClient.invalidateQueries({ queryKey: ['communications-announcements'] })} />
                  </div>
                )}
                {(announcements?.data ?? []).map((a: AnnouncementItem) => (
                  <article key={a.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="comm-avatar h-11 w-11 shrink-0 text-sm">
                        <Megaphone size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-bold text-slate-900">{a.title}</p>
                          {a.is_pinned && (
                            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">PINNED</span>
                          )}
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{a.body}</p>
                        {a.created_at && (
                          <p className="mt-2 text-xs text-slate-400">{formatConvTime(a.created_at)}</p>
                        )}
                        {a.requires_acknowledgement && !a.acknowledged && (
                          <button type="button" className="mt-3 rounded-full bg-palawan-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-palawan-700" onClick={() => acknowledge.mutate(a.id)}>
                            Acknowledge
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
                {!(announcements?.data ?? []).length && (
                  <p className="p-8 text-center text-sm text-slate-400">No announcements yet.</p>
                )}
              </div>
            ) : (
              <>
                {loadingConversations && (
                  <div className="flex justify-center p-8">
                    <Loader2 className="animate-spin text-slate-400" size={24} />
                  </div>
                )}
                {!loadingConversations && displayConversations.length === 0 && (
                  <div className="flex flex-col items-center px-6 py-12 text-center">
                    <MessageSquare size={40} className="mb-3 text-slate-300" />
                    <p className="text-sm font-medium text-slate-500">
                      {filter === 'unread' ? 'No unread messages' : filter === 'groups' ? 'No group chats yet' : 'No conversations yet'}
                    </p>
                    {filter === 'groups' && canSend && (
                      <button type="button" className="mt-4 rounded-full bg-palawan-600 px-5 py-2 text-sm font-semibold text-white hover:bg-palawan-700" onClick={openCreateGroup}>
                        Create Group
                      </button>
                    )}
                  </div>
                )}
                {displayConversations.map((c) => {
                  const isOnline = c.type === 'direct'
                    && c.members?.some((m) => m.id !== user?.id && m.presence?.status === 'online');
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedId(c.id)}
                      className={`comm-conv-row ${selectedId === c.id ? 'comm-conv-row-active' : 'hover:bg-slate-50'}`}
                    >
                      <UserAvatar name={c.title} online={isOnline} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate font-bold text-slate-900">{c.title}</p>
                          <span className="shrink-0 text-xs text-slate-400">
                            {formatConvTime(c.last_message?.created_at ?? c.last_message_at)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm text-slate-500">
                            {c.last_message?.body ?? 'No messages yet'}
                          </p>
                          {c.unread_count > 0 ? (
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-palawan-600" />
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </aside>

        {/* Chat thread */}
        <main className={`comm-thread-panel ${mobileThreadOpen ? 'comm-thread-panel-mobile md:relative md:inset-auto' : 'hidden md:flex'}`}>
          {!selectedId && filter !== 'announcements' && (
            <div className="comm-empty-thread">
              <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200/80">
                <MessageSquare size={40} className="text-palawan-600" />
              </div>
              <p className="text-xl font-semibold text-slate-800">Your messages</p>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
                Send private messages or create group chats for your team.
              </p>
              {canSend && (
                <button
                  type="button"
                  className="mt-6 rounded-full bg-palawan-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-palawan-600/20 hover:bg-palawan-700"
                  onClick={() => setShowNewDirect(true)}
                >
                  Send a message
                </button>
              )}
            </div>
          )}

          {selectedId && filter !== 'announcements' && (
            <>
              <header className="flex shrink-0 items-center gap-3 border-b border-slate-200/80 bg-white px-3 py-2.5 safe-top lg:px-4">
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-palawan-600 hover:bg-palawan-50 md:hidden"
                  aria-label="Back to chats"
                >
                  <ArrowLeft size={22} />
                </button>
                <UserAvatar
                  name={selected?.title ?? '?'}
                  size="sm"
                  online={selected?.members?.some((m) => m.id !== user?.id && m.presence?.status === 'online')}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-slate-900">{selected?.title}</p>
                  {typing.length > 0 ? (
                    <p className="truncate text-xs text-palawan-600">{typing.join(', ')} is typing...</p>
                  ) : selected?.context_type ? (
                    <p className="truncate text-xs text-slate-500">Linked: {selected.context_type} #{selected.context_id}</p>
                  ) : (
                    <p className="truncate text-xs text-slate-500">
                      {selected?.type === 'group' ? `${selected.members?.length ?? 0} members` : 'Active now'}
                    </p>
                  )}
                </div>
                <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full text-palawan-600 hover:bg-palawan-50" aria-label="Voice call">
                  <Phone size={20} />
                </button>
                <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full text-palawan-600 hover:bg-palawan-50" aria-label="Video call">
                  <Video size={20} />
                </button>
              </header>

              <div className="comm-message-area">
                {loadingMessages && <Loader2 className="mx-auto animate-spin text-slate-400" />}
                {messagesError && (
                  <p className="text-center text-sm text-red-500">Failed to load messages. Please refresh.</p>
                )}
                {messageGroups.map((group) => (
                  <div key={group.label}>
                    <div className="comm-date-divider my-3">{group.label}</div>
                    {group.messages.map((m) => {
                      const mine = m.sender.id === user?.id;
                      const showAvatar = !mine;
                      return (
                        <div key={m.id} className={`mb-1 flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
                          {showAvatar && (
                            <UserAvatar name={m.sender.name} size="sm" />
                          )}
                          {!showAvatar && <div className="w-9 shrink-0" />}
                          <div className={`max-w-[75%] ${mine ? 'comm-bubble-out' : 'comm-bubble-in'}`}>
                            {!mine && selected?.type === 'group' && (
                              <p className="mb-0.5 text-[11px] font-bold text-palawan-700">{m.sender.name}</p>
                            )}
                            <p className="whitespace-pre-wrap text-[15px] leading-snug">{m.body}</p>
                            {m.attachments?.map((a) => (
                              <a
                                key={a.id}
                                href={`/api/communications/attachments/${a.id}/download`}
                                className={`mt-1 flex items-center gap-1 text-xs underline ${mine ? 'text-white/90' : 'text-palawan-700'}`}
                              >
                                <Paperclip size={12} /> {a.file_name}
                              </a>
                            ))}
                            {showReactions && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {reactions.map((r) => (
                                  <button
                                    key={r}
                                    type="button"
                                    onClick={() => react.mutate({ messageId: m.id, reaction: r })}
                                    className={`rounded-full px-2 py-0.5 text-[10px] capitalize ${mine ? 'bg-white/20 text-white' : 'bg-white text-slate-600 shadow-sm'}`}
                                  >
                                    {r}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
                {chatMessages.length > 0 && chatMessages[chatMessages.length - 1]?.status === 'seen' && (
                  <div className="flex justify-end pr-2 pt-1">
                    <p className="flex items-center gap-1 text-[11px] text-slate-400">
                      Seen {formatConvTime(chatMessages[chatMessages.length - 1].created_at)}
                      <CheckCheck size={12} className="text-palawan-600" />
                    </p>
                  </div>
                )}
                {typing.length > 0 && (
                  <p className="text-xs italic text-slate-400">{typing.join(', ')} is typing...</p>
                )}
                <div ref={messagesEndRef} />
              </div>

              {canSend && (
                <div className="shrink-0 border-t border-slate-200/80 bg-white px-3 py-2.5 safe-bottom lg:px-4">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-palawan-600 hover:bg-palawan-50"
                    >
                      <Plus size={22} />
                    </button>
                    <input ref={fileRef} type="file" className="hidden" multiple onChange={(e) => sendMessage.mutate(e.target.files)} />
                    <div className="comm-composer min-w-0 flex-1">
                      <input
                        value={messageInput}
                        onChange={(e) => { setMessageInput(e.target.value); handleTyping(); }}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), messageInput.trim() && sendMessage.mutate(null))}
                        placeholder="Aa"
                        className="min-w-0 flex-1 border-0 bg-transparent py-2 text-[15px] text-slate-800 placeholder:text-slate-400 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-palawan-600 hover:bg-palawan-50"
                      >
                        <Paperclip size={18} />
                      </button>
                    </div>
                    {messageInput.trim() ? (
                      <button
                        type="button"
                        disabled={sendMessage.isPending}
                        onClick={() => sendMessage.mutate(null)}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-palawan-600 text-white hover:bg-palawan-700 disabled:opacity-60"
                      >
                        {sendMessage.isPending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={sendThumbsUp}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-palawan-600 hover:bg-palawan-50"
                      >
                        <ThumbsUp size={20} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {showNewDirect && (
        <Modal title="New Message" onClose={() => setShowNewDirect(false)}>
          <input
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder="Search employee name, ID, department..."
            className="input-field mb-3"
          />
          <div className="max-h-60 space-y-1 overflow-y-auto">
            {(users ?? []).map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => startDirect.mutate(u.id)}
                className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-slate-50"
              >
                <UserAvatar name={u.name} size="sm" online={u.presence?.status === 'online'} />
                <div>
                  <p className="font-semibold text-slate-900">{u.name}</p>
                  <p className="text-xs text-slate-500">{u.employee_id ?? u.email} · {u.department?.name ?? '—'}</p>
                </div>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {showNewGroup && (
        <Modal title="Create Group Chat" wide onClose={() => setShowNewGroup(false)}>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Group Name *</label>
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. Warehouse Team, Supply Office"
                className="input-field"
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
              <textarea
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                placeholder="What is this group for?"
                className="input-field min-h-[72px]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Department (optional)</label>
              <select
                value={groupDepartmentId}
                onChange={(e) => setGroupDepartmentId(e.target.value)}
                className="input-field"
              >
                <option value="">All departments</option>
                {(departments?.data ?? []).map((d: { id: number; name: string }) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Add Members *</label>
              <input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search by name, employee ID, or email..."
                className="input-field"
              />
            </div>
            {groupMembers.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {groupMembers.map((id) => {
                  const member = (users ?? []).find((u) => u.id === id);
                  return (
                    <span key={id} className="inline-flex items-center gap-1 rounded-full bg-palawan-50 px-2.5 py-1 text-xs font-medium text-palawan-800">
                      {member?.name ?? `User #${id}`}
                      <button
                        type="button"
                        className="text-palawan-700 hover:text-palawan-900"
                        onClick={() => setGroupMembers((prev) => prev.filter((mid) => mid !== id))}
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-slate-100 p-2">
              {loadingUsers && <p className="p-2 text-sm text-slate-400">Loading employees...</p>}
              {!loadingUsers && (users ?? []).length === 0 && (
                <p className="p-2 text-sm text-slate-400">No employees found.</p>
              )}
              {(users ?? []).map((u) => (
                <label key={u.id} className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={groupMembers.includes(u.id)}
                    onChange={(e) => setGroupMembers((prev) => (
                      e.target.checked ? [...prev, u.id] : prev.filter((mid) => mid !== u.id)
                    ))}
                  />
                  <UserAvatar name={u.name} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{u.name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {u.employee_id ?? u.email} · {u.department?.name ?? '—'}
                    </p>
                  </div>
                </label>
              ))}
            </div>
            <button
              type="button"
              className="btn-primary w-full"
              disabled={!groupName.trim() || groupMembers.length === 0 || createGroup.isPending}
              onClick={() => createGroup.mutate()}
            >
              {createGroup.isPending ? (
                <><Loader2 size={16} className="animate-spin" /> Creating...</>
              ) : (
                <><Users size={16} /> Create Group ({groupMembers.length} member{groupMembers.length === 1 ? '' : 's'})</>
              )}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className={`card-elevated w-full p-6 ${wide ? 'max-w-lg' : 'max-w-md'}`} onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-4 text-lg font-bold text-slate-900">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function AnnouncementForm({ onSuccess }: { onSuccess: () => void }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const submit = useMutation({
    mutationFn: () => api.post('/communications/announcements', { title, body, target_scope: 'all' }),
    onSuccess: () => { setTitle(''); setBody(''); onSuccess(); toast.success('Announcement posted'); },
    onError: () => toast.error('Failed to post announcement'),
  });
  return (
    <div className="space-y-2">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="input-field" />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Announcement body" className="input-field min-h-[80px]" />
      <button type="button" className="btn-primary rounded-full text-sm disabled:opacity-60" disabled={!title || !body} onClick={() => submit.mutate()}>Post</button>
    </div>
  );
}
