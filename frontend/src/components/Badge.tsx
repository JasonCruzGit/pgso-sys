const dotColors: Record<string, string> = {
  available: 'bg-emerald-500',
  low_stock: 'bg-amber-500',
  out_of_stock: 'bg-red-500',
  released: 'bg-emerald-500',
  issued: 'bg-blue-500',
  approved: 'bg-blue-500',
  requested: 'bg-amber-500',
  receiving: 'bg-teal-500',
  issuance: 'bg-indigo-500',
  damaged: 'bg-orange-500',
  lost: 'bg-red-500',
  rejected: 'bg-red-500',
  disposed: 'bg-slate-400',
  cancelled: 'bg-slate-400',
  draft: 'bg-slate-400',
  completed: 'bg-emerald-500',
  depleted: 'bg-slate-400',
  moving: 'bg-emerald-500',
  idle: 'bg-amber-500',
  parked: 'bg-sky-500',
  offline: 'bg-slate-400',
  pending_approval: 'bg-amber-500',
  scheduled: 'bg-indigo-500',
  ongoing: 'bg-emerald-500',
  valid: 'bg-emerald-500',
  expiring: 'bg-amber-500',
  expired: 'bg-red-500',
  pending: 'bg-slate-400',
};

const textColors: Record<string, string> = {
  available: 'text-emerald-700',
  low_stock: 'text-amber-700',
  out_of_stock: 'text-red-700',
  released: 'text-emerald-700',
  issued: 'text-blue-700',
  approved: 'text-blue-700',
  requested: 'text-amber-700',
  receiving: 'text-teal-700',
  issuance: 'text-indigo-700',
  damaged: 'text-orange-700',
  lost: 'text-red-700',
  rejected: 'text-red-700',
  disposed: 'text-slate-500',
  cancelled: 'text-slate-500',
  draft: 'text-slate-600',
  completed: 'text-emerald-700',
  depleted: 'text-slate-500',
  moving: 'text-emerald-700',
  idle: 'text-amber-700',
  parked: 'text-sky-700',
  offline: 'text-slate-500',
  pending_approval: 'text-amber-700',
  scheduled: 'text-indigo-700',
  ongoing: 'text-emerald-700',
  valid: 'text-emerald-700',
  expiring: 'text-amber-700',
  expired: 'text-red-700',
  pending: 'text-slate-600',
};

export default function Badge({ status }: { status: string }) {
  const dot = dotColors[status] ?? 'bg-slate-400';
  const text = textColors[status] ?? 'text-slate-600';
  const label = status.replace(/_/g, ' ');

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium capitalize ${text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
