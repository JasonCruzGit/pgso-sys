import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, FileSearch } from 'lucide-react';
import api from '../api/client';
import PageHeader from '../components/PageHeader';
import Badge from '../components/Badge';
import type { ReceivedItem } from '../types';

type OrderedItem = {
  id: number;
  source: 'purchase_order';
  description?: string | null;
  unit_of_measure?: string | null;
  quantity_ordered?: number | string;
  quantity_received?: number | string;
  unit_cost?: number | string;
  total_cost?: number;
  item_code?: string | null;
  property_number?: string | null;
};

type PoLookupResponse = {
  query: string;
  matched_po_number?: string | null;
  purchase_order?: {
    id: number;
    po_number: string;
    status?: string;
    total_amount?: number | string;
    issued_date?: string | null;
    expected_delivery_date?: string | null;
    supplier?: { id: number; name: string } | null;
    department?: string | null;
  } | null;
  ordered_items: OrderedItem[];
  received_items: ReceivedItem[];
};

function formatMoney(value?: number | string) {
  const amount = Number(value ?? 0);
  return `₱${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatQty(value?: number | string) {
  const n = Number(value ?? 0);
  if (Number.isNaN(n)) return '0';
  return n % 1 === 0 ? String(n) : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function PoItems() {
  const [po, setPo] = useState('');
  const [submitted, setSubmitted] = useState('');

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['po-items', submitted],
    queryFn: () => api.get('/po-items', { params: { po_number: submitted } }).then((r) => r.data as PoLookupResponse),
    enabled: submitted.trim().length > 0,
  });

  const orderedItems = data?.ordered_items ?? [];
  const receivedItems = data?.received_items ?? [];
  const hasResults = Boolean(data?.purchase_order) || orderedItems.length > 0 || receivedItems.length > 0;
  const displayPo = data?.matched_po_number || submitted;

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="PO Items"
        description="Enter a purchase order number to view all items under that PO"
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
            <label htmlFor="po-items-search" className="mb-1.5 block text-sm font-medium text-slate-700">
              PO Number
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                id="po-items-search"
                value={po}
                onChange={(e) => setPo(e.target.value)}
                placeholder="e.g. PO-2026-0001"
                className="input-field w-full !pl-11 font-mono"
                autoComplete="off"
              />
            </div>
          </div>
          <button type="submit" className="btn-primary sm:!px-6" disabled={!po.trim() || isFetching}>
            <FileSearch size={18} />
            {isFetching ? 'Searching…' : 'Search'}
          </button>
        </form>
      </div>

      {submitted && (
        <div className="card p-4">
          <p className="text-sm text-slate-600">
            Results for <span className="font-mono font-semibold text-palawan-700">{displayPo}</span>
            {data?.purchase_order?.supplier?.name ? (
              <span className="text-slate-500"> · {data.purchase_order.supplier.name}</span>
            ) : null}
          </p>
          {data?.purchase_order && (
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
              <p>
                Status: <Badge status={data.purchase_order.status ?? 'issued'} />
              </p>
              {data.purchase_order.department && <p>Office: {data.purchase_order.department}</p>}
              {data.purchase_order.total_amount != null && (
                <p>PO Total: <span className="font-semibold text-slate-900">{formatMoney(data.purchase_order.total_amount)}</span></p>
              )}
              {data.purchase_order.issued_date && (
                <p>Issued: {new Date(data.purchase_order.issued_date).toLocaleDateString('en-PH')}</p>
              )}
            </div>
          )}
        </div>
      )}

      {(isLoading || isFetching) && submitted && (
        <div className="card p-8 text-center text-sm text-slate-500">Searching…</div>
      )}

      {isError && (
        <div className="card p-8 text-center text-sm text-red-600">Failed to load PO items.</div>
      )}

      {!isLoading && !isFetching && !isError && submitted && !hasResults && (
        <div className="card p-8 text-center text-sm text-slate-500">
          No items found for that PO number.
        </div>
      )}

      {!isFetching && !isError && receivedItems.length > 0 && (
        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Accepted / Registry Items ({receivedItems.length})
            </h2>
            <p className="mt-1 text-xs text-slate-500">Items accepted through AIR and stored in Item Registry</p>
          </div>
          <div className="overflow-x-auto">
            <table className="table-zebra min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">AIR No.</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3 text-right">Accepted</th>
                  <th className="px-4 py-3 text-right">On Hand</th>
                  <th className="px-4 py-3 text-right">Unit Cost</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {receivedItems.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{row.description}</p>
                      <p className="text-xs text-slate-500">Line {row.line_number}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-palawan-700">{row.air_number}</td>
                    <td className="px-4 py-3 uppercase text-slate-600">{row.unit_of_measure}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{formatQty(row.quantity_accepted)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">{formatQty(row.quantity_on_hand)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{formatMoney(row.unit_cost)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">{formatMoney(row.total_cost)}</td>
                    <td className="px-4 py-3"><Badge status={row.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!isFetching && !isError && orderedItems.length > 0 && (
        <div className="card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              PO Line Items ({orderedItems.length})
            </h2>
            <p className="mt-1 text-xs text-slate-500">Items listed on the purchase order</p>
          </div>
          <div className="overflow-x-auto">
            <table className="table-zebra min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3 text-right">Ordered</th>
                  <th className="px-4 py-3 text-right">Received</th>
                  <th className="px-4 py-3 text-right">Unit Cost</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {orderedItems.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{row.description || '—'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {row.property_number || row.item_code || '—'}
                    </td>
                    <td className="px-4 py-3 uppercase text-slate-600">{row.unit_of_measure || '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{formatQty(row.quantity_ordered)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{formatQty(row.quantity_received)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{formatMoney(row.unit_cost)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-medium text-slate-900">{formatMoney(row.total_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
