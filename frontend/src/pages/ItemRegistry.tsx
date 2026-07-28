import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Eye, X, Archive, Package, ChevronRight, FileText, KeyRound } from 'lucide-react';
import api from '../api/client';
import DataTable from '../components/DataTable';
import Pagination from '../components/Pagination';
import PageHeader from '../components/PageHeader';
import Badge from '../components/Badge';
import type { ReceivedItem } from '../types';

type PoGroup = {
  id: string;
  po_number: string;
  item_name: string;
  other_names: string[];
  unique_names: number;
  item_count: number;
  total_on_hand: number;
  total_value: number;
  latest_acceptance_date?: string | null;
};

type AccountabilityMark = 'ics' | 'par';

function formatMoney(value?: number | string) {
  const amount = Number(value ?? 0);
  return `₱${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatQty(value?: number | string) {
  const n = Number(value ?? 0);
  if (Number.isNaN(n)) return '0';
  return n % 1 === 0 ? String(n) : n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function canMarkItem(item: ReceivedItem) {
  return item.status === 'available' && Number(item.quantity_on_hand) > 0;
}

export default function ItemRegistry() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<PoGroup | null>(null);
  const [viewItem, setViewItem] = useState<ReceivedItem | null>(null);
  const [marks, setMarks] = useState<Record<number, AccountabilityMark>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['received-items-groups', page, search, statusFilter],
    queryFn: () => api.get('/received-items/groups', {
      params: {
        page,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      },
    }).then((r) => r.data as {
      data: Omit<PoGroup, 'id'>[];
      current_page: number;
      last_page: number;
      total: number;
    }),
  });

  const groups = useMemo(
    () => (data?.data ?? []).map((g) => ({ ...g, id: g.po_number })),
    [data],
  );

  const { data: groupItems = [], isLoading: groupItemsLoading, isError: groupItemsError, error: groupItemsErr } = useQuery({
    queryKey: ['received-items-by-po', selectedGroup?.po_number, statusFilter],
    queryFn: async () => {
      const po = selectedGroup!.po_number;
      const { data: payload } = await api.get('/received-items/by-po', {
        params: {
          po_number: po,
          per_page: 1000,
          ...(statusFilter ? { status: statusFilter } : {}),
        },
      });
      const rows = Array.isArray(payload) ? payload : (payload?.data ?? []);
      return rows as ReceivedItem[];
    },
    enabled: !!selectedGroup?.po_number,
  });

  const { data: summary } = useQuery({
    queryKey: ['received-items-summary'],
    queryFn: () => api.get('/received-items/summary').then((r) => r.data as {
      total_items: number;
      total_on_hand: number;
      total_value: number;
      air_count: number;
    }),
  });

  const icsCount = useMemo(() => Object.values(marks).filter((m) => m === 'ics').length, [marks]);
  const parCount = useMemo(() => Object.values(marks).filter((m) => m === 'par').length, [marks]);

  const openGroup = (group: PoGroup) => {
    setSelectedGroup(group);
    setMarks({});
  };

  const setItemMark = (item: ReceivedItem, type: AccountabilityMark, checked: boolean) => {
    if (!canMarkItem(item)) return;
    setMarks((prev) => {
      const next = { ...prev };
      if (!checked) {
        if (next[item.id] === type) delete next[item.id];
        return next;
      }
      next[item.id] = type;
      return next;
    });
  };

  const continueMarked = (type: AccountabilityMark) => {
    const first = groupItems.find((item) => marks[item.id] === type && canMarkItem(item));
    if (!first) return;
    navigate(`/procurement/${type}?received_item_id=${first.id}&new=1`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Item Registry"
        description="Browse by item name and PO. Open a PO and mark products as ICS or PAR."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-palawan-50 p-2.5 text-palawan-700">
              <Archive size={20} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Line Items</p>
              <p className="text-2xl font-bold text-slate-900">{summary?.total_items?.toLocaleString() ?? '—'}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-sky-50 p-2.5 text-sky-700">
              <Package size={20} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Qty On Hand</p>
              <p className="text-2xl font-bold text-slate-900">{summary ? formatQty(summary.total_on_hand) : '—'}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total Value</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{summary ? formatMoney(summary.total_value) : '—'}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">AIR Documents</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{summary?.air_count?.toLocaleString() ?? '—'}</p>
        </div>
      </div>

      <div className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_11rem] sm:items-end">
        <div>
          <label htmlFor="registry-search" className="mb-1.5 block text-sm font-medium text-slate-700">Search</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              id="registry-search"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search description, AIR, DR, PO, supplier..."
              className="input-field w-full !pl-11"
            />
          </div>
        </div>
        <div>
          <label htmlFor="registry-status" className="mb-1.5 block text-sm font-medium text-slate-700">Status</label>
          <select
            id="registry-status"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="input-field w-full"
          >
            <option value="">All Status</option>
            <option value="available">Available</option>
            <option value="depleted">Depleted</option>
          </select>
        </div>
      </div>

      <DataTable<PoGroup>
        loading={isLoading}
        dense
        data={groups}
        emptyTitle="No received items yet"
        emptyDescription="Finalize an AIR from an uploaded Delivery Receipt to register accepted items here."
        onRowClick={(row) => openGroup(row)}
        columns={[
          {
            key: 'item_name',
            label: 'Item Name',
            mobilePrimary: true,
            wrap: true,
            className: 'min-w-[16rem] max-w-xl',
            render: (r) => (
              <div className="flex items-start gap-2">
                <ChevronRight size={16} className="mt-0.5 shrink-0 text-slate-400" />
                <div>
                  <p className="leading-snug font-medium text-slate-900">{r.item_name}</p>
                  {r.unique_names > 1 && (
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      +{r.unique_names - 1} more product{r.unique_names - 1 === 1 ? '' : 's'}
                      {r.other_names.length > 0 ? ` · ${r.other_names.join(', ')}` : ''}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-slate-500">
                    {r.item_count} line item{r.item_count === 1 ? '' : 's'}
                    {' · '}
                    On hand {formatQty(r.total_on_hand)}
                  </p>
                </div>
              </div>
            ),
          },
          {
            key: 'po_number',
            label: 'PO Number',
            render: (r) => (
              <span className="font-mono text-sm font-semibold text-palawan-700">
                {r.po_number === '(No PO)' ? '—' : r.po_number}
              </span>
            ),
          },
        ]}
      />

      <Pagination
        currentPage={data?.current_page ?? 1}
        lastPage={data?.last_page ?? 1}
        onPageChange={setPage}
      />

      {selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="safe-bottom flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:rounded-3xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-palawan-700">Products under PO</p>
                <h2 className="font-mono text-lg font-bold text-slate-900">
                  {selectedGroup.po_number === '(No PO)' ? 'No PO number' : selectedGroup.po_number}
                </h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  {groupItems.length} product{groupItems.length === 1 ? '' : 's'}
                  {' · '}
                  Mark each item as ICS or PAR
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setSelectedGroup(null); setMarks({}); }}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            {(icsCount > 0 || parCount > 0) && (
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-5 py-3">
                <span className="text-xs text-slate-500">
                  ICS: <strong className="text-emerald-700">{icsCount}</strong>
                  {' · '}
                  PAR: <strong className="text-sky-700">{parCount}</strong>
                </span>
                <div className="ml-auto flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={icsCount === 0}
                    onClick={() => continueMarked('ics')}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <FileText size={14} /> Continue ICS
                  </button>
                  <button
                    type="button"
                    disabled={parCount === 0}
                    onClick={() => continueMarked('par')}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 text-xs font-semibold text-sky-700 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <KeyRound size={14} /> Continue PAR
                  </button>
                </div>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto">
              {groupItemsLoading ? (
                <p className="px-5 py-8 text-center text-sm text-slate-500">Loading products…</p>
              ) : groupItemsError ? (
                <p className="px-5 py-8 text-center text-sm text-rose-600">
                  Failed to load products
                  {(groupItemsErr as { response?: { data?: { message?: string } } })?.response?.data?.message
                    ? `: ${(groupItemsErr as { response?: { data?: { message?: string } } }).response?.data?.message}`
                    : '.'}
                </p>
              ) : groupItems.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-slate-500">No products found for this PO.</p>
              ) : (
                <table className="table-zebra w-full text-left text-sm">
                  <thead className="sticky top-0 bg-white text-[11px] uppercase tracking-wide text-slate-500 shadow-sm">
                    <tr className="border-b border-slate-100">
                      <th className="w-16 px-3 py-2.5 text-center font-semibold text-emerald-700">ICS</th>
                      <th className="w-16 px-3 py-2.5 text-center font-semibold text-sky-700">PAR</th>
                      <th className="px-4 py-2.5 font-semibold">Product</th>
                      <th className="px-3 py-2.5 font-semibold">Unit</th>
                      <th className="px-3 py-2.5 text-right font-semibold">On Hand</th>
                      <th className="hidden px-3 py-2.5 text-right font-semibold sm:table-cell">Unit Cost</th>
                      <th className="px-3 py-2.5 font-semibold">Status</th>
                      <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupItems.map((item) => {
                      const markable = canMarkItem(item);
                      const mark = marks[item.id];
                      return (
                        <tr key={item.id}>
                          <td className="px-3 py-3 text-center">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                              title={markable ? 'Mark as ICS' : 'Only available items with stock can be marked'}
                              disabled={!markable}
                              checked={mark === 'ics'}
                              onChange={(e) => setItemMark(item, 'ics', e.target.checked)}
                            />
                          </td>
                          <td className="px-3 py-3 text-center">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-40"
                              title={markable ? 'Mark as PAR' : 'Only available items with stock can be marked'}
                              disabled={!markable}
                              checked={mark === 'par'}
                              onChange={(e) => setItemMark(item, 'par', e.target.checked)}
                            />
                          </td>
                          <td className="max-w-md px-4 py-3">
                            <p className="font-medium leading-snug text-slate-900">{item.description}</p>
                            <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                              {item.air_number} · Line {item.line_number}
                            </p>
                          </td>
                          <td className="px-3 py-3">
                            <span className="inline-flex rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold uppercase text-slate-600">
                              {item.unit_of_measure || '—'}
                            </span>
                          </td>
                          <td className={`px-3 py-3 text-right tabular-nums font-semibold ${Number(item.quantity_on_hand) <= 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                            {formatQty(item.quantity_on_hand)}
                          </td>
                          <td className="hidden px-3 py-3 text-right tabular-nums text-slate-600 sm:table-cell">
                            {formatMoney(item.unit_cost)}
                          </td>
                          <td className="px-3 py-3"><Badge status={item.status} /></td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => setViewItem(item)}
                              className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                            >
                              <Eye size={12} /> View
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {viewItem && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="safe-bottom flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Received Item</h2>
                <p className="text-sm text-slate-500">{viewItem.description}</p>
              </div>
              <button type="button" onClick={() => setViewItem(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3 overflow-y-auto px-5 py-4 text-sm">
              {[
                ['AIR No.', viewItem.air_number],
                ['DR No.', viewItem.dr_number ?? '—'],
                ['PO No.', viewItem.po_number ?? '—'],
                ['Line No.', String(viewItem.line_number)],
                ['Unit', viewItem.unit_of_measure],
                ['Qty Ordered', formatQty(viewItem.quantity_ordered)],
                ['Qty Delivered', formatQty(viewItem.quantity_delivered)],
                ['Qty Accepted', formatQty(viewItem.quantity_accepted)],
                ['On Hand', formatQty(viewItem.quantity_on_hand)],
                ['Unit Cost', formatMoney(viewItem.unit_cost)],
                ['Total Cost', formatMoney(viewItem.total_cost)],
                ['Supplier', viewItem.supplier_name ?? '—'],
                ['Office', viewItem.requisitioning_office ?? '—'],
                ['Location', viewItem.storage_location ?? '—'],
                ['Acceptance Date', viewItem.acceptance_date ? new Date(viewItem.acceptance_date).toLocaleDateString('en-PH') : '—'],
                ['Remarks', viewItem.remarks ?? '—'],
              ].map(([label, value]) => (
                <div key={label} className="grid grid-cols-[8.5rem_1fr] gap-2 border-b border-slate-50 pb-2">
                  <span className="font-medium text-slate-500">{label}</span>
                  <span className="text-slate-800">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
