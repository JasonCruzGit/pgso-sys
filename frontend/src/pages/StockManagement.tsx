import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Eye } from 'lucide-react';
import api from '../api/client';
import DataTable from '../components/DataTable';
import Pagination from '../components/Pagination';
import PageHeader from '../components/PageHeader';
import Badge from '../components/Badge';
import type {
  StockTransaction, InventoryAdjustment, InventoryReconciliation,
  Batch, ReplenishmentRecommendation,
} from '../types';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

type Tab = 'transactions' | 'adjustments' | 'reconciliation' | 'batches' | 'replenishment';

const tabs: { id: Tab; label: string }[] = [
  { id: 'transactions', label: 'Transactions' },
  { id: 'adjustments', label: 'Adjustments' },
  { id: 'reconciliation', label: 'Reconciliation' },
  { id: 'batches', label: 'Batches' },
  { id: 'replenishment', label: 'Replenishment' },
];

function apiError(e: unknown, fallback: string) {
  const err = e as { response?: { data?: { message?: string } } };
  toast.error(err.response?.data?.message ?? fallback);
}

export default function StockManagement() {
  const [tab, setTab] = useState<Tab>('transactions');
  const [page, setPage] = useState(1);
  const [showStockIn, setShowStockIn] = useState(false);
  const [showStockOut, setShowStockOut] = useState(false);
  const [showAdjustment, setShowAdjustment] = useState(false);
  const [showReconciliation, setShowReconciliation] = useState(false);
  const [showBatch, setShowBatch] = useState(false);
  const [viewReconciliation, setViewReconciliation] = useState<InventoryReconciliation | null>(null);

  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canCreate = hasPermission('stock.*');

  const { data: transactions, isLoading: loadingTx } = useQuery({
    queryKey: ['stock-transactions', page],
    queryFn: () => api.get('/stock-transactions', { params: { page } }).then((r) => r.data),
    enabled: tab === 'transactions',
  });

  const { data: adjustments, isLoading: loadingAdj } = useQuery({
    queryKey: ['inventory-adjustments', page],
    queryFn: () => api.get('/inventory-adjustments', { params: { page } }).then((r) => r.data),
    enabled: tab === 'adjustments',
  });

  const { data: reconciliations, isLoading: loadingRec } = useQuery({
    queryKey: ['inventory-reconciliations', page],
    queryFn: () => api.get('/inventory-reconciliations', { params: { page } }).then((r) => r.data),
    enabled: tab === 'reconciliation',
  });

  const { data: batches, isLoading: loadingBatches } = useQuery({
    queryKey: ['batches', page],
    queryFn: () => api.get('/batches', { params: { page } }).then((r) => r.data),
    enabled: tab === 'batches',
  });

  const { data: replenishment, isLoading: loadingRepl } = useQuery({
    queryKey: ['replenishment-recommendations'],
    queryFn: () => api.get('/replenishment-recommendations').then((r) => r.data),
    enabled: tab === 'replenishment',
  });

  const { data: inventory } = useQuery({
    queryKey: ['inventory-select'],
    queryFn: () => api.get('/inventory', { params: { per_page: 200 } }).then((r) => r.data),
    enabled: showStockIn || showStockOut || showAdjustment || showBatch,
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get('/suppliers', { params: { per_page: 100 } }).then((r) => r.data),
    enabled: showStockIn,
  });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments').then((r) => r.data),
    enabled: showStockOut,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data),
    enabled: showReconciliation,
  });

  const inventoryList = inventory?.data ?? [];

  const invalidateStock = () => {
    queryClient.invalidateQueries({ queryKey: ['stock-transactions'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-adjustments'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-reconciliations'] });
    queryClient.invalidateQueries({ queryKey: ['batches'] });
    queryClient.invalidateQueries({ queryKey: ['replenishment-recommendations'] });
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const handleViewReconciliation = async (id: number) => {
    try {
      const { data } = await api.get(`/inventory-reconciliations/${id}`);
      setViewReconciliation(data);
    } catch {
      toast.error('Failed to load reconciliation');
    }
  };

  const switchTab = (t: Tab) => { setTab(t); setPage(1); };

  const actionButton = () => {
    if (!canCreate) return undefined;
    if (tab === 'transactions') {
      return (
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={() => setShowStockOut(true)}>
            <Plus size={18} /> Stock Out
          </button>
          <button type="button" className="btn-primary" onClick={() => setShowStockIn(true)}>
            <Plus size={18} /> Stock In
          </button>
        </div>
      );
    }
    if (tab === 'adjustments') return <button type="button" className="btn-primary" onClick={() => setShowAdjustment(true)}><Plus size={18} /> New Adjustment</button>;
    if (tab === 'reconciliation') return <button type="button" className="btn-primary" onClick={() => setShowReconciliation(true)}><Plus size={18} /> Start Reconciliation</button>;
    if (tab === 'batches') return <button type="button" className="btn-primary" onClick={() => setShowBatch(true)}><Plus size={18} /> New Batch</button>;
    return undefined;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Management"
        description="Track stock movements, adjustments, reconciliations, and batches"
        action={actionButton()}
      />

      <div className="flex flex-wrap gap-1 rounded-full bg-white p-1 shadow-sm">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => switchTab(t.id)}
            className={`pill-nav ${tab === t.id ? 'pill-nav-active' : 'hover:bg-slate-100'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'transactions' && (
        <>
          <DataTable<StockTransaction>
            loading={loadingTx}
            data={transactions?.data ?? []}
            emptyTitle="No stock transactions"
            emptyDescription="Stock in and stock out records will appear here."
            columns={[
              { key: 'transaction_number', label: 'Ref No.', render: (r) => <span className="font-mono text-xs font-semibold text-palawan-700">{r.transaction_number}</span> },
              { key: 'type', label: 'Type', render: (r) => <Badge status={r.type} /> },
              { key: 'item', label: 'Item', render: (r) => r.inventory_item?.name ?? '—' },
              { key: 'quantity', label: 'Qty', render: (r) => r.quantity },
              { key: 'performer', label: 'Performed By', render: (r) => r.performer?.name ?? '—' },
              { key: 'date', label: 'Date', render: (r) => new Date(r.created_at).toLocaleDateString() },
            ]}
          />
          <Pagination currentPage={transactions?.current_page ?? 1} lastPage={transactions?.last_page ?? 1} onPageChange={setPage} />
        </>
      )}

      {tab === 'adjustments' && (
        <>
          <DataTable<InventoryAdjustment>
            loading={loadingAdj}
            data={adjustments?.data ?? []}
            emptyTitle="No adjustments"
            emptyDescription="Inventory adjustments will appear here."
            columns={[
              { key: 'adjustment_number', label: 'Ref No.', render: (r) => <span className="font-mono text-xs font-semibold text-palawan-700">{r.adjustment_number}</span> },
              { key: 'item', label: 'Item', render: (r) => r.inventory_item?.name ?? '—' },
              { key: 'adjustment_type', label: 'Type', render: (r) => <Badge status={r.adjustment_type} /> },
              { key: 'quantity_change', label: 'Change', render: (r) => r.quantity_change },
              { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
              { key: 'adjuster', label: 'Adjusted By', render: (r) => r.adjuster?.name ?? '—' },
              {
                key: 'actions',
                label: 'Actions',
                render: (r) => r.status === 'pending' && hasPermission('stock.*') ? (
                  <AdjustmentActions id={r.id} onDone={invalidateStock} />
                ) : null,
              },
            ]}
          />
          <Pagination currentPage={adjustments?.current_page ?? 1} lastPage={adjustments?.last_page ?? 1} onPageChange={setPage} />
        </>
      )}

      {tab === 'reconciliation' && (
        <>
          <DataTable<InventoryReconciliation>
            loading={loadingRec}
            data={reconciliations?.data ?? []}
            emptyTitle="No reconciliations"
            emptyDescription="Physical count reconciliations will appear here."
            columns={[
              { key: 'reconciliation_number', label: 'Ref No.', render: (r) => <span className="font-mono text-xs font-semibold text-palawan-700">{r.reconciliation_number}</span> },
              { key: 'title', label: 'Title' },
              { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
              { key: 'starter', label: 'Started By', render: (r) => r.starter?.name ?? '—' },
              { key: 'date', label: 'Date', render: (r) => new Date(r.created_at).toLocaleDateString() },
              {
                key: 'actions',
                label: '',
                render: (r) => (
                  <button type="button" onClick={() => handleViewReconciliation(r.id)} className="inline-flex items-center gap-1 rounded-lg bg-palawan-50 px-2.5 py-1 text-xs font-semibold text-palawan-700 hover:bg-palawan-100">
                    <Eye size={14} /> View
                  </button>
                ),
              },
            ]}
          />
          <Pagination currentPage={reconciliations?.current_page ?? 1} lastPage={reconciliations?.last_page ?? 1} onPageChange={setPage} />
        </>
      )}

      {tab === 'batches' && (
        <>
          <DataTable<Batch>
            loading={loadingBatches}
            data={batches?.data ?? []}
            emptyTitle="No batches"
            emptyDescription="Lot and batch records will appear here."
            columns={[
              { key: 'batch_number', label: 'Batch No.', render: (r) => <span className="font-mono text-xs font-semibold text-palawan-700">{r.batch_number}</span> },
              { key: 'item', label: 'Item', render: (r) => r.inventory_item?.name ?? '—' },
              { key: 'lot_number', label: 'Lot', render: (r) => r.lot_number ?? '—' },
              { key: 'quantity', label: 'Qty', render: (r) => r.quantity },
              { key: 'expiration_date', label: 'Expires', render: (r) => r.expiration_date ? new Date(r.expiration_date).toLocaleDateString() : '—' },
            ]}
          />
          <Pagination currentPage={batches?.current_page ?? 1} lastPage={batches?.last_page ?? 1} onPageChange={setPage} />
        </>
      )}

      {tab === 'replenishment' && (
        <DataTable<ReplenishmentRecommendation>
          loading={loadingRepl}
          data={replenishment?.data ?? []}
          emptyTitle="No replenishment needed"
          emptyDescription="All items are above reorder levels."
          columns={[
            { key: 'item_code', label: 'Code', render: (r) => <span className="font-mono text-xs font-semibold">{r.item_code}</span> },
            { key: 'name', label: 'Item', render: (r) => <span className="font-medium text-slate-900">{r.name}</span> },
            { key: 'category', label: 'Category', render: (r) => r.category ?? '—' },
            { key: 'quantity', label: 'On Hand', render: (r) => r.quantity },
            { key: 'reorder_level', label: 'Reorder At', render: (r) => r.reorder_level },
            { key: 'recommended_qty', label: 'Recommended', render: (r) => <span className="font-semibold text-amber-600">{r.recommended_qty}</span> },
            { key: 'estimated_cost', label: 'Est. Cost', render: (r) => `₱${Number(r.estimated_cost).toLocaleString()}` },
          ]}
        />
      )}

      {showStockIn && (
        <StockInModal
          inventoryList={inventoryList}
          supplierList={suppliers?.data ?? suppliers ?? []}
          onClose={() => setShowStockIn(false)}
          onSuccess={() => { invalidateStock(); setShowStockIn(false); toast.success('Stock in recorded'); }}
        />
      )}

      {showStockOut && (
        <StockOutModal
          inventoryList={inventoryList}
          departmentList={departments?.data ?? departments ?? []}
          onClose={() => setShowStockOut(false)}
          onSuccess={() => { invalidateStock(); setShowStockOut(false); toast.success('Stock out recorded'); }}
        />
      )}

      {showAdjustment && (
        <AdjustmentModal
          inventoryList={inventoryList}
          onClose={() => setShowAdjustment(false)}
          onSuccess={() => { invalidateStock(); setShowAdjustment(false); toast.success('Adjustment submitted'); }}
        />
      )}

      {showReconciliation && (
        <ReconciliationModal
          categoryList={categories?.data ?? categories ?? []}
          onClose={() => setShowReconciliation(false)}
          onSuccess={() => { invalidateStock(); setShowReconciliation(false); toast.success('Reconciliation started'); }}
        />
      )}

      {showBatch && (
        <BatchModal
          inventoryList={inventoryList}
          onClose={() => setShowBatch(false)}
          onSuccess={() => { invalidateStock(); setShowBatch(false); toast.success('Batch created'); }}
        />
      )}

      {viewReconciliation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card-elevated flex max-h-[90vh] w-full max-w-3xl flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{viewReconciliation.title}</h2>
                <p className="text-sm text-slate-500">{viewReconciliation.reconciliation_number}</p>
              </div>
              <button type="button" onClick={() => setViewReconciliation(null)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto px-6 py-5">
              <div className="mb-4 flex gap-4 text-sm">
                <span>Status: <Badge status={viewReconciliation.status} /></span>
                <span className="text-slate-500">Started by: {viewReconciliation.starter?.name ?? '—'}</span>
              </div>
              <table className="table-zebra w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase text-slate-500">
                    <th className="pb-2">Item</th>
                    <th className="pb-2">System Qty</th>
                    <th className="pb-2">Physical Qty</th>
                    <th className="pb-2">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {(viewReconciliation.items ?? []).map((item) => (
                    <tr key={item.id}>
                      <td className="py-2">{item.inventory_item?.name ?? '—'}</td>
                      <td className="py-2">{item.system_quantity}</td>
                      <td className="py-2">{item.physical_quantity ?? '—'}</td>
                      <td className="py-2">{item.variance ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdjustmentActions({ id, onDone }: { id: number; onDone: () => void }) {
  const approve = useMutation({
    mutationFn: () => api.post(`/inventory-adjustments/${id}/approve`),
    onSuccess: () => { toast.success('Adjustment approved'); onDone(); },
    onError: (e) => apiError(e, 'Approval failed'),
  });
  const reject = useMutation({
    mutationFn: () => api.post(`/inventory-adjustments/${id}/reject`, { rejection_reason: 'Rejected via stock management' }),
    onSuccess: () => { toast.success('Adjustment rejected'); onDone(); },
    onError: (e) => apiError(e, 'Rejection failed'),
  });
  return (
    <div className="flex gap-2">
      <button onClick={() => approve.mutate()} className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700">Approve</button>
      <button onClick={() => reject.mutate()} className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700">Reject</button>
    </div>
  );
}

function StockInModal({ inventoryList, supplierList, onClose, onSuccess }: {
  inventoryList: { id: number; item_code: string; name: string; unit_cost: number }[];
  supplierList: { id: number; name: string }[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [inventoryItemId, setInventoryItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [drNumber, setDrNumber] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [notes, setNotes] = useState('');

  const create = useMutation({
    mutationFn: () => api.post('/stock-transactions/stock-in', {
      inventory_item_id: Number(inventoryItemId),
      quantity: Number(quantity),
      unit_cost: unitCost ? Number(unitCost) : undefined,
      supplier_id: supplierId ? Number(supplierId) : undefined,
      delivery_receipt_number: drNumber || undefined,
      purchase_order_number: poNumber || undefined,
      notes: notes || undefined,
    }),
    onSuccess: onSuccess,
    onError: (e) => apiError(e, 'Stock in failed'),
  });

  return (
    <Modal title="Stock In" subtitle="Record incoming stock" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Item</label>
          <select required value={inventoryItemId} onChange={(e) => {
            const id = e.target.value;
            setInventoryItemId(id);
            const item = inventoryList.find((i) => String(i.id) === id);
            if (item) setUnitCost(String(item.unit_cost));
          }} className="input-field">
            <option value="">Select item</option>
            {inventoryList.map((i) => <option key={i.id} value={i.id}>{i.item_code} — {i.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Quantity</label>
          <input required type="number" min="0.01" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Unit Cost</label>
          <input type="number" min="0" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Supplier</label>
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="input-field">
            <option value="">None</option>
            {supplierList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">DR Number</label>
          <input value={drNumber} onChange={(e) => setDrNumber(e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">PO Number</label>
          <input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} className="input-field" />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="input-field resize-none" />
        </div>
        <ModalActions onClose={onClose} pending={create.isPending} label="Record Stock In" />
      </form>
    </Modal>
  );
}

function StockOutModal({ inventoryList, departmentList, onClose, onSuccess }: {
  inventoryList: { id: number; item_code: string; name: string }[];
  departmentList: { id: number; name: string }[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [inventoryItemId, setInventoryItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');

  const create = useMutation({
    mutationFn: () => api.post('/stock-transactions/stock-out', {
      inventory_item_id: Number(inventoryItemId),
      quantity: Number(quantity),
      department_id: departmentId ? Number(departmentId) : undefined,
      purpose: purpose || undefined,
      notes: notes || undefined,
    }),
    onSuccess: onSuccess,
    onError: (e) => apiError(e, 'Stock out failed'),
  });

  return (
    <Modal title="Stock Out" subtitle="Record outgoing stock" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Item</label>
          <select required value={inventoryItemId} onChange={(e) => setInventoryItemId(e.target.value)} className="input-field">
            <option value="">Select item</option>
            {inventoryList.map((i) => <option key={i.id} value={i.id}>{i.item_code} — {i.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Quantity</label>
          <input required type="number" min="0.01" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Department</label>
          <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="input-field">
            <option value="">None</option>
            {departmentList.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Purpose</label>
          <input value={purpose} onChange={(e) => setPurpose(e.target.value)} className="input-field" />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="input-field resize-none" />
        </div>
        <ModalActions onClose={onClose} pending={create.isPending} label="Record Stock Out" />
      </form>
    </Modal>
  );
}

function AdjustmentModal({ inventoryList, onClose, onSuccess }: {
  inventoryList: { id: number; item_code: string; name: string }[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [inventoryItemId, setInventoryItemId] = useState('');
  const [adjustmentType, setAdjustmentType] = useState('increase');
  const [quantityChange, setQuantityChange] = useState('');
  const [reason, setReason] = useState('');

  const create = useMutation({
    mutationFn: () => api.post('/inventory-adjustments', {
      inventory_item_id: Number(inventoryItemId),
      adjustment_type: adjustmentType,
      quantity_change: Number(quantityChange),
      reason,
    }),
    onSuccess: onSuccess,
    onError: (e) => apiError(e, 'Adjustment failed'),
  });

  return (
    <Modal title="New Adjustment" subtitle="Submit for approval" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Item</label>
          <select required value={inventoryItemId} onChange={(e) => setInventoryItemId(e.target.value)} className="input-field">
            <option value="">Select item</option>
            {inventoryList.map((i) => <option key={i.id} value={i.id}>{i.item_code} — {i.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Type</label>
          <select required value={adjustmentType} onChange={(e) => setAdjustmentType(e.target.value)} className="input-field">
            <option value="increase">Increase</option>
            <option value="decrease">Decrease</option>
            <option value="correction">Correction</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Quantity Change</label>
          <input required type="number" step="0.01" value={quantityChange} onChange={(e) => setQuantityChange(e.target.value)} className="input-field" />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Reason</label>
          <textarea required value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="input-field resize-none" />
        </div>
        <ModalActions onClose={onClose} pending={create.isPending} label="Submit Adjustment" />
      </form>
    </Modal>
  );
}

function ReconciliationModal({ categoryList, onClose, onSuccess }: {
  categoryList: { id: number; name: string; code: string }[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [notes, setNotes] = useState('');

  const create = useMutation({
    mutationFn: () => api.post('/inventory-reconciliations', {
      title,
      category_id: categoryId ? Number(categoryId) : undefined,
      notes: notes || undefined,
    }),
    onSuccess: onSuccess,
    onError: (e) => apiError(e, 'Failed to start reconciliation'),
  });

  return (
    <Modal title="Start Reconciliation" subtitle="Physical count session" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="grid gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Title</label>
          <input required value={title} onChange={(e) => setTitle(e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Category (optional)</label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="input-field">
            <option value="">All categories</option>
            {categoryList.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="input-field resize-none" />
        </div>
        <ModalActions onClose={onClose} pending={create.isPending} label="Start" />
      </form>
    </Modal>
  );
}

function BatchModal({ inventoryList, onClose, onSuccess }: {
  inventoryList: { id: number; item_code: string; name: string }[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [inventoryItemId, setInventoryItemId] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [quantity, setQuantity] = useState('');
  const [expirationDate, setExpirationDate] = useState('');

  const create = useMutation({
    mutationFn: () => api.post('/batches', {
      inventory_item_id: Number(inventoryItemId),
      batch_number: batchNumber,
      lot_number: lotNumber || undefined,
      quantity: Number(quantity),
      expiration_date: expirationDate || undefined,
    }),
    onSuccess: onSuccess,
    onError: (e) => apiError(e, 'Batch creation failed'),
  });

  return (
    <Modal title="New Batch" subtitle="Register lot or batch" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Item</label>
          <select required value={inventoryItemId} onChange={(e) => setInventoryItemId(e.target.value)} className="input-field">
            <option value="">Select item</option>
            {inventoryList.map((i) => <option key={i.id} value={i.id}>{i.item_code} — {i.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Batch Number</label>
          <input required value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Lot Number</label>
          <input value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Quantity</label>
          <input required type="number" min="0" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Expiration Date</label>
          <input type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} className="input-field" />
        </div>
        <ModalActions onClose={onClose} pending={create.isPending} label="Create Batch" />
      </form>
    </Modal>
  );
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card-elevated flex max-h-[90vh] w-full max-w-lg flex-col">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            <p className="text-sm text-slate-500">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function ModalActions({ onClose, pending, label }: { onClose: () => void; pending: boolean; label: string }) {
  return (
    <div className="mt-2 flex justify-end gap-3 border-t border-slate-100 pt-5 sm:col-span-2">
      <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
      <button type="submit" className="btn-primary" disabled={pending}>{pending ? 'Saving...' : label}</button>
    </div>
  );
}
