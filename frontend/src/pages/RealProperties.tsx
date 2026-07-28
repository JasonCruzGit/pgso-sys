import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, X, Building2, Pencil } from 'lucide-react';
import api from '../api/client';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import DataTable from '../components/DataTable';
import Badge from '../components/Badge';
import { useAuth } from '../context/AuthContext';
import type { RealProperty, RealPropertyStatus } from '../types';
import toast from 'react-hot-toast';

const STATUS_LABELS: Record<RealPropertyStatus, string> = {
  active: 'Active',
  under_construction: 'Under Construction',
  leased: 'Leased',
  inactive: 'Inactive',
  disposed: 'Disposed',
};

const SOURCE_OPTIONS = [
  { value: 'purchase', label: 'Purchase' },
  { value: 'donation', label: 'Donation' },
  { value: 'construction', label: 'Construction' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'legacy_registry', label: 'Legacy Registry' },
  { value: 'other', label: 'Other' },
];

function formatMoney(value?: number | string | null) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(value?: string) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

const emptyForm = {
  account_name: '',
  property_no: '',
  article: '',
  description: '',
  location: '',
  qty: '1',
  uom: 'unit',
  unit_cost: '',
  acquisition_cost: '',
  acquisition_date: '',
  status: 'active' as RealPropertyStatus,
  office: '',
  department_id: '',
  obr_no: '',
  remarks: '',
  source: '',
};

