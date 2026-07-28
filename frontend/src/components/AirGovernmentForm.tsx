import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { X, Loader2, Printer } from 'lucide-react';
import api from '../api/client';
import type { AcceptanceInspectionItem, AcceptanceInspectionReport, DeliveryReceipt } from '../types';
import { BRANDING, LOGO_PATH, PGSO_LOGO_PATH } from '../constants/branding';
import { openAirPrintPreview } from '../utils/airPrint';
import { formatPesoAmount, parsePesoAmount } from '../utils/governmentPrint';
import { isSummaryImportRow } from '../utils/deliveryReceiptImport';
import toast from 'react-hot-toast';

const MIN_BLANK_ROWS = 30;

export function itemsFromDeliveryReceipt(dr: DeliveryReceipt): AcceptanceInspectionItem[] {
  const po = dr.purchase_order;
  if (dr.stock_receipt?.items?.length) {
    return dr.stock_receipt.items.map((item) => {
      const poItem = po?.items?.find((p) => p.inventory_item_id === item.inventory_item_id);
      return {
        description: item.inventory_item?.name ?? poItem?.description ?? '—',
        unit_of_measure: item.inventory_item?.unit_of_measure ?? poItem?.unit_of_measure ?? 'unit',
        quantity_ordered: poItem?.quantity_ordered ?? item.quantity_received,
        quantity_delivered: item.quantity_received,
        quantity_accepted: item.quantity_received,
        unit_cost: item.unit_cost ?? poItem?.unit_cost ?? 0,
        remarks: '',
      };
    });
  }
  return (dr.draft_items?.items ?? [])
    .filter((item) => !isSummaryImportRow(item))
    .map((item) => ({
    description: item.description ?? '—',
    unit_of_measure: item.unit_of_measure ?? 'unit',
    quantity_ordered: Number(item.quantity_ordered ?? 0),
    quantity_delivered: Number(item.quantity_received ?? 0),
    quantity_accepted: Number(item.quantity_received ?? 0),
    unit_cost: Number(item.unit_cost ?? 0),
    remarks: '',
  }));
}

function emptyAirItem(): AcceptanceInspectionItem {
  return {
    description: '',
    unit_of_measure: '',
    quantity_accepted: '',
    quantity_ordered: '',
    quantity_delivered: '',
    unit_cost: 0,
    remarks: '',
  };
}

function padItems(items: AcceptanceInspectionItem[]): AcceptanceInspectionItem[] {
  const filled = [...items];
  const hasData = filled.some((item) => item.description?.trim());
  const targetLength = hasData ? filled.length : Math.max(MIN_BLANK_ROWS, filled.length);
  while (filled.length < targetLength) {
    filled.push(emptyAirItem());
  }
  return filled;
}

function draftItemsTotal(dr?: DeliveryReceipt | null): number {
  const lines = (dr?.draft_items?.items ?? []).filter((item) => !isSummaryImportRow(item));
  return lines.reduce(
    (sum, item) => sum + Number(item.quantity_received ?? 0) * Number(item.unit_cost ?? 0),
    0,
  );
}

function sourceMeta(draft?: AcceptanceInspectionReport | null, pendingReceipt?: DeliveryReceipt | null) {
  const po = draft?.purchase_order ?? pendingReceipt?.purchase_order;
  const pr = po?.purchase_request;
  const draftItems = pendingReceipt?.draft_items;
  const lineTotal = draftItemsTotal(pendingReceipt);
  return {
    supplier: po?.supplier?.name ?? draftItems?.supplier_name ?? '',
    poNumber: draft?.po_number ?? po?.po_number ?? pendingReceipt?.po_number ?? '',
    poDate: draft?.po_date?.slice(0, 10)
      ?? (po as { created_at?: string } | undefined)?.created_at?.slice(0, 10)
      ?? pendingReceipt?.delivery_date?.slice(0, 10)
      ?? '',
    requisitioningOffice: draft?.requisitioning_office ?? pr?.department?.name ?? '',
    abcAmount: Number(
      draft?.abc_amount
      ?? draftItems?.abc_amount
      ?? pr?.total_estimated_cost
      ?? po?.total_amount
      ?? 0,
    ),
    amount: Number(
      draft?.amount
      ?? draftItems?.amount
      ?? lineTotal
      ?? po?.total_amount
      ?? 0,
    ),
    invoiceNumber: draft?.invoice_number ?? pendingReceipt?.supplier_reference_number ?? '',
    invoiceDate: draft?.invoice_date?.slice(0, 10) ?? pendingReceipt?.delivery_date?.slice(0, 10) ?? '',
    airNumber: draft?.air_number ?? '(Auto-generated)',
  };
}

