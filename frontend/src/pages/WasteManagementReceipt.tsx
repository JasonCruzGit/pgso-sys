import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Trash2, X } from 'lucide-react';
import Card from '../components/Card';
import DataTable from '../components/DataTable';
import Pagination from '../components/Pagination';
import Badge from '../components/Badge';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import toast from 'react-hot-toast';

type WasteManagementReceiptRecord = {
  id: number;
  wmr_number: string;
  disposal_date: string;
  department?: { name: string };
  preparer?: { name: string };
  status: string;
  items_count?: number;
  mode_of_disposal?: string;
};

type WmrLineItem = {
  inventory_item_id: string;
  description: string;
  unit_of_measure: string;
  quantity: string;
  unit_cost: string;
  item_condition: string;
  disposal_reason: string;
};

const DISPOSAL_MODES = [
  'Destroyed',
  'Sold at public auction',
  'Donated',
  'Transferred',
  'Condemned',
  'Other',
] as const;

const emptyLine = (): WmrLineItem => ({
  inventory_item_id: '',
  description: '',
  unit_of_measure: '',
  quantity: '',
  unit_cost: '',
  item_condition: 'unserviceable',
  disposal_reason: '',
});

function apiError(e: unknown, fallback: string) {
  const err = e as { response?: { data?: { message?: string } } };
  toast.error(err.response?.data?.message ?? fallback);
}

export function WasteManagementReceiptPanel() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasPermission('procurement.create') || hasPermission('procurement.*');

  const { data, isLoading } = useQuery({
    queryKey: ['waste-management-receipts', page, search],
    queryFn: () => api.get('/waste-management-receipts', {
      params: {
        page,
        ...(search.trim() ? { search: search.trim() } : {}),
      },
    }).then((r) => r.data),
  });

  const records = (data?.data ?? []) as WasteManagementReceiptRecord[];

  return (
    <div className="space-y-4">
      <Card
        title="Waste Management Receipt"
        subtitle="Document disposal of unserviceable, obsolete, or waste materials"
      >
        <p className="text-sm text-slate-600">
          Click <strong>New WMR</strong> to record items withdrawn from inventory for disposal.
          Linked inventory items will be deducted from stock when the receipt is saved.
        </p>
      </Card>

      <div className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="sm:col-span-2 lg:col-span-1">
          <label htmlFor="wmr-search" className="mb-1.5 block text-sm font-medium text-slate-700">Search</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              id="wmr-search"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by WMR no., department, or item..."
              className="input-field w-full !pl-11"
            />
          </div>
        </div>
        {canManage && (
          <div className="flex justify-end">
            <button type="button" className="btn-primary w-full sm:w-auto" onClick={() => setShowCreate(true)}>
              <Plus size={18} /> New WMR
            </button>
          </div>
        )}
      </div>

      <DataTable<WasteManagementReceiptRecord>
        loading={isLoading}
        data={records}
        emptyTitle="No waste management receipts yet"
        emptyDescription={
          search.trim()
            ? 'No records match your search.'
            : 'Click New WMR to create your first waste management receipt.'
        }
        columns={[
          { key: 'wmr_number', label: 'WMR No.', render: (r) => <span className="font-mono text-xs font-semibold text-palawan-700">{r.wmr_number}</span> },
          { key: 'disposal_date', label: 'Date', render: (r) => new Date(r.disposal_date).toLocaleDateString() },
          { key: 'department', label: 'Department', render: (r) => r.department?.name ?? '—' },
          { key: 'items', label: 'Items', render: (r) => `${r.items_count ?? 0} item(s)` },
          { key: 'mode', label: 'Mode', render: (r) => r.mode_of_disposal ?? '—' },
          { key: 'prepared_by', label: 'Prepared By', render: (r) => r.preparer?.name ?? '—' },
          { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
        ]}
      />

      <Pagination
        currentPage={data?.current_page ?? 1}
        lastPage={data?.last_page ?? 1}
        onPageChange={setPage}
      />

      {showCreate && (
        <WmrCreateModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            queryClient.invalidateQueries({ queryKey: ['waste-management-receipts'] });
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
          }}
        />
      )}
    </div>
  );
}

function WmrCreateModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { user } = useAuth();
  const [disposalDate, setDisposalDate] = useState(new Date().toISOString().slice(0, 10));
  const [departmentId, setDepartmentId] = useState(user?.department?.id ? String(user.department.id) : '');
  const [disposalLocation, setDisposalLocation] = useState('GSO Main Warehouse');
  const [modeOfDisposal, setModeOfDisposal] = useState<string>(DISPOSAL_MODES[0]);
  const [witnessName, setWitnessName] = useState('');
  const [remarks, setRemarks] = useState('');
  const [lineItems, setLineItems] = useState<WmrLineItem[]>([emptyLine()]);

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments').then((r) => r.data),
  });

  const { data: inventory } = useQuery({
    queryKey: ['inventory-wmr-select'],
    queryFn: () => api.get('/inventory', { params: { per_page: 200 } }).then((r) => r.data),
  });

  const create = useMutation({
    mutationFn: () => api.post('/waste-management-receipts', {
      disposal_date: disposalDate,
      department_id: Number(departmentId),
      disposal_location: disposalLocation || undefined,
      mode_of_disposal: modeOfDisposal || undefined,
      witness_name: witnessName || undefined,
      remarks: remarks || undefined,
      items: lineItems.map((item) => ({
        inventory_item_id: item.inventory_item_id ? Number(item.inventory_item_id) : undefined,
        description: item.description.trim(),
        unit_of_measure: item.unit_of_measure || undefined,
        quantity: Number(item.quantity),
        unit_cost: item.unit_cost ? Number(item.unit_cost) : undefined,
        item_condition: item.item_condition || undefined,
        disposal_reason: item.disposal_reason || undefined,
      })),
    }),
    onSuccess: (res) => {
      toast.success(`WMR ${res.data.wmr_number} created`);
      onSuccess();
    },
    onError: (e) => apiError(e, 'Failed to create WMR'),
  });

  const deptList = departments?.data ?? departments ?? [];
  const inventoryList = inventory?.data ?? [];

  const applyInventoryItem = (index: number, itemId: string) => {
    const selected = inventoryList.find((i: { id: number }) => String(i.id) === itemId);
    if (!selected) {
      setLineItems((prev) => prev.map((line, i) => i === index ? { ...line, inventory_item_id: itemId } : line));
      return;
    }
    setLineItems((prev) => prev.map((line, i) => i === index ? {
      ...line,
      inventory_item_id: itemId,
      description: selected.name,
      unit_of_measure: selected.unit_of_measure ?? '',
      unit_cost: String(selected.unit_cost ?? ''),
    } : line));
  };

  const handleSubmit = () => {
    if (!departmentId) {
      toast.error('Please select a department');
      return;
    }
    if (lineItems.some((item) => !item.description.trim() || !item.quantity || Number(item.quantity) <= 0)) {
      toast.error('Complete description and quantity for each line item');
      return;
    }
    create.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="safe-bottom flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">New Waste Management Receipt</h2>
            <p className="text-sm text-slate-500">Record disposal of waste or unserviceable items</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Disposal Date</label>
              <input required type="date" value={disposalDate} onChange={(e) => setDisposalDate(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Department</label>
              <select required value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="input-field">
                <option value="">Select department</option>
                {deptList.map((d: { id: number; name: string }) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Disposal Location</label>
              <input value={disposalLocation} onChange={(e) => setDisposalLocation(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Mode of Disposal</label>
              <select value={modeOfDisposal} onChange={(e) => setModeOfDisposal(e.target.value)} className="input-field">
                {DISPOSAL_MODES.map((mode) => (
                  <option key={mode} value={mode}>{mode}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Witness</label>
              <input value={witnessName} onChange={(e) => setWitnessName(e.target.value)} placeholder="Name of witness (optional)" className="input-field" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Prepared By</label>
              <input readOnly value={user?.name ?? ''} className="input-field bg-slate-50 text-slate-600" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Remarks</label>
              <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className="input-field resize-none" />
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Disposed Items</h3>
              <button type="button" onClick={() => setLineItems((p) => [...p, emptyLine()])} className="text-sm font-medium text-palawan-600">
                + Add line
              </button>
            </div>
            <div className="space-y-3">
              {lineItems.map((item, index) => (
                <div key={index} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                  <div className="grid gap-2 sm:grid-cols-12 sm:items-end">
                    <div className="sm:col-span-4">
                      <label className="mb-1 block text-xs font-medium text-slate-500">Inventory Item (optional)</label>
                      <select
                        value={item.inventory_item_id}
                        onChange={(e) => applyInventoryItem(index, e.target.value)}
                        className="input-field"
                      >
                        <option value="">Manual entry</option>
                        {inventoryList.map((inv: { id: number; item_code: string; name: string; quantity: number }) => (
                          <option key={inv.id} value={inv.id}>
                            {inv.item_code} — {inv.name} (qty: {inv.quantity})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-4">
                      <label className="mb-1 block text-xs font-medium text-slate-500">Description</label>
                      <input required value={item.description} onChange={(e) => setLineItems((p) => p.map((l, i) => i === index ? { ...l, description: e.target.value } : l))} className="input-field" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-slate-500">Qty</label>
                      <input required type="number" min="0.01" step="0.01" value={item.quantity} onChange={(e) => setLineItems((p) => p.map((l, i) => i === index ? { ...l, quantity: e.target.value } : l))} className="input-field" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-slate-500">Unit</label>
                      <input value={item.unit_of_measure} onChange={(e) => setLineItems((p) => p.map((l, i) => i === index ? { ...l, unit_of_measure: e.target.value } : l))} className="input-field uppercase" />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="mb-1 block text-xs font-medium text-slate-500">Unit Cost (₱)</label>
                      <input type="number" min="0" step="0.01" value={item.unit_cost} onChange={(e) => setLineItems((p) => p.map((l, i) => i === index ? { ...l, unit_cost: e.target.value } : l))} className="input-field" />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="mb-1 block text-xs font-medium text-slate-500">Condition</label>
                      <select value={item.item_condition} onChange={(e) => setLineItems((p) => p.map((l, i) => i === index ? { ...l, item_condition: e.target.value } : l))} className="input-field">
                        <option value="unserviceable">Unserviceable</option>
                        <option value="obsolete">Obsolete</option>
                        <option value="damaged">Damaged</option>
                        <option value="expired">Expired</option>
                      </select>
                    </div>
                    <div className="sm:col-span-5">
                      <label className="mb-1 block text-xs font-medium text-slate-500">Reason for Disposal</label>
                      <input value={item.disposal_reason} onChange={(e) => setLineItems((p) => p.map((l, i) => i === index ? { ...l, disposal_reason: e.target.value } : l))} className="input-field" placeholder="e.g. Beyond economic repair" />
                    </div>
                    <div className="flex justify-end sm:col-span-1">
                      {lineItems.length > 1 && (
                        <button type="button" onClick={() => setLineItems((p) => p.filter((_, i) => i !== index))} className="rounded-xl p-2 text-slate-400 hover:bg-red-50 hover:text-red-500">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 border-t border-slate-100 px-5 py-4">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="button" onClick={handleSubmit} disabled={create.isPending} className="btn-primary flex-1">
            {create.isPending ? 'Saving…' : 'Create WMR'}
          </button>
        </div>
      </div>
    </div>
  );
}
