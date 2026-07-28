import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Sparkles, AlertCircle, Info, TrendingUp,
  PhilippinePeso, ShoppingCart, PieChart, RefreshCw, Briefcase,
} from 'lucide-react';
import api from '../api/client';
import {
  AnalyticsGlowRing, AnalyticsFeatureCard, AnalyticsSuggestionBox,
} from '../components/analytics/AnalyticsUi';
import { useAuth } from '../context/AuthContext';
import type { AiExecutiveSummary } from '../types';

const periods = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
] as const;

function formatCurrency(n: number) {
  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function AiExecutive() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const firstName = user?.name?.split(' ')[0] ?? 'there';
  const [period, setPeriod] = useState<string>('monthly');

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['ai-executive', period],
    queryFn: () => api.get('/ai/executive-summary', { params: { period } }).then((r) => r.data as AiExecutiveSummary),
  });

  const { data: recommendations } = useQuery({
    queryKey: ['ai-recommendations'],
    queryFn: () => api.get('/ai/recommendations').then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="flex flex-col items-center py-8">
          <div className="skeleton h-28 w-28 rounded-full" />
          <div className="skeleton mt-4 h-6 w-48 rounded-xl" />
        </div>
        <div className="skeleton h-40 rounded-3xl" />
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-36 rounded-3xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col items-center px-2 py-4 text-center sm:py-6">
        <AnalyticsGlowRing icon={Briefcase} />
        <p className="mt-5 text-sm text-slate-500">Executive view, {firstName}</p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Leadership summary
        </h2>
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {periods.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setPeriod(p.value)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              period === p.value
                ? 'bg-palawan-600 text-white shadow-sm'
                : 'bg-white text-slate-600 ring-1 ring-slate-100 hover:bg-slate-50'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {data && (
        <>
          <div className="analytics-suggestion-box">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-palawan-100 text-palawan-700">
                <Sparkles size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900">
                  {period.charAt(0).toUpperCase() + period.slice(1)} summary
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{data.date_range.start} — {data.date_range.end}</p>
                <p className="mt-3 text-sm leading-relaxed text-slate-700">{data.narrative}</p>
              </div>
            </div>
          </div>

          {data.highlights.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {data.highlights.map((h, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2.5 rounded-3xl border px-4 py-3.5 text-sm ${
                    h.type === 'alert'
                      ? 'border-amber-100 bg-amber-50 text-amber-900'
                      : 'border-palawan-100 bg-palawan-50 text-palawan-900'
                  }`}
                >
                  {h.type === 'alert'
                    ? <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    : <Info size={16} className="mt-0.5 shrink-0" />}
                  <span>{h.message}</span>
                </div>
              ))}
            </div>
          )}

          <section>
            <p className="analytics-section-title">Period metrics</p>
            <p className="analytics-section-sub">Key figures for the selected period</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <AnalyticsFeatureCard
                icon={PhilippinePeso}
                title="Inventory Value"
                value={formatCurrency(data.metrics.inventory_value)}
                description="Total stock value on hand"
              />
              <AnalyticsFeatureCard
                icon={TrendingUp}
                title="Stock Out"
                value={String(data.metrics.stock_out)}
                description="Units issued this period"
              />
              <AnalyticsFeatureCard
                icon={ShoppingCart}
                title="Procurement Value"
                value={formatCurrency(data.metrics.procurement_value)}
                description="Purchase orders processed"
              />
              <AnalyticsFeatureCard
                icon={PieChart}
                title="Budget Utilization"
                value={`${data.metrics.budget_utilization_pct}%`}
                description="Allocated budget consumed"
              />
            </div>
          </section>
        </>
      )}

      {recommendations && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="analytics-section-title">Reorder recommendations</p>
            <p className="analytics-section-sub">AI-generated procurement suggestions</p>
            <ul className="mt-4 space-y-2">
              {(recommendations.procurement?.recommendations ?? []).slice(0, 5).map((r: { item_code: string; name: string; message: string; urgency: string }) => (
                <li key={r.item_code} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800">{r.name}</p>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      r.urgency === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {r.urgency}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{r.message}</p>
                </li>
              ))}
              {(recommendations.procurement?.recommendations ?? []).length === 0 && (
                <p className="py-8 text-center text-sm text-slate-400">All items are adequately stocked.</p>
              )}
            </ul>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
            <p className="analytics-section-title">Maintenance alerts</p>
            <p className="analytics-section-sub">Inspections and asset replacements</p>
            <ul className="mt-4 space-y-2">
              {(recommendations.maintenance?.recommendations ?? []).slice(0, 3).map((r: { property_number: string; message: string }) => (
                <li key={r.property_number} className="flex gap-2.5 rounded-2xl border border-amber-100 bg-amber-50 p-3.5 text-sm text-amber-900">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{r.message}</span>
                </li>
              ))}
              {(recommendations.asset_replacement?.recommendations ?? []).slice(0, 3).map((r: { property_number: string; reason: string }) => (
                <li key={r.property_number} className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5 text-sm text-slate-700">
                  <span className="font-semibold text-slate-900">{r.property_number}</span>
                  <span className="text-slate-500"> — {r.reason}</span>
                </li>
              ))}
              {(recommendations.maintenance?.recommendations ?? []).length === 0
                && (recommendations.asset_replacement?.recommendations ?? []).length === 0 && (
                <p className="py-8 text-center text-sm text-slate-400">No maintenance alerts at this time.</p>
              )}
            </ul>
          </div>
        </div>
      )}

      <AnalyticsSuggestionBox
        question="Want to explore the data or ask a follow-up?"
        actions={[
          { label: 'Ask AI Assistant', onClick: () => navigate('/analytics/ai-assistant') },
          { label: 'View KPIs', onClick: () => navigate('/analytics/kpis') },
        ]}
      />

      <div className="flex justify-center pb-2">
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
        >
          <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
          {isFetching ? 'Refreshing...' : 'Refresh summary'}
        </button>
      </div>
    </div>
  );
}
