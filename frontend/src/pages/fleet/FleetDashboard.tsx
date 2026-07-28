import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Truck, MapPinned, RadioTower, Wrench, Navigation, CalendarClock } from 'lucide-react';
import api from '../../api/client';
import PageHeader from '../../components/PageHeader';
import Badge from '../../components/Badge';
import type { FleetDashboardStats } from '../../types';

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number | string;
  icon: typeof Truck;
  tone: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div className={`rounded-xl p-2.5 ${tone}`}>
          <Icon size={20} />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

export default function FleetDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['fleet-dashboard'],
    queryFn: () => api.get('/fleet/dashboard').then((r) => r.data as FleetDashboardStats),
    refetchInterval: 30000,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fleet Dashboard"
        description="GPS tracking overview and upcoming vehicle schedules"
        action={(
          <div className="flex flex-wrap gap-2">
            <Link to="/fleet/map" className="btn-secondary">
              <MapPinned size={16} /> Live Map
            </Link>
            <Link to="/fleet/schedules" className="btn-primary">
              <CalendarClock size={16} /> Schedules
            </Link>
          </div>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total Vehicles" value={isLoading ? '—' : (data?.total_vehicles ?? 0)} icon={Truck} tone="bg-palawan-50 text-palawan-700" />
        <StatCard label="Active Trips" value={isLoading ? '—' : (data?.active_trips ?? 0)} icon={Navigation} tone="bg-emerald-50 text-emerald-700" />
        <StatCard label="Idle / Parked" value={isLoading ? '—' : (data?.idle_vehicles ?? 0)} icon={Truck} tone="bg-sky-50 text-sky-700" />
        <StatCard label="Offline GPS" value={isLoading ? '—' : (data?.offline_gps ?? 0)} icon={RadioTower} tone="bg-amber-50 text-amber-700" />
        <StatCard label="Moving" value={isLoading ? '—' : (data?.moving_vehicles ?? 0)} icon={MapPinned} tone="bg-indigo-50 text-indigo-700" />
        <StatCard label="Under Maintenance" value={isLoading ? '—' : (data?.under_maintenance ?? 0)} icon={Wrench} tone="bg-slate-100 text-slate-600" />
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Upcoming Scheduled Trips</h2>
          <p className="text-sm text-slate-500">Next approved / scheduled dispatches</p>
        </div>
        <div className="divide-y divide-slate-100">
          {(data?.upcoming_schedules ?? []).length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-slate-500">No upcoming schedules.</p>
          ) : (
            (data?.upcoming_schedules ?? []).map((s) => (
              <div key={s.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-mono text-xs font-semibold text-palawan-700">{s.schedule_number}</p>
                  <p className="font-medium text-slate-900">{s.vehicle?.plate_number} · {s.destination}</p>
                  <p className="text-xs text-slate-500">
                    {s.department?.name} · {s.driver?.name ?? 'No driver'} · {new Date(s.departure_at).toLocaleString('en-PH')}
                  </p>
                </div>
                <Badge status={s.status} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
