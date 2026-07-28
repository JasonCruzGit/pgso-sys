import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, CheckSquare,
  ClipboardPen, Download, FileStack, Plus, Trash2, Upload, X,
} from 'lucide-react';
import api from '../../api/client';
import DocumentTaskFormModal, { type DocumentTaskFormValues } from '../../components/DocumentTaskFormModal';
import { useAuth } from '../../context/AuthContext';
import type { Department, TrackedDocument, TrackedDocumentAttachment, TrackedDocumentTask } from '../../types';
import toast from 'react-hot-toast';

function localDatetimeValue(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function emptyTaskForm(overrides: Partial<DocumentTaskFormValues> = {}): DocumentTaskFormValues {
  return {
    direction: 'incoming',
    is_confidential: false,
    reference_no: '',
    document_type: '',
    department_id: '',
    title: '',
    event_at: localDatetimeValue(),
    ...overrides,
  };
}

function formatDateTime(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatFileSize(bytes?: number) {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function relativeTime(iso?: string | null) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  // Clock skew / future timestamps: fall back to absolute time
  if (diffMs < 0) return formatDateTime(iso);
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  return formatDateTime(iso);
}

function modeLabel(direction: string) {
  return direction.charAt(0).toUpperCase() + direction.slice(1);
}

function statusTone(status: string) {
  if (status === 'completed') return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  if (status === 'pending') return 'bg-amber-50 text-amber-700 ring-amber-100';
  if (status === 'archived') return 'bg-slate-100 text-slate-600 ring-slate-200';
  return 'bg-sky-50 text-sky-700 ring-sky-100';
}

function MetaCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</p>
      <div className="mt-1.5 text-sm font-medium text-slate-900">{children}</div>
    </div>
  );
}