function formatMoney(value: number) {
  return formatPesoAmount(value);
}

function lineTotal(item: AcceptanceInspectionItem) {
  return Number(item.quantity_accepted ?? 0) * Number(item.unit_cost ?? 0);
}

function calcAmount(items: AcceptanceInspectionItem[]) {
  return items.reduce((sum, item) => sum + lineTotal(item), 0);
}

type AirGovernmentFormProps = {
  draft?: AcceptanceInspectionReport | null;
  pendingReceipt?: DeliveryReceipt | null;
  onClose: () => void;
  onSuccess: () => void;
};

export default function AirGovernmentForm({ draft, pendingReceipt, onClose, onSuccess }: AirGovernmentFormProps) {
  const meta = sourceMeta(draft, pendingReceipt);
  const initialItems = useMemo(() => {
    if (draft?.items?.length) {
      return padItems(draft.items.filter((item) => !isSummaryImportRow(item)));
    }
    if (pendingReceipt) return padItems(itemsFromDeliveryReceipt(pendingReceipt));
    return padItems([]);
  }, [draft, pendingReceipt]);

  const [airNumber] = useState(meta.airNumber);
  const [supplier, setSupplier] = useState(meta.supplier);
  const [poNumber, setPoNumber] = useState(meta.poNumber);
  const [poDate, setPoDate] = useState(meta.poDate);
  const [invoiceNumber, setInvoiceNumber] = useState(meta.invoiceNumber);
  const [invoiceDate, setInvoiceDate] = useState(meta.invoiceDate);
  const [requisitioningOffice, setRequisitioningOffice] = useState(meta.requisitioningOffice);
  const [obligationRequestNo, setObligationRequestNo] = useState(draft?.obligation_request_no ?? '');
  const [items, setItems] = useState(initialItems);
  const [remarksForUseOf, setRemarksForUseOf] = useState(draft?.remarks_for_use_of ?? '');
  const [remarks, setRemarks] = useState(draft?.remarks ?? '');
  const [abcAmount, setAbcAmount] = useState(meta.abcAmount);
  const [amount, setAmount] = useState(meta.amount);
  const [abcDisplay, setAbcDisplay] = useState(() => formatPesoAmount(meta.abcAmount));
  const [amountDisplay, setAmountDisplay] = useState(() => formatPesoAmount(meta.amount));
  const [acceptanceDate, setAcceptanceDate] = useState(draft?.acceptance_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [inspectionDate, setInspectionDate] = useState(
    draft?.inspection_date?.slice(0, 10) ?? pendingReceipt?.delivery_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
  );
  const [acceptanceComplete, setAcceptanceComplete] = useState(draft?.acceptance_complete ?? true);
  const [acceptancePartial, setAcceptancePartial] = useState(draft?.acceptance_partial ?? false);
  const [acceptanceSpecAccepted, setAcceptanceSpecAccepted] = useState(draft?.acceptance_spec_accepted ?? true);
  const [inspectionCorrect, setInspectionCorrect] = useState(draft?.inspection_correct ?? true);
  const [propertyOfficer, setPropertyOfficer] = useState(draft?.supply_officer_name ?? draft?.accepted_by_name ?? '');
  const [inspectionOfficer, setInspectionOfficer] = useState(draft?.inspector_name ?? pendingReceipt?.inspector_name ?? '');

  const lineItemsTotal = useMemo(() => calcAmount(items.filter((i) => i.description?.trim())), [items]);

  const updateItem = (index: number, field: keyof AcceptanceInspectionItem, value: string) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const buildPayload = (saveAsDraft: boolean) => {
    const lineItems = items
      .filter((item) => item.description?.trim())
      .map((item) => ({
        ...item,
        quantity_accepted: Number(item.quantity_accepted ?? 0),
        quantity_ordered: Number(item.quantity_ordered ?? item.quantity_accepted ?? 0),
        quantity_delivered: Number(item.quantity_delivered ?? item.quantity_accepted ?? 0),
        unit_cost: Number(item.unit_cost ?? 0),
      }));

    let inspectionResult = 'accepted';
    if (acceptancePartial) inspectionResult = 'accepted_with_reservation';

    return {
      delivery_receipt_id: draft?.delivery_receipt_id ?? pendingReceipt?.id,
      purchase_order_id: draft?.purchase_order_id ?? pendingReceipt?.purchase_order_id ?? null,
      po_number: poNumber.trim() || null,
      po_date: poDate || null,
      invoice_number: invoiceNumber || null,
      invoice_date: invoiceDate || null,
      requisitioning_office: requisitioningOffice || null,
      obligation_request_no: obligationRequestNo || null,
      inspection_date: inspectionDate,
      acceptance_date: acceptanceDate,
      inspector_name: inspectionOfficer,
      inspector_position: 'Inspection Officer',
      accepted_by_name: propertyOfficer,
      accepted_by_position: 'Property Officer',
      supply_officer_name: propertyOfficer,
      supply_officer_position: 'Property Officer',
      inspection_result: inspectionResult,
      findings: inspectionCorrect ? 'Inspected and found correct as to quantity and specification.' : '',
      remarks,
      abc_amount: abcAmount,
      amount,
      remarks_for_use_of: remarksForUseOf,
      acceptance_complete: acceptanceComplete,
      acceptance_partial: acceptancePartial,
      acceptance_spec_accepted: acceptanceSpecAccepted,
      inspection_correct: inspectionCorrect,
      items: lineItems,
      save_as_draft: saveAsDraft,
    };
  };

  const handlePrint = () => {
    openAirPrintPreview({
      air_number: airNumber,
      supplier,
      po_number: poNumber,
      po_date: poDate,
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      requisitioning_office: requisitioningOffice,
      obligation_request_no: obligationRequestNo,
      remarks_for_use_of: remarksForUseOf,
      remarks,
      abc_amount: abcAmount,
      amount,
      acceptance_date: acceptanceDate,
      inspection_date: inspectionDate,
      acceptance_complete: acceptanceComplete,
      acceptance_partial: acceptancePartial,
      acceptance_spec_accepted: acceptanceSpecAccepted,
      inspection_correct: inspectionCorrect,
      property_officer: propertyOfficer,
      inspection_officer: inspectionOfficer,
      items: items.filter((item) => item.description?.trim()),
    });
  };

  const save = useMutation({
    mutationFn: (saveAsDraft: boolean) => {
      const payload = buildPayload(saveAsDraft);
      if (draft?.id) {
        return saveAsDraft
          ? api.put(`/acceptance-inspection-reports/${draft.id}`, payload)
          : api.post(`/acceptance-inspection-reports/${draft.id}/finalize`, payload);
      }
      return api.post('/acceptance-inspection-reports', payload);
    },
    onSuccess: (_, saveAsDraft) => {
      toast.success(saveAsDraft ? 'AIR draft saved' : 'AIR finalized');
      onSuccess();
      onClose();
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e.response?.data?.message ?? 'Failed to save AIR');
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/50">
      <div className="safe-top flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-3 sm:gap-3 sm:px-4">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-bold text-slate-900 sm:text-lg">
            {draft ? 'Edit AIR Draft' : 'Acceptance & Inspection Report'}
          </h2>
          <p className="truncate text-xs text-slate-500">Provincial Government of Palawan — GSO Form</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="btn-secondary inline-flex items-center gap-1.5 px-2.5 py-2 text-sm sm:px-4"
            title="Print preview"
          >
            <Printer size={16} />
            <span>Print</span>
          </button>
          <button
            type="button"
            onClick={() => save.mutate(true)}
            disabled={save.isPending}
            className="btn-secondary hidden items-center gap-1.5 px-2.5 py-2 text-sm sm:inline-flex sm:px-4"
          >
            Save Draft
          </button>
          <button type="button" onClick={() => save.mutate(false)} disabled={save.isPending} className="btn-primary px-2.5 py-2 text-sm sm:px-4">
            {save.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Finalize'}
          </button>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-200/80 p-3 sm:p-6">
        <div className="air-form-document mx-auto max-w-4xl">
          <div className="air-form-letterhead">
            <div className="air-form-seal-wrap">
              <img
                src={LOGO_PATH}
                alt={`${BRANDING.province} seal`}
                className="air-form-seal"
              />
            </div>
            <div className="air-form-letterhead-text">
              <p>{BRANDING.republic}</p>
              <p className="font-bold">{BRANDING.lguName}</p>
              <p className="font-bold text-palawan-800">{BRANDING.gsoOfficeTitle}</p>
              <p>{BRANDING.capitalCity}</p>
            </div>
            <div className="air-form-seal-wrap">
              <img
                src={PGSO_LOGO_PATH}
                alt={BRANDING.officeName}
                className="air-form-seal"
              />
            </div>
          </div>

          <h1 className="air-form-title">ACCEPTANCE &amp; INSPECTION REPORT</h1>

          <div className="air-form-meta">
            <label className="air-form-field air-form-field-wide">
              <span>Supplier</span>
              <input value={supplier} onChange={(e) => setSupplier(e.target.value)} />
            </label>
            <label className="air-form-field">
              <span>AIR No.</span>
              <input value={airNumber} readOnly className="bg-slate-50" />
            </label>
          </div>

          <div className="air-form-meta">
            <label className="air-form-field">
              <span>P.O. No.</span>
              <input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} />
            </label>
            <label className="air-form-field air-form-field-date">
              <span>Date</span>
              <input type="date" value={poDate} onChange={(e) => setPoDate(e.target.value)} />
            </label>
            <label className="air-form-field">
              <span>Invoice No.</span>
              <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
            </label>
            <label className="air-form-field air-form-field-date">
              <span>Date</span>
              <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
            </label>
          </div>

          <div className="air-form-meta">
            <label className="air-form-field air-form-field-wide">
              <span>Requisitioning Office/Department</span>
              <input value={requisitioningOffice} onChange={(e) => setRequisitioningOffice(e.target.value)} />
            </label>
            <label className="air-form-field air-form-field-wide">
              <span>Obligation Request No.</span>
              <input value={obligationRequestNo} onChange={(e) => setObligationRequestNo(e.target.value)} />
            </label>
          </div>

          <div className="air-form-meta">
            <label className="air-form-field">
              <span>ABC</span>
              <input
                type="text"
                inputMode="decimal"
                className="air-form-currency-input"
                value={abcDisplay}
                onFocus={() => setAbcDisplay(String(abcAmount || ''))}
                onBlur={(e) => {
                  const parsed = parsePesoAmount(e.target.value);
                  setAbcAmount(parsed);
                  setAbcDisplay(formatPesoAmount(parsed));
                }}
                onChange={(e) => setAbcDisplay(e.target.value)}
              />
            </label>
            <label className="air-form-field">
              <span>Amount</span>
              <input
                type="text"
                inputMode="decimal"
                className="air-form-currency-input"
                value={amountDisplay}
                onFocus={() => setAmountDisplay(String(amount || ''))}
                onBlur={(e) => {
                  const parsed = parsePesoAmount(e.target.value);
                  setAmount(parsed);
                  setAmountDisplay(formatPesoAmount(parsed));
                }}
                onChange={(e) => setAmountDisplay(e.target.value)}
              />
            </label>
            {lineItemsTotal > 0 && Math.abs(lineItemsTotal - amount) > 0.01 && (
              <p className="col-span-full text-xs text-slate-500">
                Line items total: {formatMoney(lineItemsTotal)}
              </p>
            )}
          </div>

          <div className="air-form-items-wrap">
          <p className="air-form-items-count">
            {items.filter((item) => item.description?.trim()).length} line item
            {items.filter((item) => item.description?.trim()).length === 1 ? '' : 's'}
          </p>
          <table className="air-form-items">
            <thead>
              <tr>
                <th>Item No.</th>
                <th>Unit</th>
                <th>Description</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total Price</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index}>
                  <td className="center">{index + 1}</td>
                  <td>
                    <input
                      value={item.unit_of_measure ?? ''}
                      onChange={(e) => updateItem(index, 'unit_of_measure', e.target.value)}
                      className="air-form-cell-input"
                    />
                  </td>
                  <td>
                    <input
                      value={item.description ?? ''}
                      onChange={(e) => updateItem(index, 'description', e.target.value)}
                      className="air-form-cell-input"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={item.quantity_accepted ?? ''}
                      onChange={(e) => updateItem(index, 'quantity_accepted', e.target.value)}
                      className="air-form-cell-input center"
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.unit_cost ?? ''}
                      onChange={(e) => updateItem(index, 'unit_cost', e.target.value)}
                      className="air-form-cell-input right"
                    />
                  </td>
                  <td className="right tabular-nums text-slate-700">
                    {item.description?.trim() ? formatMoney(lineTotal(item)) : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          <div className="air-form-remarks">
            <span className="font-bold">REMARKS:</span>
            <span>For the use of</span>
            <input
              value={remarksForUseOf}
              onChange={(e) => setRemarksForUseOf(e.target.value)}
              className="air-form-inline-input flex-1"
              placeholder="Office / purpose"
            />
          </div>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={2}
            className="air-form-textarea"
            placeholder="Additional remarks"
          />

          <div className="air-form-footer">
            <div className="air-form-footer-col">
              <p className="air-form-footer-title">ACCEPTANCE</p>
              <label className="air-form-field air-form-field-date">
                <span>Date Received</span>
                <input type="date" value={acceptanceDate} onChange={(e) => setAcceptanceDate(e.target.value)} />
              </label>
              <div className="air-form-checks">
                <label>
                  <input type="checkbox" checked={acceptanceComplete} onChange={(e) => setAcceptanceComplete(e.target.checked)} />
                  Complete
                </label>
                <label>
                  <input type="checkbox" checked={acceptancePartial} onChange={(e) => setAcceptancePartial(e.target.checked)} />
                  Partial
                </label>
                <label>
                  <input type="checkbox" checked={acceptanceSpecAccepted} onChange={(e) => setAcceptanceSpecAccepted(e.target.checked)} />
                  Specification Accepted
                </label>
              </div>
              <div className="air-form-signature">
                <input
                  value={propertyOfficer}
                  onChange={(e) => setPropertyOfficer(e.target.value)}
                  className="air-form-sig-input"
                  placeholder="Name"
                />
                <div className="air-form-sig-line" />
                <p className="font-bold">Property Officer</p>
              </div>
            </div>

            <div className="air-form-footer-col">
              <p className="air-form-footer-title">INSPECTION</p>
              <label className="air-form-field air-form-field-date">
                <span>Date Inspected</span>
                <input type="date" value={inspectionDate} onChange={(e) => setInspectionDate(e.target.value)} />
              </label>
              <div className="air-form-checks">
                <label>
                  <input type="checkbox" checked={inspectionCorrect} onChange={(e) => setInspectionCorrect(e.target.checked)} />
                  Inspected and found correct as to quantity and specification
                </label>
              </div>
              <div className="air-form-signature">
                <input
                  value={inspectionOfficer}
                  onChange={(e) => setInspectionOfficer(e.target.value)}
                  className="air-form-sig-input"
                  placeholder="Name"
                />
                <div className="air-form-sig-line" />
                <p className="font-bold">Inspection Officer</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="safe-bottom flex shrink-0 gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:hidden">
        <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
        <button type="button" onClick={handlePrint} className="btn-secondary flex-1">
          <Printer size={16} /> Print
        </button>
        <button type="button" onClick={() => save.mutate(true)} disabled={save.isPending} className="btn-secondary flex-1">Draft</button>
        <button type="button" onClick={() => save.mutate(false)} disabled={save.isPending} className="btn-primary flex-1">Finalize</button>
      </div>
    </div>
  );
}
