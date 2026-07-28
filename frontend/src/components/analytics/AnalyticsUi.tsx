import type { LucideIcon } from 'lucide-react';
import { Sparkles } from 'lucide-react';

export function AnalyticsGlowRing({ icon: Icon = Sparkles, size = 'md' }: { icon?: LucideIcon; size?: 'sm' | 'md' | 'lg' }) {
  const ring = { sm: 'h-20 w-20', md: 'h-28 w-28', lg: 'h-32 w-32' }[size];
  const inner = { sm: 'h-14 w-14', md: 'h-20 w-20', lg: 'h-24 w-24' }[size];
  const iconSize = { sm: 22, md: 28, lg: 32 }[size];

  return (
    <div className={`analytics-glow-ring ${ring}`}>
      <div className={`analytics-glow-ring-inner ${inner}`}>
        <Icon size={iconSize} strokeWidth={1.75} />
      </div>
    </div>
  );
}

export function AnalyticsFeatureCard({
  icon: Icon,
  title,
  value,
  description,
  onClick,
  active,
}: {
  icon: LucideIcon;
  title: string;
  value: string;
  description: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`analytics-feature-card text-left ${onClick ? 'cursor-pointer transition hover:shadow-md active:scale-[0.99]' : ''} ${active ? 'ring-2 ring-palawan-400' : ''}`}
    >
      <Icon size={20} className="text-palawan-600" strokeWidth={1.75} />
      <p className="mt-3 text-sm font-bold text-slate-900">{title}</p>
      <p className="mt-1 text-xl font-bold tracking-tight text-palawan-700 sm:text-2xl">{value}</p>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{description}</p>
    </Tag>
  );
}

export function AnalyticsItemCard({
  rank,
  title,
  highlight,
  subtitle,
  meta,
}: {
  rank?: number;
  title: string;
  highlight: string;
  subtitle?: string;
  meta?: string;
}) {
  return (
    <div className="analytics-scroll-card">
      <div className="analytics-scroll-card-badge">
        {rank ? `#${rank}` : '—'}
      </div>
      <p className="mt-3 line-clamp-2 text-sm font-bold text-slate-900">{title}</p>
      <p className="mt-1 text-lg font-bold text-palawan-700">{highlight}</p>
      {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      {meta && <p className="mt-2 text-[11px] text-slate-400">{meta}</p>}
    </div>
  );
}

export function AnalyticsSuggestionBox({
  question,
  actions,
}: {
  question: string;
  actions: { label: string; onClick: () => void }[];
}) {
  return (
    <div className="analytics-suggestion-box">
      <p className="text-sm font-medium text-slate-700">{question}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {actions.map(({ label, onClick }) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-palawan-50 hover:text-palawan-800"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