export default function DocumentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission, user } = useAuth();
  const canManage = ['documents.*', 'documents.incoming', 'documents.outgoing', 'documents.routing', 'documents.records']
    .some((p) => hasPermission(p));

  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showInstructionForm, setShowInstructionForm] = useState(false);
  const [taskForm, setTaskForm] = useState<DocumentTaskFormValues>(emptyTaskForm);
  const [instructionForm, setInstructionForm] = useState({ instruction_for: '', instruction_task: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: doc, isLoading, isError } = useQuery({
    queryKey: ['tracked-document', id],
    queryFn: () => api.get(`/documents/${id}`).then((r) => r.data as TrackedDocument),
    enabled: Boolean(id),
  });

  const { data: departments } = useQuery({
    queryKey: ['departments-list'],
    queryFn: () => api.get('/departments', { params: { per_page: 200 } }).then((r) => {
      const raw = r.data;
      return (Array.isArray(raw) ? raw : raw.data ?? []) as Department[];
    }),
    enabled: showTaskForm,
  });

  const { data: recentDocs } = useQuery({
    queryKey: ['tracked-documents', 'control-suggest'],
    queryFn: () => api.get('/documents', { params: { per_page: 30 } }).then((r) => r.data.data as TrackedDocument[]),
    enabled: showTaskForm,
  });

  const controlSuggestions = useMemo(
    () => [...new Set((recentDocs ?? []).map((d) => d.reference_no).filter(Boolean))],
    [recentDocs],
  );

  const openTaskForm = () => {
    setTaskForm(emptyTaskForm({
      direction: doc?.direction === 'outgoing' ? 'outgoing' : 'incoming',
      is_confidential: Boolean(doc?.is_confidential),
      reference_no: doc?.reference_no ?? '',
      document_type: doc?.document_type ?? '',
      department_id: doc?.department_id ? String(doc.department_id) : '',
    }));
    setShowTaskForm(true);
  };

  const complete = useMutation({
    mutationFn: () => api.put(`/documents/${id}`, { status: 'completed' }),
    onSuccess: () => {
      toast.success('Document marked complete');
      queryClient.invalidateQueries({ queryKey: ['tracked-document', id] });
      queryClient.invalidateQueries({ queryKey: ['tracked-documents'] });
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e.response?.data?.message ?? 'Failed to mark complete');
    },
  });

  const createTask = useMutation({
    mutationFn: () => {
      const office = (departments ?? []).find((d) => String(d.id) === taskForm.department_id);
      const assigned = office ? `${office.code} — ${office.name}` : null;
      const eventIso = taskForm.event_at ? new Date(taskForm.event_at).toISOString() : undefined;
      return api.post(`/documents/${id}/tasks`, {
        assigned_to: assigned,
        body: taskForm.title,
        received_by: null,
        received_at: eventIso ?? null,
        direction: taskForm.direction,
        is_confidential: taskForm.is_confidential,
        reference_no: taskForm.reference_no || null,
        document_type: taskForm.document_type || null,
        department_id: taskForm.department_id ? Number(taskForm.department_id) : null,
      });
    },
    onSuccess: () => {
      toast.success('Task added');
      setShowTaskForm(false);
      queryClient.invalidateQueries({ queryKey: ['tracked-document', id] });
      queryClient.invalidateQueries({ queryKey: ['tracked-documents'] });
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e.response?.data?.message ?? 'Failed to add task');
    },
  });

  const updateInstruction = useMutation({
    mutationFn: () => api.put(`/documents/${id}`, {
      instruction_for: instructionForm.instruction_for || null,
      instruction_task: instructionForm.instruction_task || null,
    }),
    onSuccess: () => {
      toast.success('Instruction updated');
      setShowInstructionForm(false);
      queryClient.invalidateQueries({ queryKey: ['tracked-document', id] });
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e.response?.data?.message ?? 'Failed to update instruction');
    },
  });

  const uploadFile = useMutation({
    mutationFn: (files: File[]) => {
      const formData = new FormData();
      files.forEach((file) => formData.append('files[]', file));
      return api.post(`/documents/${id}/attachments`, formData);
    },
    onSuccess: (_res, files) => {
      toast.success(files.length === 1 ? 'File uploaded' : `${files.length} files uploaded`);
      queryClient.invalidateQueries({ queryKey: ['tracked-document', id] });
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    onError: (e: { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }) => {
      const first = e.response?.data?.errors ? Object.values(e.response.data.errors)[0]?.[0] : null;
      toast.error(first ?? e.response?.data?.message ?? 'Upload failed');
    },
  });

  const deleteAttachment = useMutation({
    mutationFn: (attachmentId: number) => api.delete(`/documents/${id}/attachments/${attachmentId}`),
    onSuccess: () => {
      toast.success('Attachment removed');
      queryClient.invalidateQueries({ queryKey: ['tracked-document', id] });
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e.response?.data?.message ?? 'Failed to remove file');
    },
  });

  const downloadAttachment = async (attachment: TrackedDocumentAttachment) => {
    try {
      const res = await api.get(`/documents/${id}/attachments/${attachment.id}/download`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.file_name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed');
    }
  };

  const tasks: TrackedDocumentTask[] = useMemo(() => doc?.tasks ?? [], [doc?.tasks]);
  const attachments: TrackedDocumentAttachment[] = useMemo(() => doc?.attachments ?? [], [doc?.attachments]);

  const MAX_FILE_BYTES = 3 * 1024 * 1024;

  const triggerUpload = () => fileInputRef.current?.click();
  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;

    const tooLarge = selected.filter((file) => file.size > MAX_FILE_BYTES);
    if (tooLarge.length > 0) {
      toast.error(
        tooLarge.length === 1
          ? `“${tooLarge[0].name}” exceeds the 3MB limit`
          : `${tooLarge.length} files exceed the 3MB limit each`,
      );
      e.target.value = '';
      return;
    }

    uploadFile.mutate(selected);
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-4 w-48 rounded bg-slate-200" />
        <div className="h-40 rounded-2xl bg-slate-200" />
        <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
          <div className="h-80 rounded-2xl bg-slate-200" />
          <div className="h-80 rounded-2xl bg-slate-200" />
        </div>
      </div>
    );
  }

  if (isError || !doc) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center">
        <p className="text-sm text-slate-600">Document not found or you do not have access.</p>
        <Link to="/documents" className="btn-secondary mt-4 inline-flex items-center gap-2">
          <ArrowLeft size={16} /> Back to Document Tracking
        </Link>
      </div>
    );
  }

  const eventDate = doc.received_at || doc.released_at || doc.created_at;
  const particulars = doc.description || doc.title;

  const openInstructionEdit = () => {
    setInstructionForm({
      instruction_for: doc.instruction_for ?? '',
      instruction_task: doc.instruction_task ?? '',
    });
    setShowInstructionForm(true);
  };

  return (
    <div className="doc-detail space-y-5">
      <style>{`
        .doc-detail { animation: docFade 0.35s ease-out; }
        .doc-detail-panel { animation: docRise 0.45s ease-out both; }
        .doc-detail-panel:nth-child(2) { animation-delay: 0.06s; }
        .doc-detail-aside { animation: docRise 0.5s ease-out 0.1s both; }
        @keyframes docFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes docRise {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex items-center gap-2 text-sm text-slate-500">
          <Link
            to="/documents"
            className="inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          >
            <ArrowLeft size={15} />
            Document Tracking
          </Link>
          <span className="text-slate-300">/</span>
          <span className="font-semibold text-slate-800">Particulars</span>
        </nav>
        <p className="font-mono text-xs font-semibold tracking-wide text-palawan-700">{doc.reference_no}</p>
      </div>

      {/* Hero */}
      <section className="doc-detail-panel relative overflow-hidden rounded-2xl bg-palawan-800 text-white shadow-[0_12px_40px_-18px_rgba(6,78,59,0.55)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'radial-gradient(ellipse 80% 60% at 100% -10%, rgba(52,211,153,0.45), transparent 55%), radial-gradient(ellipse 60% 50% at -5% 110%, rgba(16,185,129,0.35), transparent 50%), linear-gradient(135deg, #065f46 0%, #047857 48%, #059669 100%)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.65) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.65) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        <div className="relative px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-white/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-white backdrop-blur-sm">
                  {modeLabel(doc.direction)}
                </span>
                <span className={`rounded-md px-2.5 py-1 text-[11px] font-bold capitalize shadow-sm ${statusTone(doc.status)}`}>
                  {doc.status.replace(/_/g, ' ')}
                </span>
                <span className="rounded-md bg-black/20 px-2.5 py-1 text-[11px] font-semibold capitalize text-emerald-50 ring-1 ring-white/20">
                  {doc.document_type?.replace(/_/g, ' ') || 'Document'}
                </span>
              </div>

              <h1 className="mt-3.5 max-w-3xl text-[1.35rem] font-bold leading-snug tracking-tight text-white sm:text-[1.65rem]">
                {particulars}
              </h1>

              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <div className="inline-flex items-center gap-2 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium text-white ring-1 ring-white/25 backdrop-blur-sm">
                  <CalendarDays size={15} className="text-emerald-100" />
                  <span>{formatDateTime(eventDate)}</span>
                </div>
                <div className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-palawan-800 shadow-sm">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-palawan-500">Control No</span>
                  <span className="font-mono tracking-wide">{doc.reference_no}</span>
                </div>
                {doc.document_no && (
                  <div className="inline-flex items-center gap-2 rounded-lg bg-black/20 px-3 py-1.5 text-sm text-emerald-50 ring-1 ring-white/15">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-100/80">Doc No</span>
                    <span className="font-mono">{doc.document_no}</span>
                  </div>
                )}
              </div>
            </div>

            {canManage && doc.status !== 'completed' && (
              <button
                type="button"
                className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-palawan-800 shadow-md transition hover:-translate-y-0.5 hover:bg-emerald-50 hover:shadow-lg active:translate-y-0"
                disabled={complete.isPending}
                onClick={() => complete.mutate()}
              >
                <CheckSquare size={16} className="text-palawan-600" />
                {complete.isPending ? 'Saving…' : 'Mark Complete'}
              </button>
            )}
            {doc.status === 'completed' && (
              <div className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-emerald-400/20 px-4 py-2.5 text-sm font-bold text-white ring-1 ring-emerald-200/40">
                <CheckCircle2 size={16} /> Completed
              </div>
            )}
          </div>

          <div className="relative mt-6">
            <div className="absolute left-[12%] right-[12%] top-1/2 hidden h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent sm:block" />
            <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
              <div className="rounded-xl bg-white/12 px-4 py-3.5 ring-1 ring-white/20 backdrop-blur-sm transition hover:bg-white/16">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-100">Origin</p>
                <p className="mt-1.5 truncate text-[15px] font-semibold leading-snug text-white">
                  {doc.sender_name || '—'}
                </p>
              </div>
              <div className="flex items-center justify-center">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-palawan-700 shadow-md">
                  <ArrowRight size={16} strokeWidth={2.5} />
                </span>
              </div>
              <div className="rounded-xl bg-white/12 px-4 py-3.5 ring-1 ring-white/20 backdrop-blur-sm transition hover:bg-white/16">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-100">Destination</p>
                <p className="mt-1.5 truncate text-[15px] font-semibold leading-snug text-white">
                  {doc.recipient_name || '—'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="space-y-5">
          {/* Particulars grid */}
          <section className="doc-detail-panel rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgb(0_0_0_/_0.04)] sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <h2 className="text-base font-bold text-slate-900">Document Particulars</h2>
              <span className="font-mono text-xs font-semibold text-slate-400">{doc.reference_no}</span>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <MetaCell label="Control No">
                <span className="font-mono text-palawan-700">{doc.reference_no}</span>
              </MetaCell>
              <MetaCell label="Mode">{modeLabel(doc.direction)}</MetaCell>
              <MetaCell label="Type">
                <span className="capitalize">{doc.document_type?.replace(/_/g, ' ') || '—'}</span>
              </MetaCell>
              <MetaCell label="Origin">{doc.sender_name || '—'}</MetaCell>
              <MetaCell label="Destination">{doc.recipient_name || '—'}</MetaCell>
              <MetaCell label="Document No">{doc.document_no || '—'}</MetaCell>
              <MetaCell label="Date">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays size={14} className="text-slate-400" />
                  {formatDateTime(eventDate)}
                </span>
              </MetaCell>
              {doc.department?.name && (
                <MetaCell label="Office">{doc.department.name}</MetaCell>
              )}
              {doc.responsible?.name && (
                <MetaCell label="Handled by">{doc.responsible.name}</MetaCell>
              )}
            </div>

            <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Particulars</p>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-800">{particulars}</p>
            </div>
          </section>

          {/* Instruction */}
          <section className="doc-detail-panel overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgb(0_0_0_/_0.04)]">
            <div className="flex items-center gap-0 border-b border-slate-100">
              <div className="w-1.5 self-stretch bg-palawan-600" />
              <div className="flex flex-1 flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Instruction from GSO</h2>
                  <p className="mt-0.5 text-xs text-slate-500">General Services Officer routing note</p>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title="Add task"
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-palawan-50 hover:text-palawan-700"
                      onClick={openTaskForm}
                    >
                      <Plus size={17} />
                    </button>
                    <button
                      type="button"
                      title="Edit instruction"
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-palawan-50 hover:text-palawan-700"
                      onClick={openInstructionEdit}
                    >
                      <ClipboardPen size={17} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-4 px-5 py-5 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 px-4 py-3.5 ring-1 ring-slate-100">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">For</p>
                <p className="mt-1.5 text-sm font-semibold text-slate-900">{doc.instruction_for || '—'}</p>
              </div>
              <div className="rounded-xl bg-slate-50 px-4 py-3.5 ring-1 ring-slate-100 sm:col-span-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Task</p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-800">{doc.instruction_task || '—'}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
              <p className="text-xs text-slate-400">
                Multiple files · PDF, Word, Excel, images · 3MB each
              </p>
              {canManage && (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-xl bg-palawan-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-palawan-700 disabled:opacity-60"
                  disabled={uploadFile.isPending}
                  onClick={triggerUpload}
                >
                  <Upload size={15} />
                  {uploadFile.isPending ? 'Uploading…' : 'Upload New File'}
                </button>
              )}
            </div>
          </section>

          {/* Attachments */}
          <section className="doc-detail-panel rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_3px_rgb(0_0_0_/_0.04)] sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <h2 className="text-sm font-bold text-slate-900">Document(s)</h2>
                <p className="text-xs text-slate-400">
                  {attachments.length} file{attachments.length === 1 ? '' : 's'}
                </p>
              </div>
              {canManage && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-palawan-200 hover:bg-palawan-50/40 hover:text-palawan-800 disabled:opacity-60"
                  disabled={uploadFile.isPending}
                  onClick={triggerUpload}
                >
                  <Upload size={13} />
                  {uploadFile.isPending ? 'Uploading…' : 'Add file'}
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.gif,.webp,.txt"
              onChange={onFileSelected}
            />

            {attachments.length > 0 ? (
              <ul className="mt-2.5 divide-y divide-slate-100 rounded-lg border border-slate-200">
                {attachments.map((file) => (
                  <li
                    key={file.id}
                    className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-slate-50/80"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-palawan-50 text-palawan-700">
                      <FileStack size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-900">{file.file_name}</p>
                      <p className="truncate text-[10px] text-slate-400">
                        {formatFileSize(file.file_size)}
                        {file.uploader?.name ? ` · ${file.uploader.name}` : ''}
                        {file.created_at ? ` · ${formatDateTime(file.created_at)}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center">
                      <button
                        type="button"
                        className="rounded-md p-1.5 text-slate-400 transition hover:bg-white hover:text-palawan-700"
                        title="Download"
                        onClick={() => downloadAttachment(file)}
                      >
                        <Download size={14} />
                      </button>
                      {canManage && (
                        <button
                          type="button"
                          className="rounded-md p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                          title="Remove"
                          disabled={deleteAttachment.isPending}
                          onClick={() => {
                            if (window.confirm(`Remove “${file.file_name}”?`)) {
                              deleteAttachment.mutate(file.id);
                            }
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <button
                type="button"
                disabled={!canManage || uploadFile.isPending}
                onClick={canManage ? triggerUpload : undefined}
                className={`mt-2.5 flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-3 py-5 text-center transition ${
                  canManage ? 'hover:border-palawan-300 hover:bg-palawan-50/30' : ''
                }`}
              >
                <FileStack size={18} className="text-slate-400" />
                <p className="mt-1.5 text-xs font-medium text-slate-600">No files attached yet</p>
                <p className="mt-0.5 max-w-xs text-[10px] text-slate-400">
                  {canManage
                    ? 'Click to upload one or more files (3MB each).'
                    : 'Uploaded documents will appear here.'}
                </p>
              </button>
            )}
          </section>
        </div>

        {/* Tasks */}
        <aside className="doc-detail-aside overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_3px_rgb(0_0_0_/_0.04)] xl:sticky xl:top-4 xl:self-start">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3.5">
            <div>
              <h2 className="text-base font-bold text-slate-900">Task(s)</h2>
              <p className="text-xs text-slate-400">{tasks.length} entr{tasks.length === 1 ? 'y' : 'ies'}</p>
            </div>
            {canManage && (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl bg-palawan-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-palawan-700"
                onClick={openTaskForm}
              >
                <Plus size={14} /> New Task
              </button>
            )}
          </div>

          <div className="max-h-[min(70vh,36rem)] overflow-y-auto p-4">
            {tasks.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center">
                <p className="text-sm font-medium text-slate-500">No tasks yet</p>
                <p className="mt-1 text-xs text-slate-400">Create a task to start the routing trail.</p>
              </div>
            )}

            {tasks.length > 0 && (
              <ol className="relative ml-3 border-l-2 border-palawan-200 pl-6">
                {tasks.map((task, index) => {
                  const eventAt = task.created_at;
                  return (
                    <li key={task.id} className={`relative ${index < tasks.length - 1 ? 'pb-5' : 'pb-1'}`}>
                      <span className="absolute -left-[1.95rem] top-1 flex h-6 w-6 items-center justify-center rounded-full bg-palawan-600 text-[10px] font-bold text-white ring-4 ring-white">
                        {tasks.length - index}
                      </span>
                      <article className="rounded-xl border border-slate-100 bg-slate-50/80 px-3.5 py-3 transition hover:border-palawan-100 hover:bg-palawan-50/40">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                          <p className="text-xs font-semibold text-palawan-700">
                            {relativeTime(eventAt)}
                          </p>
                          {eventAt && (
                            <time
                              dateTime={eventAt}
                              className="text-[11px] tabular-nums text-slate-400"
                              title={formatDateTime(eventAt)}
                            >
                              {formatDateTime(eventAt)}
                            </time>
                          )}
                        </div>
                        {task.assigned_to && (
                          <p className="mt-1.5 text-xs font-semibold text-slate-500">
                            For <span className="text-slate-800">{task.assigned_to}</span>
                          </p>
                        )}
                        <p className="mt-1 text-sm leading-relaxed text-slate-800">{task.body}</p>
                        <div className="mt-2 space-y-0.5 text-[11px] leading-relaxed text-slate-500">
                          <p>
                            Created by{' '}
                            <span className="font-medium text-slate-700">
                              {task.creator?.name ?? user?.name ?? '—'}
                            </span>
                          </p>
                          {task.received_by && (
                            <p>
                              Received by{' '}
                              <span className="font-medium text-slate-700">{task.received_by}</span>
                              {task.received_at ? (
                                <>
                                  {' '}
                                  on{' '}
                                  <time dateTime={task.received_at} className="tabular-nums">
                                    {formatDateTime(task.received_at)}
                                  </time>
                                </>
                              ) : null}
                            </p>
                          )}
                        </div>
                      </article>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </aside>
      </div>

      <div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
          onClick={() => navigate('/documents')}
        >
          <ArrowLeft size={16} /> Back to list
        </button>
      </div>

      {showTaskForm && (
        <DocumentTaskFormModal
          values={taskForm}
          onChange={setTaskForm}
          departments={departments ?? []}
          controlSuggestions={controlSuggestions}
          submitting={createTask.isPending}
          onClose={() => setShowTaskForm(false)}
          onSubmit={() => {
            if (!taskForm.title.trim()) {
              toast.error('Particular is required');
              return;
            }
            createTask.mutate();
          }}
        />
      )}

      {showInstructionForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-3 backdrop-blur-[2px]" onClick={() => setShowInstructionForm(false)}>
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Edit Instruction</h3>
                <p className="text-xs text-slate-500">Update the GSO routing instruction</p>
              </div>
              <button type="button" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" onClick={() => setShowInstructionForm(false)}>
                <X size={18} />
              </button>
            </div>
            <form
              className="space-y-4 px-5 py-4"
              onSubmit={(e) => {
                e.preventDefault();
                updateInstruction.mutate();
              }}
            >
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">For</label>
                <input
                  className="input-field w-full"
                  value={instructionForm.instruction_for}
                  onChange={(e) => setInstructionForm({ ...instructionForm, instruction_for: e.target.value })}
                  placeholder="e.g. ENGR.ASA/EPB"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Task</label>
                <textarea
                  rows={3}
                  className="input-field w-full"
                  value={instructionForm.instruction_task}
                  onChange={(e) => setInstructionForm({ ...instructionForm, instruction_task: e.target.value })}
                  placeholder="Instruction details"
                />
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" className="btn-secondary" onClick={() => setShowInstructionForm(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={updateInstruction.isPending}>
                  {updateInstruction.isPending ? 'Saving…' : 'Save Instruction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
