import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Package, User, Eye, Printer } from 'lucide-react';
import api from '../api/client';
import DataTable from '../components/DataTable';
import Pagination from '../components/Pagination';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import Badge from '../components/Badge';
import type { MaterialRelease, IssuanceRequest, InventoryItem, User as AppUser } from '../types';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  escapeHtml,
  formatPrintMoney,
  formatPrintQty,
  governmentPrintLetterhead,
  openGovernmentPrintWindow,
} from '../utils/governmentPrint';
import { BRANDING } from '../constants/branding';

function formatQtyInt(qty: string | number): string {
  const n = Number(qty);
  if (Number.isNaN(n)) return '0';
  return String(Math.round(n));
}

function openMaterialReleasePrintPreview(mr: MaterialRelease) {
  const items = mr.items ?? [];
  const generatedAt = new Date().toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' });
  const statusLabel = (mr.status ?? 'completed').replace(/_/g, ' ').toUpperCase();
  const sourceLabel = mr.source === 'request' ? 'FROM REQUEST' : 'DIRECT RELEASE';
  const releaseDate = mr.release_date
    ? new Date(mr.release_date).toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' })
    : '—';
  const totalValue = items.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unit_cost), 0);
  const totalQty = items.reduce((sum, line) => sum + Number(line.quantity), 0);

  const itemRows = items.map((line, index) => {
    const inv = line.inventory_item;
    const propertyNo = inv?.property_number ?? inv?.item_code ?? '—';
    const serial = line.serial_number ?? inv?.serial_number ?? '—';
    const brandModel = [inv?.brand, inv?.model].filter(Boolean).join(' · ') || '—';
    const lineTotal = Number(line.quantity) * Number(line.unit_cost);

    return `
    <tr>
      <td class="center">${index + 1}</td>
      <td>${escapeHtml(inv?.name ?? '—')}</td>
      <td>${escapeHtml(propertyNo)}</td>
      <td>${escapeHtml(serial)}</td>
      <td>${escapeHtml(brandModel)}</td>
      <td class="center">${escapeHtml((inv?.unit_of_measure ?? '—').toUpperCase())}</td>
      <td class="num">${formatPrintQty(line.quantity)}</td>
      <td class="num">${formatPrintMoney(line.unit_cost)}</td>
      <td class="num">${formatPrintMoney(lineTotal)}</td>
    </tr>
  `;
  }).join('');

  const content = `
    ${governmentPrintLetterhead()}
    <h1 class="doc-title">Material Release Slip</h1>
    <p class="doc-subtitle">Report of Government Property Issued / Released Items</p>
    <div class="ref-bar">
      <span><strong>MR No.:</strong> ${escapeHtml(mr.mr_number)}</span>
      <span><strong>Status:</strong> <span class="status-stamp">${escapeHtml(statusLabel)}</span></span>
      <span><strong>Type:</strong> <span class="status-stamp">${escapeHtml(sourceLabel)}</span></span>
    </div>
    <table class="info-table">
      <tr>
        <td class="label">Employee / Recipient</td>
        <td>${escapeHtml(mr.recipient?.name ?? '—')}</td>
        <td class="label">Department</td>
        <td>${escapeHtml(mr.department?.name ?? '—')}</td>
      </tr>
      <tr>
        <td class="label">Released By</td>
        <td>${escapeHtml(mr.releaser?.name ?? '—')}</td>
        <td class="label">Release Date</td>
        <td>${escapeHtml(releaseDate)}</td>
      </tr>
      <tr>
        <td class="label">Purpose</td>
        <td>${escapeHtml(mr.purpose ?? '—')}</td>
        <td class="label">Request Reference</td>
        <td>${escapeHtml(mr.issuance_request?.request_number ?? '—')}</td>
      </tr>
      <tr>
        <td class="label">Total Items</td>
        <td>${items.length} line item(s) / ${formatPrintQty(totalQty)} total qty</td>
        <td class="label">Total Value</td>
        <td><strong>${formatPrintMoney(totalValue)}</strong></td>
      </tr>
      <tr>
        <td class="label">Notes / Remarks</td>
        <td colspan="3">${escapeHtml(mr.notes ?? '—')}</td>
      </tr>
    </table>
    <p class="section-title">Released Items</p>
    <table class="items-table">
      <thead>
        <tr>
          <th class="center" style="width:3%">#</th>
          <th>Item Description</th>
          <th style="width:11%">Property No.</th>
          <th style="width:10%">Serial No.</th>
          <th style="width:11%">Brand / Model</th>
          <th class="center" style="width:6%">Unit</th>
          <th class="num" style="width:6%">Qty</th>
          <th class="num" style="width:9%">Unit Cost</th>
          <th class="num" style="width:10%">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows || '<tr><td colspan="9" class="center" style="color:#888;padding:16px">No released items</td></tr>'}
      </tbody>
    </table>
    <div class="total-box">
      <table>
        <tr>
          <td class="label">Total Value Released</td>
          <td class="amount">${formatPrintMoney(totalValue)}</td>
        </tr>
      </table>
    </div>
    <div class="signatures">
      <div class="sig-block">
        <div class="sig-line"></div>
        <p class="sig-name">${escapeHtml(mr.releaser?.name ?? '')}</p>
        <p class="sig-role">Released By (GSO)</p>
      </div>
      <div class="sig-block">
        <div class="sig-line"></div>
        <p class="sig-name">${escapeHtml(mr.recipient?.name ?? '')}</p>
        <p class="sig-role">Received By (Employee)</p>
      </div>
      <div class="sig-block">
        <div class="sig-line"></div>
        <p class="sig-name">&nbsp;</p>
        <p class="sig-role">Noted By</p>
      </div>
      <div class="sig-block">
        <div class="sig-line"></div>
        <p class="sig-name">&nbsp;</p>
        <p class="sig-role">Approved By</p>
      </div>
    </div>
    <div class="footer">
      <span>${escapeHtml(BRANDING.printFooter)}</span>
      <span>Generated: ${escapeHtml(generatedAt)}</span>
      <span>Document Control: ${escapeHtml(mr.mr_number)}</span>
    </div>
  `;

  openGovernmentPrintWindow(`${mr.mr_number} — Material Release Slip`, content);
}

