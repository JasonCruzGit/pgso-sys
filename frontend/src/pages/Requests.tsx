import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShoppingBag, Eye, X } from 'lucide-react';
import api from '../api/client';
import DataTable from '../components/DataTable';
import Pagination from '../components/Pagination';
import PageHeader from '../components/PageHeader';
import Badge from '../components/Badge';
import type { IssuanceRequest } from '../types';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

function requestHasNonConsumableItems(request: IssuanceRequest): boolean {
  return (request.items ?? []).some((line) => line.inventory_item?.is_consumable === false);
}

function requestHasOnlyConsumableItems(request: IssuanceRequest): boolean {
  const items = request.items ?? [];
  return items.length > 0 && items.every((line) => line.inventory_item?.is_consumable !== false);
}

export default function Requests() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [viewRequest, setViewRequest] = useState<IssuanceRequest | null>(null);
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['issuance', page, status],
    queryFn: () => api.get('/issuance', { params: { page, status: status || undefined } }).then((r) => r.data),
  });

  const { data: detailRequest, isLoading: detailLoading } = useQuery({
    queryKey: ['issuance', viewRequest?.id],
    queryFn: () => api.get(`/issuance/${viewRequest!.id}`).then((r) => r.data as IssuanceRequest),
    enabled: !!viewRequest,
  });

  const displayRequest = detailRequest ?? viewRequest;

  const approve = useMutation({
    mutationFn: (id: number) => api.post(`/issuance/${id}/approve`),
    onSuccess: () => { toast.success('Request approved'); queryClient.invalidateQueries({ queryKey: ['issuance'] }); },
  });

  const release = useMutation({
    mutationFn: (id: number) => api.post(`/issuance/${id}/release`),
    onSuccess: () => { toast.success('Property items issued with MR'); queryClient.invalidateQueries({ queryKey: ['issuance'] }); },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e.response?.data?.message ?? 'Release failed'),
  });

  const issueSupplies = useMutation({
    mutationFn: (id: number) => api.post(`/issuance/${id}/issue`),
    onSuccess: () => {
      toast.success('Consumable supplies issued');
      queryClient.invalidateQueries({ queryKey: ['issuance'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e.response?.data?.message ?? 'Issue failed'),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={hasPermission('issuance.*') || hasPermission('requests.release') ? 'Employee Requests' : 'My Requests'}
        description={
          hasPermission('issuance.*') || hasPermission('requests.release')
            ? 'Review, approve, and track material requisition requests'
            : 'Track your submitted supply issuance requests'
        }
        action={
          hasPermission('requests.create') ? (
            <button type="button" onClick={() => navigate('/catalog')} className="btn-primary inline-flex items-center gap-2">
              <ShoppingBag size={18} /> Browse Items
            </button>
          ) : undefined
        }
      />

      <div className="card p-4">
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="input-field max-w-xs"
        >
          <option value="">All Statuses</option>
          <option value="requested">Requested</option>
          <option value="approved">Approved</option>
          <option value="released">Released</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <DataTable<IssuanceRequest>
        loading={isLoading}
        data={data?.data ?? []}
        emptyTitle="No requests found"
        emptyDescription="Department requests will appear here."
        columns={[
          { key: 'request_number', label: 'Request No.', render: (r) => <span className="font-mono text-xs font-semibold text-palawan-700">{r.request_number}</span> },
          { key: 'mr_number', label: 'MR No.', render: (r) => r.mr_number ? <span className="font-mono text-xs font-semibold text-emerald-700">{r.mr_number}</span> : '—' },
          { key: 'department', label: 'Department', render: (r) => r.department?.name ?? '—' },
          { key: 'requester', label: 'Requested By', render: (r) => r.requester?.name ?? '—' },
          { key: 'purpose', label: 'Purpose', render: (r) => <span className="max-w-xs truncate block">{r.purpose}</span> },
          { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
          { key: 'date_requested', label: 'Date', render: (r) => new Date(r.date_requested).toLocaleDateString() },
          {
            key: 'actions',
            label: 'Actions',
            render: (r) => (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setViewRequest(r)}
                  className="inline-flex items-center gap-1 rounded-lg bg-palawan-50 px-2.5 py-1 text-xs font-semibold text-palawan-700 hover:bg-palawan-100"
                >
                  <Eye size={14} /> View
                </button>
                {r.status === 'requested' && hasPermission('requests.approve') && (
                  <button onClick={() => approve.mutate(r.id)} className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700">Approve</button>
                )}
                {r.status === 'approved' && hasPermission('requests.release') && requestHasNonConsumableItems(r) && (
                  <button onClick={() => release.mutate(r.id)} className="rounded-lg bg-palawan-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-palawan-700">Issue MR</button>
                )}
                {r.status === 'approved' && hasPermission('requests.release') && requestHasOnlyConsumableItems(r) && (
                  <button
                    type="button"
                    onClick={() => issueSupplies.mutate(r.id)}
                    disabled={issueSupplies.isPending}
                    className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    Issue Supplies
                  </button>
                )}
              </div>
            ),
          },
        ]}
      />
      <Pagination currentPage={data?.current_page ?? 1} lastPage={data?.last_page ?? 1} onPageChange={setPage} />

      {viewRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setViewRequest(null)}>
          <div className="card-elevated flex max-h-[90vh] w-full max-w-2xl flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Request Details</p>
                <p className="mt-1 font-mono text-sm font-semibold text-palawan-700">{displayRequest?.request_number}</p>
                {displayRequest?.mr_number && (
                  <p className="font-mono text-xs text-emerald-700">MR: {displayRequest.mr_number}</p>
                )}
              </div>
              <button type="button" onClick={() => setViewRequest(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge status={displayRequest?.status ?? ''} />
                <span className="text-sm text-slate-500">
                  {displayRequest?.date_requested ? new Date(displayRequest.date_requested).toLocaleDateString() : ''}
                </span>
              </div>

              <dl className="mb-5 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-400">Department</dt>
                  <dd className="font-medium text-slate-900">{displayRequest?.department?.name ?? '—'}</dd>
                </div>
                <div>
                  <dt className="text-slate-400">Requested By</dt>
                  <dd className="font-medium text-slate-900">{displayRequest?.requester?.name ?? '—'}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-slate-400">Purpose</dt>
                  <dd className="text-slate-700">{displayRequest?.purpose}</dd>
                </div>
                {displayRequest?.notes && (
                  <div className="sm:col-span-2">
                    <dt className="text-slate-400">Notes</dt>
                    <dd className="text-slate-700">{displayRequest.notes}</dd>
                  </div>
                )}
              </dl>

              <h3 className="mb-3 text-sm font-semibold text-slate-900">Requested Items</h3>
              {detailLoading && !displayRequest?.items?.length ? (
                <div className="space-y-2">
                  <div className="skeleton h-10 w-full rounded-lg" />
                  <div className="skeleton h-10 w-full rounded-lg" />
                </div>
              ) : (displayRequest?.items?.length ?? 0) > 0 ? (
                <div className="overflow-hidden rounded-xl border border-slate-100">
                  <table className="table-zebra w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-2.5">Code</th>
                        <th className="px-4 py-2.5">Item</th>
                        <th className="px-4 py-2.5 text-right">Requested</th>
                        {(displayRequest?.status === 'released' || displayRequest?.items?.some((i) => i.quantity_issued > 0)) && (
                          <th className="px-4 py-2.5 text-right">Issued</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {displayRequest?.items?.map((line) => (
                        <tr key={line.id}>
                          <td className="px-4 py-3 font-mono text-xs font-semibold text-palawan-700">
                            {line.inventory_item?.item_code ?? '—'}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {line.inventory_item?.name ?? '—'}
                            {line.inventory_item?.unit_of_measure && (
                              <span className="ml-1 text-xs font-normal text-slate-500">
                                ({line.inventory_item.unit_of_measure})
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {line.quantity_requested}
                          </td>
                          {(displayRequest?.status === 'released' || displayRequest?.items?.some((i) => i.quantity_issued > 0)) && (
                            <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                              {line.quantity_issued}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">No items on this request.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
