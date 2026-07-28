import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import api from '../api/client';
import PageHeader from '../components/PageHeader';
import Badge from '../components/Badge';
import type { DeliveryReceipt } from '../types';

type TrackingItem = {
  inventory_item_id: number;
  item_code?: string;
  property_number?: string;
  name?: string;
  unit_of_measure?: string;
  unit_cost?: number;
  current_quantity?: number;
  qty_in: number;
  qty_out: number;
};

function formatMoney(value?: number) {
  const n = Number(value ?? 0);
  return `₱${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatQty(value?: number) {
  const n = Number(value ?? 0);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export default function Tracking() {
  const [po, setPo] = useState('');
  const [submitted, setSubmitted] = useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['tracking-po', submitted],
    queryFn: () => api.get('/tracking/po', { params: { po_number: submitted } }).then((r) => r.data as {
      query: string;
      delivery_receipts: DeliveryReceipt[];
      stock_receipts: Array<{
        id: number;
        receipt_number: string;
        purchase_order_number: string;
        delivery_receipt_number?: string;
        receiving_date: string;
        supplier?: { name?: string };
      }>;
      items: TrackingItem[];
    }),
    enabled: submitted.trim().length > 0,
  });

  const items = data?.items ?? [];
  const hasResults = (data?.delivery_receipts?.length ?? 0) > 0 || (data?.stock_receipts?.length ?? 0) > 0 || items.length > 0;

  const grouped = useMemo(() => {
    return items.map((i) => ({
      ...i,
      net: (Number(i.qty_in) || 0) - (Number(i.qty_out) || 0),
    }));
  }, [items]);

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="Tracking"
        description="Search and track received items using a PO number reference"
      />

      <div className="card p-4">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(po.trim());
          }}
        >
          <div className="flex-1">
            <label htmlFor="po-search" className="mb-1.5 block text-sm font-medium text-slate-700">PO Number</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                id="po-search"
                value={po}
                onChange={(e) => setPo(e.target.value)}
                placeholder="e.g. PO-20260612-SAMP"
                className="input-field w-full !pl-11 font-mono"
              />
            </div>
          </div>
          <button type="submit" className="btn-primary sm:!px-6">Search</button>
        </form>
      </div>

      {submitted && (
        <div className="card p-4">
          <p className="text-sm text-slate-600">
            Results for <span className="font-mono font-semibold text-palawan-700">{submitted}</span>
          </p>
        </div>
      )}

      {isLoading && submitted && (
        <div className="card p-8 text-center text-sm text-slate-500">Searching…</div>
      )}

      {isError && (
        <div className="card p-8 text-center text-sm text-red-600">Failed to load tracking results.</div>
      )}

      {!isLoading && submitted && !hasResults && (
        <div className="card p-8 text-center text-sm text-slate-500">
          No records found for that PO number.
        </div>
      )}

      {grouped.length > 0 && (
        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Items</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="table-zebra min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Code / Property</th>
                  <th className="px-4 py-3 text-right">Qty In</th>
                  <th className="px-4 py-3 text-right">Qty Out</th>
                  <th className="px-4 py-3 text-right">Net</th>
                  <th className="px-4 py-3 text-right">On Hand</th>
                  <th className="px-4 py-3 text-right">Unit Cost</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map((row) => (
                  <tr key={row.inventory_item_id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{row.name ?? '—'}</p>
                      <p className="text-xs text-slate-500">{(row.unit_of_measure ?? 'unit').toUpperCase()}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {row.property_number ?? row.item_code ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatQty(row.qty_in)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatQty(row.qty_out)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatQty(row.net)}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatQty(Number(row.current_quantity ?? 0))}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatMoney(row.unit_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(data?.delivery_receipts?.length ?? 0) > 0 && (
        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Delivery Receipts</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {(data?.delivery_receipts ?? []).map((dr) => (
              <div key={dr.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-mono text-sm font-semibold text-palawan-700">{dr.dr_number}</p>
                  <p className="text-xs text-slate-500">
                    Date: {new Date(dr.delivery_date).toLocaleDateString()}
                    {dr.supplier_reference_number ? ` · Supplier DR: ${dr.supplier_reference_number}` : ''}
                  </p>
                </div>
                <Badge status={dr.status ?? 'completed'} />
              </div>
            ))}
          </div>
        </div>
      )}

      {(data?.stock_receipts?.length ?? 0) > 0 && (
        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Stock Receipts</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {(data?.stock_receipts ?? []).map((rcv) => (
              <div key={rcv.id} className="px-5 py-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-mono text-sm font-semibold text-palawan-700">{rcv.receipt_number}</p>
                    <p className="text-xs text-slate-500">
                      Received: {new Date(rcv.receiving_date).toLocaleDateString()}
                      {rcv.delivery_receipt_number ? ` · DR: ${rcv.delivery_receipt_number}` : ''}
                    </p>
                  </div>
                  <p className="text-xs text-slate-500">{rcv.supplier?.name ?? '—'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

