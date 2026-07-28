import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Search, X } from 'lucide-react';
import api from '../../api/client';
import PageHeader from '../../components/PageHeader';
import DataTable from '../../components/DataTable';
import Pagination from '../../components/Pagination';
import Badge from '../../components/Badge';
import { useAuth } from '../../context/AuthContext';
import type { FleetVehicle } from '../../types';
import toast from 'react-hot-toast';

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function docBadge(status?: string | null) {
  if (!status) return <span className="text-slate-400">—</span>;
  return <Badge status={status} />;
}

type RegForm = {
  cr_number: string;
  or_number: string;
  mv_file_number: string;
  registration_issued_at: string;
  registration_expiry: string;
  registration_status: string;
  engine_number: string;
  chassis_number: string;
  registration_classification: string;
  registration_series: string;
  registration_gross_weight: string;
  registration_net_weight: string;
  registration_piston_displacement: string;
  registration_lto_office: string;
  registration_owner_name: string;
};

const emptyReg = (): RegForm => ({
  cr_number: '',
  or_number: '',
  mv_file_number: '',
  registration_issued_at: '',
  registration_expiry: '',
  registration_status: '',
  engine_number: '',
  chassis_number: '',
  registration_classification: '',
  registration_series: '',
  registration_gross_weight: '',
  registration_net_weight: '',
  registration_piston_displacement: '',
  registration_lto_office: '',
  registration_owner_name: '',
});

function toPayload(form: RegForm) {
  return {
    cr_number: form.cr_number.trim() || null,
    or_number: form.or_number.trim() || null,
    mv_file_number: form.mv_file_number.trim() || null,
    registration_issued_at: form.registration_issued_at || null,
    registration_expiry: form.registration_expiry || null,
    registration_status: form.registration_status || null,
    engine_number: form.engine_number.trim() || null,
    chassis_number: form.chassis_number.trim() || null,
    registration_classification: form.registration_classification.trim() || null,
    registration_series: form.registration_series.trim() || null,
    registration_gross_weight: form.registration_gross_weight ? Number(form.registration_gross_weight) : null,
    registration_net_weight: form.registration_net_weight ? Number(form.registration_net_weight) : null,
    registration_piston_displacement: form.registration_piston_displacement.trim() || null,
    registration_lto_office: form.registration_lto_office.trim() || null,
    registration_owner_name: form.registration_owner_name.trim() || null,
  };
}