interface ReleaseLine {
  inventory_item_id: number;
  quantity: number;
  name: string;
  property_number?: string;
  serial_number?: string;
  brand?: string;
  model?: string;
  available: number;
  unit?: string;
}

interface ItemGroup {
  key: string;
  name: string;
  item_code: string;
  unit: string;
  totalQty: number;
  units: InventoryItem[];
}

function buildItemGroups(items: InventoryItem[]): ItemGroup[] {
  const map = new Map<string, ItemGroup>();

  for (const item of items) {
    if (Number(item.quantity) <= 0) continue;
    const key = item.name.trim().toLowerCase();
    const qty = Math.round(Number(item.quantity));
    const existing = map.get(key);

    if (existing) {
      existing.units.push(item);
      existing.totalQty += qty;
    } else {
      map.set(key, {
        key,
        name: item.name,
        item_code: item.item_code,
        unit: item.unit_of_measure,
        totalQty: qty,
        units: [item],
      });
    }
  }

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

interface AssignableUnit {
  inventory_item_id: number;
  serial_number?: string | null;
  property_number?: string;
  name: string;
  item_code?: string;
  brand?: string;
  model?: string;
  quantity_available: number;
  unit_of_measure: string;
}

function unitLineKey(inventoryItemId: number, serialNumber?: string | null): string {
  return `${inventoryItemId}:${serialNumber ?? ''}`;
}

export default function MaterialReleasePage() {
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [viewMr, setViewMr] = useState<MaterialRelease | null>(null);
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canRelease = hasPermission('requests.release') || hasPermission('issuance.*');

  const { data, isLoading } = useQuery({
    queryKey: ['material-releases', page],
    queryFn: () => api.get('/material-releases', { params: { page } }).then((r) => r.data),
    enabled: canRelease,
  });

  const { data: pending } = useQuery({
    queryKey: ['material-releases-pending'],
    queryFn: () => api.get('/material-releases/pending-requests').then((r) => r.data.data as IssuanceRequest[]),
    enabled: canRelease,
  });

  const releaseRequest = useMutation({
    mutationFn: (id: number) => api.post(`/material-releases/from-request/${id}`),
    onSuccess: (res) => {
      toast.success(`MR ${res.data.mr_number} issued successfully`);
      queryClient.invalidateQueries({ queryKey: ['material-releases'] });
      queryClient.invalidateQueries({ queryKey: ['material-releases-pending'] });
      queryClient.invalidateQueries({ queryKey: ['issuance'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? 'Release failed'),
  });

  const handleView = async (id: number) => {
    const { data: mr } = await api.get(`/material-releases/${id}`);
    setViewMr(mr);
  };

  if (!canRelease) {
    return (
      <div className="card p-8 text-center text-slate-500">
        You do not have permission to release materials.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Material Release (MR)"
        description="Issue government property to employees with official MR numbers"
        action={
          <button type="button" onClick={() => setShowForm(true)} className="btn-primary inline-flex items-center gap-2">
            <Plus size={18} /> New MR Release
          </button>
        }
      />

      {(pending ?? []).length > 0 && (
        <Card title="Approved Property Requests — Pending MR" subtitle="Issue MR for non-consumable property requisitions">
          <div className="space-y-3">
            {(pending ?? []).map((req) => (
              <div key={req.id} className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-mono text-xs font-semibold text-palawan-700">{req.request_number}</p>
                  <p className="text-sm font-medium text-slate-900">{req.requester?.name} · {req.department?.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{req.purpose}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {(req.items ?? []).length} item(s): {(req.items ?? []).map((i) => `${i.inventory_item?.name} (${i.quantity_requested})`).join(', ')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => releaseRequest.mutate(req.id)}
                  disabled={releaseRequest.isPending}
                  className="btn-primary shrink-0 text-sm"
                >
                  Release MR
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <DataTable<MaterialRelease>
        loading={isLoading}
        data={data?.data ?? []}
        emptyTitle="No material releases yet"
        emptyDescription="Direct MR releases and request-based releases will appear here."
        columns={[
          { key: 'mr_number', label: 'MR No.', render: (r) => <span className="font-mono text-xs font-semibold text-palawan-700">{r.mr_number}</span> },
          { key: 'status', label: 'Status', render: (r) => <Badge status={r.status ?? 'completed'} /> },
          { key: 'recipient', label: 'Employee', render: (r) => r.recipient?.name ?? '—' },
          { key: 'department', label: 'Department', render: (r) => r.department?.name ?? '—' },
          { key: 'source', label: 'Source', render: (r) => (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${r.source === 'request' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {r.source === 'request' ? 'Request' : 'Direct'}
            </span>
          ) },
          { key: 'items', label: 'Items', render: (r) => `${r.items?.length ?? r.draft_items?.items?.length ?? 0} item(s)` },
          { key: 'release_date', label: 'Released', render: (r) => r.release_date ? new Date(r.release_date).toLocaleDateString() : '—' },
          { key: 'releaser', label: 'Released By', render: (r) => r.releaser?.name ?? '—' },
          {
            key: 'actions',
            label: '',
            render: (r) => (
              <button type="button" onClick={() => handleView(r.id)} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-200">
                <Eye size={14} /> View
              </button>
            ),
          },
        ]}
      />
      <Pagination currentPage={data?.current_page ?? 1} lastPage={data?.last_page ?? 1} onPageChange={setPage} />

      {showForm && (
        <MrReleaseModal
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            queryClient.invalidateQueries({ queryKey: ['material-releases'] });
            queryClient.invalidateQueries({ queryKey: ['inventory'] });
          }}
        />
      )}

      {viewMr && (
        <MrDetailModal mr={viewMr} onClose={() => setViewMr(null)} />
      )}
    </div>
  );
}

export function MrReleaseModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [recipientId, setRecipientId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<ReleaseLine[]>([]);
  const [itemSearch, setItemSearch] = useState('');
  const [propertyNumberSearch, setPropertyNumberSearch] = useState('');
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);

  const { data: employees } = useQuery({
    queryKey: ['mr-employees', departmentId],
    queryFn: () => api.get('/material-releases/employees', {
      params: { department_id: departmentId || undefined, per_page: 100 },
    }).then((r) => r.data.data as AppUser[]),
  });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments').then((r) => r.data),
  });

  const inventorySearch = [itemSearch, propertyNumberSearch].map((s) => s.trim()).filter(Boolean).join(' ') || undefined;

  const { data: inventory } = useQuery({
    queryKey: ['inventory-property', inventorySearch],
    queryFn: () => api.get('/inventory', {
      params: { per_page: 200, search: inventorySearch, is_consumable: false },
    }).then((r) => r.data),
  });

  const buildPayload = (asDraft = false) => {
    const payload: Record<string, unknown> = {
      notes: notes || undefined,
    };
    if (recipientId) payload.recipient_user_id = Number(recipientId);
    if (departmentId) payload.department_id = Number(departmentId);
    if (purpose.trim()) payload.purpose = purpose.trim();
    if (asDraft) payload.save_as_draft = true;
    const itemPayload = lines.map((l) => ({
      inventory_item_id: l.inventory_item_id,
      quantity: l.quantity,
      serial_number: l.serial_number || undefined,
    }));
    if (!asDraft || itemPayload.length > 0) payload.items = itemPayload;
    return payload;
  };

  const submit = useMutation({
    mutationFn: () => api.post('/material-releases', buildPayload(false)),
    onSuccess: (res) => {
      toast.success(`MR ${res.data.mr_number} released to employee`);
      onSuccess();
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? 'Failed to release'),
  });

  const saveDraft = useMutation({
    mutationFn: () => api.post('/material-releases', buildPayload(true)),
    onSuccess: (res) => {
      toast.success(`Draft MR ${res.data.mr_number} saved`);
      onSuccess();
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? 'Failed to save draft'),
  });

  const validateDraft = () => {
    if (!recipientId && !departmentId && !purpose.trim() && lines.length === 0) {
      toast.error('Enter an employee, department, purpose, or item to save a draft');
      return false;
    }
    return true;
  };

  const validateForm = () => {
    if (!recipientId) {
      toast.error('Please select an employee');
      return false;
    }
    if (!departmentId) {
      toast.error('Please select a department');
      return false;
    }
    if (!purpose.trim()) {
      toast.error('Please enter a purpose');
      return false;
    }
    if (lines.length === 0) {
      toast.error('Select at least one item to release');
      return false;
    }
    return true;
  };

  const deptList = departments?.data ?? departments ?? [];
  const employeeList = employees ?? [];
  const inventoryList: InventoryItem[] = inventory?.data ?? [];
  const itemGroups = useMemo(() => buildItemGroups(inventoryList), [inventoryList]);
  const selectedGroup = itemGroups.find((g) => g.key === selectedGroupKey) ?? null;

  const { data: availableUnitsData, isLoading: loadingUnits } = useQuery({
    queryKey: ['mr-available-units', selectedGroup?.name],
    queryFn: () => api.get('/material-releases/available-units', {
      params: { name: selectedGroup!.name },
    }).then((r) => r.data.data as AssignableUnit[]),
    enabled: !!selectedGroup?.name,
  });

  const visibleUnits = useMemo(() => {
    const units = availableUnitsData ?? [];
    const q = propertyNumberSearch.trim().toLowerCase();
    if (!q) return units;

    return units.filter((unit) => (
      unit.property_number?.toLowerCase().includes(q)
      || unit.serial_number?.toLowerCase().includes(q)
      || unit.item_code?.toLowerCase().includes(q)
    ));
  }, [availableUnitsData, propertyNumberSearch]);

  useEffect(() => {
    if (selectedGroupKey && !itemGroups.some((g) => g.key === selectedGroupKey)) {
      setSelectedGroupKey(null);
    }
  }, [itemGroups, selectedGroupKey]);

  const onEmployeeChange = (id: string) => {
    setRecipientId(id);
    const emp = employeeList.find((e) => String(e.id) === id);
    if (emp?.department?.id) setDepartmentId(String(emp.department.id));
  };

  const selectGroup = (group: ItemGroup) => {
    setSelectedGroupKey(group.key);
    setPropertyNumberSearch('');
  };

  const isUnitSelected = (unit: AssignableUnit) =>
    lines.some((l) => unitLineKey(l.inventory_item_id, l.serial_number) === unitLineKey(unit.inventory_item_id, unit.serial_number));

  const toggleUnit = (unit: AssignableUnit) => {
    const key = unitLineKey(unit.inventory_item_id, unit.serial_number);
    if (lines.some((l) => unitLineKey(l.inventory_item_id, l.serial_number) === key)) {
      setLines((prev) => prev.filter((l) => unitLineKey(l.inventory_item_id, l.serial_number) !== key));
      return;
    }

    setLines((prev) => [...prev, {
      inventory_item_id: unit.inventory_item_id,
      quantity: 1,
      name: unit.name,
      property_number: unit.property_number,
      serial_number: unit.serial_number ?? undefined,
      brand: unit.brand,
      model: unit.model,
      available: Math.max(1, Math.round(unit.quantity_available)),
      unit: unit.unit_of_measure,
    }]);
  };

  const updateQty = (lineKey: string, qty: number) => {
    setLines((prev) => prev.map((l) => {
      if (unitLineKey(l.inventory_item_id, l.serial_number) !== lineKey) return l;
      const max = Math.max(1, l.available);
      const next = Number.isNaN(qty) ? 1 : Math.round(qty);
      return { ...l, quantity: Math.min(Math.max(1, next), max) };
    }));
  };

  const removeLine = (lineKey: string) => {
    setLines((prev) => prev.filter((l) => unitLineKey(l.inventory_item_id, l.serial_number) !== lineKey));
  };

  return (
    <div className="fixed inset-0 z-50 flex bg-black/40">
      <div className="card-elevated flex h-full w-full flex-col rounded-none sm:m-2 sm:h-[calc(100vh-1rem)] sm:w-[calc(100vw-1rem)] sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <Package size={22} className="text-palawan-600" />
            <h2 className="text-xl font-bold text-slate-900">Issue Property via MR</h2>
          </div>
          <button type="button" onClick={onClose}><X size={24} className="text-slate-400" /></button>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); if (validateForm()) submit.mutate(); }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-6 py-5">
            <div className="grid shrink-0 gap-4 lg:grid-cols-4">
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-700">
                  <User size={14} /> Employee *
                </label>
                <select value={recipientId} onChange={(e) => onEmployeeChange(e.target.value)} className="input-field" required>
                  <option value="">Select employee</option>
                  {employeeList.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}{e.employee_id ? ` (${e.employee_id})` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Department *</label>
                <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="input-field" required>
                  <option value="">Select department</option>
                  {deptList.map((d: { id: number; name: string }) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div className="lg:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Purpose *</label>
                <textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} className="input-field" rows={2} required placeholder="Reason for issuance..." />
              </div>
            </div>

            <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
              <div className="flex min-h-0 flex-col">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Items to Release *</label>
                <input
                  type="search"
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  placeholder="Search by item name or code..."
                  className="input-field mb-2 shrink-0"
                />
                <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-slate-200">
                  {itemGroups.map((group) => (
                    <button
                      key={group.key}
                      type="button"
                      onClick={() => selectGroup(group)}
                      className={`flex w-full items-center justify-between border-b border-slate-50 px-4 py-3 text-left text-sm last:border-0 ${
                        selectedGroupKey === group.key ? 'bg-palawan-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <span>{group.name} <span className="text-xs text-slate-400">({group.item_code})</span></span>
                      <span className="text-xs text-slate-500">{group.totalQty} {group.unit}</span>
                    </button>
                  ))}
                  {itemGroups.length === 0 && (
                    <p className="p-4 text-center text-sm text-slate-400">No property items found.</p>
                  )}
                </div>
              </div>

              <div className="flex min-h-0 flex-col">
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  {selectedGroup ? `Select Unit — ${selectedGroup.name}` : 'Select Unit to Assign'}
                </label>
                <input
                  type="search"
                  value={propertyNumberSearch}
                  onChange={(e) => setPropertyNumberSearch(e.target.value)}
                  placeholder="Search property number or serial number..."
                  className="input-field mb-2 shrink-0"
                  disabled={!selectedGroup}
                />
                {!selectedGroup ? (
                  <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-400">
                    Select an item from the list to view available units
                  </div>
                ) : loadingUnits ? (
                  <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-400">
                    Loading available units...
                  </div>
                ) : (
                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-2">
                    {visibleUnits.map((unit) => {
                      const selected = isUnitSelected(unit);
                      const lineKey = unitLineKey(unit.inventory_item_id, unit.serial_number);
                      const line = lines.find((l) => unitLineKey(l.inventory_item_id, l.serial_number) === lineKey);
                      const hasSerial = Boolean(unit.serial_number);

                      return (
                        <label
                          key={lineKey}
                          className={`block cursor-pointer rounded-xl border p-3 transition ${
                            selected ? 'border-palawan-300 bg-palawan-50' : 'border-slate-100 bg-slate-50/50 hover:border-slate-200'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleUnit(unit)}
                              className="mt-1 h-4 w-4 rounded border-slate-300 text-palawan-600"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-slate-900">{unit.name}</p>
                              <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                                <div>
                                  <p className="text-slate-400">Property Number</p>
                                  <p className="font-mono font-medium text-slate-800">{unit.property_number ?? unit.item_code ?? '—'}</p>
                                </div>
                                <div>
                                  <p className="text-slate-400">Serial Number</p>
                                  <p className="font-mono font-medium text-slate-800">{unit.serial_number ?? '—'}</p>
                                </div>
                                <div>
                                  <p className="text-slate-400">Brand / Model</p>
                                  <p className="text-slate-700">{[unit.brand, unit.model].filter(Boolean).join(' · ') || '—'}</p>
                                </div>
                                <div>
                                  <p className="text-slate-400">Available</p>
                                  <p className="text-slate-700">{formatQtyInt(unit.quantity_available)} {unit.unit_of_measure}</p>
                                </div>
                              </div>
                              {selected && !hasSerial && line && line.available > 1 && (
                                <div className="mt-3 flex items-center gap-2">
                                  <span className="text-xs text-slate-500">Qty to release</span>
                                  <input
                                    type="number"
                                    min={1}
                                    max={line.available}
                                    step={1}
                                    value={line.quantity}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => updateQty(lineKey, Number(e.target.value))}
                                    className="input-field w-24 py-1 text-center text-sm"
                                  />
                                  <span className="text-xs text-slate-400">/ {line.available} {line.unit}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                    {visibleUnits.length === 0 && (
                      <p className="p-4 text-center text-sm text-slate-400">No units match your search.</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {lines.length > 0 && (
              <div className="shrink-0 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <p className="mb-3 text-sm font-semibold text-slate-800">Items to Assign ({lines.length})</p>
                <ul className="space-y-2">
                  {lines.map((line) => {
                    const key = unitLineKey(line.inventory_item_id, line.serial_number);
                    return (
                    <li key={key} className="flex items-center gap-3 rounded-lg bg-white px-3 py-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900">{line.name}</p>
                        <p className="text-xs text-slate-500">
                          Property: <span className="font-mono">{line.property_number ?? '—'}</span>
                          {' · '}Serial: <span className="font-mono">{line.serial_number ?? '—'}</span>
                          {' · '}Qty: {formatQtyInt(line.quantity)} {line.unit}
                        </p>
                      </div>
                      <button type="button" onClick={() => removeLine(key)} className="text-red-500 hover:text-red-700">
                        <X size={16} />
                      </button>
                    </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div className="shrink-0">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Notes</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} className="input-field" placeholder="Optional remarks" />
            </div>
          </div>

          <div className="flex shrink-0 justify-end gap-3 border-t border-slate-100 px-6 py-4">
            <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
            <button
              type="button"
              onClick={() => { if (validateDraft()) saveDraft.mutate(); }}
              disabled={saveDraft.isPending || submit.isPending}
              className="btn-secondary"
            >
              {saveDraft.isPending ? 'Saving...' : 'Save as Draft'}
            </button>
            <button
              type="submit"
              disabled={submit.isPending || saveDraft.isPending}
              className="btn-primary"
            >
              {submit.isPending ? 'Releasing...' : 'Issue MR Release'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function MrDetailModal({ mr, onClose }: { mr: MaterialRelease; onClose: () => void }) {
  const items = mr.items ?? [];
  const draftLineCount = mr.draft_items?.items?.length ?? 0;
  const totalValue = items.reduce((sum, line) => sum + Number(line.quantity) * Number(line.unit_cost), 0);
  const totalQty = items.reduce((sum, line) => sum + Number(line.quantity), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card-elevated flex max-h-[90vh] w-full max-w-4xl flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-palawan-50">
              <Package size={22} className="text-palawan-600" />
            </div>
            <div>
              <p className="font-mono text-lg font-bold text-palawan-700">{mr.mr_number}</p>
              <p className="text-sm text-slate-500">Material Release Slip</p>
            </div>
            <span className={`ml-2 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
              mr.source === 'request' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
            }`}>
              {mr.source === 'request' ? 'From Request' : 'Direct Release'}
            </span>
            <Badge status={mr.status ?? 'completed'} />
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100">
            <X size={24} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-1">
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Release Summary</p>
                <dl className="space-y-3 text-sm">
                  <div>
                    <dt className="text-xs text-slate-400">Employee</dt>
                    <dd className="flex items-center gap-2 font-semibold text-slate-900">
                      <User size={14} className="text-slate-400" />
                      {mr.recipient?.name ?? '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Department</dt>
                    <dd className="font-medium text-slate-900">{mr.department?.name ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Released By</dt>
                    <dd className="font-medium text-slate-900">{mr.releaser?.name ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Release Date</dt>
                    <dd className="font-medium text-slate-900">{mr.release_date ? new Date(mr.release_date).toLocaleString() : '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400">Purpose</dt>
                    <dd className="mt-1 text-slate-700">{mr.purpose ?? '—'}</dd>
                  </div>
                  {mr.notes && (
                    <div>
                      <dt className="text-xs text-slate-400">Notes</dt>
                      <dd className="mt-1 text-slate-700">{mr.notes}</dd>
                    </div>
                  )}
                </dl>
              </div>

              <div className="rounded-xl border border-palawan-100 bg-palawan-50/40 p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-palawan-600">Totals</p>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-2xl font-bold text-slate-900">{items.length || draftLineCount}</p>
                    <p className="text-xs text-slate-500">Line item(s)</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-palawan-700">{formatQtyInt(totalQty)}</p>
                    <p className="text-xs text-slate-500">Total qty released</p>
                  </div>
                </div>
                <div className="mt-3 border-t border-palawan-100 pt-3">
                  <p className="text-xs text-slate-500">Total Value</p>
                  <p className="text-xl font-bold text-slate-900">₱{totalValue.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Released Items ({items.length})
                </p>
                {items.length > 0 && (
                  <button
                    type="button"
                    className="btn-secondary !px-3 !py-1.5 text-xs"
                    onClick={() => openMaterialReleasePrintPreview(mr)}
                  >
                    <Printer size={14} /> Print Preview
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {items.map((line) => {
                  const inv = line.inventory_item;
                  const propertyNo = inv?.property_number ?? inv?.item_code ?? '—';
                  const serial = line.serial_number ?? inv?.serial_number ?? '—';
                  const lineTotal = Number(line.quantity) * Number(line.unit_cost);

                  return (
                    <div key={line.id} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-base font-bold text-slate-900">{inv?.name ?? '—'}</p>
                          {inv?.item_code && (
                            <p className="mt-0.5 font-mono text-xs text-palawan-700">{inv.item_code}</p>
                          )}
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="text-lg font-bold text-slate-900">₱{lineTotal.toLocaleString()}</p>
                          <p className="text-xs text-slate-500">
                            {formatQtyInt(line.quantity)} {inv?.unit_of_measure ?? 'unit'} × ₱{Number(line.unit_cost).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 border-t border-slate-50 pt-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <p className="text-xs text-slate-400">Property Number</p>
                          <p className="font-mono font-semibold text-slate-800">{propertyNo}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Serial Number</p>
                          <p className="font-mono font-semibold text-slate-800">{serial}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Brand / Model</p>
                          <p className="text-slate-700">{[inv?.brand, inv?.model].filter(Boolean).join(' · ') || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-400">Quantity</p>
                          <p className="font-semibold text-slate-900">
                            {formatQtyInt(line.quantity)} <span className="uppercase text-slate-500">{inv?.unit_of_measure}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {items.length === 0 && (
                  <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
                    No items on this release.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 justify-end border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="btn-secondary">Close</button>
        </div>
      </div>
    </div>
  );
}
