import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Search, X } from 'lucide-react';
import api from '../../api/client';
import PageHeader from '../../components/PageHeader';
import DataTable from '../../components/DataTable';
import Pagination from '../../components/Pagination';
import Badge from '../../components/Badge';
import { useAuth } from '../../context/AuthContext';
import type { Department } from '../../types';
import toast from 'react-hot-toast';

type FleetDriver = {
  id: number;
  name: string;
  email?: string;
  employee_id?: string | null;
  phone?: string | null;
  department?: Department | null;
  driver_license_number?: string | null;
  driver_license_type?: string | null;
  driver_license_expiry?: string | null;
  driver_license_status?: string | null;
  driver_license_issued_at?: string | null;
  driver_license_restrictions?: string | null;
  driver_license_conditions?: string | null;
  driver_license_blood_type?: string | null;
  driver_license_date_of_birth?: string | null;
  driver_license_sex?: string | null;
  driver_license_nationality?: string | null;
  driver_license_address?: string | null;
  driver_license_agency_code?: string | null;
  assigned_vehicles?: Array<{ id: number; plate_number: string; name: string }>;
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function docBadge(status?: string | null) {
  if (!status) return <span className="text-slate-400">—</span>;
  return <Badge status={status} />;
}

type LicenseForm = {
  driver_license_number: string;
  driver_license_type: string;
  driver_license_issued_at: string;
  driver_license_expiry: string;
  driver_license_status: string;
  driver_license_restrictions: string;
  driver_license_conditions: string;
  driver_license_blood_type: string;
  driver_license_date_of_birth: string;
  driver_license_sex: string;
  driver_license_nationality: string;
  driver_license_address: string;
  driver_license_agency_code: string;
};

const emptyForm = (): LicenseForm => ({
  driver_license_number: '',
  driver_license_type: '',
  driver_license_issued_at: '',
  driver_license_expiry: '',
  driver_license_status: '',
  driver_license_restrictions: '',
  driver_license_conditions: '',
  driver_license_blood_type: '',
  driver_license_date_of_birth: '',
  driver_license_sex: '',
  driver_license_nationality: '',
  driver_license_address: '',
  driver_license_agency_code: '',
});

function toPayload(form: LicenseForm) {
  return {
    driver_license_number: form.driver_license_number.trim() || null,
    driver_license_type: form.driver_license_type.trim() || null,
    driver_license_issued_at: form.driver_license_issued_at || null,
    driver_license_expiry: form.driver_license_expiry || null,
    driver_license_status: form.driver_license_status || null,
    driver_license_restrictions: form.driver_license_restrictions.trim() || null,
    driver_license_conditions: form.driver_license_conditions.trim() || null,
    driver_license_blood_type: form.driver_license_blood_type.trim() || null,
    driver_license_date_of_birth: form.driver_license_date_of_birth || null,
    driver_license_sex: form.driver_license_sex.trim() || null,
    driver_license_nationality: form.driver_license_nationality.trim() || null,
    driver_license_address: form.driver_license_address.trim() || null,
    driver_license_agency_code: form.driver_license_agency_code.trim() || null,
  };
}

export default function FleetDriversLicense() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('fleet.*') || hasPermission('fleet.manage');
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<FleetDriver | null>(null);
  const [form, setForm] = useState<LicenseForm>(emptyForm());

  const { data, isLoading } = useQuery({
    queryKey: ['fleet-drivers', page, search],
    queryFn: () => api.get('/fleet/drivers', {
      params: { page, per_page: 25, ...(search.trim() ? { search: search.trim() } : {}) },
    }).then((r) => r.data),
  });

  const drivers = (data?.data ?? []) as FleetDriver[];

  const summary = useMemo(() => ({
    valid: drivers.filter((d) => d.driver_license_status === 'valid').length,
    expiring: drivers.filter((d) => d.driver_license_status === 'expiring').length,
    expired: drivers.filter((d) => d.driver_license_status === 'expired').length,
    pending: drivers.filter((d) => !d.driver_license_status || d.driver_license_status === 'pending').length,
  }), [drivers]);

  const save = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error('No driver selected');
      return api.put(`/fleet/drivers/${editing.id}`, toPayload(form));
    },
    onSuccess: () => {
      toast.success("Driver's license updated");
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['fleet-drivers'] });
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e.response?.data?.message ?? "Failed to update driver's license");
    },
  });

  const openEdit = (driver: FleetDriver) => {
    setEditing(driver);
    setForm({
      driver_license_number: driver.driver_license_number ?? '',
      driver_license_type: driver.driver_license_type ?? '',
      driver_license_issued_at: driver.driver_license_issued_at?.slice(0, 10) ?? '',
      driver_license_expiry: driver.driver_license_expiry?.slice(0, 10) ?? '',
      driver_license_status: driver.driver_license_status ?? '',
      driver_license_restrictions: driver.driver_license_restrictions ?? '',
      driver_license_conditions: driver.driver_license_conditions ?? '',
      driver_license_blood_type: driver.driver_license_blood_type ?? '',
      driver_license_date_of_birth: driver.driver_license_date_of_birth?.slice(0, 10) ?? '',
      driver_license_sex: driver.driver_license_sex ?? '',
      driver_license_nationality: driver.driver_license_nationality ?? 'Filipino',
      driver_license_address: driver.driver_license_address ?? '',
      driver_license_agency_code: driver.driver_license_agency_code ?? '',
    });
  };

  const set = <K extends keyof LicenseForm>(key: K, value: LicenseForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Driver's License Registration"
        description="Track LTO driver's license details for assigned fleet drivers"
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
            placeholder="Search driver, license no., restrictions, LTO office..."
          />
        </div>
      </div>

      <DataTable<FleetDriver>
        loading={isLoading}
        data={drivers}
        emptyTitle="No drivers found"
        emptyDescription="Assign drivers to fleet vehicles to manage their license registration here."
        columns={[
          {
            key: 'name',
            label: 'Driver',
            render: (r) => (
              <div>
                <p className="font-medium text-slate-900">{r.name}</p>
                <p className="text-xs text-slate-500">{r.employee_id || r.email || '—'}</p>
              </div>
            ),
          },
          { key: 'department', label: 'Office', render: (r) => r.department?.name ?? '—' },
          {
            key: 'assigned_vehicles',
            label: 'Assigned Vehicle',
            render: (r) => (r.assigned_vehicles?.length
              ? r.assigned_vehicles.map((v) => v.plate_number).join(', ')
              : '—'),
          },
          { key: 'driver_license_number', label: 'License No.', render: (r) => (
            <span className="font-mono text-xs">{r.driver_license_number || '—'}</span>
          ) },
          { key: 'driver_license_type', label: 'Type', render: (r) => r.driver_license_type || '—' },
          { key: 'driver_license_restrictions', label: 'Restrictions', render: (r) => r.driver_license_restrictions || '—' },
          { key: 'driver_license_blood_type', label: 'Blood Type', render: (r) => r.driver_license_blood_type || '—' },
          { key: 'driver_license_issued_at', label: 'Issued', render: (r) => formatDate(r.driver_license_issued_at) },
          { key: 'driver_license_expiry', label: 'Expiry', render: (r) => formatDate(r.driver_license_expiry) },
          { key: 'driver_license_agency_code', label: 'LTO Office', render: (r) => r.driver_license_agency_code || '—' },
          { key: 'driver_license_status', label: 'Status', render: (r) => docBadge(r.driver_license_status) },
          ...(canManage ? [{
            key: 'actions',
            label: '',
            render: (r: FleetDriver) => (
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
                <h2 className="text-lg font-bold">Update Driver&apos;s License</h2>
                <p className="text-sm text-slate-500">{editing.name}</p>
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
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">License details</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">License Number</label>
                    <input className="input-field w-full font-mono" value={form.driver_license_number} onChange={(e) => set('driver_license_number', e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">License Type / Classification</label>
                    <input className="input-field w-full" value={form.driver_license_type} onChange={(e) => set('driver_license_type', e.target.value)} placeholder="e.g. Non-Professional, Professional B" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Date Issued</label>
                    <input type="date" className="input-field w-full" value={form.driver_license_issued_at} onChange={(e) => set('driver_license_issued_at', e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Expiry Date</label>
                    <input type="date" className="input-field w-full" value={form.driver_license_expiry} onChange={(e) => set('driver_license_expiry', e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Restriction Codes</label>
                    <input className="input-field w-full" value={form.driver_license_restrictions} onChange={(e) => set('driver_license_restrictions', e.target.value)} placeholder="e.g. 1, 2 / A, B" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Conditions</label>
                    <input className="input-field w-full" value={form.driver_license_conditions} onChange={(e) => set('driver_license_conditions', e.target.value)} placeholder="e.g. A — Corrective lenses" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">LTO Agency / Office Code</label>
                    <input className="input-field w-full" value={form.driver_license_agency_code} onChange={(e) => set('driver_license_agency_code', e.target.value)} placeholder="e.g. LTO Puerto Princesa" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Status</label>
                    <select className="input-field w-full" value={form.driver_license_status} onChange={(e) => set('driver_license_status', e.target.value)}>
                      <option value="">Auto from expiry</option>
                      <option value="valid">Valid</option>
                      <option value="expiring">Expiring</option>
                      <option value="expired">Expired</option>
                      <option value="pending">Pending</option>
                    </select>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Personal details</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Date of Birth</label>
                    <input type="date" className="input-field w-full" value={form.driver_license_date_of_birth} onChange={(e) => set('driver_license_date_of_birth', e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Sex</label>
                    <select className="input-field w-full" value={form.driver_license_sex} onChange={(e) => set('driver_license_sex', e.target.value)}>
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Blood Type</label>
                    <select className="input-field w-full" value={form.driver_license_blood_type} onChange={(e) => set('driver_license_blood_type', e.target.value)}>
                      <option value="">Select</option>
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Nationality</label>
                    <input className="input-field w-full" value={form.driver_license_nationality} onChange={(e) => set('driver_license_nationality', e.target.value)} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium">Address</label>
                    <textarea
                      rows={2}
                      className="input-field w-full"
                      value={form.driver_license_address}
                      onChange={(e) => set('driver_license_address', e.target.value)}
                      placeholder="Residential address as indicated on license"
                    />
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
