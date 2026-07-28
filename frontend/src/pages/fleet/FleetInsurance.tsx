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

function formatMoney(value?: number | string | null) {
  if (value == null || value === '') return '—';
  return `₱${Number(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function docBadge(status?: string | null) {
  if (!status) return <span className="text-slate-400">—</span>;
  return <Badge status={status} />;
}

type InsuranceForm = {
  insurance_provider: string;
  insurance_policy_number: string;
  insurance_certificate_number: string;
  insurance_coverage_type: string;
  insurance_issued_at: string;
  insurance_expiry: string;
  insurance_status: string;
  insurance_sum_insured: string;
  insurance_broker: string;
  insurance_contact_person: string;
  insurance_contact_phone: string;
  insurance_remarks: string;
};

const emptyForm = (): InsuranceForm => ({
  insurance_provider: '',
  insurance_policy_number: '',
  insurance_certificate_number: '',
  insurance_coverage_type: '',
  insurance_issued_at: '',
  insurance_expiry: '',
  insurance_status: '',
  insurance_sum_insured: '',
  insurance_broker: '',
  insurance_contact_person: '',
  insurance_contact_phone: '',
  insurance_remarks: '',
});

function toPayload(form: InsuranceForm) {
  return {
    insurance_provider: form.insurance_provider.trim() || null,
    insurance_policy_number: form.insurance_policy_number.trim() || null,
    insurance_certificate_number: form.insurance_certificate_number.trim() || null,
    insurance_coverage_type: form.insurance_coverage_type.trim() || null,
    insurance_issued_at: form.insurance_issued_at || null,
    insurance_expiry: form.insurance_expiry || null,
    insurance_status: form.insurance_status || null,
    insurance_sum_insured: form.insurance_sum_insured ? Number(form.insurance_sum_insured) : null,
    insurance_broker: form.insurance_broker.trim() || null,
    insurance_contact_person: form.insurance_contact_person.trim() || null,
    insurance_contact_phone: form.insurance_contact_phone.trim() || null,
    insurance_remarks: form.insurance_remarks.trim() || null,
  };
}

export default function FleetInsurance() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('fleet.*') || hasPermission('fleet.manage');
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<FleetVehicle | null>(null);
  const [form, setForm] = useState<InsuranceForm>(emptyForm());

  const { data, isLoading } = useQuery({
    queryKey: ['fleet-vehicles', page, search, 'insurance'],
    queryFn: () => api.get('/fleet/vehicles', {
      params: { page, per_page: 25, ...(search.trim() ? { search: search.trim() } : {}) },
    }).then((r) => r.data),
  });

  const vehicles = (data?.data ?? []) as FleetVehicle[];

  const summary = useMemo(() => {
    const rows = vehicles;
    return {
      valid: rows.filter((v) => v.insurance_status === 'valid').length,
      expiring: rows.filter((v) => v.insurance_status === 'expiring').length,
      expired: rows.filter((v) => v.insurance_status === 'expired').length,
      pending: rows.filter((v) => !v.insurance_status || v.insurance_status === 'pending').length,
    };
  }, [vehicles]);

  const save = useMutation({
    mutationFn: () => {
      if (!editing) throw new Error('No vehicle selected');
      return api.put(`/fleet/vehicles/${editing.id}`, toPayload(form));
    },
    onSuccess: () => {
      toast.success('Insurance details updated');
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ['fleet-vehicles'] });
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e.response?.data?.message ?? 'Failed to update insurance');
    },
  });

  const openEdit = (vehicle: FleetVehicle) => {
    setEditing(vehicle);
    setForm({
      insurance_provider: vehicle.insurance_provider ?? '',
      insurance_policy_number: vehicle.insurance_policy_number ?? '',
      insurance_certificate_number: vehicle.insurance_certificate_number ?? '',
      insurance_coverage_type: vehicle.insurance_coverage_type ?? '',
      insurance_issued_at: vehicle.insurance_issued_at?.slice(0, 10) ?? '',
      insurance_expiry: vehicle.insurance_expiry?.slice(0, 10) ?? '',
      insurance_status: vehicle.insurance_status ?? '',
      insurance_sum_insured: vehicle.insurance_sum_insured != null ? String(vehicle.insurance_sum_insured) : '',
      insurance_broker: vehicle.insurance_broker ?? '',
      insurance_contact_person: vehicle.insurance_contact_person ?? '',
      insurance_contact_phone: vehicle.insurance_contact_phone ?? '',
      insurance_remarks: vehicle.insurance_remarks ?? '',
    });
  };

  const set = <K extends keyof InsuranceForm>(key: K, value: InsuranceForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Vehicle Insurance"
        description="Policy coverage, certificate details, broker contacts, and expiry tracking"
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
            placeholder="Search plate, provider, policy, certificate, broker..."
          />
        </div>
      </div>

      <DataTable<FleetVehicle>
        loading={isLoading}
        data={vehicles}
        emptyTitle="No vehicles"
        emptyDescription="Add fleet vehicles first, then record their insurance policies here."
        columns={[
          { key: 'plate_number', label: 'Plate', render: (r) => <span className="font-mono text-xs font-semibold text-palawan-700">{r.plate_number}</span> },
          { key: 'name', label: 'Vehicle', render: (r) => (
            <div>
              <p className="font-medium text-slate-900">{r.name}</p>
              <p className="text-xs text-slate-500 capitalize">{r.vehicle_type}</p>
            </div>
          ) },
          { key: 'insurance_provider', label: 'Provider', render: (r) => r.insurance_provider || '—' },
          { key: 'insurance_policy_number', label: 'Policy No.', render: (r) => r.insurance_policy_number || '—' },
          { key: 'insurance_certificate_number', label: 'Certificate', render: (r) => r.insurance_certificate_number || '—' },
          { key: 'insurance_coverage_type', label: 'Coverage', render: (r) => r.insurance_coverage_type || '—' },
          { key: 'insurance_sum_insured', label: 'Sum Insured', render: (r) => formatMoney(r.insurance_sum_insured) },
          { key: 'insurance_issued_at', label: 'Effective', render: (r) => formatDate(r.insurance_issued_at) },
          { key: 'insurance_expiry', label: 'Expiry', render: (r) => formatDate(r.insurance_expiry) },
          { key: 'insurance_status', label: 'Status', render: (r) => docBadge(r.insurance_status) },
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
                <h2 className="text-lg font-bold">Update Vehicle Insurance</h2>
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
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Policy details</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium">Insurance Provider</label>
                    <input className="input-field w-full" value={form.insurance_provider} onChange={(e) => set('insurance_provider', e.target.value)} placeholder="e.g. GSIS, Malayan" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Policy Number</label>
                    <input className="input-field w-full" value={form.insurance_policy_number} onChange={(e) => set('insurance_policy_number', e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Certificate Number</label>
                    <input className="input-field w-full" value={form.insurance_certificate_number} onChange={(e) => set('insurance_certificate_number', e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Coverage Type</label>
                    <select className="input-field w-full" value={form.insurance_coverage_type} onChange={(e) => set('insurance_coverage_type', e.target.value)}>
                      <option value="">Select</option>
                      <option value="CTPL">CTPL</option>
                      <option value="Comprehensive">Comprehensive</option>
                      <option value="CTPL + OD">CTPL + OD</option>
                      <option value="Third Party Liability">Third Party Liability</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Sum Insured (₱)</label>
                    <input type="number" min="0" step="0.01" className="input-field w-full" value={form.insurance_sum_insured} onChange={(e) => set('insurance_sum_insured', e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Effective / Issued Date</label>
                    <input type="date" className="input-field w-full" value={form.insurance_issued_at} onChange={(e) => set('insurance_issued_at', e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Insurance Expiry</label>
                    <input type="date" className="input-field w-full" value={form.insurance_expiry} onChange={(e) => set('insurance_expiry', e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Status</label>
                    <select className="input-field w-full" value={form.insurance_status} onChange={(e) => set('insurance_status', e.target.value)}>
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
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Broker / contact</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium">Broker / Agency</label>
                    <input className="input-field w-full" value={form.insurance_broker} onChange={(e) => set('insurance_broker', e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Contact Person</label>
                    <input className="input-field w-full" value={form.insurance_contact_person} onChange={(e) => set('insurance_contact_person', e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Contact Phone</label>
                    <input className="input-field w-full" value={form.insurance_contact_phone} onChange={(e) => set('insurance_contact_phone', e.target.value)} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium">Remarks</label>
                    <textarea
                      rows={2}
                      className="input-field w-full"
                      value={form.insurance_remarks}
                      onChange={(e) => set('insurance_remarks', e.target.value)}
                      placeholder="Notes, endorsements, or special conditions"
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