export default function FleetRegistration() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('fleet.*') || hasPermission('fleet.manage');
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<FleetVehicle | null>(null);
  const [form, setForm] = useState<RegForm>(emptyReg());

  const { data, isLoading } = useQuery({
    queryKey: ['fleet-vehicles', page, search, 'registration'],
    queryFn: () => api.get('/fleet/vehicles', {
      params: { page, per_page: 25, ...(search.trim() ? { search: search.trim() } : {}) },
    }).then((r) => r.data),
  });

  const vehicles = (data?.data ?? []) as FleetVehicle[];

  const summary = useMemo(() => {
    const rows = vehicles;
    return {
      valid: rows.filter((v) => v.registration_status === 'valid').length,
      expiring: rows.filter((v) => v.registration_status === 'expiring').length,
      expired: rows.filter((v) => v.registration_status === 'expired').length,
      pending: rows.filter((v) => !v.registration_status || v.registration_status === 'pending').length,
    };
  }, [vehicles]);

  const save = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error('No vehicle selected');
      return api.put(`/fleet/vehicles/${editing.id}`, toPayload(form));
    },
    onSuccess: () => {
      toast.success('Vehicle registration updated');
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['fleet-vehicles'] });
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e.response?.data?.message ?? 'Failed to update registration');
    },
  });

  const openEdit = (vehicle: FleetVehicle) => {
    setEditing(vehicle);
    setForm({
      cr_number: vehicle.cr_number ?? '',
      or_number: vehicle.or_number ?? '',
      mv_file_number: vehicle.mv_file_number ?? '',
      registration_issued_at: vehicle.registration_issued_at?.slice(0, 10) ?? '',
      registration_expiry: vehicle.registration_expiry?.slice(0, 10) ?? '',
      registration_status: vehicle.registration_status ?? '',
      engine_number: vehicle.engine_number ?? '',
      chassis_number: vehicle.chassis_number ?? '',
      registration_classification: vehicle.registration_classification ?? 'Government',
      registration_series: vehicle.registration_series ?? '',
      registration_gross_weight: vehicle.registration_gross_weight != null ? String(vehicle.registration_gross_weight) : '',
      registration_net_weight: vehicle.registration_net_weight != null ? String(vehicle.registration_net_weight) : '',
      registration_piston_displacement: vehicle.registration_piston_displacement ?? '',
      registration_lto_office: vehicle.registration_lto_office ?? '',
      registration_owner_name: vehicle.registration_owner_name ?? 'Provincial Government of Palawan',
    });
  };

  const set = <K extends keyof RegForm>(key: K, value: RegForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Vehicle Registration"
        description="LTO vehicle registration — CR / OR, engine & chassis, weights, and expiry"
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Valid', summary.valid, 'text-emerald-700 bg-emerald-50'],
          ['Expiring soon', summary.expiring, 'text-amber-700 bg-amber-50'],
          ['Expired', summary.expired, 'text-rose-700 bg-rose-50'],
          ['Pending', summary.pending, 'text-slate-600 bg-slate-50'],
        ].map(([label, value, tone]) => (
          <div key={label as string} className={`rounded-xl px-4 py-3 ${tone}`}>
            <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</p>
            <p className="mt-1 text-2xl font-bold">{value as number}</p>
          </div>
        ))}
      </div>

      <div className="card p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            className="input-field w-full !pl-10"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search plate, CR / OR, engine, chassis, LTO office..."
          />
        </div>
      </div>

      <DataTable<FleetVehicle>
        loading={isLoading}
        data={vehicles}
        emptyTitle="No vehicles"
        emptyDescription="Add fleet vehicles first, then record their LTO registration here."
        columns={[
          { key: 'plate_number', label: 'Plate', render: (r) => <span className="font-mono text-xs font-semibold text-palawan-700">{r.plate_number}</span> },
          { key: 'name', label: 'Vehicle', render: (r) => (
            <div>
              <p className="font-medium text-slate-900">{r.name}</p>
              <p className="text-xs text-slate-500 capitalize">{r.vehicle_type}{r.registration_classification ? ` · ${r.registration_classification}` : ''}</p>
            </div>
          ) },
          { key: 'cr_number', label: 'CR No.', render: (r) => r.cr_number || '—' },
          { key: 'or_number', label: 'OR No.', render: (r) => r.or_number || '—' },
          { key: 'engine_number', label: 'Engine No.', render: (r) => <span className="font-mono text-xs">{r.engine_number || '—'}</span> },
          { key: 'chassis_number', label: 'Chassis No.', render: (r) => <span className="font-mono text-xs">{r.chassis_number || '—'}</span> },
          { key: 'registration_issued_at', label: 'Issued', render: (r) => formatDate(r.registration_issued_at) },
          { key: 'registration_expiry', label: 'Expiry', render: (r) => formatDate(r.registration_expiry) },
          { key: 'registration_lto_office', label: 'LTO Office', render: (r) => r.registration_lto_office || '—' },
          { key: 'registration_status', label: 'Status', render: (r) => docBadge(r.registration_status) },
          ...(canManage ? [{
            key: 'actions',
            label: '',
            render: (r: FleetVehicle) => (
              <button type="button" className="btn-ghost text-sm" onClick={() => openEdit(r)}>
                <Pencil size={14} /> Edit
              </button>
            ),
          }] : []),
        ]}
      />
      <Pagination currentPage={data?.current_page ?? 1} lastPage={data?.last_page ?? 1} onPageChange={setPage} />

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
          <div className="card-elevated max-h-[95vh] w-full max-w-3xl overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold">Update Vehicle Registration</h2>
                <p className="text-sm text-slate-500">{editing.plate_number} · {editing.name}</p>
              </div>
              <button type="button" onClick={() => setEditing(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            <form
              className="space-y-5 px-5 py-4"
              onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
            >
              <section>
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Registration documents</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">CR Number</label>
                    <input className="input-field w-full" value={form.cr_number} onChange={(e) => set('cr_number', e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">OR Number</label>
                    <input className="input-field w-full" value={form.or_number} onChange={(e) => set('or_number', e.target.value)} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium">MV File Number</label>
                    <input className="input-field w-full" value={form.mv_file_number} onChange={(e) => set('mv_file_number', e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Date Issued</label>
                    <input type="date" className="input-field w-full" value={form.registration_issued_at} onChange={(e) => set('registration_issued_at', e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Registration Expiry</label>
                    <input type="date" className="input-field w-full" value={form.registration_expiry} onChange={(e) => set('registration_expiry', e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Classification</label>
                    <select className="input-field w-full" value={form.registration_classification} onChange={(e) => set('registration_classification', e.target.value)}>
                      <option value="">Select</option>
                      <option value="Government">Government</option>
                      <option value="Private">Private</option>
                      <option value="For Hire">For Hire</option>
                      <option value="Diplomatic">Diplomatic</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Series / Denomination</label>
                    <input className="input-field w-full" value={form.registration_series} onChange={(e) => set('registration_series', e.target.value)} placeholder="e.g. UV, Truck, Car" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">LTO Office</label>
                    <input className="input-field w-full" value={form.registration_lto_office} onChange={(e) => set('registration_lto_office', e.target.value)} placeholder="e.g. LTO Puerto Princesa" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Status</label>
                    <select className="input-field w-full" value={form.registration_status} onChange={(e) => set('registration_status', e.target.value)}>
                      <option value="">Auto from expiry</option>
                      <option value="valid">Valid</option>
                      <option value="expiring">Expiring</option>
                      <option value="expired">Expired</option>
                      <option value="pending">Pending</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium">Registered Owner</label>
                    <input className="input-field w-full" value={form.registration_owner_name} onChange={(e) => set('registration_owner_name', e.target.value)} />
                  </div>
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Vehicle identification</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Engine Number</label>
                    <input className="input-field w-full font-mono" value={form.engine_number} onChange={(e) => set('engine_number', e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Chassis Number</label>
                    <input className="input-field w-full font-mono" value={form.chassis_number} onChange={(e) => set('chassis_number', e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Gross Weight (kg)</label>
                    <input type="number" min="0" step="0.01" className="input-field w-full" value={form.registration_gross_weight} onChange={(e) => set('registration_gross_weight', e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Net Weight (kg)</label>
                    <input type="number" min="0" step="0.01" className="input-field w-full" value={form.registration_net_weight} onChange={(e) => set('registration_net_weight', e.target.value)} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium">Piston Displacement</label>
                    <input className="input-field w-full" value={form.registration_piston_displacement} onChange={(e) => set('registration_piston_displacement', e.target.value)} placeholder="e.g. 1496 cc" />
                  </div>
                </div>
              </section>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={save.isPending}>
                  {save.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
