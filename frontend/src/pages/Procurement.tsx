import { useState, useEffect } from 'react';
import { useParams, Navigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Trash2, Eye, Pencil, Search, Printer } from 'lucide-react';
import api from '../api/client';
import DataTable from '../components/DataTable';
import Pagination from '../components/Pagination';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import Badge from '../components/Badge';
import type { DeliveryReceipt, MaterialRelease, IssuanceRequest } from '../types';
import { useAuth } from '../context/AuthContext';
import { MrReleaseModal, MrDetailModal } from './MaterialRelease';
import { PropertyAccountabilityTab } from './PropertyAccountability';
import { AirReportsPanel } from './AcceptanceInspectionReport';
import { WasteManagementReceiptPanel } from './WasteManagementReceipt';
import toast from 'react-hot-toast';
import {
  escapeHtml,
  governmentPrintLetterhead,
  openGovernmentPrintWindow,
} from '../utils/governmentPrint';
import { serialFieldCountForUnit, unitUsesIndividualSerialNumbers } from '../constants/units';
import { BRANDING } from '../constants/branding';

type Section = 'air' | 'deliveries' | 'mr-release' | 'ics' | 'par' | 'waste-management';

const SECTION_META: Record<Section, { title: string; description: string }> = {
  air: { title: 'AIR', description: 'Acceptance & Inspection Reports' },
  deliveries: { title: 'Deliveries', description: 'Delivery receipts and receiving records' },
  'mr-release': { title: 'MR Release', description: 'Material release slips' },
  ics: { title: 'ICS', description: 'Inventory Custodian Slip — property accountability' },
  par: { title: 'PAR', description: 'Property Acknowledgment Receipt — property accountability' },
  'waste-management': { title: 'Waste Management Receipt', description: 'Disposal and waste material documentation' },
};

function parseSection(raw?: string): Section | null {
  if (!raw || raw === 'air') return 'air';
  if (raw === 'mr') return 'mr-release';
  const valid: Section[] = ['air', 'deliveries', 'mr-release', 'ics', 'par', 'waste-management'];
  return valid.includes(raw as Section) ? (raw as Section) : null;
}

interface DrLineItem {
  po_item_id: string;
  inventory_item_id: string;
  description: string;
  unit_of_measure: string;
  quantity_ordered: string;
  quantity_received_prior: string;
  quantity_received: string;
  unit_cost: string;
  brand: string;
  model: string;
  serial_numbers: string[];
}

function serialFieldCount(qty: string | number, unit?: string): number {
  return serialFieldCountForUnit(qty, unit);
}

function resizeSerialNumbers(current: string[], count: number): string[] {
  const next = current.slice(0, count);
  while (next.length < count) next.push('');
  return next;
}

function initSerialNumbers(saved?: DraftDrLineItem, qty?: string | number, unit?: string, fallback = ''): string[] {
  const count = serialFieldCount(qty ?? saved?.quantity_received ?? 0, unit ?? saved?.unit_of_measure);
  if (saved?.serial_numbers?.length) {
    return resizeSerialNumbers(saved.serial_numbers, count);
  }
  if (saved?.serial_number) {
    return resizeSerialNumbers([saved.serial_number], count);
  }
  if (fallback) {
    return resizeSerialNumbers([fallback], Math.min(count, 1));
  }
  return resizeSerialNumbers([], count);
}

type DraftDrLineItem = NonNullable<NonNullable<DeliveryReceipt['draft_items']>['items']>[number];

const DELIVERY_CONDITIONS = [
  { value: 'complete', label: 'Complete — all items as ordered' },
  { value: 'partial', label: 'Partial delivery' },
  { value: 'with_discrepancy', label: 'With discrepancy / damage' },
] as const;

const emptyDrLine = (): DrLineItem => ({
  po_item_id: '',
  inventory_item_id: '',
  description: '',
  unit_of_measure: '',
  quantity_ordered: '',
  quantity_received_prior: '0',
  quantity_received: '',
  unit_cost: '',
  brand: '',
  model: '',
  serial_numbers: [],
});

function draftItemToDrLine(saved: DraftDrLineItem): DrLineItem {
  const qty = saved.quantity_received != null && saved.quantity_received !== '' ? String(saved.quantity_received) : '';
  const unit = (saved.unit_of_measure ?? '').toUpperCase();
  return {
    po_item_id: saved.po_item_id ?? '',
    inventory_item_id: saved.inventory_item_id ?? '',
    description: saved.description ?? '',
    unit_of_measure: unit,
    quantity_ordered: saved.quantity_ordered != null ? String(saved.quantity_ordered) : '',
    quantity_received_prior: saved.quantity_received_prior != null ? String(saved.quantity_received_prior) : '0',
    quantity_received: qty,
    unit_cost: saved.unit_cost != null ? String(saved.unit_cost) : '',
    brand: saved.brand ?? '',
    model: saved.model ?? '',
    serial_numbers: initSerialNumbers(saved, qty, unit),
  };
}

function getDrPoNumber(dr: DeliveryReceipt) {
  return dr.purchase_order?.po_number ?? dr.po_number ?? '—';
}

function getDrSupplierName(dr: DeliveryReceipt) {
  return dr.purchase_order?.supplier?.name ?? dr.draft_items?.supplier_name ?? '—';
}

