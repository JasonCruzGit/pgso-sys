import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { X, Upload, FileSpreadsheet, Loader2, Download } from 'lucide-react';
import api from '../api/client';
import type { DeliveryReceipt } from '../types';
import {
  downloadDeliveryReceiptTemplate,
  parseDeliveryReceiptWorkbook,
  type DeliveryReceiptImportPayload,
} from '../utils/deliveryReceiptImport';
import toast from 'react-hot-toast';

type Props = {
  onClose: () => void;
  onImported: (receipt: DeliveryReceipt) => void;
};

export default function DeliveryReceiptUploadModal({ onClose, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<DeliveryReceiptImportPayload | null>(null);
  const [fileName, setFileName] = useState('');
  const [poNumber, setPoNumber] = useState('');

  const importDr = useMutation({
    mutationFn: (payload: DeliveryReceiptImportPayload) =>
      api.post('/delivery-receipts/import', payload).then((r) => r.data as DeliveryReceipt),
    onSuccess: (receipt) => {
      toast.success(`Delivery receipt ${receipt.dr_number} imported`);
      onImported(receipt);
      onClose();
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e.response?.data?.message ?? 'Failed to import delivery receipt');
    },
  });

  const handleFile = async (file: File) => {
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      toast.error('Please upload an Excel file (.xlsx, .xls) or CSV');
      return;
    }
    try {
      const buffer = await file.arrayBuffer();
      const data = parseDeliveryReceiptWorkbook(buffer);
      setParsed(data);
      setFileName(file.name);
      setPoNumber(data.po_number ?? '');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not read spreadsheet');
      setParsed(null);
      setFileName('');
    }
  };

  const handleImport = () => {
    if (!parsed || !poNumber.trim()) return;
    importDr.mutate({
      ...parsed,
      po_number: poNumber.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="safe-bottom flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Upload Delivery Receipt</h2>
            <p className="text-sm text-slate-500">Import from Excel (.xlsx) — supports the simple template or government PO layout</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <button
            type="button"
            onClick={downloadDeliveryReceiptTemplate}
            className="inline-flex items-center gap-2 text-sm font-semibold text-palawan-700 hover:text-palawan-800"
          >
            <Download size={16} /> Download Excel template
          </button>

          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = '';
            }}
          />

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-palawan-200 bg-palawan-50/50 px-4 py-8 text-center transition hover:border-palawan-400 hover:bg-palawan-50"
          >
            <Upload size={28} className="text-palawan-600" />
            <span className="text-sm font-semibold text-slate-800">Choose Excel file</span>
            <span className="text-xs text-slate-500">.xlsx, .xls, or .csv</span>
          </button>

          {fileName && (
            <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <FileSpreadsheet size={16} className="shrink-0 text-palawan-600" />
              <span className="truncate">{fileName}</span>
            </div>
          )}

          {parsed && (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">PO Reference *</label>
                <input
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                  placeholder="PO number from spreadsheet"
                  className="input-field"
                />
                <p className="mt-1 text-xs text-slate-500">Used for AIR documentation. Does not need to exist as a PO record in the system.</p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm">
                <p><span className="font-medium text-slate-800">Delivery date:</span> {parsed.delivery_date}</p>
                {parsed.amount != null && parsed.amount > 0 && (
                  <p className="mt-1"><span className="font-medium text-slate-800">Amount:</span> ₱{parsed.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                )}
                {parsed.abc_amount != null && parsed.abc_amount > 0 && (
                  <p className="mt-1"><span className="font-medium text-slate-800">ABC:</span> ₱{parsed.abc_amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
                )}
                {parsed.supplier_reference_number && (
                  <p className="mt-1"><span className="font-medium text-slate-800">Supplier ref:</span> {parsed.supplier_reference_number}</p>
                )}
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {parsed.items.length} item{parsed.items.length === 1 ? '' : 's'} found
                </p>
                <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-slate-600">
                  {parsed.items.map((item, i) => (
                    <li key={i} className="truncate">
                      {item.description} — {item.quantity_received} {item.unit_of_measure}
                      {item.unit_cost > 0 ? ` @ ₱${item.unit_cost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-2 border-t border-slate-100 px-5 py-4">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            type="button"
            onClick={handleImport}
            disabled={!parsed || !poNumber.trim() || importDr.isPending}
            className="btn-primary flex-1"
          >
            {importDr.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Import & Open AIR'}
          </button>
        </div>
      </div>
    </div>
  );
}
