import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import api from '../../api/client';
import PageHeader from '../../components/PageHeader';
import Badge from '../../components/Badge';
import type { FleetSchedule } from '../../types';
import toast from 'react-hot-toast';

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function FleetReports() {
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const { data, isLoading } = useQuery({
    queryKey: ['fleet-reports', from, to],
    queryFn: () => api.get('/fleet/reports', { params: { from, to } }).then((r) => r.data as {
      by_status: Record<string, number>;
      by_department: Record<string, number>;
      utilization: Array<{ vehicle?: { plate_number: string; name: string }; trips: number; completed: number }>;
      driver_history: Array<{ driver?: { name: string; employee_id?: string }; assignments: number }>;
      upcoming: FleetSchedule[];
      completed: FleetSchedule[];
      cancelled: FleetSchedule[];
    }),
  });

  const statusRows = useMemo(() => Object.entries(data?.by_status ?? {}), [data]);

  const exportUtil = () => {
    if (!data) return;
    downloadCsv(`fleet-utilization-${from}-${to}.csv`, [
      ['Plate', 'Name', 'Trips', 'Completed'],
      ...data.utilization.map((u) => [
        u.vehicle?.plate_number ?? '',
        u.vehicle?.name ?? '',
        String(u.trips),
        String(u.completed),
      ]),
    ]);
    toast.success('CSV exported');
  };

  const exportCompleted = () => {
    if (!data) return;
    downloadCsv(`fleet-completed-${from}-${to}.csv`, [
      ['Schedule No.', 'Plate', 'Destination', 'Department', 'Departure', 'Return'],
      ...data.completed.map((s) => [
        s.schedule_number,
        s.vehicle?.plate_number ?? '',
        s.destination,
        s.department?.name ?? '',
        s.departure_at,
        s.actual_return_at ?? s.expected_return_at,
      ]),
    ]);
    toast.success('CSV exported');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fleet Reports"
        description="Utilization, trip history, and department usage analytics"
        action={(
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={exportUtil}><Download size={16} /> Utilization CSV</button>
            <button type="button" className="btn-secondary" onClick={exportCompleted}><Download size={16} /> Completed CSV</button>
          </div>
        )}
      />

      <div className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 sm:items-end">
        <div>
          <label className="mb-1.5 block text-sm font-medium">From</label>
          <input type="date" className="input-field w-full" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">To</label>
          <input type="date" className="input-field w-full" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading reports…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {statusRows.map(([status, count]) => (
              <div key={status} className="card p-4">
                <Badge status={status} />
                <p className="mt-2 text-2xl font-bold text-slate-900">{count}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card p-4">
              <h3 className="mb-3 font-semibold text-slate-900">Vehicle Utilization</h3>
              <div className="space-y-2">
                {(data?.utilization ?? []).map((u, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                    <span>{u.vehicle?.plate_number} — {u.vehicle?.name}</span>
                    <span className="font-semibold">{u.completed}/{u.trips} trips</span>
                  </div>
                ))}
                {(data?.utilization ?? []).length === 0 && <p className="text-sm text-slate-500">No utilization data.</p>}
              </div>
            </div>

            <div className="card p-4">
              <h3 className="mb-3 font-semibold text-slate-900">Usage by Department</h3>
              <div className="space-y-2">
                {Object.entries(data?.by_department ?? {}).map(([dept, count]) => (
                  <div key={dept} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                    <span>{dept}</span>
                    <span className="font-semibold">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-4">
              <h3 className="mb-3 font-semibold text-slate-900">Driver Assignment History</h3>
              <div className="space-y-2">
                {(data?.driver_history ?? []).map((d, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
                    <span>{d.driver?.name} {d.driver?.employee_id ? `(${d.driver.employee_id})` : ''}</span>
                    <span className="font-semibold">{d.assignments}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-4">
              <h3 className="mb-3 font-semibold text-slate-900">Upcoming Schedules</h3>
              <div className="space-y-2">
                {(data?.upcoming ?? []).map((s) => (
                  <div key={s.id} className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
                    <p className="font-medium">{s.vehicle?.plate_number} · {s.destination}</p>
                    <p className="text-xs text-slate-500">{new Date(s.departure_at).toLocaleString('en-PH')}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-3 font-semibold">Cancelled Trips</div>
            <div className="divide-y divide-slate-100">
              {(data?.cancelled ?? []).length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-500">No cancelled trips in range.</p>
              ) : (data?.cancelled ?? []).map((s) => (
                <div key={s.id} className="px-4 py-3 text-sm">
                  <p className="font-medium">{s.schedule_number} · {s.vehicle?.plate_number}</p>
                  <p className="text-slate-500">{s.destination} · {s.department?.name}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
