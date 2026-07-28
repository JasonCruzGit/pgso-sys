import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown, Download, MoreVertical, Plus, Search,
} from 'lucide-react';
import api from '../../api/client';
import DocumentTaskFormModal, { type DocumentTaskFormValues } from '../../components/DocumentTaskFormModal';
import Pagination from '../../components/Pagination';
import { useAuth } from '../../context/AuthContext';
import type { Department, TrackedDocument } from '../../types';
import toast from 'react-hot-toast';

type TabKey = 'all' | 'incoming' | 'outgoing' | 'active' | 'completed' | 'request';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'incoming', label: 'Incoming' },
  { key: 'outgoing', label: 'Outgoing' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
];

const ADMIN_TABS: { key: TabKey; label: string }[] = [
  { key: 'request', label: 'Request' },
];

const FILE_TYPES = [
  { value: '', label: 'File Type' },
  { value: 'pdf', label: 'PDF' },
  { value: 'doc', label: 'DOC' },
  { value: 'xls', label: 'XLS' },
  { value: 'image', label: 'Image' },
  { value: 'other', label: 'Other' },
];

const emptyForm = (): DocumentTaskFormValues => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const local = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return {
    direction: 'incoming',
    is_confidential: false,
    reference_no: '',
    document_type: '',
    department_id: '',
    title: '',
    event_at: local,
  };
};

