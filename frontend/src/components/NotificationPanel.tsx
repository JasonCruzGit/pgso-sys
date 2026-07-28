import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell, X, Package, FileText, Truck, ShoppingCart, AlertTriangle, CheckCircle, XCircle,
  MessageSquare, UserPlus,
} from 'lucide-react';
import api from '../api/client';
import type { Notification } from '../types';

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
  anchorRef?: RefObject<HTMLButtonElement | null>;
}

function getNotificationIcon(type: string) {
  switch (type) {
    case 'low_stock': return AlertTriangle;
    case 'pending_approval':
    case 'request_submitted': return FileText;
    case 'request_approved':
    case 'request_released': return CheckCircle;
    case 'request_rejected': return XCircle;
    case 'stock_in':
    case 'stock_out': return Truck;
    case 'procurement': return ShoppingCart;
    case 'new_message': return MessageSquare;
    case 'announcement': return Bell;
    case 'account_registration': return UserPlus;
    default: return Package;
  }
}

function getNotificationLink(notification: Notification): string | null {
  switch (notification.type) {
    case 'low_stock': return '/inventory';
    case 'pending_approval':
    case 'request_submitted':
    case 'request_approved':
    case 'request_rejected':
    case 'request_released': return '/requests';
    case 'stock_in':
    case 'stock_out': return '/stock';
    case 'procurement': return '/procurement/air';
    case 'new_message': {
      const convId = notification.data?.conversation_id;
      return convId ? `/communications?conversation=${convId}` : '/communications';
    }
    case 'announcement': return '/communications';
    case 'account_registration': return '/settings/users';
    default: return null;
  }
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}

export default function NotificationPanel({ open, onClose, anchorRef }: NotificationPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [position, setPosition] = useState({ top: 72, right: 16 });

  useEffect(() => {
    if (!open || !anchorRef?.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 8,
      right: Math.max(16, window.innerWidth - rect.right),
    });
  }, [open, anchorRef]);

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications', { params: { per_page: 30 } }).then((r) => r.data),
    enabled: open,
  });

  const markRead = useMutation({
    mutationFn: (id: number) => api.post(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => api.post('/notifications/mark-all-read'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-count'] });
    },
  });

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const handleClick = (notification: Notification) => {
    if (!notification.is_read) {
      markRead.mutate(notification.id);
    }
    const link = getNotificationLink(notification);
    if (link) {
      onClose();
      navigate(link);
    }
  };

  if (!open) return null;

  const notifications: Notification[] = data?.data ?? [];

  return createPortal(
    <>
      <div
        className="fixed inset-x-0 bottom-0 top-16 z-[100]"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        style={{ top: position.top, right: position.right }}
        className="fixed z-[110] w-[min(100vw-2rem,380px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell size={18} className="text-palawan-600" />
            <h3 className="text-sm font-semibold text-slate-900">Transaction Alerts</h3>
          </div>
          <div className="flex items-center gap-2">
            {notifications.some((n) => !n.is_read) && (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                className="text-xs font-medium text-palawan-600 hover:underline"
              >
                Mark all read
              </button>
            )}
            <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2 p-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-16 rounded-xl" />
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-10 text-center">
              <Bell size={28} className="text-slate-300" />
              <p className="mt-2 text-sm font-medium text-slate-600">No notifications yet</p>
              <p className="mt-1 text-xs text-slate-400">Stock, request, and procurement updates will appear here.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 p-2">
              {notifications.map((notification) => {
                const Icon = getNotificationIcon(notification.type);
                return (
                  <li key={notification.id}>
                    <button
                      type="button"
                      onClick={() => handleClick(notification)}
                      className={`flex w-full gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-slate-50 ${
                        !notification.is_read ? 'bg-palawan-50/50' : ''
                      }`}
                    >
                      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        !notification.is_read ? 'bg-palawan-100 text-palawan-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        <Icon size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
                          {!notification.is_read && (
                            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-red-500" />
                          )}
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{notification.message}</p>
                        <p className="mt-1 text-[10px] text-slate-400">{formatTime(notification.created_at)}</p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>,
    document.body,
  );
}
