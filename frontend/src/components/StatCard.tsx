import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  highlight?: boolean;
  trend?: { value: string; up?: boolean };
  onClick?: () => void;
  active?: boolean;
  compact?: boolean;
  fill?: boolean;
}

export default function StatCard({ title, value, subtitle, icon: Icon, highlight, trend, onClick, active, compact, fill }: StatCardProps) {
  const interactive = onClick
    ? 'cursor-pointer touch-manipulation transition hover:border-palawan-200 hover:bg-slate-50/80 hover:shadow-md active:scale-[0.99] active:bg-slate-50'
    : '';
  const activeRing = active ? 'border-palawan-300 bg-palawan-50/40 ring-2 ring-inset ring-palawan-500' : '';
  const padding = compact ? 'p-4' : 'p-5';
  const valueSize = compact ? 'text-xl' : 'text-2xl';
  const valueMt = compact ? 'mt-1.5' : 'mt-3';
  const iconSize = compact ? 'h-8 w-8' : 'h-9 w-9';
  const iconInner = compact ? 16 : 18;
  const fillClass = fill ? 'flex h-auto min-h-[6.75rem] flex-col sm:min-h-[8.5rem]' : '';
  const sharedProps = onClick
    ? {
        type: 'button' as const,
        onClick,
        'aria-pressed': active,
        'aria-label': `View ${title}`,
      }
    : {};

  if (highlight) {
    const HighlightTag = onClick ? 'button' : 'div';
    return (
      <HighlightTag
        {...sharedProps}
        className={`gradient-highlight relative w-full overflow-hidden rounded-2xl p-5 text-left text-white shadow-lg shadow-palawan-600/25 ${interactive} ${activeRing}`}
      >
        <p className="text-sm font-medium text-white/80">{title}</p>
        <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
        {subtitle && <p className="mt-1 text-xs text-white/70">{subtitle}</p>}
        {trend && (
          <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium">
            {trend.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {trend.value}
          </div>
        )}
        {Icon && (
          <div className="absolute -bottom-2 -right-2 opacity-20">
            <Icon size={64} strokeWidth={1} />
          </div>
        )}
      </HighlightTag>
    );
  }

  if (onClick) {
    return (
      <button
        {...sharedProps}
        className={`card min-w-0 max-w-full text-left ${padding} ${fillClass} ${interactive} ${activeRing}`}
      >
        <div className="flex min-w-0 items-start justify-between gap-2">
          <p className="min-w-0 text-sm font-medium text-slate-500">{title}</p>
          {Icon && (
            <div className={`flex ${iconSize} shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600`}>
              <Icon size={iconInner} />
            </div>
          )}
        </div>
        <p className={`${valueMt} ${valueSize} font-bold tracking-tight text-slate-900`}>{value}</p>
        <div className={`${fill ? 'mt-auto' : ''} ${compact ? 'mt-1 min-h-[1.125rem]' : 'mt-2 min-h-[1.25rem]'} flex flex-wrap items-center gap-x-2 gap-y-0.5`}>
          {trend ? (
            <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${trend.up ? 'text-emerald-600' : 'text-red-500'}`}>
              {trend.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {trend.value}
            </span>
          ) : (
            <span className="invisible text-xs">—</span>
          )}
          {subtitle && <span className="text-xs text-slate-400">{subtitle}</span>}
        </div>
      </button>
    );
  }

  return (
    <div className={`card min-w-0 max-w-full ${padding} ${fillClass}`}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <p className="min-w-0 text-sm font-medium text-slate-500">{title}</p>
        {Icon && (
          <div className={`flex ${iconSize} shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600`}>
            <Icon size={iconInner} />
          </div>
        )}
      </div>
      <p className={`${valueMt} ${valueSize} font-bold tracking-tight text-slate-900`}>{value}</p>
      <div className={`${fill ? 'mt-auto' : ''} ${compact ? 'mt-1 min-h-[1.125rem]' : 'mt-2 min-h-[1.25rem]'} flex flex-wrap items-center gap-x-2 gap-y-0.5`}>
        {trend ? (
          <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${trend.up ? 'text-emerald-600' : 'text-red-500'}`}>
            {trend.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {trend.value}
          </span>
        ) : (
          <span className="invisible text-xs">—</span>
        )}
        {subtitle && <span className="text-xs text-slate-400">{subtitle}</span>}
      </div>
    </div>
  );
}
