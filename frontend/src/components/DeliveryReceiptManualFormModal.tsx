import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { X, Loader2, Plus, Trash2, ClipboardPen } from 'lucide-react';
import api from '../api/client';
import type { DeliveryReceipt } from '../types';
import type { DeliveryReceiptImportPayload } from '../utils/deliveryReceiptImport';
import toast from 'react-hot-toast';

type ManualLineItem = {
  description: string;
  unit_of_measure: string;
  quantity_received: string;
  unit_cost: string;
};

type Props = {
  onClose: () => void;
  onCreated: (receipt: DeliveryReceipt) => void;
};

function emptyLine(): ManualLineItem {
  return {
    description: '',
    unit_of_measure: '',
    quantity_received: '',
    unit_cost: '',
  };
}

export default function DeliveryReceiptManualFormModal({ onClose, onCreated }: Props) {
  const [poNumber, setPoNumber] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().slice(0, 10));
  const [supplierReference, setSupplierReference] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('GSO Main Warehouse');
  const [inspectorName, setInspectorName] = useState('');
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<ManualLineItem[]>([emptyLine(), emptyLine(), emptyLine()]);

  const lineTotal = useMemo(
    () => lineItems.reduce((sum, item) => {
      const qty = Number(item.quantity_received);
      const cost = Number(item.unit_cost);
      if (!Number.isFinite(qty) || !Number.isFinite(cost)) return sum;
      return sum + qty * cost;
    }, 0),
    [lineItems],
  );

  const createDr = useMutation({
    mutationFn: (payload: DeliveryReceiptImportPayload) =>
      api.post('/delivery-receipts/import', payload).then((r) => r.data as DeliveryReceipt),
    onSuccess: (receipt) => {
      toast.success(`Delivery receipt ${receipt.dr_number} created`);
      onCreated(receipt);
      onClose();
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e.response?.data?.message ?? 'Failed to create delivery receipt');
    },
  });

  const updateLine = (index: number, field: keyof ManualLineItem, value: string) => {
    setLineItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const addLine = () => setLineItems((prev) => [...prev, emptyLine()]);

  const removeLine = (index: number) => {
    setLineItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const handleSubmit = () => {
    if (!poNumber.trim()) {
      toast.error('PO reference is required');
      return;
    }

    const items = lineItems
      .filter((item) => item.description.trim() && Number(item.quantity_received) > 0)
      .map((item) => ({
        description: item.description.trim(),
        unit_of_measure: item.unit_of_measure.trim() || 'unit',
        quantity_received: Number(item.quantity_received),
        quantity_ordered: Number(item.quantity_received),
        unit_cost: Number(item.unit_cost) || 0,
      }));

    if (!items.length) {
      toast.error('Add at least one line item with description and quantity');
      return;
    }

    createDr.mutate({
      po_number: poNumber.trim(),
      supplier_name: supplierName.trim() || undefined,
      delivery_date: deliveryDate,
      supplier_reference_number: supplierReference.trim() || undefined,
      delivery_location: deliveryLocation.trim() || undefined,
      inspector_name: inspectorName.trim() || undefined,
      notes: notes.trim() || 'Manually entered for AIR',
      items,
    });
  };

  const filledCount = lineItems.filter((item) => item.description.trim()).length;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="safe-bottom flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <ClipboardPen size={20} className="text-palawan-700" />
              Manual Delivery Receipt
            </h2>
            <p className="text-sm text-slate-500">For deliveries that were not recorded through procurement</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">PO Reference *</label>
              <input
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                placeholder="PO number on the document"
                className="input-field"
              />
              <p className="mt-1 text-xs text-slate-500">Does not need to exist as a PO in the system.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Supplier</label>
              <input
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Supplier name"
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Delivery Date *</label>
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Invoice / Supplier Ref.</label>
              <input
                value={supplierReference}
                onChange={(e) => setSupplierReference(e.target.value)}
                placeholder="Invoice or delivery slip number"
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Delivery Location</label>
              <input
                value={deliveryLocation}
                onChange={(e) => setDeliveryLocation(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Inspector</label>
              <input
                value={inspectorName}
                onChange={(e) => setInspectorName(e.target.value)}
                placeholder="Inspecting officer"
                className="input-field"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Optional remarks about this delivery"
                className="input-field resize-none"
              />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-800">Line Items</p>
                <p className="text-xs text-slate-500">{filledCount} item{filledCount === 1 ? '' : 's'} entered</p>
              </div>
              <button type="button" onClick={addLine} className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs">
                <Plus size={14} /> Add row
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="table-zebra min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Description</th>
                    <th className="w-24 px-3 py-2">Unit</th>
                    <th className="w-24 px-3 py-2">Qty</th>
                    <th className="w-28 px-3 py-2">Unit Price</th>
                    <th className="w-10 px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item, index) => (
                    <tr key={index}>
                      <td className="px-3 py-2">
                        <input
                          value={item.description}
                          onChange={(e) => updateLine(index, 'description', e.target.value)}
                          placeholder="Item description"
                          className="input-field !py-1.5 text-sm"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={item.unit_of_measure}
                          onChange={(e) => updateLine(index, 'unit_of_measure', e.target.value)}
                          placeholder="unit"
                          className="input-field !py-1.5 text-sm"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={item.quantity_received}
                          onChange={(e) => updateLine(index, 'quantity_received', e.target.value)}
                          className="input-field !py-1.5 text-sm"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.unit_cost}
                          onChange={(e) => updateLine(index, 'unit_cost', e.target.value)}
                          className="input-field !py-1.5 text-sm"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <button
                          type="button"
                          onClick={() => removeLine(index)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          title="Remove row"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {lineTotal > 0 && (
              <p className="mt-2 text-right text-sm font-semibold text-slate-700">
                Estimated total: ₱{lineTotal.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-2 border-t border-slate-100 px-5 py-4">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={createDr.isPending}
            className="btn-primary flex-1"
          >
            {createDr.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Save & Open AIR'}
          </button>
        </div>
      </div>
    </div>
  );
}
