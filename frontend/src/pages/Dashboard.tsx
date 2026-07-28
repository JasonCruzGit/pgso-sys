import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Package, Boxes, AlertTriangle, PackageX,
  ArrowUpRight, Building2, Sparkles,
  Truck, QrCode, Activity, Calendar, Send, MessagesSquare,
  ShieldCheck, KeyRound, FileText, ClipboardList, ClipboardCheck, ScrollText,
} from 'lucide-react';
import api from '../api/client';
import DataTable from '../components/DataTable';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import Badge from '../components/Badge';
import type { IssuanceRequest } from '../types';
import { useAuth } from '../context/AuthContext';

const COLORS = ['#006633', '#16b364', '#4ade80', '#ca8a04', '#005229', '#34d37a'];

const tooltipStyle = {
  borderRadius: '12px',
  border: 'none',
  boxShadow: '0 4px 20px rgb(0 0 0 / 0.1)',
  fontSize: '12px',
};

type StockView = 'available' | 'low_stock' | 'out_of_stock';

interface StockItem {
  id: number;
  item_code: string;
  name: string;
  category?: string;
  quantity: number;
  unit_of_measure: string;
  reorder_level: number;
  unit_cost: number;
  total_value: number;
  storage_location?: string;
  stock_status: string;
}

const stockViewMeta: Record<StockView, { title: string; description: string; emptyTitle: string; emptyDescription: string }> = {
  available: {
    title: 'Available Stock',
    description: 'Supplies and property currently on hand',
    emptyTitle: 'No available stock',
    emptyDescription: 'All items are depleted or not yet recorded.',
  },
  low_stock: {
    title: 'Low Stock Items',
    description: 'Items at or below reorder level',
    emptyTitle: 'No low stock alerts',
    emptyDescription: 'All items are above their reorder thresholds.',
  },
  out_of_stock: {
    title: 'Out of Stock',
    description: 'Items that need immediate replenishment',
    emptyTitle: 'Nothing out of stock',
    emptyDescription: 'All recorded items have quantity on hand.',
  },
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatCurrency(n: number) {
  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatQty(n: number) {
  return Math.round(n).toLocaleString();
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="skeleton h-28 rounded-2xl" />
      <div className="skeleton h-14 rounded-xl" />
      <div className="skeleton h-12 rounded-xl" />
      <div className="skeleton h-72 rounded-2xl" />
    </div>
  );
}

function EmployeeDashboard({
  firstName,
  today,
  onNavigate,
  hasPermission,
}: {
  firstName: string;
  today: string;
  onNavigate: (to: string) => void;
  hasPermission: (p: string) => boolean;
}) {
  const { data: requests, isLoading } = useQuery({
    queryKey: ['employee-dashboard-requests'],
    queryFn: () => api.get('/issuance', { params: { page: 1, per_page: 5 } }).then((r) => r.data),
  });

  const actions = [
    { label: 'Request Items', desc: 'Browse and request supplies', icon: Send, to: '/catalog', permission: 'requests.create' },
    { label: 'My Assets', desc: 'Property issued to you', icon: QrCode, to: '/assets', permission: 'assets.view' },
    { label: 'Communications', desc: 'Messages and announcements', icon: MessagesSquare, to: '/communications', permission: 'messaging.view,messaging.send,messaging.*' },
    { label: 'AI Assistant', desc: 'Ask about requests and property', icon: Sparkles, to: '/analytics', permission: 'ai.chat,ai.view,ai.analytics,ai.*' },
  ].filter((a) => !a.permission || a.permission.split(',').some((p) => hasPermission(p.trim())));

  const recentRequests: IssuanceRequest[] = requests?.data ?? [];

  return (
    <div className="dashboard-shell space-y-4 md:space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-palawan-100 bg-gradient-to-br from-palawan-700 via-palawan-600 to-emerald-600 px-4 py-5 text-white shadow-lg shadow-palawan-900/10 sm:px-6">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative min-w-0">
          <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white/90 sm:text-xs">
            <Calendar size={12} /> <span className="truncate">{today}</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            {getGreeting()}, {firstName}
          </h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-white/85">
            Request supplies, track your requests, and view government property assigned to your department.
          </p>
        </div>
      </div>

      <section>
        <p className="text-sm font-bold text-slate-900">Quick actions</p>
        <p className="text-xs text-slate-500">What would you like to do?</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {actions.map(({ label, desc, icon: Icon, to }) => (
            <button
              key={to}
              type="button"
              onClick={() => onNavigate(to)}
              className="analytics-feature-card text-left transition active:scale-[0.99]"
            >
              <Icon size={20} className="text-palawan-600" strokeWidth={1.75} />
              <p className="mt-3 text-sm font-bold text-slate-900">{label}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{desc}</p>
            </button>
          ))}
        </div>
      </section>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900">My Requests</h3>
            <p className="text-xs text-slate-500">Recent supply requests</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/requests')}
            className="shrink-0 text-xs font-semibold text-palawan-700 hover:underline"
          >
            View all
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {isLoading && (
            <div className="space-y-2 p-4">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-14 rounded-xl" />)}
            </div>
          )}
          {!isLoading && recentRequests.length === 0 && (
            <div className="p-6 text-center">
              <p className="text-sm text-slate-500">No requests yet.</p>
              <button type="button" onClick={() => onNavigate('/catalog')} className="btn-primary mt-3 text-sm">
                Browse items
              </button>
            </div>
          )}
          {recentRequests.map((req) => (
            <button
              key={req.id}
              type="button"
              onClick={() => onNavigate('/requests')}
              className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-slate-50 sm:px-5"
            >
              <div className="min-w-0">
                <p className="truncate font-mono text-xs font-semibold text-palawan-700">{req.request_number}</p>
                <p className="mt-0.5 truncate text-sm text-slate-700">
                  {(req.items ?? []).slice(0, 2).map((i) => i.inventory_item?.name).filter(Boolean).join(', ') || 'Supply request'}
                </p>
              </div>
              <Badge status={req.status} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, hasPermission, isEmployee } = useAuth();
  const navigate = useNavigate();
  const [stockView, setStockView] = useState<StockView>('available');
  const stockSectionRef = useRef<HTMLDivElement>(null);

  const selectStockView = (view: StockView) => {
    setStockView(view);
    requestAnimationFrame(() => {
      stockSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard').then((r) => r.data),
    enabled: !isEmployee,
  });

  const firstName = user?.name?.split(' ')[0] ?? 'User';
  const today = new Date().toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' });

  if (isEmployee) {
    return (
      <EmployeeDashboard
        firstName={firstName}
        today={today}
        onNavigate={navigate}
        hasPermission={hasPermission}
      />
    );
  }

  if (isLoading) return <DashboardSkeleton />;

  const stats = data?.stats ?? {};
  const categories = data?.category_distribution ?? [];
  const stockItems = (data?.stock_items ?? {}) as Record<StockView, StockItem[]>;
  const activeStockList = stockItems[stockView] ?? [];
  const stockMeta = stockViewMeta[stockView];
  const alertItems = [...(stockItems.low_stock ?? []), ...(stockItems.out_of_stock ?? [])];
  const stockHealthPct = stats.total_items > 0
    ? Math.round(((Number(stats.total_items) - Number(stats.low_stock_alerts) - Number(stats.out_of_stock)) / Number(stats.total_items)) * 100)
    : 100;

  const workspaceModules = [
    { label: 'IPA', desc: 'Property accountability', icon: ShieldCheck, to: '/individual-property-accountability', permission: 'property.view,property.*,requests.release,issuance.*' },
    { label: 'PAR', desc: 'Property receipts', icon: KeyRound, to: '/par-records', permission: 'property.view,property.*,requests.release,issuance.*' },
    { label: 'ICS', desc: 'Custodian slips', icon: FileText, to: '/ics-records', permission: 'property.view,property.*,requests.release,issuance.*' },
    { label: 'Real Properties', desc: 'Master registry', icon: Building2, to: '/real-properties', permission: 'property.view,property.*' },
    { label: 'Temp. Certificate', desc: 'Transfer requests', icon: ScrollText, to: '/temporary-certificate', permission: 'property.view,property.*,requests.release,issuance.*' },
    { label: 'AIR', desc: 'Inspection reports', icon: ClipboardList, to: '/procurement/air', permission: 'procurement.view,procurement.view_own,procurement.create,procurement.*' },
    { label: 'MR Release', desc: 'Material release', icon: ClipboardCheck, to: '/procurement/mr-release', permission: 'requests.release,issuance.*' },
    { label: 'Stocks', desc: 'Inventory levels', icon: Package, to: '/inventory', permission: 'inventory.view' },
    { label: 'Fleet', desc: 'GPS & scheduling', icon: Truck, to: '/fleet', permission: 'fleet.view,fleet.*,fleet.schedule' },
    { label: 'Assets', desc: 'Tagged property', icon: QrCode, to: '/assets', permission: 'assets.view' },
  ].filter((m) => m.permission.split(',').some((p) => hasPermission(p.trim())));

  const summaryMetrics = [
    { label: 'Inventory Value', value: formatCurrency(Number(stats.inventory_value ?? 0)), icon: Package },
    { label: 'SKUs on Record', value: formatQty(Number(stats.total_items ?? 0)), icon: Boxes },
    { label: 'Low Stock', value: stats.low_stock_alerts ?? 0, icon: AlertTriangle, alert: Number(stats.low_stock_alerts) > 0, onClick: () => selectStockView('low_stock') },
    { label: 'Out of Stock', value: stats.out_of_stock ?? 0, icon: PackageX, alert: Number(stats.out_of_stock) > 0, onClick: () => selectStockView('out_of_stock') },
  ];

  return (
    <div className="dashboard-shell space-y-4 md:space-y-6">
      {/* Hero summary card */}
      <div className="relative overflow-hidden rounded-2xl border border-palawan-100 bg-gradient-to-br from-palawan-700 via-palawan-600 to-emerald-600 px-4 py-4 text-white shadow-lg shadow-palawan-900/10 sm:px-8 sm:py-6">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="relative min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] text-white/80 sm:gap-2 sm:text-xs">
            <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 font-medium sm:gap-1.5 sm:px-2.5 sm:py-1">
              <Calendar size={12} className="shrink-0" /> <span className="truncate">{today}</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 font-medium sm:gap-1.5 sm:px-2.5 sm:py-1">
              <Activity size={12} className="shrink-0" /> {stockHealthPct}% stock health
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight sm:text-3xl">
            {getGreeting()}, {firstName}
          </h1>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-white/85 sm:mt-2">
            Property accountability, procurement workflow, and provincial inventory in one place.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summaryMetrics.map(({ label, value, icon: Icon, alert, onClick }) => {
          const Tag = onClick ? 'button' : 'div';
          return (
            <Tag
              key={label}
              type={onClick ? 'button' : undefined}
              onClick={onClick}
              className={`rounded-xl border bg-white px-4 py-3 text-left shadow-sm transition ${
                onClick ? 'cursor-pointer hover:border-palawan-200 hover:shadow-md' : ''
              } ${alert ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-slate-500">{label}</p>
                <Icon size={16} className={alert ? 'text-amber-600' : 'text-palawan-600'} />
              </div>
              <p className={`mt-1 text-xl font-bold tabular-nums ${alert ? 'text-amber-800' : 'text-slate-900'}`}>
                {value}
              </p>
            </Tag>
          );
        })}
      </div>

      {workspaceModules.length > 0 && (
        <section>
          <p className="text-sm font-bold text-slate-900">Operations</p>
          <p className="text-xs text-slate-500">Jump to a module</p>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {workspaceModules.map(({ label, desc, icon: Icon, to }) => (
              <button
                key={to}
                type="button"
                onClick={() => navigate(to)}
                className="flex min-w-[9.5rem] shrink-0 flex-col rounded-xl border border-slate-200 bg-white px-3 py-3 text-left shadow-sm transition hover:border-palawan-200 hover:bg-palawan-50/30"
              >
                <Icon size={18} className="text-palawan-700" strokeWidth={1.75} />
                <p className="mt-2 text-sm font-semibold text-slate-900">{label}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">{desc}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Stock table */}
      <div ref={stockSectionRef} className="card min-w-0 max-w-full scroll-mt-24 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900">{stockMeta.title}</h3>
            <p className="text-sm text-slate-500">{stockMeta.description}</p>
          </div>
          <div className="dashboard-stock-tabs min-w-0">
            <div className="dashboard-stock-tabs-track">
              {(Object.keys(stockViewMeta) as StockView[]).map((view) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => selectStockView(view)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition sm:px-3.5 sm:text-sm ${
                    stockView === view
                      ? 'bg-palawan-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {view === 'available' ? 'Available' : view === 'low_stock' ? 'Low Stock' : 'Out of Stock'}
                  <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    stockView === view ? 'bg-white/20' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {stockItems[view]?.length ?? 0}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="p-1">
          <DataTable<StockItem>
            data={activeStockList}
            emptyTitle={stockMeta.emptyTitle}
            emptyDescription={stockMeta.emptyDescription}
            columns={[
              { key: 'item_code', label: 'Code', hideOnMobile: true, render: (r) => <span className="font-mono text-xs font-semibold text-palawan-700">{r.item_code}</span> },
              { key: 'name', label: 'Item', mobilePrimary: true, render: (r) => <span className="font-medium text-slate-900">{r.name}</span> },
              { key: 'category', label: 'Category', hideOnMobile: true, render: (r) => r.category ?? '—' },
              { key: 'quantity', label: 'On Hand', render: (r) => (
                <span className={
                  r.stock_status === 'out_of_stock' ? 'font-semibold text-red-600'
                    : r.stock_status === 'low_stock' ? 'font-semibold text-amber-600'
                      : 'font-semibold text-emerald-700'
                }>
                  {formatQty(r.quantity)}
                </span>
              )},
              { key: 'unit_of_measure', label: 'Unit', render: (r) => <span className="text-slate-600">{r.unit_of_measure}</span> },
              { key: 'reorder_level', label: 'Reorder At', hideOnMobile: true, render: (r) => formatQty(r.reorder_level) },
              { key: 'unit_cost', label: 'Unit Cost', hideOnMobile: true, render: (r) => formatCurrency(r.unit_cost) },
              { key: 'total_value', label: 'Value', hideOnMobile: true, render: (r) => formatCurrency(r.total_value) },
              { key: 'storage_location', label: 'Location', hideOnMobile: true, render: (r) => r.storage_location ?? '—' },
              { key: 'stock_status', label: 'Status', render: (r) => <Badge status={r.stock_status} /> },
            ]}
          />
        </div>
      </div>

      {/* Insights row — desktop/tablet only to avoid chart overflow on phones */}
      <div className="hidden min-w-0 gap-4 md:grid lg:grid-cols-12">
        <Card title="Category Distribution" subtitle="Items by classification" className="min-w-0 lg:col-span-4">
          {categories.length > 0 ? (
            <div className="h-[220px] w-full min-w-0 max-w-full overflow-hidden">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie data={categories} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={78} paddingAngle={3}>
                    {categories.map((_: unknown, i: number) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="white" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState icon={Package} title="No categories" description="Add inventory to see distribution." />
          )}
        </Card>

        <div className="card min-w-0 p-5 lg:col-span-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">Stock Alerts</h3>
              <p className="text-xs text-slate-500">{alertItems.length} items need attention</p>
            </div>
            <button type="button" onClick={() => navigate('/inventory')} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <ArrowUpRight size={16} />
            </button>
          </div>
          <div className="mt-4 max-h-52 space-y-2 overflow-y-auto">
            {alertItems.length > 0 ? (
              alertItems.slice(0, 6).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectStockView(item.stock_status === 'out_of_stock' ? 'out_of_stock' : 'low_stock')}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-left text-sm transition hover:border-palawan-100 hover:bg-palawan-50/50"
                >
                  <span className="min-w-0 truncate font-medium text-slate-800">{item.name}</span>
                  <Badge status={item.stock_status} />
                </button>
              ))
            ) : (
              <div className="flex flex-col items-center py-6 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <Boxes size={18} />
                </div>
                <p className="mt-2 text-sm font-medium text-slate-700">All stocked</p>
                <p className="text-xs text-slate-400">No alerts at this time</p>
              </div>
            )}
          </div>
        </div>

        <div className="card min-w-0 p-5 lg:col-span-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">Recent Activity</h3>
              <p className="text-xs text-slate-500">Latest inventory transactions</p>
            </div>
          </div>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {(data?.recent_transactions ?? []).length > 0 ? (
              (data?.recent_transactions ?? []).slice(0, 8).map((tx: { type: string; reference: string; description: string; date: string }, i: number) => (
                <div key={tx.reference + i} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2.5">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-palawan-700 ring-1 ring-slate-100">
                    {tx.type === 'receiving' ? <Truck size={14} /> : <Package size={14} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-semibold text-slate-800">{tx.reference}</span>
                      <Badge status={tx.type} />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-600">{tx.description}</p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {new Date(tx.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState icon={Activity} title="No recent activity" description="Transactions will appear here." />
            )}
          </div>
        </div>
      </div>

      {/* Mobile insights summary */}
      <div className="grid min-w-0 gap-3 md:hidden">
        <div className="card p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-900">Stock Alerts</h3>
              <p className="text-xs text-slate-500">{alertItems.length} items need attention</p>
            </div>
            <button type="button" onClick={() => navigate('/inventory')} className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <ArrowUpRight size={16} />
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {alertItems.length > 0 ? (
              alertItems.slice(0, 4).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectStockView(item.stock_status === 'out_of_stock' ? 'out_of_stock' : 'low_stock')}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-left text-sm transition hover:border-palawan-100 hover:bg-palawan-50/50"
                >
                  <span className="min-w-0 truncate font-medium text-slate-800">{item.name}</span>
                  <Badge status={item.stock_status} />
                </button>
              ))
            ) : (
              <p className="py-2 text-center text-sm text-slate-500">All stocked — no alerts right now.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
