import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Inbox, Search, Eye } from 'lucide-react';
import api from '../api/client';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import Badge from '../components/Badge';
import { REQUEST_TYPES } from '../utils/gsoInventoryRequestPrint';

type IncomingRow = {
  id: number;
  control_number: string;
  status: string;
  requested_at?: string | null;
  employee_name?: string | null;
  office_name?: string | null;
  request_type?: string | null;
  purpose?: string | null;
  contact_no?: string | null;
  preparer?: { id: number; name: string } | null;
};

function requestTypeLabel(value?: string | null) {
  if (!value) return '—';
  const match = REQUEST_TYPES.find((t) => t.value === value);
  return match ? `${match.letter}. ${match.label}` : value;
}

function formatWhen(value?: string | null) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function IncomingInventoryRequests() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('finalized');

  const { data, isLoading } = useQuery({
    queryKey: ['gso-inventory-requests-incoming', page, search, statusFilter],
    queryFn: () => api.get('/gso-inventory-requests', {
      params: {
        page,
        per_page: 20,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      },
    }).then((r) => r.data as {
      data: IncomingRow[];
      current_page: number;
      last_page: number;
      total: number;
    }),
  });

  const rows = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incoming Items for New Inventory Request"
        description="Submitted GSO Control Slip requests ready for review and processing."
      />

      <div className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_11rem] sm:items-end">
        <div>
          <label htmlFor="incoming-nir-search" className="mb-1.5 block text-sm font-medium text-slate-700">Search</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              id="incoming-nir-search"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Control no., employee, office, purpose..."
              className="input-field w-full !pl-11"
            />
          </div>
        </div>
        <div>
          <label htmlFor="incoming-nir-status" className="mb-1.5 block text-sm font-medium text-slate-700">Status</label>
          <select
            id="incoming-nir-status"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="input-field w-full"
          >
            <option value="finalized">Finalized (Incoming)</option>
            <option value="draft">Draft</option>
            <option value="">All</option>
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">Loading incoming requests…</p>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-5 py-14 text-center">
            <Inbox className="text-slate-300" size={36} />
            <p className="font-semibold text-slate-800">No incoming requests</p>
            <p className="max-w-sm text-sm text-slate-500">
              Finalized New Inventory Request slips will appear here for processing.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-zebra w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5">Control No.</th>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Employee</th>
                  <th className="px-4 py-2.5">Office</th>
                  <th className="px-4 py-2.5">Request For</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold text-palawan-700">
                      {row.control_number}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-600">
                      {formatWhen(row.requested_at)}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-900">{row.employee_name || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-700">{row.office_name || '—'}</td>
                    <td className="max-w-xs px-4 py-2.5 text-slate-700">
                      <p className="leading-snug">{requestTypeLabel(row.request_type)}</p>
                      {row.purpose && (
                        <p className="mt-0.5 truncate text-[11px] text-slate-500">{row.purpose}</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5"><Badge status={row.status} /></td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => navigate(`/new-inventory-request?id=${row.id}`)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Eye size={14} /> Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Pagination
        currentPage={data?.current_page ?? 1}
        lastPage={data?.last_page ?? 1}
        onPageChange={setPage}
      />
    </div>
  );
}
