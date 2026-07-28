import { useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Eye, Printer, X, ClipboardCheck, Upload, ClipboardPen, FileText, Package } from 'lucide-react';
import api from '../api/client';
import DataTable from '../components/DataTable';
import Pagination from '../components/Pagination';
import PageHeader from '../components/PageHeader';
import Badge from '../components/Badge';
import AirGovernmentForm from '../components/AirGovernmentForm';
import DeliveryReceiptUploadModal from '../components/DeliveryReceiptUploadModal';
import DeliveryReceiptManualFormModal from '../components/DeliveryReceiptManualFormModal';
import type { AcceptanceInspectionItem, AcceptanceInspectionReport, DeliveryReceipt } from '../types';
import { useAuth } from '../context/AuthContext';
import { formatPrintQty } from '../utils/governmentPrint';
import { openAirPrintPreview } from '../utils/airPrint';
import { openCoaRequestPrintPreview } from '../utils/coaRequestPrint';
import { openParRequestPrintPreview } from '../utils/parRequestPrint';

const RESULT_LABELS: Record<string, string> = {
  accepted: 'Accepted',
  accepted_with_reservation: 'Accepted with Reservation',
  rejected: 'Rejected',
};

const RESULT_PILL: Record<string, string> = {
  accepted: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  accepted_with_reservation: 'bg-amber-50 text-amber-800 ring-amber-200',
  rejected: 'bg-red-50 text-red-700 ring-red-200',
};

function airSupplierName(report: AcceptanceInspectionReport): string {
  return (
    report.purchase_order?.supplier?.name
    || report.delivery_receipt?.purchase_order?.supplier?.name
    || report.delivery_receipt?.draft_items?.supplier_name
    || '—'
  );
}

function airPoNumber(report: AcceptanceInspectionReport): string {
  return report.po_number || report.purchase_order?.po_number || report.delivery_receipt?.po_number || '—';
}

function money(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n === 0) return '—';
  return n.toLocaleString('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 });
}

function MetaField({ label, value, className = '' }: { label: string; value?: ReactNode; className?: string }) {
  const empty = value == null || value === '';
  return (
    <div className={className}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-slate-800 break-words">{empty ? '—' : value}</p>
    </div>
  );
}

