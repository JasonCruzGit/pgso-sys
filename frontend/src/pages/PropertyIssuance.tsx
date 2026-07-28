import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, FileText } from 'lucide-react';
import api from '../api/client';
import DataTable from '../components/DataTable';
import Pagination from '../components/Pagination';
import PageHeader from '../components/PageHeader';
import Badge from '../components/Badge';
import type { AssetAssignment, AssetTransfer, BorrowingLog } from '../types';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

type Tab = 'assignments' | 'transfers' | 'borrowing';

const tabs: { id: Tab; label: string }[] = [
  { id: 'assignments', label: 'Assignments' },
  { id: 'transfers', label: 'Transfers' },
  { id: 'borrowing', label: 'Borrowing' },
];

function apiError(e: unknown, fallback: string) {
  const err = e as { response?: { data?: { message?: string } } };
  toast.error(err.response?.data?.message ?? fallback);
}

async function downloadPar(id: number) {
  try {
    const response = await api.get(`/reports/par/${id}`, { params: { format: 'pdf' }, responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.download = `par-${id}.pdf`;
    link.click();
    window.URL.revokeObjectURL(url);
  } catch {
    toast.error('Failed to download PAR');
  }
}

export default function PropertyIssuance() {
  const [tab, setTab] = useState<Tab>('assignments');
  const [page, setPage] = useState(1);
  const [showAssignment, setShowAssignment] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showBorrow, setShowBorrow] = useState(false);

  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canCreate = hasPermission('property.*');

  const { data: assignments, isLoading: loadingAssign } = useQuery({
    queryKey: ['asset-assignments', page],
    queryFn: () => api.get('/asset-assignments', { params: { page } }).then((r) => r.data),
    enabled: tab === 'assignments',
  });

  const { data: transfers, isLoading: loadingTransfer } = useQuery({
    queryKey: ['asset-transfers', page],
    queryFn: () => api.get('/asset-transfers', { params: { page } }).then((r) => r.data),
    enabled: tab === 'transfers',
  });

  const { data: borrowing, isLoading: loadingBorrow } = useQuery({
    queryKey: ['borrowing-logs', page],
    queryFn: () => api.get('/borrowing-logs', { params: { page } }).then((r) => r.data),
    enabled: tab === 'borrowing',
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['asset-assignments'] });
    queryClient.invalidateQueries({ queryKey: ['asset-transfers'] });
    queryClient.invalidateQueries({ queryKey: ['borrowing-logs'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const returnAssignment = useMutation({
    mutationFn: (id: number) => api.post(`/asset-assignments/${id}/return`),
    onSuccess: () => { toast.success('Asset returned'); invalidate(); },
    onError: (e) => apiError(e, 'Return failed'),
  });

  const returnBorrow = useMutation({
    mutationFn: (id: number) => api.post(`/borrowing-logs/${id}/return`, { condition_on_return: 'good' }),
    onSuccess: () => { toast.success('Borrow returned'); invalidate(); },
    onError: (e) => apiError(e, 'Return failed'),
  });

  const switchTab = (t: Tab) => { setTab(t); setPage(1); };

  const actionButton = () => {
    if (!canCreate) return undefined;
    if (tab === 'assignments') return <button type="button" className="btn-primary" onClick={() => setShowAssignment(true)}><Plus size={18} /> New Assignment</button>;
    if (tab === 'transfers') return <button type="button" className="btn-primary" onClick={() => setShowTransfer(true)}><Plus size={18} /> New Transfer</button>;
    if (tab === 'borrowing') return <button type="button" className="btn-primary" onClick={() => setShowBorrow(true)}><Plus size={18} /> New Borrow</button>;
    return undefined;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Property Issuance"
        description="Manage asset assignments, transfers, and borrowing"
        action={actionButton()}
      />

      <div className="flex flex-wrap gap-1 rounded-full bg-white p-1 shadow-sm">
        {tabs.map((t) => (
          <button key={t.id} type="button" onClick={() => switchTab(t.id)} className={`pill-nav ${tab === t.id ? 'pill-nav-active' : 'hover:bg-slate-100'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'assignments' && (
        <>
          <DataTable<AssetAssignment>
            loading={loadingAssign}
            data={assignments?.data ?? []}
            emptyTitle="No assignments"
            emptyDescription="Asset assignments will appear here."
            columns={[
              { key: 'assignment_number', label: 'Ref No.', render: (r) => <span className="font-mono text-xs font-semibold text-palawan-700">{r.assignment_number}</span> },
              { key: 'asset', label: 'Asset', render: (r) => r.asset?.inventory_item?.name ?? r.asset?.property_number ?? '—' },
              { key: 'custodian', label: 'Custodian', render: (r) => r.custodian?.name ?? '—' },
              { key: 'department', label: 'Department', render: (r) => r.department?.name ?? '—' },
              { key: 'document_type', label: 'Doc', render: (r) => r.document_type?.toUpperCase() ?? '—' },
              { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
              { key: 'date', label: 'Date', render: (r) => new Date(r.assignment_date).toLocaleDateString() },
              {
                key: 'actions',
                label: 'Actions',
                render: (r) => (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => downloadPar(r.id)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                      <FileText size={12} /> PAR
                    </button>
                    {r.status === 'active' && hasPermission('property.*') && (
                      <button onClick={() => returnAssignment.mutate(r.id)} className="rounded-lg bg-palawan-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-palawan-700">Return</button>
                    )}
                  </div>
                ),
              },
            ]}
          />
          <Pagination currentPage={assignments?.current_page ?? 1} lastPage={assignments?.last_page ?? 1} onPageChange={setPage} />
        </>
      )}

      {tab === 'transfers' && (
        <>
          <DataTable<AssetTransfer>
            loading={loadingTransfer}
            data={transfers?.data ?? []}
            emptyTitle="No transfers"
            emptyDescription="Asset transfers will appear here."
            columns={[
              { key: 'transfer_number', label: 'Ref No.', render: (r) => <span className="font-mono text-xs font-semibold text-palawan-700">{r.transfer_number}</span> },
              { key: 'asset', label: 'Asset', render: (r) => r.asset?.inventory_item?.name ?? '—' },
              { key: 'from', label: 'From', render: (r) => r.from_user?.name ?? '—' },
              { key: 'to', label: 'To', render: (r) => r.to_user?.name ?? '—' },
              { key: 'department', label: 'To Dept', render: (r) => r.to_department?.name ?? '—' },
              { key: 'date', label: 'Date', render: (r) => new Date(r.transfer_date).toLocaleDateString() },
            ]}
          />
          <Pagination currentPage={transfers?.current_page ?? 1} lastPage={transfers?.last_page ?? 1} onPageChange={setPage} />
        </>
      )}

      {tab === 'borrowing' && (
        <>
          <DataTable<BorrowingLog>
            loading={loadingBorrow}
            data={borrowing?.data ?? []}
            emptyTitle="No borrowing records"
            emptyDescription="Asset borrowing logs will appear here."
            columns={[
              { key: 'borrow_number', label: 'Ref No.', render: (r) => <span className="font-mono text-xs font-semibold text-palawan-700">{r.borrow_number}</span> },
              { key: 'asset', label: 'Asset', render: (r) => r.asset?.inventory_item?.name ?? '—' },
              { key: 'borrower', label: 'Borrower', render: (r) => r.borrower?.name ?? '—' },
              { key: 'department', label: 'Department', render: (r) => r.department?.name ?? '—' },
              { key: 'expected_return_date', label: 'Due', render: (r) => new Date(r.expected_return_date).toLocaleDateString() },
              { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
              {
                key: 'actions',
                label: 'Actions',
                render: (r) => (r.status === 'active' || r.status === 'overdue') && hasPermission('property.*') ? (
                  <button onClick={() => returnBorrow.mutate(r.id)} className="rounded-lg bg-palawan-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-palawan-700">Return</button>
                ) : null,
              },
            ]}
          />
          <Pagination currentPage={borrowing?.current_page ?? 1} lastPage={borrowing?.last_page ?? 1} onPageChange={setPage} />
        </>
      )}

      {showAssignment && <AssignmentModal onClose={() => setShowAssignment(false)} onSuccess={() => { invalidate(); setShowAssignment(false); toast.success('Assignment created'); }} />}
      {showTransfer && <TransferModal onClose={() => setShowTransfer(false)} onSuccess={() => { invalidate(); setShowTransfer(false); toast.success('Transfer recorded'); }} />}
      {showBorrow && <BorrowModal onClose={() => setShowBorrow(false)} onSuccess={() => { invalidate(); setShowBorrow(false); toast.success('Borrow recorded'); }} />}
    </div>
  );
}

function AssignmentModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [assetId, setAssetId] = useState('');
  const [custodianId, setCustodianId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [assignmentDate, setAssignmentDate] = useState(new Date().toISOString().slice(0, 10));
  const [documentType, setDocumentType] = useState('par');
  const [location, setLocation] = useState('');
  const [condition, setCondition] = useState('good');
  const [notes, setNotes] = useState('');

  const { data: assets } = useQuery({
    queryKey: ['assets-select'],
    queryFn: () => api.get('/assets', { params: { per_page: 200 } }).then((r) => r.data),
  });
  const { data: custodians } = useQuery({
    queryKey: ['custodians-select', departmentId],
    queryFn: () => api.get('/custodians', { params: { department_id: departmentId || undefined } }).then((r) => r.data),
  });
  const { data: departments } = useQuery({ queryKey: ['departments'], queryFn: () => api.get('/departments').then((r) => r.data) });

  type AssetOption = {
    id: number;
    property_number: string;
    location?: string;
    condition?: string;
    inventory_item?: {
      name: string;
      item_code?: string;
      serial_number?: string;
      unit_of_measure?: string;
      unit_cost?: number;
      storage_location?: string;
      category?: { name: string };
    };
  };

  type CustodianOption = {
    id: number;
    name: string;
    employee_id?: string;
    department_id?: number;
    department?: { name: string };
  };

  const assetList: AssetOption[] = assets?.data ?? [];
  const custodianList: CustodianOption[] = custodians?.data ?? [];
  const deptList = departments?.data ?? departments ?? [];
  const selectedAsset = assetList.find((a) => String(a.id) === assetId);
  const selectedCustodian = custodianList.find((c) => String(c.id) === custodianId);
  const item = selectedAsset?.inventory_item;

  useEffect(() => {
    if (!selectedAsset) return;
    setLocation(selectedAsset.location ?? item?.storage_location ?? '');
    setCondition(selectedAsset.condition ?? 'good');
  }, [selectedAsset?.id]);

  useEffect(() => {
    if (!selectedCustodian?.department_id) return;
    setDepartmentId(String(selectedCustodian.department_id));
  }, [custodianId, selectedCustodian?.department_id]);

  const create = useMutation({
    mutationFn: () => api.post('/asset-assignments', {
      asset_id: Number(assetId),
      custodian_user_id: Number(custodianId),
      department_id: Number(departmentId),
      assignment_date: assignmentDate,
      document_type: documentType,
      location: location || undefined,
      condition: condition || undefined,
      notes: notes || undefined,
    }),
    onSuccess: onSuccess,
    onError: (e) => apiError(e, 'Assignment failed'),
  });

  return (
    <FormModal wide title="New Assignment" subtitle="Assign government property (PAR / ICS)" onClose={onClose} onSubmit={() => create.mutate()} pending={create.isPending} label="Create Assignment">
      <div className="space-y-6">
        <section>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Property / Asset</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Asset</label>
              <select required value={assetId} onChange={(e) => setAssetId(e.target.value)} className="input-field uppercase">
                <option value="">SELECT ASSET</option>
                {assetList.map((a) => (
                  <option key={a.id} value={a.id}>{a.property_number} — {a.inventory_item?.name}</option>
                ))}
              </select>
            </div>
            <ReadOnlyField label="Property Number" value={selectedAsset?.property_number} mono />
            <ReadOnlyField label="Item Code" value={item?.item_code} mono />
            <ReadOnlyField label="Item Name" value={item?.name} className="sm:col-span-2" />
            <ReadOnlyField label="Serial Number" value={item?.serial_number} mono />
            <ReadOnlyField label="Category" value={item?.category?.name} />
            <ReadOnlyField label="Unit Cost" value={item?.unit_cost != null ? `₱${Number(item.unit_cost).toLocaleString()}` : undefined} />
            <ReadOnlyField label="Quantity" value={item ? `1 ${(item.unit_of_measure ?? 'unit').toUpperCase()}` : undefined} />
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Custodian & Office</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Custodian</label>
              <select required value={custodianId} onChange={(e) => setCustodianId(e.target.value)} className="input-field">
                <option value="">Select custodian</option>
                {custodianList.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}{u.employee_id ? ` (${u.employee_id})` : ''}</option>
                ))}
              </select>
            </div>
            <ReadOnlyField label="Employee ID" value={selectedCustodian?.employee_id} mono />
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Department / Office</label>
              <select required value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="input-field">
                <option value="">Select department</option>
                {deptList.map((d: { id: number; name: string }) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Assignment Details</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Assignment Date</label>
              <input required type="date" value={assignmentDate} onChange={(e) => setAssignmentDate(e.target.value)} className="input-field" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Document Type</label>
              <select required value={documentType} onChange={(e) => setDocumentType(e.target.value)} className="input-field uppercase">
                <option value="par">PAR — Property Acknowledgment Receipt</option>
                <option value="ics">ICS — Inventory Custodian Slip</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Location</label>
              <input required value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Office / room / building" className="input-field" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Condition</label>
              <select required value={condition} onChange={(e) => setCondition(e.target.value)} className="input-field uppercase">
                <option value="excellent">EXCELLENT</option>
                <option value="good">GOOD</option>
                <option value="fair">FAIR</option>
                <option value="poor">POOR</option>
                <option value="damaged">DAMAGED</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Notes / Remarks</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Purpose, special instructions, or accountability remarks" className="input-field resize-none" />
            </div>
          </div>
        </section>
      </div>
    </FormModal>
  );
}

function ReadOnlyField({ label, value, mono, className = '' }: { label: string; value?: string | null; mono?: boolean; className?: string }) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      <p className={`rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-800 ring-1 ring-slate-200 ${mono ? 'font-mono' : ''}`}>
        {value?.trim() ? value : '—'}
      </p>
    </div>
  );
}

function TransferModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [assetId, setAssetId] = useState('');
  const [toUserId, setToUserId] = useState('');
  const [toDeptId, setToDeptId] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const { hasPermission } = useAuth();

  const { data: assets } = useQuery({ queryKey: ['assets-select'], queryFn: () => api.get('/assets', { params: { per_page: 200 } }).then((r) => r.data) });
  const { data: users } = useQuery({
    queryKey: ['users-select'],
    queryFn: () => api.get('/users', { params: { per_page: 200 } }).then((r) => r.data),
    enabled: hasPermission('users.*'),
  });
  const { data: departments } = useQuery({ queryKey: ['departments'], queryFn: () => api.get('/departments').then((r) => r.data) });

  const create = useMutation({
    mutationFn: () => api.post('/asset-transfers', {
      asset_id: Number(assetId),
      to_user_id: Number(toUserId),
      to_department_id: Number(toDeptId),
      transfer_date: transferDate,
      reason: reason || undefined,
    }),
    onSuccess: onSuccess,
    onError: (e) => apiError(e, 'Transfer failed'),
  });

  const assetList = assets?.data ?? [];
  const userList = users?.data ?? [];
  const deptList = departments?.data ?? departments ?? [];

  return (
    <FormModal title="New Transfer" subtitle="Transfer asset custody" onClose={onClose} onSubmit={() => create.mutate()} pending={create.isPending} label="Record Transfer">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Asset</label>
          <select required value={assetId} onChange={(e) => setAssetId(e.target.value)} className="input-field">
            <option value="">Select asset</option>
            {assetList.map((a: { id: number; property_number: string; inventory_item?: { name: string } }) => (
              <option key={a.id} value={a.id}>{a.property_number} — {a.inventory_item?.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Transfer To</label>
          <select required value={toUserId} onChange={(e) => setToUserId(e.target.value)} className="input-field">
            <option value="">Select user</option>
            {userList.map((u: { id: number; name: string }) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">To Department</label>
          <select required value={toDeptId} onChange={(e) => setToDeptId(e.target.value)} className="input-field">
            <option value="">Select department</option>
            {deptList.map((d: { id: number; name: string }) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Transfer Date</label>
          <input required type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} className="input-field" />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Reason</label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} className="input-field" />
        </div>
      </div>
    </FormModal>
  );
}

function BorrowModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [assetId, setAssetId] = useState('');
  const [borrowerId, setBorrowerId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [borrowDate, setBorrowDate] = useState(new Date().toISOString().slice(0, 10));
  const [expectedReturn, setExpectedReturn] = useState('');
  const [condition, setCondition] = useState('good');
  const [purpose, setPurpose] = useState('');
  const { hasPermission } = useAuth();

  const { data: assets } = useQuery({ queryKey: ['assets-select'], queryFn: () => api.get('/assets', { params: { per_page: 200 } }).then((r) => r.data) });
  const { data: users } = useQuery({
    queryKey: ['users-select'],
    queryFn: () => api.get('/users', { params: { per_page: 200 } }).then((r) => r.data),
    enabled: hasPermission('users.*'),
  });
  const { data: departments } = useQuery({ queryKey: ['departments'], queryFn: () => api.get('/departments').then((r) => r.data) });

  const create = useMutation({
    mutationFn: () => api.post('/borrowing-logs', {
      asset_id: Number(assetId),
      borrower_user_id: Number(borrowerId),
      department_id: Number(departmentId),
      borrow_date: borrowDate,
      expected_return_date: expectedReturn,
      condition_on_borrow: condition,
      purpose: purpose || undefined,
    }),
    onSuccess: onSuccess,
    onError: (e) => apiError(e, 'Borrow failed'),
  });

  const assetList = assets?.data ?? [];
  const userList = users?.data ?? [];
  const deptList = departments?.data ?? departments ?? [];

  return (
    <FormModal title="New Borrow" subtitle="Record asset borrowing" onClose={onClose} onSubmit={() => create.mutate()} pending={create.isPending} label="Record Borrow">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Asset</label>
          <select required value={assetId} onChange={(e) => setAssetId(e.target.value)} className="input-field">
            <option value="">Select asset</option>
            {assetList.map((a: { id: number; property_number: string; inventory_item?: { name: string } }) => (
              <option key={a.id} value={a.id}>{a.property_number} — {a.inventory_item?.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Borrower</label>
          <select required value={borrowerId} onChange={(e) => setBorrowerId(e.target.value)} className="input-field">
            <option value="">Select user</option>
            {userList.map((u: { id: number; name: string }) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Department</label>
          <select required value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="input-field">
            <option value="">Select department</option>
            {deptList.map((d: { id: number; name: string }) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Borrow Date</label>
          <input required type="date" value={borrowDate} onChange={(e) => setBorrowDate(e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Expected Return</label>
          <input required type="date" value={expectedReturn} onChange={(e) => setExpectedReturn(e.target.value)} className="input-field" />
        </div>
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
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Purpose</label>
          <input value={purpose} onChange={(e) => setPurpose(e.target.value)} className="input-field" />
        </div>
      </div>
    </FormModal>
  );
}

function FormModal({ title, subtitle, onClose, onSubmit, pending, label, wide, children }: {
  title: string; subtitle: string; onClose: () => void; onSubmit: () => void; pending: boolean; label: string; wide?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={`card-elevated flex max-h-[90vh] w-full flex-col ${wide ? 'max-w-3xl' : 'max-w-lg'}`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            <p className="text-sm text-slate-500">{subtitle}</p>
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