function getDrPrReference(dr: DeliveryReceipt) {
  return dr.purchase_order?.purchase_request?.pr_number ?? dr.draft_items?.pr_reference ?? '—';
}

function apiError(e: unknown, fallback: string) {
  const err = e as { response?: { data?: { message?: string } } };
  toast.error(err.response?.data?.message ?? fallback);
}

function viewButton(onClick: () => void) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-lg bg-palawan-50 px-2.5 py-1 text-xs font-semibold text-palawan-700 hover:bg-palawan-100"
    >
      <Eye size={14} /> View
    </button>
  );
}

function editButton(onClick: () => void, enabled: boolean, title?: string) {
  return (
    <button
      type="button"
      onClick={enabled ? onClick : undefined}
      disabled={!enabled}
      title={title}
      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold ${
        enabled
          ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          : 'cursor-not-allowed bg-slate-50 text-slate-300'
      }`}
    >
      <Pencil size={14} /> Edit
    </button>
  );
}

function formatQty(qty: string | number): string {
  const n = Number(qty);
  if (Number.isNaN(n)) return '0';
  return Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(2)));
}


type DrPrintItem = {
  description?: string;
  unit_of_measure?: string;
  quantity_received?: number | string;
  brand?: string;
  model?: string;
  serial_number?: string;
  serial_numbers?: string[];
};

function getDeliveryReceiptItems(dr: DeliveryReceipt): DrPrintItem[] {
  if (dr.status === 'draft' || (!dr.stock_receipt?.items?.length && dr.draft_items?.items?.length)) {
    return dr.draft_items?.items ?? [];
  }
  return (dr.stock_receipt?.items ?? []).map((item) => ({
    description: item.description ?? item.inventory_item?.name,
    unit_of_measure: item.unit_of_measure,
    quantity_received: item.quantity_received,
    brand: item.brand,
    model: item.model,
    serial_number: item.serial_number,
    serial_numbers: item.serial_numbers,
  }));
}

function openDeliveryReceiptPrintPreview(dr: DeliveryReceipt, receivedItems: DrPrintItem[]) {
  const generatedAt = new Date().toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' });
  const statusLabel = (dr.status ?? 'completed').replace(/_/g, ' ').toUpperCase();
  const deliveryDate = dr.delivery_date
    ? new Date(dr.delivery_date).toLocaleDateString('en-PH', { dateStyle: 'long' })
    : '—';

  const itemRows = receivedItems.map((item, index) => {
    const serial = item.serial_numbers?.filter(Boolean).join(', ') || item.serial_number || '—';
    return `
    <tr>
      <td class="center">${index + 1}</td>
      <td>${escapeHtml(item.description ?? '—')}</td>
      <td class="center">${escapeHtml((item.unit_of_measure ?? '—').toUpperCase())}</td>
      <td class="num">${formatQty(item.quantity_received ?? 0)}</td>
      <td>${escapeHtml(item.brand ?? '—')}</td>
      <td>${escapeHtml(item.model ?? '—')}</td>
      <td>${escapeHtml(serial)}</td>
    </tr>
  `;
  }).join('');

  const content = `
    ${governmentPrintLetterhead()}
    <h1 class="doc-title">Delivery Receipt</h1>
    <p class="doc-subtitle">Report of Items Received / Inspection Report</p>
    <div class="ref-bar">
      <span><strong>DR No.:</strong> ${escapeHtml(dr.dr_number)}</span>
      <span><strong>Status:</strong> <span class="status-stamp">${escapeHtml(statusLabel)}</span></span>
      <span><strong>Date:</strong> ${escapeHtml(deliveryDate)}</span>
    </div>
    <table class="info-table">
      <tr>
        <td class="label">PO Reference</td>
        <td>${escapeHtml(getDrPoNumber(dr))}</td>
        <td class="label">Supplier</td>
        <td>${escapeHtml(getDrSupplierName(dr))}</td>
      </tr>
      <tr>
        <td class="label">Supplier DR / Invoice</td>
        <td>${escapeHtml(dr.supplier_reference_number ?? '—')}</td>
        <td class="label">Received By</td>
        <td>${escapeHtml(dr.receiver?.name ?? '—')}</td>
      </tr>
      <tr>
        <td class="label">Delivery Location</td>
        <td>${escapeHtml(dr.delivery_location ?? '—')}</td>
        <td class="label">Inspector</td>
        <td>${escapeHtml(dr.inspector_name ?? '—')}</td>
      </tr>
      <tr>
        <td class="label">Delivery Condition</td>
        <td>${escapeHtml(dr.delivery_condition ?? '—')}</td>
        <td class="label">PR Reference</td>
        <td>${escapeHtml(getDrPrReference(dr))}</td>
      </tr>
      <tr>
        <td class="label">Notes / Remarks</td>
        <td colspan="3">${escapeHtml(dr.notes ?? '—')}</td>
      </tr>
    </table>
    <p class="section-title">Received Items</p>
    <table class="items-table">
      <thead>
        <tr>
          <th class="center" style="width:4%">#</th>
          <th>Item Description / Specifications</th>
          <th class="center" style="width:8%">Unit</th>
          <th class="num" style="width:10%">Qty Received</th>
          <th style="width:12%">Brand</th>
          <th style="width:12%">Model</th>
          <th style="width:14%">Serial No.</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows || '<tr><td colspan="7" class="center" style="color:#888;padding:16px">No received items</td></tr>'}
      </tbody>
    </table>
    <div class="signatures">
      <div class="sig-block">
        <div class="sig-line"></div>
        <p class="sig-name">&nbsp;</p>
        <p class="sig-role">Delivered By (Supplier)</p>
      </div>
      <div class="sig-block">
        <div class="sig-line"></div>
        <p class="sig-name">${escapeHtml(dr.inspector_name ?? '')}</p>
        <p class="sig-role">Inspected By</p>
      </div>
      <div class="sig-block">
        <div class="sig-line"></div>
        <p class="sig-name">${escapeHtml(dr.receiver?.name ?? '')}</p>
        <p class="sig-role">Received By</p>
      </div>
      <div class="sig-block">
        <div class="sig-line"></div>
        <p class="sig-name">&nbsp;</p>
        <p class="sig-role">Noted By (GSO)</p>
      </div>
    </div>
    <div class="footer">
      <span>${escapeHtml(BRANDING.printFooter)}</span>
      <span>Generated: ${escapeHtml(generatedAt)}</span>
      <span>Document Control: ${escapeHtml(dr.dr_number)}</span>
    </div>
  `;

  openGovernmentPrintWindow(`${dr.dr_number} — Delivery Receipt`, content);
}

export default function Procurement() {
  const { section: rawSection } = useParams<{ section?: string }>();
  const section = parseSection(rawSection);
  const [searchParams, setSearchParams] = useSearchParams();

  if (rawSection && !section) {
    return <Navigate to="/procurement/air" replace />;
  }

  const activeSection = section ?? 'air';
  const [page, setPage] = useState(1);
  const [drSearch, setDrSearch] = useState('');
  const [drStatusFilter, setDrStatusFilter] = useState('');
  const [drSupplierFilter, setDrSupplierFilter] = useState('');
  const [mrSearch, setMrSearch] = useState('');
  const [mrDepartmentFilter, setMrDepartmentFilter] = useState('');
  const [mrSourceFilter, setMrSourceFilter] = useState('');
  const [mrStatusFilter, setMrStatusFilter] = useState('');
  const [showDelivery, setShowDelivery] = useState(false);
  const [editingDraft, setEditingDraft] = useState<DeliveryReceipt | null>(null);
  const [showMr, setShowMr] = useState(false);
  const [viewMr, setViewMr] = useState<MaterialRelease | null>(null);
  const [viewingDrId, setViewingDrId] = useState<number | null>(null);
  const [showAccountabilityForm, setShowAccountabilityForm] = useState(false);
  const [preselectedReceivedItemId, setPreselectedReceivedItemId] = useState<number | null>(null);

  const receivedItemIdParam = Number(searchParams.get('received_item_id') || 0) || null;
  const openNewFromRegistry = searchParams.get('new') === '1';

  useEffect(() => {
    if ((activeSection === 'ics' || activeSection === 'par') && openNewFromRegistry) {
      setPreselectedReceivedItemId(receivedItemIdParam);
      setShowAccountabilityForm(true);
    }
  }, [activeSection, openNewFromRegistry, receivedItemIdParam]);

  const handleAccountabilityFormOpenChange = (open: boolean) => {
    setShowAccountabilityForm(open);
    if (!open) {
      setPreselectedReceivedItemId(null);
      if (searchParams.has('received_item_id') || searchParams.has('new')) {
        const next = new URLSearchParams(searchParams);
        next.delete('received_item_id');
        next.delete('new');
        setSearchParams(next, { replace: true });
      }
    }
  };

  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canApprove = hasPermission('procurement.*');
  const canRelease = hasPermission('requests.release') || hasPermission('issuance.*');
  const canViewAccountability = canRelease || hasPermission('property.view') || hasPermission('property.*');
  const canIssueAccountability = canRelease || hasPermission('property.*');

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments').then((r) => r.data),
    enabled: activeSection === 'mr-release' || activeSection === 'ics' || activeSection === 'par',
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get('/suppliers', { params: { per_page: 100 } }).then((r) => r.data),
    enabled: activeSection === 'deliveries',
  });

  const { data: deliveries, isLoading: loadingDr } = useQuery({
    queryKey: ['delivery-receipts', page, drSearch, drStatusFilter, drSupplierFilter],
    queryFn: () => api.get('/delivery-receipts', {
      params: {
        page,
        ...(drSearch.trim() ? { search: drSearch.trim() } : {}),
        ...(drStatusFilter ? { status: drStatusFilter } : {}),
        ...(drSupplierFilter ? { supplier_id: drSupplierFilter } : {}),
      },
    }).then((r) => r.data),
    enabled: activeSection === 'deliveries',
  });

  const { data: materialReleases, isLoading: loadingMr } = useQuery({
    queryKey: ['material-releases', page, mrSearch, mrDepartmentFilter, mrSourceFilter, mrStatusFilter],
    queryFn: () => api.get('/material-releases', {
      params: {
        page,
        ...(mrSearch.trim() ? { search: mrSearch.trim() } : {}),
        ...(mrDepartmentFilter ? { department_id: mrDepartmentFilter } : {}),
        ...(mrSourceFilter ? { source: mrSourceFilter } : {}),
        ...(mrStatusFilter ? { status: mrStatusFilter } : {}),
      },
    }).then((r) => r.data),
    enabled: activeSection === 'mr-release' && canRelease,
  });

  const { data: pendingMr } = useQuery({
    queryKey: ['material-releases-pending'],
    queryFn: () => api.get('/material-releases/pending-requests').then((r) => r.data.data as IssuanceRequest[]),
    enabled: activeSection === 'mr-release' && canRelease,
  });

  const releaseRequest = useMutation({
    mutationFn: (id: number) => api.post(`/material-releases/from-request/${id}`),
    onSuccess: (res) => {
      toast.success(`MR ${res.data.mr_number} issued successfully`);
      invalidate();
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e.response?.data?.message ?? 'Release failed'),
  });

  const handleViewMr = async (id: number) => {
    const { data: mr } = await api.get(`/material-releases/${id}`);
    setViewMr(mr);
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
    queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    queryClient.invalidateQueries({ queryKey: ['delivery-receipts'] });
    queryClient.invalidateQueries({ queryKey: ['material-releases'] });
    queryClient.invalidateQueries({ queryKey: ['material-releases-pending'] });
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  useEffect(() => {
    setPage(1);
  }, [activeSection]);

  const deptList = departments?.data ?? departments ?? [];
  const supplierList = suppliers?.data ?? suppliers ?? [];
  const pageMeta = SECTION_META[activeSection];

  const actionButton = () => {
    if (activeSection === 'deliveries' && canApprove) {
      return (
        <button type="button" className="btn-primary" onClick={() => { setEditingDraft(null); setShowDelivery(true); }}>
          <Plus size={18} /> Record Delivery
        </button>
      );
    }
    if (activeSection === 'mr-release' && canRelease) {
      return (
        <button type="button" className="btn-primary" onClick={() => setShowMr(true)}>
          <Plus size={18} /> New MR Release
        </button>
      );
    }
    if ((activeSection === 'ics' || activeSection === 'par') && canIssueAccountability) {
      return (
        <button type="button" className="btn-primary" onClick={() => { setPreselectedReceivedItemId(null); setShowAccountabilityForm(true); }}>
          <Plus size={18} /> New {activeSection === 'par' ? 'PAR' : 'ICS'}
        </button>
      );
    }
    return undefined;
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title={pageMeta.title}
        description={pageMeta.description}
        action={actionButton()}
      />

      {activeSection === 'air' && <AirReportsPanel embedded />}

      {activeSection === 'deliveries' && (
        <>
          <div className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_11rem_11rem] sm:items-end">
            <div className="sm:col-span-2 lg:col-span-1">
              <label htmlFor="dr-search" className="mb-1.5 block text-sm font-medium text-slate-700">Search</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  id="dr-search"
                  value={drSearch}
                  onChange={(e) => { setDrSearch(e.target.value); setPage(1); }}
                  placeholder="Search by DR no., PO no., or supplier..."
                  className="input-field w-full !pl-11"
                />
              </div>
            </div>
            <div>
              <label htmlFor="dr-status" className="mb-1.5 block text-sm font-medium text-slate-700">Status</label>
              <select
                id="dr-status"
                value={drStatusFilter}
                onChange={(e) => { setDrStatusFilter(e.target.value); setPage(1); }}
                className="input-field w-full"
              >
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div>
              <label htmlFor="dr-supplier" className="mb-1.5 block text-sm font-medium text-slate-700">Supplier</label>
              <select
                id="dr-supplier"
                value={drSupplierFilter}
                onChange={(e) => { setDrSupplierFilter(e.target.value); setPage(1); }}
                className="input-field w-full"
              >
                <option value="">All Suppliers</option>
                {supplierList.map((s: { id: number; name: string }) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <DataTable<DeliveryReceipt>
            loading={loadingDr}
            data={deliveries?.data ?? []}
            emptyTitle="No delivery receipts"
            emptyDescription={
              drSearch || drStatusFilter || drSupplierFilter
                ? 'No delivery receipts match your search or filters.'
                : 'Delivery records will appear here.'
            }
            columns={[
              { key: 'dr_number', label: 'DR No.', render: (r) => <span className="font-mono text-xs font-semibold text-palawan-700">{r.dr_number}</span> },
              { key: 'status', label: 'Status', render: (r) => <Badge status={r.status ?? 'completed'} /> },
              { key: 'po', label: 'PO', render: (r) => getDrPoNumber(r) },
              { key: 'supplier', label: 'Supplier', render: (r) => getDrSupplierName(r) },
              { key: 'delivery_date', label: 'Date', render: (r) => new Date(r.delivery_date).toLocaleDateString() },
              { key: 'receiver', label: 'Received By', render: (r) => r.receiver?.name ?? '—' },
              { key: 'view', label: 'View', render: (r) => viewButton(() => setViewingDrId(r.id)) },
              {
                key: 'edit',
                label: 'Edit',
                render: (r) => editButton(
                  () => { setEditingDraft(r); setShowDelivery(true); },
                  r.status === 'draft' && canApprove,
                  r.status === 'draft' ? 'Continue editing this draft' : 'Only draft deliveries can be edited',
                ),
              },
            ]}
          />
          <Pagination currentPage={deliveries?.current_page ?? 1} lastPage={deliveries?.last_page ?? 1} onPageChange={setPage} />
        </>
      )}

      {activeSection === 'mr-release' && !canRelease && (
        <div className="card p-8 text-center text-slate-500">
          You do not have permission to release materials.
        </div>
      )}

      {activeSection === 'mr-release' && canRelease && (
        <>
          {(pendingMr ?? []).length > 0 && (
            <Card title="Approved Property Requests — Pending MR" subtitle="Issue MR for non-consumable property requisitions">
              <div className="space-y-3">
                {(pendingMr ?? []).map((req) => (
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

          <div className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_11rem_11rem_11rem] sm:items-end">
            <div className="sm:col-span-2 lg:col-span-1">
              <label htmlFor="mr-search" className="mb-1.5 block text-sm font-medium text-slate-700">Search</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  id="mr-search"
                  value={mrSearch}
                  onChange={(e) => { setMrSearch(e.target.value); setPage(1); }}
                  placeholder="Search by MR no. or employee name..."
                  className="input-field w-full !pl-11"
                />
              </div>
            </div>
            <div>
              <label htmlFor="mr-department" className="mb-1.5 block text-sm font-medium text-slate-700">Department</label>
              <select
                id="mr-department"
                value={mrDepartmentFilter}
                onChange={(e) => { setMrDepartmentFilter(e.target.value); setPage(1); }}
                className="input-field w-full"
              >
                <option value="">All Departments</option>
                {deptList.map((d: { id: number; name: string }) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="mr-source" className="mb-1.5 block text-sm font-medium text-slate-700">Source</label>
              <select
                id="mr-source"
                value={mrSourceFilter}
                onChange={(e) => { setMrSourceFilter(e.target.value); setPage(1); }}
                className="input-field w-full"
              >
                <option value="">All Sources</option>
                <option value="direct">Direct</option>
                <option value="request">Request</option>
              </select>
            </div>
            <div>
              <label htmlFor="mr-status" className="mb-1.5 block text-sm font-medium text-slate-700">Status</label>
              <select
                id="mr-status"
                value={mrStatusFilter}
                onChange={(e) => { setMrStatusFilter(e.target.value); setPage(1); }}
                className="input-field w-full"
              >
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          <DataTable<MaterialRelease>
            loading={loadingMr}
            data={materialReleases?.data ?? []}
            emptyTitle="No material releases yet"
            emptyDescription={
              mrSearch || mrDepartmentFilter || mrSourceFilter || mrStatusFilter
                ? 'No material releases match your search or filters.'
                : 'Direct MR releases and request-based releases will appear here.'
            }
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
              { key: 'view', label: 'View', render: (r) => viewButton(() => handleViewMr(r.id)) },
            ]}
          />
          <Pagination currentPage={materialReleases?.current_page ?? 1} lastPage={materialReleases?.last_page ?? 1} onPageChange={setPage} />
        </>
      )}

      {(activeSection === 'ics' || activeSection === 'par') && (
        <PropertyAccountabilityTab
          page={page}
          onPageChange={setPage}
          canView={canViewAccountability}
          canIssue={canIssueAccountability}
          deptList={deptList}
          documentType={activeSection}
          manualFormOpen={showAccountabilityForm}
          onManualFormOpenChange={handleAccountabilityFormOpenChange}
          initialReceivedItemId={preselectedReceivedItemId}
        />
      )}

      {activeSection === 'waste-management' && <WasteManagementReceiptPanel />}

      {showDelivery && (
        <DeliveryModal
          draft={editingDraft}
          onClose={() => { setShowDelivery(false); setEditingDraft(null); }}
          onSuccess={(message) => { invalidate(); setShowDelivery(false); setEditingDraft(null); toast.success(message); }}
        />
      )}
      {showMr && (
        <MrReleaseModal
          onClose={() => setShowMr(false)}
          onSuccess={() => { invalidate(); setShowMr(false); }}
        />
      )}
      {viewMr && <MrDetailModal mr={viewMr} onClose={() => setViewMr(null)} />}
      {viewingDrId && <DrViewModal id={viewingDrId} onClose={() => setViewingDrId(null)} />}
    </div>
  );
}

function DetailShell({ title, subtitle, onClose, loading, children }: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-6">
      <div className="card-elevated flex max-h-[95vh] w-full max-w-4xl flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X size={20} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {loading ? <p className="text-sm text-slate-500">Loading...</p> : children}
        </div>
        <div className="flex shrink-0 justify-end border-t border-slate-100 px-6 py-4">
          <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function LineItemsTable({ rows, columns }: {
  rows: Record<string, React.ReactNode>[];
  columns: { key: string; label: string; align?: 'right' }[];
}) {
  if (!rows.length) return <p className="text-sm text-slate-500">No line items.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-100">
      <table className="table-zebra min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={`px-3 py-2 ${col.align === 'right' ? 'text-right' : ''}`}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((col) => (
                <td key={col.key} className={`px-3 py-2 text-slate-700 ${col.align === 'right' ? 'text-right' : ''}`}>{row[col.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


function DrViewModal({ id, onClose }: { id: number; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['delivery-receipt-view', id],
    queryFn: () => api.get(`/delivery-receipts/${id}`).then((r) => r.data as DeliveryReceipt),
  });

  const receivedItems = data ? getDeliveryReceiptItems(data) : [];

  const lineRows = receivedItems.map((item) => ({
    description: item.description ?? '—',
    unit: (item.unit_of_measure ?? '—').toUpperCase(),
    qty: formatQty(item.quantity_received ?? 0),
    brand: item.brand ?? '—',
    model: item.model ?? '—',
    serial: ((item as { serial_numbers?: string[] }).serial_numbers?.filter(Boolean).join(', ')
      || item.serial_number) ?? '—',
  }));

  return (
    <DetailShell title={data?.dr_number ?? 'Delivery Receipt'} subtitle={data ? getDrPoNumber(data) : undefined} onClose={onClose} loading={isLoading}>
      {data && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <Badge status={data.status ?? 'completed'} />
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-slate-400">PO Number</dt><dd className="font-mono font-medium text-palawan-700">{getDrPoNumber(data)}</dd></div>
            <div><dt className="text-slate-400">PR Reference</dt><dd className="font-medium text-slate-900">{getDrPrReference(data)}</dd></div>
            <div><dt className="text-slate-400">Supplier</dt><dd className="font-medium text-slate-900">{getDrSupplierName(data)}</dd></div>
            <div><dt className="text-slate-400">Delivery Date</dt><dd className="font-medium text-slate-900">{new Date(data.delivery_date).toLocaleDateString()}</dd></div>
            <div><dt className="text-slate-400">Received By</dt><dd className="font-medium text-slate-900">{data.receiver?.name ?? '—'}</dd></div>
            <div><dt className="text-slate-400">Supplier DR / Invoice</dt><dd className="font-medium text-slate-900">{data.supplier_reference_number ?? '—'}</dd></div>
            <div><dt className="text-slate-400">Inspector</dt><dd className="font-medium text-slate-900">{data.inspector_name ?? '—'}</dd></div>
            <div><dt className="text-slate-400">Delivery Location</dt><dd className="font-medium text-slate-900">{data.delivery_location ?? '—'}</dd></div>
            <div><dt className="text-slate-400">Condition</dt><dd className="font-medium text-slate-900">{data.delivery_condition ?? '—'}</dd></div>
            <div className="sm:col-span-2"><dt className="text-slate-400">Notes</dt><dd className="font-medium text-slate-900">{data.notes ?? '—'}</dd></div>
          </dl>
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-800">Received Items</h3>
              {receivedItems.length > 0 && (
                <button
                  type="button"
                  className="btn-secondary !px-3 !py-1.5 text-xs"
                  onClick={() => openDeliveryReceiptPrintPreview(data, receivedItems)}
                >
                  <Printer size={14} /> Print Preview
                </button>
              )}
            </div>
            <LineItemsTable
              rows={lineRows}
              columns={[
                { key: 'description', label: 'Item' },
                { key: 'unit', label: 'Unit' },
                { key: 'qty', label: 'Qty Received', align: 'right' },
                { key: 'brand', label: 'Brand' },
                { key: 'model', label: 'Model' },
                { key: 'serial', label: 'Serial No.' },
              ]}
            />
          </div>
        </div>
      )}
    </DetailShell>
  );
}


function DeliveryModal({ onClose, onSuccess, draft }: { onClose: () => void; onSuccess: (message: string) => void; draft?: DeliveryReceipt | null }) {
  const { user } = useAuth();
  const [draftId, setDraftId] = useState<number | undefined>(draft?.id);
  const [poNumber, setPoNumber] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [prReference, setPrReference] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().slice(0, 10));
  const [supplierReference, setSupplierReference] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('GSO Main Warehouse');
  const [deliveryCondition, setDeliveryCondition] = useState('complete');
  const [inspectorName, setInspectorName] = useState('');
  const [triggerStockIn, setTriggerStockIn] = useState(true);
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<DrLineItem[]>([emptyDrLine(), emptyDrLine(), emptyDrLine()]);

  useEffect(() => {
    if (!draft) return;
    const saved = draft.draft_items;
    setDraftId(draft.id);
    setPoNumber(draft.po_number ?? draft.purchase_order?.po_number ?? '');
    setSupplierName(saved?.supplier_name ?? draft.purchase_order?.supplier?.name ?? '');
    setPrReference(saved?.pr_reference ?? draft.purchase_order?.purchase_request?.pr_number ?? '');
    setDeliveryDate(draft.delivery_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
    setSupplierReference(saved?.supplier_reference_number ?? draft.supplier_reference_number ?? '');
    setDeliveryLocation(saved?.delivery_location ?? draft.delivery_location ?? 'GSO Main Warehouse');
    setDeliveryCondition(saved?.delivery_condition ?? draft.delivery_condition ?? 'complete');
    setInspectorName(saved?.inspector_name ?? draft.inspector_name ?? '');
    setNotes(saved?.notes ?? draft.notes ?? '');
    setTriggerStockIn(saved?.trigger_stock_in ?? true);
    if (saved?.items?.length) {
      setLineItems(saved.items.map(draftItemToDrLine));
    }
  }, [draft]);

  const updateLineItem = (index: number, patch: Partial<DrLineItem>) => {
    setLineItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const buildPayload = () => ({
    po_number: poNumber.trim(),
    supplier_name: supplierName.trim() || undefined,
    pr_reference: prReference.trim() || undefined,
    delivery_date: deliveryDate,
    supplier_reference_number: supplierReference || undefined,
    delivery_location: deliveryLocation || undefined,
    delivery_condition: deliveryCondition || undefined,
    inspector_name: inspectorName || undefined,
    notes: notes || undefined,
    trigger_stock_in: triggerStockIn,
    items: lineItems
      .filter((i) => i.description.trim() && Number(i.quantity_received) > 0)
      .map((i) => ({
        description: i.description.trim(),
        unit_of_measure: i.unit_of_measure.trim() || 'unit',
        quantity_ordered: i.quantity_ordered ? Number(i.quantity_ordered) : Number(i.quantity_received),
        quantity_received: Number(i.quantity_received),
        unit_cost: i.unit_cost !== '' ? Number(i.unit_cost) : undefined,
        brand: i.brand || undefined,
        model: i.model || undefined,
        serial_numbers: i.serial_numbers.map((s) => s.trim()),
        serial_number: i.serial_numbers.map((s) => s.trim()).find(Boolean) || undefined,
      })),
  });

  const validateDraft = () => {
    if (!poNumber.trim()) {
      toast.error('PO reference is required');
      return false;
    }
    return true;
  };

  const validateForm = () => {
    if (!poNumber.trim()) {
      toast.error('PO reference is required');
      return false;
    }
    if (triggerStockIn) {
      const received = lineItems.filter((item) => item.description.trim() && Number(item.quantity_received) > 0);
      if (!received.length) {
        toast.error('Add at least one item with description and quantity received');
        return false;
      }
      for (const item of received) {
        if (item.unit_cost === '' || item.unit_cost == null) {
          toast.error(`Unit cost is required for "${item.description}"`);
          return false;
        }
      }
    }
    return true;
  };

  const saveDraft = useMutation({
    mutationFn: () => {
      const payload = { ...buildPayload(), save_as_draft: true };
      return draftId
        ? api.put(`/delivery-receipts/${draftId}`, payload)
        : api.post('/delivery-receipts', payload);
    },
    onSuccess: (response) => {
      setDraftId(response.data.id);
      toast.success('Delivery draft saved');
    },
    onError: (e) => apiError(e, 'Failed to save draft'),
  });

  const create = useMutation({
    mutationFn: () => {
      const payload = buildPayload();
      return draftId
        ? api.post(`/delivery-receipts/${draftId}/finalize`, payload)
        : api.post('/delivery-receipts', payload);
    },
    onSuccess: () => onSuccess(draftId ? 'Delivery finalized' : 'Delivery recorded'),
    onError: (e) => apiError(e, 'Delivery recording failed'),
  });

  return (
    <FormModal
      title={draftId ? 'Continue Delivery Draft' : 'Record Delivery'}
      onClose={onClose}
      onSubmit={() => { if (validateForm()) create.mutate(); }}
      onDraft={() => { if (validateDraft()) saveDraft.mutate(); }}
      pending={create.isPending}
      draftPending={saveDraft.isPending}
      label="Record Delivery"
      extraWide
      fullHeight
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">PO Reference</label>
          <input
            required
            value={poNumber}
            onChange={(e) => setPoNumber(e.target.value)}
            placeholder="e.g. PO-2026-00123"
            className="input-field font-mono"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">PR Reference</label>
          <input
            value={prReference}
            onChange={(e) => setPrReference(e.target.value)}
            placeholder="Optional purchase request no."
            className="input-field font-mono"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Supplier</label>
          <input
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
            placeholder="Supplier name as shown on PO"
            className="input-field"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Received By</label>
          <input readOnly value={user?.name ?? ''} className="input-field bg-slate-50 text-slate-600" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Inspector</label>
          <input
            value={inspectorName}
            onChange={(e) => setInspectorName(e.target.value)}
            placeholder="Name of inspecting officer"
            className="input-field"
          />
        </div>

        {(poNumber.trim() || supplierName.trim()) && (
          <div className="sm:col-span-2 rounded-xl border border-palawan-100 bg-palawan-50/50 p-3 text-sm">
            <p className="font-semibold text-palawan-800">{poNumber.trim() || '—'}</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <p className="text-slate-600"><span className="text-slate-400">Supplier:</span> {supplierName.trim() || '—'}</p>
              <p className="text-slate-600"><span className="text-slate-400">PR ref:</span> {prReference.trim() || '—'}</p>
              <p className="text-slate-600"><span className="text-slate-400">Mode:</span> External PO reference (not linked to system PO)</p>
            </div>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Supplier DR / Invoice No.</label>
          <input value={supplierReference} onChange={(e) => setSupplierReference(e.target.value)} placeholder="e.g. DR-2026-0892" className="input-field" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Delivery Date</label>
          <input required type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Delivery Location</label>
          <input value={deliveryLocation} onChange={(e) => setDeliveryLocation(e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Delivery Condition</label>
          <select value={deliveryCondition} onChange={(e) => setDeliveryCondition(e.target.value)} className="input-field">
            {DELIVERY_CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={triggerStockIn} onChange={(e) => setTriggerStockIn(e.target.checked)} className="rounded border-slate-300 text-palawan-600" />
            Trigger stock in on delivery (add received items to inventory)
          </label>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Notes / Discrepancies</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={1} placeholder="Shortages, damages, or other delivery remarks..." className="input-field resize-none" />
        </div>
      </div>

      {triggerStockIn && (
        <div className="mt-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-800">Received Items</h3>
            <button
              type="button"
              onClick={() => setLineItems((prev) => [...prev, emptyDrLine()])}
              className="btn-secondary !px-3 !py-1.5 text-xs"
            >
              <Plus size={14} /> Add item
            </button>
          </div>
          <div className="space-y-3">
            {lineItems.map((item, index) => (
              <div key={index} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                <div className="grid gap-2 sm:grid-cols-12 sm:items-end">
                  <div className="sm:col-span-4">
                    <label className="mb-1 block text-xs font-medium text-slate-500">Item</label>
                    <input
                      value={item.description}
                      onChange={(e) => updateLineItem(index, { description: e.target.value })}
                      placeholder="Item description"
                      className="input-field"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-slate-500">Unit</label>
                    <input
                      value={item.unit_of_measure}
                      onChange={(e) => {
                        const unit = e.target.value.toUpperCase();
                        updateLineItem(index, {
                          unit_of_measure: unit,
                          serial_numbers: resizeSerialNumbers(item.serial_numbers, serialFieldCount(item.quantity_received, unit)),
                        });
                      }}
                      placeholder="e.g. UNIT"
                      className="input-field uppercase"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-slate-500">Qty Received</label>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.quantity_received}
                      onChange={(e) => {
                        const qty = e.target.value;
                        updateLineItem(index, {
                          quantity_received: qty,
                          serial_numbers: resizeSerialNumbers(item.serial_numbers, serialFieldCount(qty, item.unit_of_measure)),
                        });
                      }}
                      className="input-field"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="mb-1 block text-xs font-medium text-slate-500">Unit Cost</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_cost}
                      onChange={(e) => updateLineItem(index, { unit_cost: e.target.value })}
                      placeholder="0.00"
                      className="input-field"
                    />
                  </div>
                  <div className="flex items-end justify-end sm:col-span-1">
                    <button
                      type="button"
                      onClick={() => setLineItems((p) => (p.length <= 1 ? p : p.filter((_, i) => i !== index)))}
                      className="rounded-xl p-2 text-slate-400 hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">Brand</label>
                      <input
                        value={item.brand}
                        onChange={(e) => setLineItems((p) => p.map((l, i) => i === index ? { ...l, brand: e.target.value } : l))}
                        placeholder="e.g. HP, Canon"
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-500">Model</label>
                      <input
                        value={item.model}
                        onChange={(e) => setLineItems((p) => p.map((l, i) => i === index ? { ...l, model: e.target.value } : l))}
                        placeholder="e.g. LaserJet Pro"
                        className="input-field"
                      />
                    </div>
                  </div>
                  {item.serial_numbers.length > 0 && (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {item.serial_numbers.map((serial, serialIndex) => (
                        <div key={serialIndex}>
                          <label className="mb-1 block text-xs font-medium text-slate-500">
                            {unitUsesIndividualSerialNumbers(item.unit_of_measure)
                              ? `Serial Number${item.serial_numbers.length > 1 ? ` ${serialIndex + 1}` : ''}`
                              : 'Lot / Batch No. (optional)'}
                          </label>
                          <input
                            value={serial}
                            onChange={(e) => setLineItems((p) => p.map((l, i) => {
                              if (i !== index) return l;
                              const serial_numbers = [...l.serial_numbers];
                              serial_numbers[serialIndex] = e.target.value;
                              return { ...l, serial_numbers };
                            }))}
                            placeholder={
                              unitUsesIndividualSerialNumbers(item.unit_of_measure)
                                ? 'Property / equipment S/N'
                                : 'Optional lot or batch reference'
                            }
                            className="input-field font-mono"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </FormModal>
  );
}

function FormModal({ title, onClose, onSubmit, onDraft, pending, draftPending, label, children, wide, extraWide, fullHeight }: {
  title: string; onClose: () => void; onSubmit: () => void; onDraft?: () => void; pending: boolean; draftPending?: boolean; label: string; children: React.ReactNode; wide?: boolean; extraWide?: boolean; fullHeight?: boolean;
}) {
  const widthClass = extraWide ? (fullHeight ? 'max-w-[96vw]' : 'max-w-6xl') : wide ? 'max-w-3xl' : 'max-w-xl';
  const heightClass = fullHeight ? 'h-[98vh]' : 'max-h-[95vh]';

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 ${fullHeight ? 'p-1' : 'p-3 sm:p-6'}`}>
      <div className={`card-elevated flex ${heightClass} w-full flex-col ${widthClass}`}>
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-3">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X size={20} /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            {children}
          </div>
          <div className="flex shrink-0 justify-end gap-3 border-t border-slate-100 px-6 py-4">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            {onDraft && (
              <button type="button" className="btn-secondary" onClick={onDraft} disabled={pending || draftPending}>
                {draftPending ? 'Saving...' : 'Save as Draft'}
              </button>
            )}
            <button type="submit" className="btn-primary" disabled={pending || draftPending}>{pending ? 'Saving...' : label}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
