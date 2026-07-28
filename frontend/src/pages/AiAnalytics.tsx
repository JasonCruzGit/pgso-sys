import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  PhilippinePeso, Package, AlertTriangle, PackageX, TrendingUp,
  RotateCcw, Archive, ArrowDownRight, Activity,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import {
  AnalyticsGlowRing, AnalyticsFeatureCard, AnalyticsItemCard, AnalyticsSuggestionBox,
} from '../components/analytics/AnalyticsUi';
import type { AiAnalyticsKpis } from '../types';

const tooltipStyle = {
  borderRadius: '16px',
  border: 'none',
  boxShadow: '0 4px 20px rgb(0 0 0 / 0.1)',
  fontSize: '12px',
};

function formatCurrency(n: number) {
  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function AiAnalytics() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const firstName = user?.name?.split(' ')[0] ?? 'there';

  const { data, isLoading } = useQuery({
    queryKey: ['ai-analytics'],
    queryFn: () => api.get('/ai/analytics').then((r) => r.data as AiAnalyticsKpis),
  });

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="flex flex-col items-center py-8">
          <div className="skeleton h-28 w-28 rounded-full" />
          <div className="skeleton mt-4 h-6 w-40 rounded-xl" />
          <div className="skeleton mt-2 h-4 w-56 rounded-xl" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-36 rounded-3xl" />)}
        </div>
        <div className="skeleton h-64 rounded-3xl" />
      </div>
    );
  }

  if (!data) return null;

  const procurementChart = (data.procurement_trends ?? []).map((t) => ({
    month: t.month,
    orders: t.count,
    amount: Number(t.amount),
  }));

  const stockHealthPct = data.total_stock_items > 0
    ? Math.round(((data.total_stock_items - data.low_stock_count - data.out_of_stock_count) / data.total_stock_items) * 100)
    : 100;

  return (
    <div className="space-y-6">
      <section className="flex flex-col items-center px-2 py-4 text-center sm:py-6">
        <AnalyticsGlowRing icon={Activity} />
        <p className="mt-5 text-sm text-slate-500">{getGreeting()}, {firstName}</p>
        <h2 className="mt-1 max-w-sm text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Your inventory at a glance
        </h2>
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-palawan-50 px-3 py-1 text-xs font-semibold text-palawan-700">
          <Activity size={14} />
          {stockHealthPct}% stock health
        </p>
      </section>

      <section>
        <p className="analytics-section-title">Key metrics</p>
        <p className="analytics-section-sub">Real-time inventory health and movement</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <AnalyticsFeatureCard
            icon={PhilippinePeso}
            title="Inventory Value"
            value={formatCurrency(data.inventory_value)}
            description="Total value of stock on hand"
          />
          <AnalyticsFeatureCard
            icon={Package}
            title="Total Stock Items"
            value={String(data.total_stock_items)}
            description="Unique items tracked in the system"
          />
          <AnalyticsFeatureCard
            icon={AlertTriangle}
            title="Low Stock"
            value={String(data.low_stock_count)}
            description={data.low_stock_count > 0 ? 'Items below reorder level' : 'All items above reorder level'}
          />
          <AnalyticsFeatureCard
            icon={PackageX}
            title="Out of Stock"
            value={String(data.out_of_stock_count)}
            description="Items needing immediate replenishment"
          />
        </div>
      </section>

      <section>
        <p className="analytics-section-title">Performance</p>
        <p className="analytics-section-sub">Utilization, turnover, and consumption</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <AnalyticsFeatureCard
            icon={TrendingUp}
            title="Asset Utilization"
            value={`${data.asset_utilization_rate}%`}
            description="Government property in active use"
          />
          <AnalyticsFeatureCard
            icon={RotateCcw}
            title="Turnover Ratio"
            value={String(data.inventory_turnover_ratio)}
            description="How quickly inventory moves"
          />
          <AnalyticsFeatureCard
            icon={Archive}
            title="Dead Stock Value"
            value={formatCurrency(data.dead_stock_value)}
            description="Slow-moving or idle inventory value"
          />
          <AnalyticsFeatureCard
            icon={ArrowDownRight}
            title="Monthly Consumption"
            value={String(data.monthly_consumption)}
            description="Units consumed this month"
          />
        </div>
      </section>

      {(data.fast_moving_items ?? []).length > 0 && (
        <section>
          <p className="analytics-section-title">Fast moving items</p>
          <p className="analytics-section-sub">Top consumed in the last 90 days</p>
          <div className="analytics-scroll-row mt-3">
            {(data.fast_moving_items ?? []).map((item, i) => (
              <AnalyticsItemCard
                key={item.item_code}
                rank={i + 1}
                title={item.name}
                highlight={`${item.total_out} units`}
                subtitle="Stock-out volume"
                meta={item.item_code}
              />
            ))}
          </div>
        </section>
      )}

      {(data.slow_moving_items ?? []).length > 0 && (
        <section>
          <p className="analytics-section-title">Slow moving items</p>
          <p className="analytics-section-sub">Lowest consumption in the last 90 days</p>
          <div className="analytics-scroll-row mt-3">
            {(data.slow_moving_items ?? []).map((item, i) => (
              <AnalyticsItemCard
                key={item.item_code}
                rank={i + 1}
                title={item.name}
                highlight={`${item.quantity} on hand`}
                subtitle={`${item.total_out ?? 0} units out`}
                meta={item.item_code}
              />
            ))}
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
        <p className="analytics-section-title">Procurement trends</p>
        <p className="analytics-section-sub">Purchase orders over the last 6 months</p>
        {procurementChart.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-400">No procurement data yet.</p>
        ) : (
          <div className="mt-4 rounded-2xl bg-gradient-to-b from-palawan-50/40 to-white p-2">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={procurementChart} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(0, 102, 51, 0.06)' }} />
                <Bar dataKey="orders" fill="url(#procurementGradient)" name="Orders" radius={[8, 8, 0, 0]} maxBarSize={40} />
                <defs>
                  <linearGradient id="procurementGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#16b364" />
                    <stop offset="100%" stopColor="#006633" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <AnalyticsSuggestionBox
        question="Need deeper insights or a summary for leadership?"
        actions={[
          { label: 'Ask AI Assistant', onClick: () => navigate('/analytics/ai-assistant') },
          { label: 'Executive Dashboard', onClick: () => navigate('/analytics/executive') },
        ]}
      />
    </div>
  );
}
