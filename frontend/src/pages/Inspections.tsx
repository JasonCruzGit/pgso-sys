import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import api from '../api/client';
import DataTable from '../components/DataTable';
import Pagination from '../components/Pagination';
import PageHeader from '../components/PageHeader';
import Badge from '../components/Badge';
import type { Inspection, MaintenanceRecord, RepairRecord, DisposalRecord } from '../types';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

type Tab = 'inspections' | 'maintenance' | 'repairs' | 'disposal';

const tabs: { id: Tab; label: string }[] = [
  { id: 'inspections', label: 'Inspections' },
  { id: 'maintenance', label: 'Maintenance' },
  { id: 'repairs', label: 'Repairs' },
  { id: 'disposal', label: 'Disposal' },
];

function apiError(e: unknown, fallback: string) {
  const err = e as { response?: { data?: { message?: string } } };
  toast.error(err.response?.data?.message ?? fallback);
}

export default function InspectionsPage() {
  const [tab, setTab] = useState<Tab>('inspections');
  const [page, setPage] = useState(1);
  const [showInspection, setShowInspection] = useState(false);
  const [showMaintenance, setShowMaintenance] = useState(false);
  const [showRepair, setShowRepair] = useState(false);
  const [showDisposal, setShowDisposal] = useState(false);
  const [completeInspection, setCompleteInspection] = useState<Inspection | null>(null);
  const [completeMaintenance, setCompleteMaintenance] = useState<MaintenanceRecord | null>(null);

  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canCreate = hasPermission('inspection.*');

  const { data: inspections, isLoading: loadingInsp } = useQuery({
    queryKey: ['inspections', page],
    queryFn: () => api.get('/inspections', { params: { page } }).then((r) => r.data),
    enabled: tab === 'inspections',
  });

  const { data: maintenance, isLoading: loadingMaint } = useQuery({
    queryKey: ['maintenance-records', page],
    queryFn: () => api.get('/maintenance-records', { params: { page } }).then((r) => r.data),
    enabled: tab === 'maintenance',
  });

  const { data: repairs, isLoading: loadingRepair } = useQuery({
    queryKey: ['repair-records', page],
    queryFn: () => api.get('/repair-records', { params: { page } }).then((r) => r.data),
    enabled: tab === 'repairs',
  });

  const { data: disposals, isLoading: loadingDisposal } = useQuery({
    queryKey: ['disposal-records', page],
    queryFn: () => api.get('/disposal-records', { params: { page } }).then((r) => r.data),
    enabled: tab === 'disposal',
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['inspections'] });
    queryClient.invalidateQueries({ queryKey: ['maintenance-records'] });
    queryClient.invalidateQueries({ queryKey: ['repair-records'] });
    queryClient.invalidateQueries({ queryKey: ['disposal-records'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const approveDisposal = useMutation({
    mutationFn: (id: number) => api.post(`/disposal-records/${id}/approve`),
    onSuccess: () => { toast.success('Disposal approved'); invalidate(); },
    onError: (e) => apiError(e, 'Approval failed'),
  });

  const switchTab = (t: Tab) => { setTab(t); setPage(1); };

  const actionButton = () => {
    if (!canCreate) return undefined;
    if (tab === 'inspections') return <button type="button" className="btn-primary" onClick={() => setShowInspection(true)}><Plus size={18} /> Schedule Inspection</button>;
    if (tab === 'maintenance') return <button type="button" className="btn-primary" onClick={() => setShowMaintenance(true)}><Plus size={18} /> New Maintenance</button>;
    if (tab === 'repairs') return <button type="button" className="btn-primary" onClick={() => setShowRepair(true)}><Plus size={18} /> New Repair</button>;
    if (tab === 'disposal') return <button type="button" className="btn-primary" onClick={() => setShowDisposal(true)}><Plus size={18} /> Recommend Disposal</button>;
    return undefined;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inspections & Maintenance"
        description="Schedule inspections, maintenance, repairs, and disposal"
        action={actionButton()}
      />

      <div className="flex flex-wrap gap-1 rounded-full bg-white p-1 shadow-sm">
        {tabs.map((t) => (
          <button key={t.id} type="button" onClick={() => switchTab(t.id)} className={`pill-nav ${tab === t.id ? 'pill-nav-active' : 'hover:bg-slate-100'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'inspections' && (
        <>
          <DataTable<Inspection>
            loading={loadingInsp}
            data={inspections?.data ?? []}
            emptyTitle="No inspections"
            emptyDescription="Scheduled inspections will appear here."
            columns={[
              { key: 'inspection_number', label: 'Ref No.', render: (r) => <span className="font-mono text-xs font-semibold text-palawan-700">{r.inspection_number}</span> },
              { key: 'target', label: 'Target', render: (r) => r.asset?.inventory_item?.name ?? r.inventory_item?.name ?? '—' },
              { key: 'inspector', label: 'Inspector', render: (r) => r.inspector?.name ?? '—' },
              { key: 'scheduled_date', label: 'Scheduled', render: (r) => new Date(r.scheduled_date).toLocaleDateString() },
              { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
              {
                key: 'actions',
                label: 'Actions',
                render: (r) => r.status === 'scheduled' && hasPermission('inspection.*') ? (
                  <button onClick={() => setCompleteInspection(r)} className="rounded-lg bg-palawan-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-palawan-700">Complete</button>
                ) : null,
              },
            ]}
          />
          <Pagination currentPage={inspections?.current_page ?? 1} lastPage={inspections?.last_page ?? 1} onPageChange={setPage} />
        </>
      )}

      {tab === 'maintenance' && (
        <>
          <DataTable<MaintenanceRecord>
            loading={loadingMaint}
            data={maintenance?.data ?? []}
            emptyTitle="No maintenance records"
            emptyDescription="Maintenance schedules will appear here."
            columns={[
              { key: 'maintenance_number', label: 'Ref No.', render: (r) => <span className="font-mono text-xs font-semibold text-palawan-700">{r.maintenance_number}</span> },
              { key: 'asset', label: 'Asset', render: (r) => r.asset?.inventory_item?.name ?? '—' },
              { key: 'type', label: 'Type', render: (r) => <Badge status={r.type} /> },
              { key: 'scheduled_date', label: 'Scheduled', render: (r) => r.scheduled_date ? new Date(r.scheduled_date).toLocaleDateString() : '—' },
              { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
              {
                key: 'actions',
                label: 'Actions',
                render: (r) => (r.status === 'scheduled' || r.status === 'in_progress') && hasPermission('inspection.*') ? (
                  <button onClick={() => setCompleteMaintenance(r)} className="rounded-lg bg-palawan-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-palawan-700">Complete</button>
                ) : null,
              },
            ]}
          />
          <Pagination currentPage={maintenance?.current_page ?? 1} lastPage={maintenance?.last_page ?? 1} onPageChange={setPage} />
        </>
      )}

      {tab === 'repairs' && (
        <>
          <DataTable<RepairRecord>
            loading={loadingRepair}
            data={repairs?.data ?? []}
            emptyTitle="No repair records"
            emptyDescription="Repair records will appear here."
            columns={[
              { key: 'repair_number', label: 'Ref No.', render: (r) => <span className="font-mono text-xs font-semibold text-palawan-700">{r.repair_number}</span> },
              { key: 'asset', label: 'Asset', render: (r) => r.asset?.inventory_item?.name ?? '—' },
              { key: 'service_provider', label: 'Provider', render: (r) => r.service_provider ?? '—' },
              { key: 'repair_date', label: 'Date', render: (r) => new Date(r.repair_date).toLocaleDateString() },
              { key: 'cost', label: 'Cost', render: (r) => `₱${Number(r.cost).toLocaleString()}` },
            ]}
          />
          <Pagination currentPage={repairs?.current_page ?? 1} lastPage={repairs?.last_page ?? 1} onPageChange={setPage} />
        </>
      )}

      {tab === 'disposal' && (
        <>
          <DataTable<DisposalRecord>
            loading={loadingDisposal}
            data={disposals?.data ?? []}
            emptyTitle="No disposal records"
            emptyDescription="Disposal recommendations will appear here."
            columns={[
              { key: 'disposal_number', label: 'Ref No.', render: (r) => <span className="font-mono text-xs font-semibold text-palawan-700">{r.disposal_number}</span> },
              { key: 'target', label: 'Item/Asset', render: (r) => r.asset?.inventory_item?.name ?? r.inventory_item?.name ?? '—' },
              { key: 'reason', label: 'Reason', render: (r) => <span className="max-w-xs truncate block">{r.reason}</span> },
              { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
              { key: 'date', label: 'Date', render: (r) => new Date(r.recommendation_date).toLocaleDateString() },
              {
                key: 'actions',
                label: 'Actions',
                render: (r) => r.status === 'recommended' && hasPermission('inspection.*') ? (
                  <button onClick={() => approveDisposal.mutate(r.id)} className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700">Approve</button>
                ) : null,
              },
            ]}
          />
          <Pagination currentPage={disposals?.current_page ?? 1} lastPage={disposals?.last_page ?? 1} onPageChange={setPage} />
        </>
      )}

      {showInspection && <InspectionModal onClose={() => setShowInspection(false)} onSuccess={() => { invalidate(); setShowInspection(false); toast.success('Inspection scheduled'); }} />}
      {showMaintenance && <MaintenanceModal onClose={() => setShowMaintenance(false)} onSuccess={() => { invalidate(); setShowMaintenance(false); toast.success('Maintenance created'); }} />}
      {showRepair && <RepairModal onClose={() => setShowRepair(false)} onSuccess={() => { invalidate(); setShowRepair(false); toast.success('Repair recorded'); }} />}
      {showDisposal && <DisposalModal onClose={() => setShowDisposal(false)} onSuccess={() => { invalidate(); setShowDisposal(false); toast.success('Disposal recommended'); }} />}

      {completeInspection && (
        <CompleteInspectionModal
          inspection={completeInspection}
          onClose={() => setCompleteInspection(null)}
          onSuccess={() => { invalidate(); setCompleteInspection(null); toast.success('Inspection completed'); }}
        />
      )}

      {completeMaintenance && (
        <CompleteMaintenanceModal
          record={completeMaintenance}
          onClose={() => setCompleteMaintenance(null)}
          onSuccess={() => { invalidate(); setCompleteMaintenance(null); toast.success('Maintenance completed'); }}
        />
      )}
    </div>
  );
}

function InspectionModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [assetId, setAssetId] = useState('');
  const [inventoryItemId, setInventoryItemId] = useState('');
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().slice(0, 10));
  const [findings, setFindings] = useState('');

  const { data: assets } = useQuery({ queryKey: ['assets-select'], queryFn: () => api.get('/assets', { params: { per_page: 200 } }).then((r) => r.data) });
  const { data: inventory } = useQuery({ queryKey: ['inventory-select'], queryFn: () => api.get('/inventory', { params: { per_page: 200 } }).then((r) => r.data) });

  const create = useMutation({
    mutationFn: () => api.post('/inspections', {
      asset_id: assetId ? Number(assetId) : undefined,
      inventory_item_id: inventoryItemId ? Number(inventoryItemId) : undefined,
      scheduled_date: scheduledDate,
      findings: findings || undefined,
    }),
    onSuccess: onSuccess,
    onError: (e) => apiError(e, 'Failed to schedule inspection'),
  });

  return (
    <FormModal title="Schedule Inspection" onClose={onClose} onSubmit={() => create.mutate()} pending={create.isPending} label="Schedule">
      <div className="grid gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Asset (optional)</label>
          <select value={assetId} onChange={(e) => { setAssetId(e.target.value); if (e.target.value) setInventoryItemId(''); }} className="input-field">
            <option value="">None</option>
            {(assets?.data ?? []).map((a: { id: number; property_number: string; inventory_item?: { name: string } }) => (
              <option key={a.id} value={a.id}>{a.property_number} — {a.inventory_item?.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Inventory Item (optional)</label>
          <select value={inventoryItemId} onChange={(e) => { setInventoryItemId(e.target.value); if (e.target.value) setAssetId(''); }} className="input-field">
            <option value="">None</option>
            {(inventory?.data ?? []).map((i: { id: number; item_code: string; name: string }) => (
              <option key={i.id} value={i.id}>{i.item_code} — {i.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Scheduled Date</label>
          <input required type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Findings</label>
          <textarea value={findings} onChange={(e) => setFindings(e.target.value)} rows={2} className="input-field resize-none" />
        </div>
      </div>
    </FormModal>
  );
}

function MaintenanceModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [assetId, setAssetId] = useState('');
  const [type, setType] = useState('preventive');
  const [scheduledDate, setScheduledDate] = useState('');
  const [serviceProvider, setServiceProvider] = useState('');
  const [cost, setCost] = useState('');
  const [description, setDescription] = useState('');

  const { data: assets } = useQuery({ queryKey: ['assets-select'], queryFn: () => api.get('/assets', { params: { per_page: 200 } }).then((r) => r.data) });

  const create = useMutation({
    mutationFn: () => api.post('/maintenance-records', {
      asset_id: Number(assetId),
      type,
      scheduled_date: scheduledDate || undefined,
      service_provider: serviceProvider || undefined,
      cost: cost ? Number(cost) : undefined,
      description: description || undefined,
    }),
    onSuccess: onSuccess,
    onError: (e) => apiError(e, 'Maintenance creation failed'),
  });

  return (
    <FormModal title="New Maintenance" onClose={onClose} onSubmit={() => create.mutate()} pending={create.isPending} label="Create">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Asset</label>
          <select required value={assetId} onChange={(e) => setAssetId(e.target.value)} className="input-field">
            <option value="">Select asset</option>
            {(assets?.data ?? []).map((a: { id: number; property_number: string; inventory_item?: { name: string } }) => (
              <option key={a.id} value={a.id}>{a.property_number} — {a.inventory_item?.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Type</label>
          <select required value={type} onChange={(e) => setType(e.target.value)} className="input-field">
            <option value="preventive">Preventive</option>
            <option value="corrective">Corrective</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Scheduled Date</label>
          <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Service Provider</label>
          <input value={serviceProvider} onChange={(e) => setServiceProvider(e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Est. Cost</label>
          <input type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} className="input-field" />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="input-field resize-none" />
        </div>
      </div>
    </FormModal>
  );
}

function RepairModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [assetId, setAssetId] = useState('');
  const [repairDate, setRepairDate] = useState(new Date().toISOString().slice(0, 10));
  const [serviceProvider, setServiceProvider] = useState('');
  const [cost, setCost] = useState('');
  const [description, setDescription] = useState('');

  const { data: assets } = useQuery({ queryKey: ['assets-select'], queryFn: () => api.get('/assets', { params: { per_page: 200 } }).then((r) => r.data) });

  const create = useMutation({
    mutationFn: () => api.post('/repair-records', {
      asset_id: Number(assetId),
      repair_date: repairDate,
      service_provider: serviceProvider || undefined,
      cost: cost ? Number(cost) : undefined,
      description: description || undefined,
    }),
    onSuccess: onSuccess,
    onError: (e) => apiError(e, 'Repair creation failed'),
  });

  return (
    <FormModal title="New Repair" onClose={onClose} onSubmit={() => create.mutate()} pending={create.isPending} label="Record Repair">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Asset</label>
          <select required value={assetId} onChange={(e) => setAssetId(e.target.value)} className="input-field">
            <option value="">Select asset</option>
            {(assets?.data ?? []).map((a: { id: number; property_number: string; inventory_item?: { name: string } }) => (
              <option key={a.id} value={a.id}>{a.property_number} — {a.inventory_item?.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Repair Date</label>
          <input required type="date" value={repairDate} onChange={(e) => setRepairDate(e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Service Provider</label>
          <input value={serviceProvider} onChange={(e) => setServiceProvider(e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Cost</label>
          <input type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} className="input-field" />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="input-field resize-none" />
        </div>
      </div>
    </FormModal>
  );
}

function DisposalModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [assetId, setAssetId] = useState('');
  const [inventoryItemId, setInventoryItemId] = useState('');
  const [recommendationDate, setRecommendationDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const { data: assets } = useQuery({ queryKey: ['assets-select'], queryFn: () => api.get('/assets', { params: { per_page: 200 } }).then((r) => r.data) });
  const { data: inventory } = useQuery({ queryKey: ['inventory-select'], queryFn: () => api.get('/inventory', { params: { per_page: 200 } }).then((r) => r.data) });

  const create = useMutation({
    mutationFn: () => api.post('/disposal-records', {
      asset_id: assetId ? Number(assetId) : undefined,
      inventory_item_id: inventoryItemId ? Number(inventoryItemId) : undefined,
      recommendation_date: recommendationDate,
      reason,
      notes: notes || undefined,
    }),
    onSuccess: onSuccess,
    onError: (e) => apiError(e, 'Disposal recommendation failed'),
  });

  return (
    <FormModal title="Recommend Disposal" onClose={onClose} onSubmit={() => create.mutate()} pending={create.isPending} label="Submit">
      <div className="grid gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Asset (optional)</label>
          <select value={assetId} onChange={(e) => { setAssetId(e.target.value); if (e.target.value) setInventoryItemId(''); }} className="input-field">
            <option value="">None</option>
            {(assets?.data ?? []).map((a: { id: number; property_number: string }) => <option key={a.id} value={a.id}>{a.property_number}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Inventory Item (optional)</label>
          <select value={inventoryItemId} onChange={(e) => { setInventoryItemId(e.target.value); if (e.target.value) setAssetId(''); }} className="input-field">
            <option value="">None</option>
            {(inventory?.data ?? []).map((i: { id: number; item_code: string; name: string }) => (
              <option key={i.id} value={i.id}>{i.item_code} — {i.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Recommendation Date</label>
          <input required type="date" value={recommendationDate} onChange={(e) => setRecommendationDate(e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Reason</label>
          <textarea required value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="input-field resize-none" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="input-field resize-none" />
        </div>
      </div>
    </FormModal>
  );
}

function CompleteInspectionModal({ inspection, onClose, onSuccess }: { inspection: Inspection; onClose: () => void; onSuccess: () => void }) {
  const [condition, setCondition] = useState('good');
  const [findings, setFindings] = useState(inspection.findings ?? '');

  const complete = useMutation({
    mutationFn: () => api.post(`/inspections/${inspection.id}/complete`, { condition, findings: findings || undefined }),
    onSuccess: onSuccess,
    onError: (e) => apiError(e, 'Completion failed'),
  });

  return (
    <FormModal title="Complete Inspection" subtitle={inspection.inspection_number} onClose={onClose} onSubmit={() => complete.mutate()} pending={complete.isPending} label="Complete">
      <div className="grid gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Condition</label>
          <select required value={condition} onChange={(e) => setCondition(e.target.value)} className="input-field">
            <option value="excellent">Excellent</option>
            <option value="good">Good</option>
            <option value="fair">Fair</option>
            <option value="poor">Poor</option>
            <option value="unserviceable">Unserviceable</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Findings</label>
          <textarea value={findings} onChange={(e) => setFindings(e.target.value)} rows={3} className="input-field resize-none" />
        </div>
      </div>
    </FormModal>
  );
}

function CompleteMaintenanceModal({ record, onClose, onSuccess }: { record: MaintenanceRecord; onClose: () => void; onSuccess: () => void }) {
  const [cost, setCost] = useState(String(record.cost ?? ''));
  const [description, setDescription] = useState(record.description ?? '');

  const complete = useMutation({
    mutationFn: () => api.post(`/maintenance-records/${record.id}/complete`, {
      cost: cost ? Number(cost) : undefined,
      description: description || undefined,
    }),
    onSuccess: onSuccess,
    onError: (e) => apiError(e, 'Completion failed'),
  });

  return (
    <FormModal title="Complete Maintenance" subtitle={record.maintenance_number} onClose={onClose} onSubmit={() => complete.mutate()} pending={complete.isPending} label="Complete">
      <div className="grid gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Final Cost</label>
          <input type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="input-field resize-none" />
        </div>
      </div>
    </FormModal>
  );
}

function FormModal({ title, subtitle, onClose, onSubmit, pending, label, children }: {
  title: string; subtitle?: string; onClose: () => void; onSubmit: () => void; pending: boolean; label: string; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card-elevated flex max-h-[90vh] w-full max-w-lg flex-col">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X size={20} /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="overflow-y-auto px-6 py-5">
          {children}
          <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={pending}>{pending ? 'Saving...' : label}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
