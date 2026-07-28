import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell, Lock, Mail, Building2, Shield, BadgeCheck, KeyRound,
  Package, FileText, Truck, ShoppingCart, AlertTriangle, CheckCircle, XCircle,
  Phone, Hash, Eye, EyeOff,
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import Card from '../components/Card';
import type { Notification } from '../types';

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
    default: return Package;
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
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function PasswordField({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input-field pr-11"
          required={required}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          tabIndex={-1}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');

  const { data: notifications, isLoading: loadingNotifications } = useQuery({
    queryKey: ['notifications', 'account'],
    queryFn: () => api.get('/notifications', { params: { per_page: 20 } }).then((r) => r.data),
  });

  const notificationList: Notification[] = notifications?.data ?? [];
  const unreadCount = notificationList.filter((n) => !n.is_read).length;

  const changePassword = useMutation({
    mutationFn: () => api.post('/auth/change-password', {
      current_password: currentPassword,
      password,
      password_confirmation: passwordConfirmation,
    }),
    onSuccess: () => {
      toast.success('Password updated successfully');
      setCurrentPassword('');
      setPassword('');
      setPasswordConfirmation('');
    },
    onError: () => toast.error('Failed to update password. Check your current password.'),
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
      toast.success('All notifications marked as read');
    },
  });

  const initials = user?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() ?? 'U';

  return (
    <div className="space-y-6">
      {/* Profile hero */}
      <div className="relative overflow-hidden rounded-2xl border border-palawan-100 bg-gradient-to-br from-palawan-700 via-palawan-600 to-emerald-600 px-6 py-6 text-white shadow-lg shadow-palawan-900/10 sm:px-8">
        <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-2xl font-bold ring-2 ring-white/30 backdrop-blur-sm">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold">
                <Shield size={12} /> {user?.role?.name ?? 'User'}
              </span>
              {user?.department?.name && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold">
                  <Building2 size={12} /> {user.department.name}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 px-2.5 py-1 text-xs font-semibold text-emerald-100">
                <BadgeCheck size={12} /> Active
              </span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight">{user?.name}</h2>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-white/85">
              <Mail size={14} /> {user?.email}
            </p>
          </div>
        </div>
      </div>

      {/* Account details */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Role', value: user?.role?.name ?? '—', icon: Shield, bg: 'bg-blue-50', text: 'text-blue-600' },
          { label: 'Department', value: user?.department?.name ?? '—', icon: Building2, bg: 'bg-emerald-50', text: 'text-emerald-600' },
          { label: 'Employee ID', value: user?.employee_id ?? '—', icon: Hash, bg: 'bg-violet-50', text: 'text-violet-600' },
          { label: 'Phone', value: user?.phone ?? '—', icon: Phone, bg: 'bg-amber-50', text: 'text-amber-600' },
        ].map(({ label, value, icon: Icon, bg, text }) => (
          <div key={label} className="card flex items-center gap-3 p-4">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bg} ${text}`}>
              <Icon size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
              <p className="truncate text-sm font-semibold text-slate-900">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Notifications */}
        <div className="lg:col-span-3">
          <Card
            title="Notifications"
            subtitle="System alerts and activity updates"
            action={
              unreadCount > 0 ? (
                <button
                  type="button"
                  onClick={() => markAllRead.mutate()}
                  disabled={markAllRead.isPending}
                  className="rounded-lg bg-palawan-50 px-3 py-1.5 text-xs font-semibold text-palawan-700 transition hover:bg-palawan-100"
                >
                  Mark all read ({unreadCount})
                </button>
              ) : undefined
            }
          >
            {loadingNotifications ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="skeleton h-16 rounded-xl" />
                ))}
              </div>
            ) : notificationList.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <Bell size={22} />
                </div>
                <p className="mt-3 text-sm font-medium text-slate-700">No notifications yet</p>
                <p className="mt-1 text-xs text-slate-400">Alerts for requests, stock, and releases will appear here.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {notificationList.map((n) => {
                  const Icon = getNotificationIcon(n.type);
                  return (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => !n.is_read && markRead.mutate(n.id)}
                      className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${
                        n.is_read
                          ? 'border-slate-100 bg-white hover:bg-slate-50'
                          : 'border-palawan-100 bg-palawan-50/40 hover:bg-palawan-50'
                      }`}
                    >
                      <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        n.is_read ? 'bg-slate-100 text-slate-500' : 'bg-palawan-100 text-palawan-700'
                      }`}>
                        <Icon size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">{n.title}</p>
                          <span className="shrink-0 text-[10px] text-slate-400">{formatTime(n.created_at)}</span>
                        </div>
                        <p className="mt-0.5 text-sm text-slate-600">{n.message}</p>
                        {!n.is_read && (
                          <span className="mt-1.5 inline-block rounded-full bg-palawan-600 px-2 py-0.5 text-[10px] font-bold text-white">
                            New
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Password + security */}
        <div className="space-y-6 lg:col-span-2">
          <Card title="Change Password" subtitle="Keep your account secure">
            <form
              onSubmit={(e) => { e.preventDefault(); changePassword.mutate(); }}
              className="space-y-4"
            >
              <PasswordField
                label="Current password"
                value={currentPassword}
                onChange={setCurrentPassword}
                required
              />
              <PasswordField
                label="New password"
                value={password}
                onChange={setPassword}
                required
              />
              <PasswordField
                label="Confirm new password"
                value={passwordConfirmation}
                onChange={setPasswordConfirmation}
                required
              />
              <button
                type="submit"
                disabled={changePassword.isPending}
                className="btn-primary w-full"
              >
                <KeyRound size={16} />
                {changePassword.isPending ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </Card>

          <div className="card border-amber-100 bg-amber-50/50 p-5">
            <div className="flex gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <Lock size={16} />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-900">Security tips</p>
                <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-amber-800/90">
                  <li>Use a strong password with letters, numbers, and symbols.</li>
                  <li>Do not share your login credentials with others.</li>
                  <li>Sign out when using shared or public computers.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