function AirViewModal({
  report,
  canManage,
  onClose,
  onEditDraft,
}: {
  report: AcceptanceInspectionReport;
  canManage: boolean;
  onClose: () => void;
  onEditDraft: () => void;
}) {
  const [itemSearch, setItemSearch] = useState('');
  const items = report.items ?? [];
  const result = report.inspection_result ?? 'accepted';

  const filteredItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    if (!q) return items.map((item, index) => ({ item, index }));
    return items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) =>
        [item.description, item.unit_of_measure, item.remarks]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      );
  }, [items, itemSearch]);

  const totals = useMemo(() => {
    let acceptedQty = 0;
    let amount = 0;
    for (const item of items) {
      const qty = Number(item.quantity_accepted ?? 0);
      const cost = Number(item.unit_cost ?? 0);
      acceptedQty += Number.isFinite(qty) ? qty : 0;
      amount += Number.isFinite(qty) && Number.isFinite(cost) ? qty * cost : 0;
    }
    return { acceptedQty, amount, lines: items.length };
  }, [items]);

  const lineTotal = (item: AcceptanceInspectionItem) => {
    const qty = Number(item.quantity_accepted ?? 0);
    const cost = Number(item.unit_cost ?? 0);
    if (!Number.isFinite(qty) || !Number.isFinite(cost) || (qty === 0 && cost === 0)) return null;
    return qty * cost;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="safe-bottom flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-slate-200 bg-gradient-to-r from-palawan-50/80 to-white px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <FileText className="shrink-0 text-palawan-600" size={20} />
                <h2 className="font-mono text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
                  {report.air_number}
                </h2>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${RESULT_PILL[result] ?? 'bg-slate-50 text-slate-600 ring-slate-200'}`}>
                  {RESULT_LABELS[result] ?? result}
                </span>
                <Badge status={report.status} />
              </div>
              <p className="mt-1 text-sm text-slate-500">Acceptance and Inspection Report</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Summary strip */}
          <div className="grid grid-cols-2 gap-px border-b border-slate-200 bg-slate-200 sm:grid-cols-4">
            <div className="bg-white px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Line items</p>
              <p className="mt-0.5 text-lg font-bold text-slate-900">{totals.lines.toLocaleString()}</p>
            </div>
            <div className="bg-white px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Total accepted qty</p>
              <p className="mt-0.5 text-lg font-bold text-slate-900">{formatPrintQty(totals.acceptedQty)}</p>
            </div>
            <div className="bg-white px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Report amount</p>
              <p className="mt-0.5 text-lg font-bold text-slate-900">
                {money(report.amount ?? (totals.amount || null))}
              </p>
            </div>
            <div className="bg-white px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">ABC amount</p>
              <p className="mt-0.5 text-lg font-bold text-slate-900">{money(report.abc_amount)}</p>
            </div>
          </div>

          {/* Metadata */}
          <div className="space-y-4 px-5 py-4 sm:px-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <MetaField label="PO Reference" value={airPoNumber(report)} />
              <MetaField label="DR Reference" value={report.delivery_receipt?.dr_number} />
              <MetaField label="Supplier" value={airSupplierName(report)} />
              <MetaField
                label="Inspection Date"
                value={report.inspection_date ? new Date(report.inspection_date).toLocaleDateString('en-PH') : '—'}
              />
              <MetaField
                label="Acceptance Date"
                value={report.acceptance_date ? new Date(report.acceptance_date).toLocaleDateString('en-PH') : '—'}
              />
              <MetaField label="Invoice No." value={report.invoice_number} />
              <MetaField label="Requisitioning Office" value={report.requisitioning_office || report.purchase_order?.purchase_request?.department?.name} />
              <MetaField label="Inspector" value={report.inspector_name} />
              <MetaField label="Accepted By" value={report.accepted_by_name || report.supply_officer_name} />
            </div>

            {(report.findings || report.remarks || report.remarks_for_use_of) && (
              <div className="grid gap-3 sm:grid-cols-2">
                {report.findings && (
                  <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3.5 py-3 sm:col-span-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Findings</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-700">{report.findings}</p>
                  </div>
                )}
                {report.remarks && (
                  <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3.5 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Remarks</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-700">{report.remarks}</p>
                  </div>
                )}
                {report.remarks_for_use_of && (
                  <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3.5 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">For use of</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-700">{report.remarks_for_use_of}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Items */}
          <div className="border-t border-slate-100 px-5 pb-5 sm:px-6">
            <div className="sticky top-0 z-10 -mx-5 flex flex-col gap-3 border-b border-slate-100 bg-white/95 px-5 py-3 backdrop-blur sm:-mx-6 sm:px-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Package size={16} className="text-palawan-600" />
                <h3 className="text-sm font-bold text-slate-800">
                  Items
                  <span className="ml-1.5 font-normal text-slate-500">
                    ({filteredItems.length === items.length
                      ? items.length.toLocaleString()
                      : `${filteredItems.length.toLocaleString()} of ${items.length.toLocaleString()}`})
                  </span>
                </h3>
              </div>
              <div className="relative w-full sm:max-w-xs">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  placeholder="Search items…"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-palawan-400 focus:bg-white focus:ring-2 focus:ring-palawan-100"
                />
              </div>
            </div>

            {items.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500">No items on this report.</div>
            ) : filteredItems.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500">No items match “{itemSearch.trim()}”.</div>
            ) : (
              <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
                <table className="table-zebra min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="sticky top-0 whitespace-nowrap px-3 py-2.5">#</th>
                      <th className="sticky top-0 min-w-[220px] px-3 py-2.5">Description</th>
                      <th className="sticky top-0 whitespace-nowrap px-3 py-2.5">Unit</th>
                      <th className="sticky top-0 whitespace-nowrap px-3 py-2.5 text-right">Ordered</th>
                      <th className="sticky top-0 whitespace-nowrap px-3 py-2.5 text-right">Delivered</th>
                      <th className="sticky top-0 whitespace-nowrap px-3 py-2.5 text-right">Accepted</th>
                      <th className="sticky top-0 whitespace-nowrap px-3 py-2.5 text-right">Unit cost</th>
                      <th className="sticky top-0 whitespace-nowrap px-3 py-2.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map(({ item, index }) => {
                      const total = lineTotal(item);
                      return (
                        <tr key={index}>
                          <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-slate-400">{index + 1}</td>
                          <td className="px-3 py-2.5">
                            <p className="font-medium text-slate-800">{item.description || '—'}</p>
                            {item.remarks && (
                              <p className="mt-0.5 text-xs text-slate-500">{item.remarks}</p>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{item.unit_of_measure || '—'}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-slate-600">
                            {formatPrintQty(item.quantity_ordered ?? 0)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-slate-600">
                            {formatPrintQty(item.quantity_delivered ?? 0)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums font-semibold text-slate-800">
                            {formatPrintQty(item.quantity_accepted ?? 0)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-slate-600">
                            {money(item.unit_cost)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums font-medium text-slate-800">
                            {total == null ? '—' : money(total)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="shrink-0 border-t border-slate-200 bg-slate-50/90 px-5 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            {report.status === 'completed' && (
              <>
                <button type="button" onClick={() => printSavedAir(report)} className="btn-primary">
                  <Printer size={16} /> Print AIR
                </button>
                <button type="button" onClick={() => openCoaRequestPrintPreview(report)} className="btn-secondary">
                  <Printer size={16} /> Print COA Request
                </button>
                <button type="button" onClick={() => openParRequestPrintPreview(report)} className="btn-secondary">
                  <Printer size={16} /> Request for PAR
                </button>
              </>
            )}
            {canManage && report.status === 'draft' && (
              <button type="button" onClick={onEditDraft} className="btn-secondary">
                Edit Draft
              </button>
            )}
            <button type="button" onClick={onClose} className="btn-secondary ml-auto">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function printSavedAir(report: AcceptanceInspectionReport) {
  openAirPrintPreview({
    air_number: report.air_number,
    supplier: report.purchase_order?.supplier?.name,
    po_number: report.po_number ?? report.purchase_order?.po_number,
    po_date: report.po_date,
    invoice_number: report.invoice_number,
    invoice_date: report.invoice_date,
    requisitioning_office: report.requisitioning_office ?? report.purchase_order?.purchase_request?.department?.name,
    obligation_request_no: report.obligation_request_no,
    remarks_for_use_of: report.remarks_for_use_of,
    remarks: report.remarks,
    abc_amount: report.abc_amount,
    amount: report.amount,
    acceptance_date: report.acceptance_date,
    inspection_date: report.inspection_date,
    acceptance_complete: report.acceptance_complete,
    acceptance_partial: report.acceptance_partial,
    acceptance_spec_accepted: report.acceptance_spec_accepted,
    inspection_correct: report.inspection_correct,
    property_officer: report.supply_officer_name ?? report.accepted_by_name,
    inspection_officer: report.inspector_name,
    items: report.items,
  });
}

export function AirReportsPanel({ embedded = false }: { embedded?: boolean }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showManualDr, setShowManualDr] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<DeliveryReceipt | null>(null);
  const [editingDraft, setEditingDraft] = useState<AcceptanceInspectionReport | null>(null);
  const [viewing, setViewing] = useState<AcceptanceInspectionReport | null>(null);
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasPermission('procurement.create') || hasPermission('procurement.*');

  const { data, isLoading } = useQuery({
    queryKey: ['acceptance-inspection-reports', page, search, statusFilter],
    queryFn: () => api.get('/acceptance-inspection-reports', {
      params: {
        page,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      },
    }).then((r) => r.data),
  });

  const { data: pendingReceipts } = useQuery({
    queryKey: ['acceptance-inspection-reports-pending'],
    queryFn: () => api.get('/acceptance-inspection-reports/pending-delivery-receipts').then((r) => r.data.data as DeliveryReceipt[]),
    enabled: showCreate && canManage,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['acceptance-inspection-reports'] });
    queryClient.invalidateQueries({ queryKey: ['acceptance-inspection-reports-pending'] });
    queryClient.invalidateQueries({ queryKey: ['received-items'] });
    queryClient.invalidateQueries({ queryKey: ['received-items-summary'] });
  };

  const openView = async (id: number) => {
    const { data: report } = await api.get(`/acceptance-inspection-reports/${id}`);
    setViewing(report as AcceptanceInspectionReport);
  };

  const actionButtons = canManage ? (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => setShowUpload(true)} className="btn-secondary">
        <Upload size={18} /> Upload DR Excel
      </button>
      <button type="button" onClick={() => setShowManualDr(true)} className="btn-secondary">
        <ClipboardPen size={18} /> Manual DR
      </button>
      <button type="button" onClick={() => setShowCreate(true)} className="btn-primary">
        <Plus size={18} /> New AIR
      </button>
    </div>
  ) : undefined;

  return (
    <div className="space-y-5">
      {embedded ? (
        actionButtons && <div className="flex justify-end">{actionButtons}</div>
      ) : (
        <PageHeader
          title="Acceptance and Inspection Report"
          description="Document inspection and acceptance of delivered supplies and equipment"
          action={actionButtons}
        />
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search AIR, PO, DR, or supplier..."
            className="input-field !pl-11"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="filter-select sm:w-44"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      <DataTable<AcceptanceInspectionReport>
        loading={isLoading}
        data={data?.data ?? []}
        emptyTitle="No acceptance and inspection reports"
        emptyDescription={canManage ? 'Create an AIR from a completed delivery receipt.' : 'Reports will appear here once prepared.'}
        columns={[
          {
            key: 'air_number',
            label: 'AIR No.',
            mobilePrimary: true,
            render: (r) => <span className="font-mono text-xs font-semibold text-palawan-700">{r.air_number}</span>,
          },
          {
            key: 'po',
            label: 'PO / DR',
            render: (r) => (
              <div className="text-sm">
                <p className="font-medium text-slate-800">{r.po_number ?? r.purchase_order?.po_number ?? '—'}</p>
                <p className="text-xs text-slate-500">{r.delivery_receipt?.dr_number ?? '—'}</p>
              </div>
            ),
          },
          {
            key: 'supplier',
            label: 'Supplier',
            hideOnMobile: true,
            render: (r) => r.purchase_order?.supplier?.name ?? '—',
          },
          {
            key: 'inspection_date',
            label: 'Inspection Date',
            render: (r) => new Date(r.inspection_date).toLocaleDateString('en-PH'),
          },
          {
            key: 'inspection_result',
            label: 'Result',
            render: (r) => RESULT_LABELS[r.inspection_result ?? 'accepted'] ?? 'Accepted',
          },
          {
            key: 'status',
            label: 'Status',
            render: (r) => <Badge status={r.status} />,
          },
          {
            key: 'actions',
            label: '',
            render: (r) => (
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => openView(r.id)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-palawan-700 hover:bg-palawan-50">
                  <Eye size={14} /> View
                </button>
                {r.status === 'completed' && (
                  <button type="button" onClick={async () => { const { data: full } = await api.get(`/acceptance-inspection-reports/${r.id}`); printSavedAir(full); }} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100">
                    <Printer size={14} /> Print
                  </button>
                )}
                {canManage && r.status === 'draft' && (
                  <button type="button" onClick={async () => { const { data: full } = await api.get(`/acceptance-inspection-reports/${r.id}`); setEditingDraft(full); }} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50">
                    Edit
                  </button>
                )}
              </div>
            ),
          },
        ]}
      />

      <Pagination
        currentPage={data?.current_page ?? 1}
        lastPage={data?.last_page ?? 1}
        onPageChange={setPage}
      />

      {showUpload && (
        <DeliveryReceiptUploadModal
          onClose={() => setShowUpload(false)}
          onImported={async (receipt) => {
            refresh();
            const { data: full } = await api.get(`/delivery-receipts/${receipt.id}`);
            setSelectedReceipt(full as DeliveryReceipt);
          }}
        />
      )}

      {showManualDr && (
        <DeliveryReceiptManualFormModal
          onClose={() => setShowManualDr(false)}
          onCreated={async (receipt) => {
            refresh();
            const { data: full } = await api.get(`/delivery-receipts/${receipt.id}`);
            setSelectedReceipt(full as DeliveryReceipt);
          }}
        />
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="safe-bottom flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Select Delivery Receipt</h2>
                <p className="text-sm text-slate-500">Choose a completed delivery to inspect and accept</p>
              </div>
              <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            <div className="divide-y divide-slate-100 overflow-y-auto">
              {(pendingReceipts ?? []).length === 0 ? (
                <div className="px-5 py-10 text-center text-sm text-slate-500">
                  <ClipboardCheck className="mx-auto mb-3 text-slate-300" size={32} />
                  No completed delivery receipts are waiting for AIR.
                </div>
              ) : (
                (pendingReceipts ?? []).map((dr) => (
                  <button
                    key={dr.id}
                    type="button"
                    onClick={() => { setSelectedReceipt(dr); setShowCreate(false); }}
                    className="flex w-full items-start justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-semibold text-palawan-700">{dr.dr_number}</p>
                      <p className="mt-0.5 truncate text-sm text-slate-700">{dr.purchase_order?.supplier?.name ?? '—'}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        PO {dr.purchase_order?.po_number ?? '—'} · {new Date(dr.delivery_date).toLocaleDateString('en-PH')}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {selectedReceipt && (
        <AirGovernmentForm
          pendingReceipt={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
          onSuccess={refresh}
        />
      )}

      {editingDraft && (
        <AirGovernmentForm
          draft={editingDraft}
          onClose={() => setEditingDraft(null)}
          onSuccess={refresh}
        />
      )}

      {viewing && (
        <AirViewModal
          report={viewing}
          canManage={canManage}
          onClose={() => setViewing(null)}
          onEditDraft={() => {
            setEditingDraft(viewing);
            setViewing(null);
          }}
        />
      )}
    </div>
  );
}

export default function AcceptanceInspectionReportPage() {
  return <AirReportsPanel />;
}
