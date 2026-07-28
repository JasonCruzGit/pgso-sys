import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, Printer, Search, X } from 'lucide-react';
import api from '../api/client';
import DataTable from '../components/DataTable';
import Pagination from '../components/Pagination';
import Card from '../components/Card';
import Badge from '../components/Badge';
import type { AccountabilityDocument, AssetAssignment, PendingAccountabilityItem } from '../types';
import toast from 'react-hot-toast';
import { openPropertyBarcodePrintPreview } from '../utils/barcodePrint';
import {
  escapeHtml,
  formatPrintMoney,
  formatPrintQty,
  governmentPrintLetterhead,
  openGovernmentPrintWindow,
} from '../utils/governmentPrint';
import { BRANDING } from '../constants/branding';

function formatRegistryDate(value?: string) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function formatRegistryDateUpper(value?: string) {
  if (!value) return '—';
  return formatRegistryDate(value).toUpperCase();
}

function formatMoney(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getAssignmentPropertyLine(assignment: AssetAssignment) {
  const item = assignment.asset?.inventory_item ?? assignment.material_release_item?.inventory_item;
  const qty = Number(assignment.material_release_item?.quantity ?? 1);
  const unitCost = Number(item?.unit_cost ?? assignment.material_release_item?.unit_cost ?? 0);
  const descriptionParts = [
    item?.name,
    item?.brand ? `Brand: ${item.brand}` : null,
    item?.model ? `Model: ${item.model}` : null,
    item?.description,
  ].filter(Boolean);

  return {
    propertyNo: assignment.asset?.property_number ?? item?.property_number ?? item?.item_code ?? '—',
    dateAcquired: item?.date_acquired ?? assignment.assignment_date,
    description: descriptionParts.join(', ') || '—',
    qty,
    unit: item?.unit_of_measure ?? 'unit',
    unitValue: unitCost,
    totalValue: qty * unitCost,
  };
}

function formatFundLabel(document: AccountabilityDocument) {
  return `${document.fund_code} — ${document.fund_name}`;
}

function formatObrMrRef(document: AccountabilityDocument) {
  const parts = [document.obr_reference, document.mr_reference].filter(Boolean);
  return parts.length > 0 ? parts.join(' / ') : '—';
}

function AccountabilitySplitView({
  documentType,
  loading,
  page,
  lastPage,
  total,
  onPageChange,
  search,
  onSearchChange,
  deptFilter,
  onDeptFilterChange,
  deptList,
  documents,
}: {
  documentType: 'ics' | 'par';
  documents: AccountabilityDocument[];
  loading: boolean;
  page: number;
  lastPage: number;
  total?: number;
  onPageChange: (page: number) => void;
  search: string;
  onSearchChange: (value: string) => void;
  deptFilter: string;
  onDeptFilterChange: (value: string) => void;
  deptList: Array<{ id: number; name: string }>;
}) {
  const docLabel = documentType.toUpperCase();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [printBarcode, setPrintBarcode] = useState(false);

  useEffect(() => {
    if (documents.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !documents.some((r) => r.id === selectedId)) {
      setSelectedId(documents[0].id);
    }
  }, [documents, selectedId]);

  const { data: selectedDetail, isLoading: loadingDetail } = useQuery({
    queryKey: ['property-accountability-document', selectedId],
    queryFn: () => api.get(`/property-accountability/documents/${selectedId}`).then((r) => r.data as AccountabilityDocument),
    enabled: !!selectedId,
  });

  const document = selectedDetail ?? documents.find((r) => r.id === selectedId);
  const propertyLines = (document?.items ?? []).map(getAssignmentPropertyLine);
  const totalValue = propertyLines.reduce((sum, line) => sum + line.totalValue, 0);
  const officeLabel = document?.department
    ? [document.department.code, document.department.name].filter(Boolean).join(' - ')
    : '—';

  const handlePrint = async () => {
    if (!document) return;
    openAccountabilityDocumentPrintPreview(document);
    if (printBarcode) {
      await openPropertyBarcodePrintPreview(
        (document.items ?? []).map((item) => {
          const line = getAssignmentPropertyLine(item);
          return {
            propertyNumber: line.propertyNo,
            description: line.description,
            documentNumber: document.acknowledgment_number,
            documentType: document.document_type,
            custodianName: document.custodian?.name,
          };
        }),
      );
    }
  };

  return (
    <div className="grid min-h-[calc(100vh-14rem)] gap-4 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
      <aside className="card flex flex-col overflow-hidden">
        <div className="space-y-2 border-b border-slate-100 p-3">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <input
              type="checkbox"
              checked={printBarcode}
              onChange={(e) => setPrintBarcode(e.target.checked)}
              className="rounded border-slate-300 text-palawan-600 focus:ring-palawan-500"
            />
            Print Barcode
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={`Search ${docLabel} no., employee...`}
              className="input-field !pl-9 text-sm"
            />
          </div>
          <select
            value={deptFilter}
            onChange={(e) => onDeptFilterChange(e.target.value)}
            className="input-field text-sm"
          >
            <option value="">All offices</option>
            {deptList.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="table-zebra min-w-full text-xs">
            <thead className="sticky top-0 bg-sky-50 text-left text-[10px] font-bold uppercase tracking-wide text-sky-900">
              <tr>
                <th className="px-3 py-2">{docLabel} No.</th>
                <th className="px-2 py-2">Date Entry</th>
                <th className="px-2 py-2">Employee</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}><td colSpan={3} className="px-3 py-2"><div className="skeleton h-8 rounded" /></td></tr>
                ))
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-8 text-center text-slate-500">
                    No {docLabel} records found.
                  </td>
                </tr>
              ) : (
                documents.map((row) => {
                  const active = row.id === selectedId;
                  return (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedId(row.id)}
                      className={`cursor-pointer ${active ? 'table-row-active' : ''}`}
                    >
                      <td className={`px-3 py-2.5 font-mono font-semibold ${active ? 'text-sky-800' : 'text-palawan-700'}`}>
                        {row.acknowledgment_number}
                        {(row.items_count ?? 0) > 1 && (
                          <span className="ml-1 rounded bg-sky-200 px-1 py-0.5 text-[9px] font-bold text-sky-900">
                            {row.items_count}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 text-slate-600">
                        {formatRegistryDate(row.assignment_date)}
                      </td>
                      <td className="max-w-[88px] truncate px-2 py-2.5 text-slate-700" title={row.custodian?.name}>
                        {row.custodian?.name ?? '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {lastPage > 1 && (
          <div className="border-t border-slate-100 p-2">
            <Pagination currentPage={page} lastPage={lastPage} onPageChange={onPageChange} />
          </div>
        )}
        {total != null && (
          <div className="border-t border-slate-100 bg-slate-50 px-3 py-2 text-[10px] text-slate-500">
            {documents.length} shown · {total} total in registry
          </div>
        )}
      </aside>

      <section className="card flex min-h-0 flex-col overflow-hidden">
        {!document ? (
          <div className="flex flex-1 items-center justify-center p-8 text-sm text-slate-500">
            Select a {docLabel} record from the list to view details.
          </div>
        ) : (
          <>
            <div className="border-b border-slate-200 bg-gradient-to-r from-sky-50 to-white px-5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Details</p>
                  <p className="font-mono text-lg font-bold text-amber-600">
                    {document.acknowledgment_number}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge status={document.status} />
                  <button
                    type="button"
                    onClick={() => { void handlePrint(); }}
                    className="btn-secondary inline-flex items-center gap-2 text-sm"
                  >
                    <Printer size={16} /> Print
                  </button>
                </div>
              </div>
            </div>

            {loadingDetail ? (
              <div className="space-y-3 p-5">
                <div className="skeleton h-20 rounded-xl" />
                <div className="skeleton h-40 rounded-xl" />
              </div>
            ) : (
              <>
                <div className="grid gap-2 border-b border-slate-100 bg-sky-50/40 p-4 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-lg border border-sky-100 bg-white px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{docLabel} No.</p>
                    <p className="mt-1 font-mono text-sm font-bold text-amber-600">
                      {document.acknowledgment_number}
                    </p>
                  </div>
                  <div className="rounded-lg border border-sky-100 bg-white px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Date Entry</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">{formatRegistryDateUpper(document.assignment_date)}</p>
                  </div>
                  <div className="rounded-lg border border-sky-100 bg-white px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Employee Name</p>
                    <p className="mt-1 text-sm font-bold uppercase text-slate-900">{document.custodian?.name ?? '—'}</p>
                  </div>
                  <div className="rounded-lg border border-sky-100 bg-white px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Fund</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">{formatFundLabel(document)}</p>
                  </div>
                  <div className="rounded-lg border border-sky-100 bg-white px-3 py-2.5 sm:col-span-2 xl:col-span-1">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Office Name</p>
                    <p className="mt-1 text-sm font-bold uppercase text-slate-900">{officeLabel}</p>
                  </div>
                  <div className="rounded-lg border border-sky-100 bg-white px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">OBR / MR Ref.</p>
                    <p className="mt-1 font-mono text-sm font-bold text-slate-900">
                      {formatObrMrRef(document)}
                    </p>
                  </div>
                </div>

                <div className="flex-1 overflow-auto">
                  <table className="table-zebra min-w-full text-sm">
                    <thead className="sticky top-0 bg-sky-100 text-left text-[10px] font-bold uppercase tracking-wide text-sky-900">
                      <tr>
                        <th className="px-3 py-2.5">Property No.</th>
                        <th className="px-3 py-2.5">Date Acquired</th>
                        <th className="min-w-[240px] px-3 py-2.5">Description</th>
                        <th className="px-3 py-2.5 text-right">Qty</th>
                        <th className="px-3 py-2.5">Unit</th>
                        <th className="px-3 py-2.5 text-right">Unit Value</th>
                        <th className="px-3 py-2.5 text-right">Total Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {propertyLines.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                            No property lines in this {docLabel}.
                          </td>
                        </tr>
                      ) : (
                        propertyLines.map((propertyLine, index) => (
                          <tr key={`${propertyLine.propertyNo}-${index}`}>
                            <td className="px-3 py-3 font-mono text-xs font-semibold text-palawan-700">
                              {propertyLine.propertyNo}
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                              {formatRegistryDate(propertyLine.dateAcquired)}
                            </td>
                            <td className="px-3 py-3 text-slate-700">{propertyLine.description}</td>
                            <td className="px-3 py-3 text-right font-medium">{propertyLine.qty}</td>
                            <td className="px-3 py-3 text-slate-600">{propertyLine.unit}</td>
                            <td className="whitespace-nowrap px-3 py-3 text-right">{formatMoney(propertyLine.unitValue)}</td>
                            <td className="whitespace-nowrap px-3 py-3 text-right font-bold text-sky-800">
                              {formatMoney(propertyLine.totalValue)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                  <p className="text-slate-600">
                    <span className="font-semibold text-slate-900">{propertyLines.length}</span> total item(s) in this {docLabel}
                  </p>
                  <p className="font-bold text-sky-800">
                    Σ {formatMoney(totalValue)}
                  </p>
                </div>
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}

export function openAccountabilityDocumentPrintPreview(document: AccountabilityDocument) {
  const isPar = document.document_type === 'par';
  const title = isPar ? 'Property Acknowledgment Receipt' : 'Inventory Custodian Slip';
  const subtitle = isPar
    ? 'Acknowledgment of Receipt of Government Property (High-Value / PPE)'
    : 'Acknowledgment of Receipt of Semi-Expendable Property';
  const docLabel = isPar ? 'PAR No.' : 'ICS No.';
  const items = document.items ?? [];
  const generatedAt = new Date().toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' });
  const assignmentDate = document.assignment_date
    ? new Date(document.assignment_date).toLocaleDateString('en-PH', { dateStyle: 'long' })
    : '—';
  const mr = document.material_release;
  const totalAmount = items.reduce((sum, assignment) => sum + getAssignmentPropertyLine(assignment).totalValue, 0);

  const rows = items.map((assignment, index) => {
    const line = getAssignmentPropertyLine(assignment);
    const item = assignment.asset?.inventory_item ?? assignment.material_release_item?.inventory_item;
    const serial = assignment.material_release_item?.serial_number ?? item?.serial_number ?? '—';
    const brandModel = [item?.brand, item?.model].filter(Boolean).join(' · ') || '—';

    return `
      <tr>
        <td class="center">${index + 1}</td>
        <td>${escapeHtml(line.description)}</td>
        <td>${escapeHtml(line.propertyNo)}</td>
        <td>${escapeHtml(serial)}</td>
        <td>${escapeHtml(brandModel)}</td>
        <td class="center">${escapeHtml(line.unit.toUpperCase())}</td>
        <td class="num">${formatPrintQty(line.qty)}</td>
        <td class="num">${formatPrintMoney(line.unitValue)}</td>
        <td class="num">${formatPrintMoney(line.totalValue)}</td>
      </tr>
    `;
  }).join('');

  const content = `
    ${governmentPrintLetterhead()}
    <h1 class="doc-title">${escapeHtml(title)}</h1>
    <p class="doc-subtitle">${escapeHtml(subtitle)}</p>
    <div class="ref-bar">
      <span><strong>${escapeHtml(docLabel)}</strong> ${escapeHtml(document.acknowledgment_number ?? '—')}</span>
      <span><strong>OBR Ref.:</strong> ${escapeHtml(document.obr_reference ?? '—')}</span>
      <span><strong>MR Ref.:</strong> ${escapeHtml(document.mr_reference ?? mr?.mr_number ?? '—')}</span>
      <span><strong>Status:</strong> <span class="status-stamp">${escapeHtml((document.status ?? 'active').toUpperCase())}</span></span>
    </div>
    <table class="info-table">
      <tr>
        <td class="label">Custodian / End User</td>
        <td>${escapeHtml(document.custodian?.name ?? '—')}</td>
        <td class="label">Department / Office</td>
        <td>${escapeHtml(document.department?.name ?? '—')}</td>
      </tr>
      <tr>
        <td class="label">Date Issued</td>
        <td>${escapeHtml(assignmentDate)}</td>
        <td class="label">Fund</td>
        <td>${escapeHtml(formatFundLabel(document))}</td>
      </tr>
      <tr>
        <td class="label">Issued By (GSO)</td>
        <td>${escapeHtml(document.assigner?.name ?? '—')}</td>
        <td class="label">Purpose / MR Purpose</td>
        <td>${escapeHtml(mr?.purpose ?? document.notes ?? '—')}</td>
      </tr>
    </table>
    <p class="section-title">Property Details</p>
    <table class="items-table">
      <thead>
        <tr>
          <th class="center" style="width:4%">#</th>
          <th>Item Description</th>
          <th style="width:12%">Property No.</th>
          <th style="width:10%">Serial No.</th>
          <th style="width:12%">Brand / Model</th>
          <th class="center" style="width:7%">Unit</th>
          <th class="num" style="width:7%">Qty</th>
          <th class="num" style="width:11%">Unit Cost</th>
          <th class="num" style="width:11%">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="9" class="center">No property lines</td></tr>'}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="8" class="num strong">Total</td>
          <td class="num strong">${formatPrintMoney(totalAmount)}</td>
        </tr>
      </tfoot>
    </table>
    <p style="margin:12px 0 20px;font-size:11px;line-height:1.5;color:#333">
      I hereby acknowledge receipt of the government property described above and assume accountability therefor.
      I understand that I am responsible for the safekeeping and proper use of said property in accordance with
      COA and GPPB regulations. ${isPar ? 'This PAR applies to property with unit cost above ₱50,000.' : 'This ICS applies to semi-expendable property with unit cost of ₱50,000 and below.'}
    </p>
    <div class="signatures">
      <div class="sig-block">
        <div class="sig-line"></div>
        <p class="sig-name">${escapeHtml(document.custodian?.name ?? '')}</p>
        <p class="sig-role">Received By / Custodian</p>
      </div>
      <div class="sig-block">
        <div class="sig-line"></div>
        <p class="sig-name">${escapeHtml(document.assigner?.name ?? '')}</p>
        <p class="sig-role">Issued By (GSO)</p>
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
      <span>Document Control: ${escapeHtml(document.acknowledgment_number ?? '')}</span>
    </div>
  `;

  openGovernmentPrintWindow(
    `${document.acknowledgment_number ?? ''} — ${isPar ? 'PAR' : 'ICS'}`,
    content,
  );
}

export function openAccountabilityPrintPreview(assignment: AssetAssignment) {
  if (assignment.accountability_document) {
    openAccountabilityDocumentPrintPreview({
      ...assignment.accountability_document,
      items: [assignment],
    });
    return;
  }

  openAccountabilityDocumentPrintPreview({
    id: assignment.accountability_document_id ?? assignment.id,
    acknowledgment_number: assignment.acknowledgment_number ?? assignment.assignment_number,
    document_type: assignment.document_type as 'ics' | 'par',
    custodian_user_id: assignment.custodian_user_id,
    custodian: assignment.custodian,
    department: assignment.department,
    material_release_id: assignment.material_release_id,
    material_release: assignment.material_release,
    assignment_date: assignment.assignment_date,
    fund_code: '100',
    fund_name: 'GENERAL FUND',
    obr_reference: null,
    mr_reference: assignment.material_release?.mr_number ?? null,
    assigner: assignment.assigner,
    status: assignment.status,
    notes: assignment.notes,
    items: [assignment],
  });
}

export function AccountabilityDetailModal({
  assignment,
  onClose,
}: {
  assignment: AssetAssignment;
  onClose: () => void;
}) {
  const item = assignment.asset?.inventory_item ?? assignment.material_release_item?.inventory_item;
  const isPar = assignment.document_type === 'par';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
          <div>
            <p className="font-mono text-lg font-bold text-palawan-700">{assignment.acknowledgment_number}</p>
            <p className="text-sm text-slate-500">{isPar ? 'Property Acknowledgment Receipt' : 'Inventory Custodian Slip'}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openAccountabilityPrintPreview(assignment)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Printer size={16} /> Print Preview
            </button>
            <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100">✕</button>
          </div>
        </div>
        <div className="space-y-4 p-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><dt className="text-xs text-slate-400">MR Reference</dt><dd className="font-mono font-medium text-palawan-700">{assignment.material_release?.mr_number ?? '—'}</dd></div>
            <div><dt className="text-xs text-slate-400">Document Type</dt><dd className="font-medium uppercase text-slate-900">{assignment.document_type}</dd></div>
            <div><dt className="text-xs text-slate-400">Custodian</dt><dd className="font-medium text-slate-900">{assignment.custodian?.name ?? '—'}</dd></div>
            <div><dt className="text-xs text-slate-400">Department</dt><dd className="font-medium text-slate-900">{assignment.department?.name ?? '—'}</dd></div>
            <div><dt className="text-xs text-slate-400">Date Issued</dt><dd className="font-medium text-slate-900">{new Date(assignment.assignment_date).toLocaleDateString()}</dd></div>
            <div><dt className="text-xs text-slate-400">Status</dt><dd><Badge status={assignment.status} /></dd></div>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Property</p>
            <p className="font-medium text-slate-900">{item?.name ?? '—'}</p>
            <p className="mt-1 font-mono text-xs text-palawan-700">{assignment.asset?.property_number ?? item?.property_number ?? item?.item_code}</p>
            <p className="mt-2 text-sm text-slate-600">Unit cost: ₱{Number(item?.unit_cost ?? 0).toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ManualAccountabilityModal({
  documentType,
  deptList,
  initialReceivedItemId,
  onClose,
  onSuccess,
}: {
  documentType: 'ics' | 'par';
  deptList: Array<{ id: number; name: string }>;
  initialReceivedItemId?: number | null;
  onClose: () => void;
  onSuccess: (assignment: AssetAssignment) => void;
}) {
  const docLabel = documentType.toUpperCase();
  const [selectionKey, setSelectionKey] = useState(
    initialReceivedItemId ? `received_item:${initialReceivedItemId}` : '',
  );
  const [custodianId, setCustodianId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [assignmentDate, setAssignmentDate] = useState(new Date().toISOString().slice(0, 10));
  const [mrReference, setMrReference] = useState('');
  const [obrReference, setObrReference] = useState('');
  const [fundCode, setFundCode] = useState('100');
  const [fundName, setFundName] = useState('GENERAL FUND');
  const [location, setLocation] = useState('');
  const [condition, setCondition] = useState('good');
  const [notes, setNotes] = useState('');

  const { data: assets } = useQuery({
    queryKey: ['property-accountability-assignable-assets', documentType],
    queryFn: () => api.get('/property-accountability/assignable-assets', {
      params: { document_type: documentType },
    }).then((r) => r.data.data as Array<{
      id: number;
      source?: 'asset' | 'received_item';
      received_item_id?: number;
      property_number: string;
      location?: string;
      condition?: string;
      air_number?: string;
      obr_reference?: string | null;
      quantity_on_hand?: number | string;
      inventory_item?: {
        name: string;
        item_code?: string;
        serial_number?: string;
        unit_of_measure?: string;
        unit_cost?: number;
        storage_location?: string;
        category?: { name: string };
      };
    }>),
  });

  const { data: custodians } = useQuery({
    queryKey: ['custodians-select', departmentId],
    queryFn: () => api.get('/custodians', { params: { department_id: departmentId || undefined } }).then((r) => r.data),
  });

  type AssignableOption = NonNullable<typeof assets>[number];

  function optionKey(option: AssignableOption) {
    return `${option.source ?? 'asset'}:${option.id}`;
  }

  const assetList = assets ?? [];
  const stockAssets = assetList.filter((a) => (a.source ?? 'asset') === 'asset');
  const registryItems = assetList.filter((a) => a.source === 'received_item');
  const custodianList = custodians?.data ?? [];
  const selectedOption = assetList.find((a) => optionKey(a) === selectionKey);
  const selectedCustodian = custodianList.find((c: { id: number }) => String(c.id) === custodianId);
  const item = selectedOption?.inventory_item;

  useEffect(() => {
    if (!initialReceivedItemId || !assets) return;
    const key = `received_item:${initialReceivedItemId}`;
    const match = assets.find((a) => optionKey(a) === key);
    if (match) {
      setSelectionKey(key);
    } else if (selectionKey === key) {
      toast.error('This registry item is not available for issuance');
      setSelectionKey('');
    }
  }, [initialReceivedItemId, assets]);

  useEffect(() => {
    if (!selectedOption) return;
    setLocation(selectedOption.location ?? item?.storage_location ?? '');
    setCondition(selectedOption.condition ?? 'good');
    if (selectedOption.source === 'received_item' && selectedOption.obr_reference) {
      setObrReference(selectedOption.obr_reference);
    }
  }, [selectionKey, item?.storage_location, selectedOption?.location, selectedOption?.condition, selectedOption?.obr_reference, selectedOption?.source]);

  useEffect(() => {
    if (!selectedCustodian?.department_id) return;
    setDepartmentId(String(selectedCustodian.department_id));
  }, [custodianId, selectedCustodian?.department_id]);

  const create = useMutation({
    mutationFn: () => {
      const payload: Record<string, unknown> = {
        custodian_user_id: Number(custodianId),
        department_id: Number(departmentId),
        assignment_date: assignmentDate,
        document_type: documentType,
        mr_reference: mrReference.trim() || undefined,
        obr_reference: obrReference.trim() || undefined,
        fund_code: fundCode.trim() || undefined,
        fund_name: fundName.trim() || undefined,
        location: location || undefined,
        condition: condition || undefined,
        notes: notes.trim() || undefined,
      };

      if (selectedOption?.source === 'received_item') {
        payload.received_item_id = selectedOption.received_item_id ?? selectedOption.id;
      } else {
        payload.asset_id = Number(selectedOption?.id);
      }

      return api.post('/property-accountability', payload).then((r) => r.data as AssetAssignment);
    },
    onSuccess,
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e.response?.data?.message ?? `Failed to create ${docLabel}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectionKey || !custodianId || !departmentId) {
      toast.error('Complete all required fields');
      return;
    }
    create.mutate();
  };

  const renderOption = (option: AssignableOption) => {
    const qtyLabel = option.source === 'received_item' && option.quantity_on_hand != null
      ? ` · Qty ${Number(option.quantity_on_hand).toLocaleString()}`
      : '';
    const costLabel = option.inventory_item?.unit_cost != null
      ? ` (₱${Number(option.inventory_item.unit_cost).toLocaleString()})`
      : '';

    return (
      <option key={optionKey(option)} value={optionKey(option)}>
        {option.property_number} — {option.inventory_item?.name}{costLabel}{qtyLabel}
      </option>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-6">
      <div className="card-elevated flex max-h-[95vh] w-full max-w-3xl flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">New {docLabel}</h2>
            <p className="text-sm text-slate-500">Manually issue {docLabel} for property not linked to an MR in this system</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-6">
            <section>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Property</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Asset</label>
                  <select required value={selectionKey} onChange={(e) => setSelectionKey(e.target.value)} className="input-field">
                    <option value="">Select property / asset</option>
                    {registryItems.length > 0 && (
                      <optgroup label="Item Registry (from AIR / DR)">
                        {registryItems.map(renderOption)}
                      </optgroup>
                    )}
                    {stockAssets.length > 0 && (
                      <optgroup label="Stocks / Assets">
                        {stockAssets.map(renderOption)}
                      </optgroup>
                    )}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Property No.</label>
                  <input readOnly value={selectedOption?.property_number ?? ''} className="input-field bg-slate-50 font-mono text-slate-600" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Unit Cost</label>
                  <input
                    readOnly
                    value={item?.unit_cost != null ? `₱${Number(item.unit_cost).toLocaleString()}` : ''}
                    className="input-field bg-slate-50 text-slate-600"
                  />
                </div>
              </div>
            </section>

            <section>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Custodian &amp; Office</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Custodian</label>
                  <select required value={custodianId} onChange={(e) => setCustodianId(e.target.value)} className="input-field">
                    <option value="">Select custodian</option>
                    {custodianList.map((user: { id: number; name: string; employee_id?: string }) => (
                      <option key={user.id} value={user.id}>
                        {user.name}{user.employee_id ? ` (${user.employee_id})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Department / Office</label>
                  <select required value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="input-field">
                    <option value="">Select department</option>
                    {deptList.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>
            </section>

            <section>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Issuance Details</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Date Issued</label>
                  <input required type="date" value={assignmentDate} onChange={(e) => setAssignmentDate(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">MR Reference</label>
                  <input
                    value={mrReference}
                    onChange={(e) => setMrReference(e.target.value)}
                    placeholder="Optional external MR number"
                    className="input-field font-mono"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">OBR Reference</label>
                  <input
                    value={obrReference}
                    onChange={(e) => setObrReference(e.target.value)}
                    placeholder="Obligation Request No."
                    className="input-field font-mono"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Fund Code</label>
                  <input value={fundCode} onChange={(e) => setFundCode(e.target.value)} className="input-field font-mono" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Fund Name</label>
                  <input value={fundName} onChange={(e) => setFundName(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Location</label>
                  <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Office / room / building" className="input-field" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Condition</label>
                  <select value={condition} onChange={(e) => setCondition(e.target.value)} className="input-field uppercase">
                    <option value="excellent">EXCELLENT</option>
                    <option value="good">GOOD</option>
                    <option value="fair">FAIR</option>
                    <option value="poor">POOR</option>
                    <option value="damaged">DAMAGED</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Notes / Remarks</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Purpose or accountability remarks"
                    className="input-field resize-none"
                  />
                </div>
              </div>
            </section>
          </div>

          <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={create.isPending}>
              {create.isPending ? 'Issuing...' : `Issue ${docLabel}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface PropertyAccountabilityTabProps {
  page: number;
  onPageChange: (page: number) => void;
  canView: boolean;
  canIssue: boolean;
  deptList: Array<{ id: number; name: string }>;
  documentType?: 'ics' | 'par';
  manualFormOpen?: boolean;
  onManualFormOpenChange?: (open: boolean) => void;
  initialReceivedItemId?: number | null;
  variant?: 'workflow' | 'registry';
}

export function PropertyAccountabilityTab({
  page,
  onPageChange,
  canView,
  canIssue,
  deptList,
  documentType,
  manualFormOpen = false,
  onManualFormOpenChange,
  initialReceivedItemId = null,
  variant = 'workflow',
}: PropertyAccountabilityTabProps) {
  const [search, setSearch] = useState('');
  const [docFilter, setDocFilter] = useState(documentType ?? '');
  const [deptFilter, setDeptFilter] = useState('');
  const [viewAssignment, setViewAssignment] = useState<AssetAssignment | null>(null);
  const queryClient = useQueryClient();

  const showManualForm = manualFormOpen;
  const closeManualForm = () => onManualFormOpenChange?.(false);

  const { data: pending, isLoading: loadingPending } = useQuery({
    queryKey: ['property-accountability-pending'],
    queryFn: () => api.get('/property-accountability/pending').then((r) => r.data.data as PendingAccountabilityItem[]),
    enabled: canView && variant === 'workflow',
  });

  const { data: records, isLoading: loadingRecords } = useQuery({
    queryKey: ['property-accountability', page, search, documentType ?? docFilter, deptFilter],
    queryFn: () => api.get('/property-accountability', {
      params: {
        page,
        per_page: documentType ? 50 : 15,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...((documentType ?? docFilter) ? { document_type: documentType ?? docFilter } : {}),
        ...(deptFilter ? { department_id: deptFilter } : {}),
      },
    }).then((r) => r.data),
    enabled: canView && !documentType,
  });

  const { data: documentsPage, isLoading: loadingDocuments } = useQuery({
    queryKey: ['property-accountability-documents', page, search, documentType, deptFilter],
    queryFn: () => api.get('/property-accountability/documents', {
      params: {
        page,
        per_page: 50,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(documentType ? { document_type: documentType } : {}),
        ...(deptFilter ? { department_id: deptFilter } : {}),
      },
    }).then((r) => r.data),
    enabled: canView && !!documentType,
  });

  const issue = useMutation({
    mutationFn: (payload: { lineId: number; document_type?: string }) => api.post(
      `/property-accountability/from-mr-item/${payload.lineId}`,
      { document_type: payload.document_type },
    ),
    onSuccess: (res) => {
      const doc = res.data.document_type?.toUpperCase() ?? 'ICS/PAR';
      toast.success(`${doc} ${res.data.acknowledgment_number} issued`);
      queryClient.invalidateQueries({ queryKey: ['property-accountability'] });
      queryClient.invalidateQueries({ queryKey: ['property-accountability-documents'] });
      queryClient.invalidateQueries({ queryKey: ['property-accountability-pending'] });
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e.response?.data?.message ?? 'Failed to issue accountability document');
    },
  });

  const openDetail = async (id: number) => {
    const { data } = await api.get(`/property-accountability/${id}`);
    setViewAssignment(data);
  };

  const docLabel = documentType?.toUpperCase() ?? 'ICS / PAR';
  const pendingLines = documentType
    ? (pending ?? []).filter((line) => line.suggested_document_type === documentType)
    : (pending ?? []);

  if (!canView) {
    return (
      <div className="card p-8 text-center text-slate-500">
        You do not have permission to view {docLabel} records.
      </div>
    );
  }

  return (
    <>
      {variant === 'workflow' && pendingLines.length > 0 && canIssue && (
        <Card title={`Pending ${docLabel} — After MR`} subtitle="Completed material releases awaiting accountability issuance">
          <div className="space-y-3">
            {pendingLines.map((line) => {
              const issueType = documentType ?? line.suggested_document_type;
              return (
              <div key={line.id} className="flex flex-col gap-3 rounded-xl border border-amber-100 bg-amber-50/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-mono text-xs font-semibold text-palawan-700">{line.mr_number}</p>
                  <p className="text-sm font-medium text-slate-900">
                    {line.inventory_item?.name} · {line.recipient?.name}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">{line.department?.name} · {line.purpose}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Unit cost: ₱{Number(line.unit_cost).toLocaleString()} · {issueType.toUpperCase()}
                  </p>
                </div>
                <div className="flex shrink-0">
                  <button
                    type="button"
                    onClick={() => issue.mutate({ lineId: line.id, document_type: issueType })}
                    disabled={issue.isPending}
                    className="btn-primary text-sm"
                  >
                    Issue {issueType.toUpperCase()}
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        </Card>
      )}

      {variant === 'workflow' && !loadingPending && pendingLines.length === 0 && canIssue && (
        <p className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          No completed MR lines are waiting for {docLabel} issuance.
        </p>
      )}

      {documentType ? (
        <AccountabilitySplitView
          documentType={documentType}
          documents={(documentsPage?.data ?? []) as AccountabilityDocument[]}
          loading={loadingDocuments}
          page={documentsPage?.current_page ?? 1}
          lastPage={documentsPage?.last_page ?? 1}
          total={documentsPage?.total}
          onPageChange={onPageChange}
          search={search}
          onSearchChange={(value) => { setSearch(value); onPageChange(1); }}
          deptFilter={deptFilter}
          onDeptFilterChange={(value) => { setDeptFilter(value); onPageChange(1); }}
          deptList={deptList}
        />
      ) : (
        <>
          <div className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_10rem_11rem] sm:items-end">
            <div className="sm:col-span-2 lg:col-span-1">
              <label htmlFor="ics-par-search" className="mb-1.5 block text-sm font-medium text-slate-700">Search</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  id="ics-par-search"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); onPageChange(1); }}
                  placeholder="Search ICS/PAR no., MR no., custodian, property no..."
                  className="input-field w-full !pl-11"
                />
              </div>
            </div>
            <div>
              <label htmlFor="ics-par-doc" className="mb-1.5 block text-sm font-medium text-slate-700">Document</label>
              <select id="ics-par-doc" value={docFilter} onChange={(e) => { setDocFilter(e.target.value); onPageChange(1); }} className="input-field w-full">
                <option value="">All</option>
                <option value="ics">ICS</option>
                <option value="par">PAR</option>
              </select>
            </div>
            <div>
              <label htmlFor="ics-par-dept" className="mb-1.5 block text-sm font-medium text-slate-700">Department</label>
              <select id="ics-par-dept" value={deptFilter} onChange={(e) => { setDeptFilter(e.target.value); onPageChange(1); }} className="input-field w-full">
                <option value="">All Departments</option>
                {deptList.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>

          <DataTable<AssetAssignment>
            loading={loadingRecords}
            data={records?.data ?? []}
            emptyTitle={`No ${docLabel} records yet`}
            emptyDescription={`Issue ${docLabel} accountability documents from completed material releases above.`}
            columns={[
              { key: 'ack', label: 'Doc No.', render: (r) => <span className="font-mono text-xs font-semibold text-palawan-700">{r.acknowledgment_number}</span> },
              { key: 'type', label: 'Type', render: (r) => <span className="uppercase">{r.document_type}</span> },
              { key: 'mr', label: 'MR Ref.', render: (r) => r.material_release?.mr_number ?? '—' },
              { key: 'property', label: 'Property', render: (r) => r.asset?.inventory_item?.name ?? r.asset?.property_number ?? '—' },
              { key: 'custodian', label: 'Custodian', render: (r) => r.custodian?.name ?? '—' },
              { key: 'department', label: 'Department', render: (r) => r.department?.name ?? '—' },
              { key: 'date', label: 'Date', render: (r) => new Date(r.assignment_date).toLocaleDateString() },
              { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
              {
                key: 'actions',
                label: '',
                render: (r) => (
                  <button
                    type="button"
                    onClick={() => openDetail(r.id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-palawan-50 px-2.5 py-1 text-xs font-semibold text-palawan-700 hover:bg-palawan-100"
                  >
                    <Eye size={14} /> View
                  </button>
                ),
              },
            ]}
          />
          <Pagination currentPage={records?.current_page ?? 1} lastPage={records?.last_page ?? 1} onPageChange={onPageChange} />

          {viewAssignment && (
            <AccountabilityDetailModal assignment={viewAssignment} onClose={() => setViewAssignment(null)} />
          )}
        </>
      )}

      {showManualForm && documentType && (
        <ManualAccountabilityModal
          documentType={documentType}
          deptList={deptList}
          initialReceivedItemId={initialReceivedItemId}
          onClose={closeManualForm}
          onSuccess={(assignment) => {
            toast.success(`${assignment.document_type.toUpperCase()} ${assignment.acknowledgment_number} issued`);
            closeManualForm();
            queryClient.invalidateQueries({ queryKey: ['property-accountability'] });
            queryClient.invalidateQueries({ queryKey: ['property-accountability-documents'] });
            queryClient.invalidateQueries({ queryKey: ['property-accountability-assignable-assets'] });
            queryClient.invalidateQueries({ queryKey: ['received-items'] });
            queryClient.invalidateQueries({ queryKey: ['received-items-summary'] });
            onPageChange(1);
          }}
        />
      )}
    </>
  );
}