export default function RealProperties() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RealProperty | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasPermission('property.*');

  const { data, isLoading } = useQuery({
    queryKey: ['real-properties', page, search, statusFilter],
    queryFn: () => api.get('/real-properties', {
      params: {
        page,
        per_page: 30,
        search: search || undefined,
        status: statusFilter || undefined,
      },
    }).then((r) => r.data),
  });

  const { data: departmentsData } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments', { params: { per_page: 100 } }).then((r) => r.data),
    enabled: showForm,
  });
  const departments: { id: number; name: string }[] = departmentsData?.data ?? departmentsData ?? [];

  const saveProperty = useMutation({
    mutationFn: () => {
      const payload = {
        account_name: form.account_name.trim(),
        property_no: form.property_no.trim(),
        article: form.article.trim() || undefined,
        description: form.description.trim() || undefined,
        location: form.location.trim() || undefined,
        qty: form.qty ? Number(form.qty) : 1,
        uom: form.uom.trim() || 'unit',
        unit_cost: form.unit_cost ? Number(form.unit_cost) : undefined,
        acquisition_cost: form.acquisition_cost ? Number(form.acquisition_cost) : undefined,
        acquisition_date: form.acquisition_date || undefined,
        status: form.status,
        office: form.office.trim() || undefined,
        department_id: form.department_id ? Number(form.department_id) : undefined,
        obr_no: form.obr_no.trim() || undefined,
        remarks: form.remarks.trim() || undefined,
        source: form.source.trim() || undefined,
      };
      if (editing) {
        return api.put(`/real-properties/${editing.id}`, payload);
      }
      return api.post('/real-properties', payload);
    },
    onSuccess: () => {
      toast.success(editing ? 'Record updated' : 'Record added');
      queryClient.invalidateQueries({ queryKey: ['real-properties'] });
      closeForm();
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e.response?.data?.message ?? 'Failed to save record');
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (property: RealProperty) => {
    setEditing(property);
    setForm({
      account_name: property.account_name,
      property_no: property.property_no,
      article: property.article ?? '',
      description: property.description ?? '',
      location: property.location ?? '',
      qty: property.qty != null ? String(property.qty) : '1',
      uom: property.uom ?? 'unit',
      unit_cost: property.unit_cost != null ? String(property.unit_cost) : '',
      acquisition_cost: property.acquisition_cost != null ? String(property.acquisition_cost) : '',
      acquisition_date: property.acquisition_date?.slice(0, 10) ?? '',
      status: property.status,
      office: property.office ?? property.department?.name ?? '',
      department_id: property.department_id ? String(property.department_id) : '',
      obr_no: property.obr_no ?? '',
      remarks: property.remarks ?? '',
      source: property.source ?? '',
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const properties = (data?.data ?? []) as RealProperty[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Real Properties"
        description="Master registry of provincial real property records"
        action={
          canManage ? (
            <button type="button" onClick={openCreate} className="btn-primary inline-flex items-center gap-2">
              <Plus size={18} /> Add Record
            </button>
          ) : undefined
        }
      />

      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search account name, property no., article, office, OBR..."
            className="input-field !pl-11"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="input-field min-w-[140px] sm:min-w-[160px]"
        >
          <option value="">All Status</option>
          {(Object.keys(STATUS_LABELS) as RealPropertyStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      <div className="card overflow-hidden">
        <DataTable<RealProperty>
          loading={isLoading}
          data={properties}
          emptyTitle="No real property records yet"
          emptyDescription={canManage ? 'Add master records for provincial real properties.' : 'No records available.'}
          columns={[
            { key: 'account_name', label: 'Account Name', render: (r) => <span className="font-medium text-slate-900">{r.account_name}</span> },
            { key: 'property_no', label: 'Property No.', render: (r) => <span className="font-mono text-xs font-semibold text-palawan-700">{r.property_no}</span> },
            { key: 'article', label: 'Article', render: (r) => r.article ?? '—' },
            { key: 'description', label: 'Description', render: (r) => <span className="line-clamp-2 max-w-[220px]">{r.description ?? '—'}</span> },
            { key: 'location', label: 'Location', render: (r) => <span className="line-clamp-2 max-w-[180px]">{r.location ?? '—'}</span> },
            { key: 'qty', label: 'Qty', render: (r) => <span className="tabular-nums">{r.qty ?? 1}</span> },
            { key: 'uom', label: 'UOM', render: (r) => r.uom ?? '—' },
            { key: 'unit_cost', label: 'Unit Cost', render: (r) => <span className="tabular-nums">{formatMoney(r.unit_cost)}</span> },
            { key: 'acquisition_cost', label: 'Acquisition Cost', render: (r) => <span className="tabular-nums font-medium">{formatMoney(r.acquisition_cost)}</span> },
            { key: 'acquisition_date', label: 'Acquisition Date', render: (r) => formatDate(r.acquisition_date) },
            { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
            { key: 'office', label: 'Office', render: (r) => <span className="line-clamp-2 max-w-[160px]">{r.office ?? r.department?.name ?? '—'}</span> },
            { key: 'obr_no', label: 'OBR No.', render: (r) => <span className="font-mono text-xs">{r.obr_no ?? '—'}</span> },
            { key: 'remarks', label: 'Remarks', render: (r) => <span className="line-clamp-2 max-w-[160px]">{r.remarks ?? '—'}</span> },
            { key: 'source', label: 'Source', render: (r) => r.source?.replace(/_/g, ' ') ?? '—' },
            ...(canManage ? [{
              key: 'actions',
              label: '',
              render: (r: RealProperty) => (
                <button
                  type="button"
                  onClick={() => openEdit(r)}
                  className="inline-flex items-center gap-1 rounded-lg bg-palawan-50 px-2.5 py-1 text-xs font-semibold text-palawan-700 hover:bg-palawan-100"
                >
                  <Pencil size={14} /> Edit
                </button>
              ),
            }] : []),
          ]}
        />
      </div>

      {data?.last_page > 1 && (
        <Pagination currentPage={data.current_page} lastPage={data.last_page} onPageChange={setPage} />
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeForm}>
          <div className="card-elevated max-h-[90vh] w-full max-w-3xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <Building2 size={20} className="text-palawan-700" />
                <h2 className="text-lg font-bold text-slate-900">{editing ? 'Edit Master Record' : 'Add Master Record'}</h2>
              </div>
              <button type="button" onClick={closeForm} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveProperty.mutate();
              }}
              className="space-y-5 p-5"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Account Name *</label>
                  <input required value={form.account_name} onChange={(e) => setForm({ ...form, account_name: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Property No. *</label>
                  <input required value={form.property_no} onChange={(e) => setForm({ ...form, property_no: e.target.value })} className="input-field font-mono uppercase" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Article</label>
                  <input value={form.article} onChange={(e) => setForm({ ...form, article: e.target.value })} className="input-field" placeholder="Hospital, Building, Lot..." />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Location</label>
                  <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="input-field" />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="input-field resize-none" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Qty</label>
                  <input type="number" min="0" step="0.01" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">UOM</label>
                  <input value={form.uom} onChange={(e) => setForm({ ...form, uom: e.target.value })} className="input-field" placeholder="unit, lot, building" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Unit Cost</label>
                  <input type="number" min="0" step="0.01" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Acquisition Cost</label>
                  <input type="number" min="0" step="0.01" value={form.acquisition_cost} onChange={(e) => setForm({ ...form, acquisition_cost: e.target.value })} className="input-field" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Acquisition Date</label>
                  <input type="date" value={form.acquisition_date} onChange={(e) => setForm({ ...form, acquisition_date: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as RealPropertyStatus })} className="input-field">
                    {(Object.keys(STATUS_LABELS) as RealPropertyStatus[]).map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Office</label>
                  <input value={form.office} onChange={(e) => setForm({ ...form, office: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Department Link</label>
                  <select value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })} className="input-field">
                    <option value="">None</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">OBR No.</label>
                  <input value={form.obr_no} onChange={(e) => setForm({ ...form, obr_no: e.target.value })} className="input-field font-mono" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Source</label>
                  <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="input-field">
                    <option value="">Select source</option>
                    {SOURCE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Remarks</label>
                <textarea value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} rows={2} className="input-field resize-none" />
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button type="button" onClick={closeForm} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={saveProperty.isPending} className="btn-primary">
                  {saveProperty.isPending ? 'Saving...' : editing ? 'Save Changes' : 'Add Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