function statusPill(status: string) {
  const map: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700',
    completed: 'bg-violet-50 text-violet-700',
    pending: 'bg-amber-50 text-amber-700',
    archived: 'bg-slate-100 text-slate-600',
  };
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ${map[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function formatUploaded(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  const day = d.getDate();
  const suffix = day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th';
  return `Uploaded ${day}${suffix} ${d.toLocaleString('en-GB', { month: 'short' })}, ${d.getFullYear()}`;
}

export default function DocumentTracking() {
  const { hasPermission, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isDocAdmin = user?.role?.slug === 'document_tracking_admin';
  const canManage = ['documents.*', 'documents.incoming', 'documents.outgoing', 'documents.routing', 'documents.records']
    .some((p) => hasPermission(p));
  const canView = canManage || hasPermission('documents.view');

  const [tab, setTab] = useState<TabKey>(isDocAdmin ? 'request' : 'all');
  const [search, setSearch] = useState('');
  const [fileType, setFileType] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const [form, setForm] = useState<DocumentTaskFormValues>(emptyForm);

  const visibleTabs = useMemo(() => {
    if (isDocAdmin) return ADMIN_TABS;

    return TABS.filter((t) => {
      if (t.key === 'incoming' && !hasPermission('documents.*') && !hasPermission('documents.incoming') && !hasPermission('documents.records')) {
        if (hasPermission('documents.outgoing') && !hasPermission('documents.incoming')) return false;
      }
      if (t.key === 'outgoing' && !hasPermission('documents.*') && !hasPermission('documents.outgoing') && !hasPermission('documents.records')) {
        if (hasPermission('documents.incoming') && !hasPermission('documents.outgoing')) return false;
      }
      return true;
    });
  }, [hasPermission, isDocAdmin]);

  useEffect(() => {
    if (isDocAdmin && tab !== 'request') {
      setTab('request');
      setPage(1);
    }
  }, [isDocAdmin, tab]);

  const { data, isLoading } = useQuery({
    queryKey: ['tracked-documents', tab, search, fileType, page],
    queryFn: () => api.get('/documents', {
      params: {
        page,
        tab,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(fileType ? { file_type: fileType } : {}),
      },
    }).then((r) => r.data),
    enabled: canView,
  });

  const { data: departments } = useQuery({
    queryKey: ['departments-active'],
    queryFn: () => api.get('/departments', { params: { is_active: true, per_page: 100 } }).then((r) => (r.data.data ?? r.data) as Department[]),
    enabled: showForm,
  });

  const controlSuggestions = useMemo(
    () => [...new Set((data?.data as TrackedDocument[] | undefined)?.map((d) => d.reference_no).filter(Boolean) ?? [])],
    [data?.data],
  );

  const create = useMutation({
    mutationFn: () => {
      const dept = (departments ?? []).find((d) => String(d.id) === form.department_id);
      const officeName = dept ? `${dept.code} — ${dept.name}` : '';
      const eventIso = form.event_at ? new Date(form.event_at).toISOString() : undefined;
      const particular = form.title.trim();

      return api.post('/documents', {
        title: particular,
        description: particular,
        direction: form.direction,
        document_type: form.document_type.trim() || 'letter',
        is_confidential: form.is_confidential,
        reference_no: form.reference_no.trim() || undefined,
        department_id: form.department_id ? Number(form.department_id) : null,
        sender_name: form.direction === 'incoming' ? officeName || null : 'PGSO',
        recipient_name: form.direction === 'outgoing' ? officeName || null : 'PGSO',
        status: 'active',
        ...(form.direction === 'incoming' && eventIso ? { received_at: eventIso } : {}),
        ...(form.direction === 'outgoing' && eventIso ? { released_at: eventIso } : {}),
      });
    },
    onSuccess: (res) => {
      toast.success('Document logged');
      setShowForm(false);
      setForm(emptyForm());
      queryClient.invalidateQueries({ queryKey: ['tracked-documents'] });
      const id = res.data?.id;
      if (id) navigate(`/documents/${id}`);
    },
    onError: (e: { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }) => {
      const first = e.response?.data?.errors ? Object.values(e.response.data.errors)[0]?.[0] : null;
      toast.error(first ?? e.response?.data?.message ?? 'Failed to save document');
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => api.put(`/documents/${id}`, { status }),
    onSuccess: () => {
      toast.success('Status updated');
      setMenuOpenId(null);
      queryClient.invalidateQueries({ queryKey: ['tracked-documents'] });
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e.response?.data?.message ?? 'Update failed');
    },
  });

  const documents: TrackedDocument[] = data?.data ?? [];
  const total = data?.total ?? documents.length;

  if (!canView) {
    return (
      <div className="card p-8 text-center">
        <h2 className="text-lg font-semibold text-slate-900">Document Tracking</h2>
        <p className="mt-2 text-sm text-slate-500">You do not have permission to view tracked documents.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Document Tracking</h1>
          <p className="mt-1 text-sm text-slate-500">Incoming, outgoing, and routed office documents</p>
        </div>
        {canManage && (
          <button
            type="button"
            className="btn-primary inline-flex items-center gap-2 self-start"
            onClick={() => { setForm(emptyForm()); setShowForm(true); }}
          >
            <Plus size={18} /> New Task
          </button>
        )}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 scrollbar-none">
          {visibleTabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => { setTab(t.key); setPage(1); }}
              className={`relative shrink-0 px-4 pb-3 pt-1 text-sm font-semibold transition ${
                tab === t.key ? 'text-sky-600' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
              {tab === t.key && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-sky-500" />
              )}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-[14rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-700 shadow-sm outline-none placeholder:text-slate-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
              placeholder="Search documents..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <div className="relative">
            <select
              value={fileType}
              onChange={(e) => { setFileType(e.target.value); setPage(1); }}
              className="appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-4 pr-10 text-sm font-medium text-slate-700 shadow-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
            >
              {FILE_TYPES.map((ft) => (
                <option key={ft.value || 'all'} value={ft.value}>{ft.label}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          </div>
        </div>
      </div>

      <p className="text-sm text-slate-500">
        {total} document{total === 1 ? '' : 's'}
        {user?.document_task_division ? (
          <span className="text-slate-400"> · Division: {user.document_task_division.replace(/_/g, ' ')}</span>
        ) : null}
      </p>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgb(0_0_0_/_0.04)]">
        <div className="overflow-x-auto">
          <table className="table-zebra min-w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3.5 font-semibold">Document</th>
                <th className="px-5 py-3.5 font-semibold">Type</th>
                <th className="px-5 py-3.5 font-semibold">Document Particulars</th>
                <th className="px-5 py-3.5 font-semibold">Control No.</th>
                <th className="px-5 py-3.5 font-semibold">Status</th>
                <th className="px-5 py-3.5 font-semibold"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-400">Loading documents…</td>
                </tr>
              )}
              {!isLoading && documents.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-400">No documents found for this filter.</td>
                </tr>
              )}
              {!isLoading && documents.map((doc) => (
                <tr
                  key={doc.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/documents/${doc.id}`)}
                >
                  <td className="px-5 py-4">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{doc.title}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{formatUploaded(doc.created_at)}</p>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm capitalize text-slate-600">{doc.direction}</td>
                  <td className="px-5 py-4">
                    <div className="min-w-0 max-w-xs">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {doc.sender_name || doc.recipient_name
                          ? [doc.sender_name, doc.recipient_name].filter(Boolean).join(' → ')
                          : '—'}
                      </p>
                      <p className="mt-0.5 truncate text-xs capitalize text-slate-400">
                        {doc.document_type?.replace(/_/g, ' ') || '—'}
                        {doc.department?.name ? ` · ${doc.department.name}` : ''}
                      </p>
                    </div>
                  </td>
                  <td className="px-5 py-4 font-mono text-sm text-slate-600">{doc.reference_no}</td>
                  <td className="px-5 py-4">{statusPill(doc.status)}</td>
                  <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                    <div className="relative flex items-center justify-end gap-1">
                      <button
                        type="button"
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        title="Download"
                        onClick={() => toast('Open the document to download attachments.')}
                      >
                        <Download size={18} />
                      </button>
                      <button
                        type="button"
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        onClick={() => setMenuOpenId(menuOpenId === doc.id ? null : doc.id)}
                      >
                        <MoreVertical size={18} />
                      </button>
                      {menuOpenId === doc.id && (
                        <div className="absolute right-0 top-9 z-20 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                          {canManage && doc.status !== 'completed' && (
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                              onClick={() => updateStatus.mutate({ id: doc.id, status: 'completed' })}
                            >
                              Mark completed
                            </button>
                          )}
                          {canManage && doc.status !== 'active' && (
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                              onClick={() => updateStatus.mutate({ id: doc.id, status: 'active' })}
                            >
                              Mark active
                            </button>
                          )}
                          <button
                            type="button"
                            className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                            onClick={() => { setMenuOpenId(null); navigate(`/documents/${doc.id}`); }}
                          >
                            View details
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination currentPage={data?.current_page ?? 1} lastPage={data?.last_page ?? 1} onPageChange={setPage} />

      {showForm && (
        <DocumentTaskFormModal
          subtitle="Create a new tracked document entry"
          values={form}
          onChange={setForm}
          departments={departments ?? []}
          controlSuggestions={controlSuggestions}
          referencePlaceholder="Leave blank to auto-generate"
          submitting={create.isPending}
          onClose={() => setShowForm(false)}
          onSubmit={() => {
            if (!form.title.trim()) {
              toast.error('Particular is required');
              return;
            }
            create.mutate();
          }}
        />
      )}
    </div>
  );
}
