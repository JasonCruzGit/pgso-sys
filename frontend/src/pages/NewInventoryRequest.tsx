import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, FilePenLine, Plus, Printer, Save, Search, Trash2, Upload, X } from 'lucide-react';
import api from '../api/client';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import { useAuth } from '../context/AuthContext';
import { BRANDING, LOGO_PATH, PGSO_LOGO_PATH } from '../constants/branding';
import {
  openGsoInventoryRequestPrintPreview,
  REQUEST_TYPES,
  type GsoInventoryRequestForm,
} from '../utils/gsoInventoryRequestPrint';
import toast from 'react-hot-toast';

type RecordRow = GsoInventoryRequestForm & {
  id: number;
  control_number: string;
  status: string;
  processor_signature_path?: string | null;
};

function localDateTimeValue(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const EMPTY_FORM = (): GsoInventoryRequestForm => ({
  requested_at: localDateTimeValue(),
  employee_name: '',
  office_name: '',
  request_type: '',
  par_is_new: false,
  par_is_transfer: false,
  ics_is_new: false,
  ics_is_transfer: false,
  ics_to_name: '',
  ics_employee_signature: '',
  ics_office: '',
  ics_position: '',
  ics_id_no: '',
  horm_property_or_plate: '',
  others_specify: '',
  purpose: '',
  requester_signature: '',
  contact_no: '',
  pgso_instruction: '',
  remarks: '',
  processor_signature: '',
  approved_name: 'MERCY M. BONTAO',
  approved_position: 'Acting PGSO',
});

function toDateTimeLocal(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
  return localDateTimeValue(d);
}

function formatPreviewDateTime(value?: string) {
  if (!value) return '____________________';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function Field({
  label,
  children,
  className = '',
  required,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  required?: boolean;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-semibold text-slate-600">
        {label}{required ? <span className="text-rose-500"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function DocumentPreview({
  form,
  signaturePreviewUrl,
}: {
  form: GsoInventoryRequestForm;
  signaturePreviewUrl?: string | null;
}) {
  return (
    <div className="mx-auto max-w-[816px] bg-white px-6 py-8 text-slate-900 sm:px-10">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-white">
          <img src={LOGO_PATH} alt="" className="h-full w-full object-contain" />
        </div>
        <div className="min-w-0 flex-1 text-center text-[11px] leading-relaxed">
          <p className="uppercase tracking-wide">{BRANDING.republic}</p>
          <p className="mt-0.5 text-xs font-bold uppercase">{BRANDING.lguName}</p>
          <p className="mt-0.5 font-semibold uppercase text-palawan-700">Provincial General Services Office</p>
          <p className="mt-0.5">{BRANDING.capitalCity}</p>
        </div>
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-white">
          <img src={PGSO_LOGO_PATH} alt="" className="h-full w-full object-contain" />
        </div>
      </div>

      <h2 className="mb-3 text-center text-sm font-bold uppercase tracking-wide">
        New Inventory Request — GSO Control Slip
      </h2>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <p>
          <span className="font-semibold">GSO Control Slip No.:</span>{' '}
          <span className="font-mono font-semibold text-palawan-700">{form.control_number || '—'}</span>
        </p>
        <p><span className="font-semibold">Date & Time:</span> {formatPreviewDateTime(form.requested_at)}</p>
      </div>

      <div className="mb-2 rounded border border-slate-300 p-2.5 text-xs">
        <span className="font-semibold">I. Name of Employee:</span> {form.employee_name || '—'}
      </div>
      <div className="mb-2 rounded border border-slate-300 p-2.5 text-xs">
        <span className="font-semibold">II. Name of Office:</span> {form.office_name || '—'}
      </div>

      <div className="mb-2 rounded border border-slate-300 p-3">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">III. Request for</p>
        <div className="space-y-1.5 text-xs">
          {REQUEST_TYPES.map((t) => {
            const on = form.request_type === t.value;
            return (
              <div key={t.value}>
                <p>
                  <span className="mr-1">{on ? '☑' : '☐'}</span>
                  <strong>{t.letter}.</strong> {t.label}
                  {t.value === 'par' && on && (
                    <span className="ml-2 text-slate-600">
                      ({form.par_is_new ? 'New' : ''}{form.par_is_new && form.par_is_transfer ? ' / ' : ''}{form.par_is_transfer ? 'Transfer' : ''})
                    </span>
                  )}
                  {t.value === 'ics' && on && (
                    <span className="ml-2 text-slate-600">
                      ({form.ics_is_new ? 'New' : ''}{form.ics_is_new && form.ics_is_transfer ? ' / ' : ''}{form.ics_is_transfer ? 'Transfer' : ''})
                    </span>
                  )}
                  {t.value === 'horm' && on && form.horm_property_or_plate ? ` — ${form.horm_property_or_plate}` : ''}
                  {t.value === 'others' && on && form.others_specify ? ` — ${form.others_specify}` : ''}
                </p>
                {t.value === 'ics' && on && (
                  <div className="ml-5 mt-1 space-y-0.5 text-[11px] text-slate-600">
                    <p>To: {form.ics_to_name || '—'}</p>
                    <p>Employee: {form.ics_employee_signature || '—'}</p>
                    <p>Office: {form.ics_office || '—'} · Position: {form.ics_position || '—'} · ID: {form.ics_id_no || '—'}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mb-2 rounded border border-slate-300 p-3 text-xs">
        <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">IV. Purpose</p>
        <p className="min-h-[3rem] whitespace-pre-wrap">{form.purpose || '—'}</p>
        <p className="mt-3"><span className="font-semibold">Requester:</span> {form.requester_signature || '—'}</p>
        <p className="mt-1 text-rose-700"><span className="font-semibold">Contact No.:</span> {form.contact_no || '—'}</p>
      </div>

      <div className="mb-2 rounded border border-slate-300 p-3 text-xs">
        <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">V. PGSO Instruction</p>
        <p className="min-h-[3rem] whitespace-pre-wrap">{form.pgso_instruction || '—'}</p>
      </div>

      <div className="mb-2 py-3 text-center text-xs">
        <p className="font-bold uppercase">{form.approved_name || 'MERCY M. BONTAO'}</p>
        <p>{form.approved_position || 'Acting PGSO'}</p>
        <p>Provincial General Services Office</p>
      </div>

      <div className="rounded border border-slate-300 p-3 text-xs">
        <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">VI. Remarks</p>
        <p className="min-h-[3rem] whitespace-pre-wrap">{form.remarks || '—'}</p>
        <p className="mt-3 font-semibold">Processor's Signature</p>
        {signaturePreviewUrl ? (
          <img src={signaturePreviewUrl} alt="Processor signature" className="mt-2 max-h-16 max-w-[12rem] object-contain" />
        ) : (
          <p className="mt-1 text-slate-500">—</p>
        )}
      </div>
    </div>
  );
}

export default function NewInventoryRequest() {
  const { hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const canWrite = [
    'requests.create', 'requests.*', 'inspection.*',
    'documents.*', 'documents.incoming', 'documents.outgoing',
  ].some((p) => hasPermission(p)) || hasPermission('documents.view');
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formStatus, setFormStatus] = useState<'draft' | 'finalized'>('draft');
  const [form, setForm] = useState<GsoInventoryRequestForm>(EMPTY_FORM);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signatureLocalUrl, setSignatureLocalUrl] = useState<string | null>(null);
  const [clearSignature, setClearSignature] = useState(false);
  const [savedSignatureBlobUrl, setSavedSignatureBlobUrl] = useState<string | null>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const openedFromQuery = useRef<number | null>(null);

  useEffect(() => () => {
    if (signatureLocalUrl) URL.revokeObjectURL(signatureLocalUrl);
  }, [signatureLocalUrl]);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setSavedSignatureBlobUrl(null);
    if (!editingId || !form.processor_signature_path || clearSignature || signatureLocalUrl) {
      return () => { active = false; };
    }
    api.get(`/gso-inventory-requests/${editingId}/processor-signature`, { responseType: 'blob' })
      .then((r) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(r.data);
        setSavedSignatureBlobUrl(objectUrl);
      })
      .catch(() => {
        if (active) setSavedSignatureBlobUrl(null);
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [editingId, form.processor_signature_path, clearSignature, signatureLocalUrl]);

  const signaturePreviewUrl = signatureLocalUrl || savedSignatureBlobUrl;

  const { data: listPage, isLoading } = useQuery({
    queryKey: ['gso-inventory-requests', page, search],
    queryFn: () => api.get('/gso-inventory-requests', {
      params: {
        page,
        ...(search.trim() ? { search: search.trim() } : {}),
      },
    }).then((r) => r.data),
  });

  const records = (listPage?.data ?? []) as RecordRow[];

  const save = useMutation({
    mutationFn: (status: 'draft' | 'finalized') => {
      const body = new FormData();
      const payload: Record<string, string | boolean | null> = {
        ...form,
        requested_at: form.requested_at ? new Date(form.requested_at).toISOString() : null,
        status,
        par_is_new: form.par_is_new,
        par_is_transfer: form.par_is_transfer,
        ics_is_new: form.ics_is_new,
        ics_is_transfer: form.ics_is_transfer,
      };
      Object.entries(payload).forEach(([key, value]) => {
        if (key === 'processor_signature_path' || key === 'control_number') return;
        if (value === null || value === undefined) return;
        body.append(key, String(value));
      });
      if (signatureFile) {
        body.append('processor_signature_file', signatureFile);
      }
      if (clearSignature && !signatureFile) {
        body.append('clear_processor_signature', '1');
      }
      if (editingId) {
        // POST with _method for multipart (some stacks); we also have POST route
        return api.post(`/gso-inventory-requests/${editingId}`, body).then((r) => r.data);
      }
      return api.post('/gso-inventory-requests', body).then((r) => r.data);
    },
    onSuccess: (data: RecordRow, status) => {
      toast.success(status === 'draft' ? 'Draft saved' : editingId ? 'Request updated' : `Saved ${data.control_number}`);
      setEditingId(data.id);
      setFormStatus(data.status as 'draft' | 'finalized');
      setForm((prev) => ({
        ...prev,
        control_number: data.control_number,
        processor_signature_path: data.processor_signature_path ?? null,
      }));
      setSignatureFile(null);
      setClearSignature(false);
      if (signatureLocalUrl) {
        URL.revokeObjectURL(signatureLocalUrl);
        setSignatureLocalUrl(null);
      }
      queryClient.invalidateQueries({ queryKey: ['gso-inventory-requests'] });
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e.response?.data?.message ?? 'Failed to save');
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/gso-inventory-requests/${id}`),
    onSuccess: () => {
      toast.success('Request deleted');
      handleNew();
      queryClient.invalidateQueries({ queryKey: ['gso-inventory-requests'] });
    },
    onError: () => toast.error('Failed to delete'),
  });

  const handleNew = () => {
    setEditingId(null);
    setFormStatus('draft');
    setForm(EMPTY_FORM());
    setSignatureFile(null);
    setClearSignature(false);
    if (signatureLocalUrl) {
      URL.revokeObjectURL(signatureLocalUrl);
      setSignatureLocalUrl(null);
    }
  };

  const handleSelect = (record: RecordRow) => {
    setEditingId(record.id);
    setFormStatus(record.status === 'finalized' ? 'finalized' : 'draft');
    setSignatureFile(null);
    setClearSignature(false);
    if (signatureLocalUrl) {
      URL.revokeObjectURL(signatureLocalUrl);
      setSignatureLocalUrl(null);
    }
    setForm({
      control_number: record.control_number,
      requested_at: toDateTimeLocal(record.requested_at),
      employee_name: record.employee_name ?? '',
      office_name: record.office_name ?? '',
      request_type: record.request_type ?? '',
      par_is_new: Boolean(record.par_is_new),
      par_is_transfer: Boolean(record.par_is_transfer),
      ics_is_new: Boolean(record.ics_is_new),
      ics_is_transfer: Boolean(record.ics_is_transfer),
      ics_to_name: record.ics_to_name ?? '',
      ics_employee_signature: record.ics_employee_signature ?? '',
      ics_office: record.ics_office ?? '',
      ics_position: record.ics_position ?? '',
      ics_id_no: record.ics_id_no ?? '',
      horm_property_or_plate: record.horm_property_or_plate ?? '',
      others_specify: record.others_specify ?? '',
      purpose: record.purpose ?? '',
      requester_signature: record.requester_signature ?? '',
      contact_no: record.contact_no ?? '',
      pgso_instruction: record.pgso_instruction ?? '',
      remarks: record.remarks ?? '',
      processor_signature: record.processor_signature ?? '',
      processor_signature_path: record.processor_signature_path ?? null,
      approved_name: record.approved_name ?? 'MERCY M. BONTAO',
      approved_position: record.approved_position ?? 'Acting PGSO',
    });
  };

  useEffect(() => {
    const raw = searchParams.get('id');
    const id = raw ? Number(raw) : NaN;
    if (!Number.isFinite(id) || id <= 0) return;
    if (openedFromQuery.current === id) return;
    openedFromQuery.current = id;
    api.get(`/gso-inventory-requests/${id}`)
      .then((r) => {
        handleSelect(r.data as RecordRow);
        setSearchParams({}, { replace: true });
      })
      .catch(() => {
        toast.error('Unable to open inventory request');
        openedFromQuery.current = null;
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- open once from query id
  }, [searchParams]);

  const onPickSignature = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error('Signature image must be 3MB or less');
      return;
    }
    if (signatureLocalUrl) URL.revokeObjectURL(signatureLocalUrl);
    setSignatureFile(file);
    setSignatureLocalUrl(URL.createObjectURL(file));
    setClearSignature(false);
  };

  const clearProcessorSignature = () => {
    if (signatureLocalUrl) URL.revokeObjectURL(signatureLocalUrl);
    setSignatureFile(null);
    setSignatureLocalUrl(null);
    setClearSignature(true);
    setForm((prev) => ({ ...prev, processor_signature_path: null }));
    if (signatureInputRef.current) signatureInputRef.current.value = '';
  };

  const set = <K extends keyof GsoInventoryRequestForm>(key: K, value: GsoInventoryRequestForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const selectType = (value: string) => {
    setForm((prev) => ({
      ...prev,
      request_type: value,
      ...(value !== 'par' ? { par_is_new: false, par_is_transfer: false } : {}),
      ...(value !== 'ics' ? {
        ics_is_new: false,
        ics_is_transfer: false,
        ics_to_name: '',
        ics_employee_signature: '',
        ics_office: '',
        ics_position: '',
        ics_id_no: '',
      } : {}),
      ...(value !== 'horm' ? { horm_property_or_plate: '' } : {}),
      ...(value !== 'others' ? { others_specify: '' } : {}),
    }));
  };

  const canFinalize = Boolean(
    form.requested_at
    && form.employee_name.trim()
    && form.office_name.trim()
    && form.request_type
    && form.purpose.trim()
    && form.requester_signature.trim()
    && form.contact_no.trim(),
  );
  const hasFilledForm = Boolean(
    editingId
    || form.employee_name.trim()
    || form.office_name.trim()
    || form.request_type
    || form.purpose.trim()
    || form.requester_signature.trim()
    || form.contact_no.trim()
    || form.pgso_instruction.trim()
    || form.remarks.trim()
    || signaturePreviewUrl,
  );

  const handleNewClick = () => {
    if (hasFilledForm && !window.confirm('Start a new request? Unsaved changes in the current form will be cleared.')) {
      return;
    }
    handleNew();
    toast.success('Ready for a new request');
  };

  const handlePrintClick = () => {
    if (!hasFilledForm) {
      toast.error('Fill out the form first before printing');
      return;
    }
    openGsoInventoryRequestPrintPreview(previewForm, {
      processorSignatureUrl: signaturePreviewUrl,
    });
  };

  const previewForm = useMemo(() => form, [form]);

  return (
    <div className="min-h-screen bg-white">
      <div className="space-y-4 md:space-y-6">
        <PageHeader
          title="New Inventory Request"
          description="GSO Control Slip — inventory and property document requests"
          action={
            <div className="flex flex-wrap items-center gap-2">
              {formStatus === 'draft' && editingId && (
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">Draft</span>
              )}
              {canWrite && (
                <button type="button" className="btn-secondary" onClick={handleNewClick}>
                  <Plus size={18} /> New
                </button>
              )}
              <button
                type="button"
                className="btn-secondary"
                onClick={handlePrintClick}
              >
                <Printer size={18} /> Print
              </button>
              {canWrite && (
                <>
                  <button type="button" className="btn-secondary" disabled={save.isPending} onClick={() => save.mutate('draft')}>
                    <FilePenLine size={18} /> {save.isPending ? 'Saving…' : 'Save as Draft'}
                  </button>
                  <button type="button" className="btn-primary" disabled={!canFinalize || save.isPending} onClick={() => save.mutate('finalized')}>
                    <Save size={18} /> {save.isPending ? 'Saving…' : editingId && formStatus === 'finalized' ? 'Update' : 'Save'}
                  </button>
                </>
              )}
            </div>
          }
        />

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Saved Requests</h2>
              <p className="text-xs text-slate-500">Select a draft or finalized slip to continue editing</p>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search control no, employee, office…"
                className="input-field !pl-9 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {isLoading ? (
              <p className="py-6 text-sm text-slate-500">Loading…</p>
            ) : records.length === 0 ? (
              <p className="py-6 text-sm text-slate-500">No saved requests yet.</p>
            ) : (
              records.map((record) => (
                <button
                  key={record.id}
                  type="button"
                  onClick={() => handleSelect(record)}
                  className={`min-w-[220px] shrink-0 rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                    editingId === record.id
                      ? 'border-palawan-300 bg-palawan-50 ring-1 ring-palawan-200'
                      : record.status === 'draft'
                        ? 'border-amber-200 bg-amber-50/60 hover:bg-amber-50'
                        : 'border-slate-100 bg-slate-50/50 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-mono text-xs font-semibold text-palawan-700">{record.control_number}</p>
                    {canWrite && (
                      <span
                        role="button"
                        tabIndex={0}
                        className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm(`Delete ${record.control_number}?`)) remove.mutate(record.id);
                        }}
                      >
                        <Trash2 size={14} />
                      </span>
                    )}
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-700">{record.employee_name || 'No employee'}</p>
                  <p className="mt-0.5 text-[11px] capitalize text-slate-500">{record.status}</p>
                </button>
              ))
            )}
          </div>
          <Pagination currentPage={listPage?.current_page ?? 1} lastPage={listPage?.last_page ?? 1} onPageChange={setPage} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,26rem)_1fr]">
          <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <ClipboardList size={16} className="text-palawan-700" />
              Form fields
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="GSO Control Slip No.">
                <input className="input-field font-mono text-sm" value={form.control_number ?? ''} readOnly placeholder="Auto on save" />
              </Field>
              <Field label="Date & Time" required>
                <input type="datetime-local" className="input-field text-sm" value={form.requested_at} onChange={(e) => set('requested_at', e.target.value)} disabled={!canWrite} />
              </Field>
              <Field label="I. Name of Employee" required className="sm:col-span-2">
                <input className="input-field text-sm" value={form.employee_name} onChange={(e) => set('employee_name', e.target.value)} disabled={!canWrite} />
              </Field>
              <Field label="II. Name of Office" required className="sm:col-span-2">
                <input className="input-field text-sm" value={form.office_name} onChange={(e) => set('office_name', e.target.value)} disabled={!canWrite} />
              </Field>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">III. Request for</p>
              <div className="space-y-2">
                {REQUEST_TYPES.map((t) => (
                  <div key={t.value}>
                    <label className="flex items-start gap-2 text-sm text-slate-700">
                      <input
                        type="radio"
                        name="request_type"
                        className="mt-0.5 h-4 w-4 border-slate-300 text-palawan-600"
                        checked={form.request_type === t.value}
                        disabled={!canWrite}
                        onChange={() => selectType(t.value)}
                      />
                      <span><strong>{t.letter}.</strong> {t.label}</span>
                    </label>

                    {t.value === 'par' && form.request_type === 'par' && (
                      <div className="ml-6 mt-1.5 flex flex-wrap gap-4 text-sm">
                        <label className="inline-flex items-center gap-2">
                          <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-palawan-600" checked={form.par_is_new} disabled={!canWrite} onChange={(e) => set('par_is_new', e.target.checked)} />
                          New
                        </label>
                        <label className="inline-flex items-center gap-2">
                          <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-palawan-600" checked={form.par_is_transfer} disabled={!canWrite} onChange={(e) => set('par_is_transfer', e.target.checked)} />
                          Transfer
                        </label>
                      </div>
                    )}

                    {t.value === 'ics' && form.request_type === 'ics' && (
                      <div className="ml-6 mt-2 space-y-2 rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                        <div className="flex flex-wrap gap-4 text-sm">
                          <label className="inline-flex items-center gap-2">
                            <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-palawan-600" checked={form.ics_is_new} disabled={!canWrite} onChange={(e) => set('ics_is_new', e.target.checked)} />
                            New
                          </label>
                          <label className="inline-flex items-center gap-2">
                            <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-palawan-600" checked={form.ics_is_transfer} disabled={!canWrite} onChange={(e) => set('ics_is_transfer', e.target.checked)} />
                            Transfer
                          </label>
                        </div>
                        <Field label="To">
                          <input className="input-field text-sm" value={form.ics_to_name} onChange={(e) => set('ics_to_name', e.target.value)} disabled={!canWrite} />
                        </Field>
                        <Field label="Signature of Employee Over Printed Name">
                          <input className="input-field text-sm" value={form.ics_employee_signature} onChange={(e) => set('ics_employee_signature', e.target.value)} disabled={!canWrite} />
                        </Field>
                        <div className="grid gap-2 sm:grid-cols-3">
                          <Field label="Office">
                            <input className="input-field text-sm" value={form.ics_office} onChange={(e) => set('ics_office', e.target.value)} disabled={!canWrite} />
                          </Field>
                          <Field label="Position">
                            <input className="input-field text-sm" value={form.ics_position} onChange={(e) => set('ics_position', e.target.value)} disabled={!canWrite} />
                          </Field>
                          <Field label="ID No.">
                            <input className="input-field text-sm" value={form.ics_id_no} onChange={(e) => set('ics_id_no', e.target.value)} disabled={!canWrite} />
                          </Field>
                        </div>
                      </div>
                    )}

                    {t.value === 'horm' && form.request_type === 'horm' && (
                      <div className="ml-6 mt-1.5">
                        <Field label="Property No. / Plate No.">
                          <input className="input-field text-sm" value={form.horm_property_or_plate} onChange={(e) => set('horm_property_or_plate', e.target.value)} disabled={!canWrite} />
                        </Field>
                      </div>
                    )}

                    {t.value === 'others' && form.request_type === 'others' && (
                      <div className="ml-6 mt-1.5">
                        <Field label="Please specify">
                          <input className="input-field text-sm" value={form.others_specify} onChange={(e) => set('others_specify', e.target.value)} disabled={!canWrite} />
                        </Field>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Field label="IV. Purpose" required>
              <textarea rows={3} className="input-field text-sm" value={form.purpose} onChange={(e) => set('purpose', e.target.value)} disabled={!canWrite} />
            </Field>
            <Field label="Signature Over Printed Name of Requester" required>
              <input className="input-field text-sm" value={form.requester_signature} onChange={(e) => set('requester_signature', e.target.value)} disabled={!canWrite} />
            </Field>
            <Field label="Contact No." required>
              <input className="input-field text-sm" value={form.contact_no} onChange={(e) => set('contact_no', e.target.value)} disabled={!canWrite} />
            </Field>
            <Field label="V. PGSO Instruction">
              <textarea rows={3} className="input-field text-sm" value={form.pgso_instruction} onChange={(e) => set('pgso_instruction', e.target.value)} disabled={!canWrite} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Approved">
                <input className="input-field text-sm" value={form.approved_name} onChange={(e) => set('approved_name', e.target.value)} disabled={!canWrite} />
              </Field>
              <Field label="Position">
                <input className="input-field text-sm" value={form.approved_position} onChange={(e) => set('approved_position', e.target.value)} disabled={!canWrite} />
              </Field>
            </div>
            <Field label="VI. Remarks">
              <textarea rows={3} className="input-field text-sm" value={form.remarks} onChange={(e) => set('remarks', e.target.value)} disabled={!canWrite} />
            </Field>
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-600">Processor's Signature</p>
              <input
                ref={signatureInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                className="hidden"
                disabled={!canWrite}
                onChange={(e) => onPickSignature(e.target.files?.[0] ?? null)}
              />
              {signaturePreviewUrl ? (
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <img src={signaturePreviewUrl} alt="Processor signature" className="mx-auto max-h-24 max-w-full object-contain" />
                  {canWrite && (
                    <div className="mt-3 flex flex-wrap justify-center gap-2">
                      <button type="button" className="btn-secondary text-xs" onClick={() => signatureInputRef.current?.click()}>
                        <Upload size={14} /> Replace
                      </button>
                      <button type="button" className="btn-secondary text-xs text-rose-600" onClick={clearProcessorSignature}>
                        <X size={14} /> Remove
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  disabled={!canWrite}
                  onClick={() => signatureInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500 transition hover:border-palawan-300 hover:bg-palawan-50/40 hover:text-palawan-800 disabled:opacity-50"
                >
                  <Upload size={20} />
                  Upload signature image
                  <span className="text-[11px] text-slate-400">PNG, JPG, WEBP · max 3MB</span>
                </button>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100/70 shadow-sm xl:sticky xl:top-4 xl:self-start">
            <div className="border-b border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Document preview
            </div>
            <div className="max-h-[min(calc(100vh-6rem),56rem)] overflow-auto p-3 sm:p-5">
              <DocumentPreview form={previewForm} signaturePreviewUrl={signaturePreviewUrl} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
