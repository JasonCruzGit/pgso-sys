import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardPen, FilePenLine, Plus, Printer, Save, Search, Trash2, Upload, X } from 'lucide-react';
import api from '../api/client';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import { useAuth } from '../context/AuthContext';
import { BRANDING, LOGO_PATH, PGSO_LOGO_PATH } from '../constants/branding';
import {
  EQUIPMENT_CATEGORIES,
  openPrePostInspectionRepairPrintPreview,
  type PrePostInspectionRepairForm,
} from '../utils/prePostInspectionRepairPrint';
import toast from 'react-hot-toast';

type RecordRow = PrePostInspectionRepairForm & {
  id: number;
  control_number: string;
  status: string;
  requisitioner_signature_path?: string | null;
};

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY_FORM = (): PrePostInspectionRepairForm => ({
  form_date: today(),
  pre_inspection: true,
  pre_inspection_date: today(),
  post_inspection: false,
  post_inspection_date: '',
  equipment_category: '',
  equipment_category_notes: '',
  property_no: '',
  type: '',
  brand: '',
  model: '',
  engine_no: '',
  chassis_no: '',
  serial_no: '',
  plate_no: '',
  date_of_acquisition: '',
  date_of_last_repair: '',
  location_of_eqpt: '',
  date_of_request: today(),
  office: '',
  requisitioner: '',
  requisitioner_signature_path: null,
  approved_name: 'MERCY M. BONTAO',
  approved_position: 'Acting PGSO',
  approval_date: '',
  inspector_1: '',
  inspector_2: '',
  inspector_3: '',
});

function formatPreviewDate(value?: string) {
  if (!value) return '____________';
  return new Date(value).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
}

function Field({
  label,
  children,
  className = '',
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function DocumentPreview({
  form,
  signaturePreviewUrl,
}: {
  form: PrePostInspectionRepairForm;
  signaturePreviewUrl?: string | null;
}) {
  const categoryLabel = EQUIPMENT_CATEGORIES.find((c) => c.value === form.equipment_category)?.label;

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

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <p>
          <span className="font-semibold">GSO Form #3</span> — Control No.{' '}
          <span className="font-mono font-semibold text-palawan-700">{form.control_number || '—'}</span>
        </p>
        <p><span className="font-semibold">Date:</span> {formatPreviewDate(form.form_date)}</p>
      </div>

      <h2 className="mb-4 text-center text-sm font-bold uppercase tracking-wide">
        Request for Pre and Post Inspection of Repair
      </h2>

      <div className="mb-4 flex flex-wrap gap-x-8 gap-y-2 text-xs">
        <p>
          <span className="mr-1">{form.pre_inspection ? '☑' : '☐'}</span>
          Pre-Inspection · {formatPreviewDate(form.pre_inspection_date)}
        </p>
        <p>
          <span className="mr-1">{form.post_inspection ? '☑' : '☐'}</span>
          Post-Inspection · {formatPreviewDate(form.post_inspection_date)}
        </p>
      </div>

      <div className="mb-4 rounded border border-slate-300 p-3">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Equipment / Unit</p>
        <div className="grid gap-1 sm:grid-cols-2">
          {EQUIPMENT_CATEGORIES.map((c) => (
            <p key={c.value} className="text-xs">
              <span className="mr-1">{form.equipment_category === c.value ? '☑' : '☐'}</span>
              {c.label}
              {form.equipment_category === c.value && form.equipment_category_notes
                ? ` — ${form.equipment_category_notes}`
                : ''}
            </p>
          ))}
        </div>
      </div>

      <div className="mb-6 rounded border border-slate-300 p-3">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Please Indicate</p>
        <dl className="grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
          {[
            ['Property No.', form.property_no],
            ['Type', form.type],
            ['Brand', form.brand],
            ['Model', form.model],
            ['Engine No.', form.engine_no],
            ['Chassis No.', form.chassis_no],
            ['Serial No.', form.serial_no],
            ['Plate No.', form.plate_no],
            ['Date of Acquisition', formatPreviewDate(form.date_of_acquisition)],
            ['Date of Last Repair', formatPreviewDate(form.date_of_last_repair)],
            ['Location of Eqpt.', form.location_of_eqpt],
            ['Date of Request', formatPreviewDate(form.date_of_request)],
            ['Office', form.office],
            ['Category', categoryLabel ?? ''],
          ].map(([label, value]) => (
            <div key={label} className="flex gap-2 border-b border-dotted border-slate-200 pb-1">
              <dt className="w-32 shrink-0 font-semibold text-slate-600">{label}</dt>
              <dd className="min-w-0 flex-1">{value || '—'}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mb-6 grid gap-8 sm:grid-cols-2">
        <div className="text-center text-xs">
          {signaturePreviewUrl ? (
            <img src={signaturePreviewUrl} alt="Requisitioner signature" className="mx-auto mb-1 max-h-14 max-w-[12rem] object-contain" />
          ) : null}
          <div className="mx-auto mb-1 max-w-[14rem] border-b border-slate-900 pb-1 font-bold uppercase">
            {form.requisitioner || '\u00A0'}
          </div>
          <p className="font-semibold">Requisitioner</p>
          <p className="text-[10px] text-slate-500">Signature over Printed Name</p>
        </div>
        <div className="text-center text-xs">
          <div className="mx-auto mb-1 max-w-[14rem] border-b border-slate-900 pb-1 font-bold uppercase">
            {form.approved_name || 'MERCY M. BONTAO'}
          </div>
          <p>{form.approved_position || 'Acting PGSO'}</p>
          <p className="font-semibold">Approved</p>
          <p className="mt-1 text-slate-600">Date: {formatPreviewDate(form.approval_date)}</p>
        </div>
      </div>

      <div className="rounded border border-dashed border-slate-400 p-3">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Assigned Inspector</p>
        <ol className="list-decimal space-y-2 pl-5 text-xs">
          {[form.inspector_1, form.inspector_2, form.inspector_3].map((name, i) => (
            <li key={i} className="border-b border-slate-300 pb-1">{name || '\u00A0'}</li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export default function PrePostInspectionRepair() {
  const { hasPermission } = useAuth();
  const canWrite = hasPermission('inspection.*');
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formStatus, setFormStatus] = useState<'draft' | 'finalized'>('draft');
  const [form, setForm] = useState<PrePostInspectionRepairForm>(EMPTY_FORM);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signatureLocalUrl, setSignatureLocalUrl] = useState<string | null>(null);
  const [clearSignature, setClearSignature] = useState(false);
  const [savedSignatureBlobUrl, setSavedSignatureBlobUrl] = useState<string | null>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (signatureLocalUrl) URL.revokeObjectURL(signatureLocalUrl);
  }, [signatureLocalUrl]);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setSavedSignatureBlobUrl(null);
    if (!editingId || !form.requisitioner_signature_path || clearSignature || signatureLocalUrl) {
      return () => { active = false; };
    }
    api.get(`/pre-post-inspection-repairs/${editingId}/requisitioner-signature`, { responseType: 'blob' })
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
  }, [editingId, form.requisitioner_signature_path, clearSignature, signatureLocalUrl]);

  const signaturePreviewUrl = signatureLocalUrl || savedSignatureBlobUrl;

  const { data: listPage, isLoading } = useQuery({
    queryKey: ['pre-post-inspection-repairs', page, search],
    queryFn: () => api.get('/pre-post-inspection-repairs', {
      params: {
        page,
        ...(search.trim() ? { search: search.trim() } : {}),
      },
    }).then((r) => r.data),
  });

  const records = (listPage?.data ?? []) as RecordRow[];

  const save = useMutation({
    mutationFn: (status: 'draft' | 'finalized') => {
      const isPost = form.post_inspection && !form.pre_inspection;
      const body = new FormData();
      const payload: Record<string, string | boolean | null> = {
        ...form,
        pre_inspection: !isPost,
        post_inspection: isPost,
        pre_inspection_date: isPost ? null : (form.pre_inspection_date || null),
        post_inspection_date: isPost ? (form.post_inspection_date || null) : null,
        status,
      };
      Object.entries(payload).forEach(([key, value]) => {
        if (key === 'requisitioner_signature_path' || key === 'control_number') return;
        if (value === null || value === undefined) return;
        body.append(key, String(value));
      });
      if (signatureFile) {
        body.append('requisitioner_signature_file', signatureFile);
      }
      if (clearSignature && !signatureFile) {
        body.append('clear_requisitioner_signature', '1');
      }
      if (editingId) {
        return api.post(`/pre-post-inspection-repairs/${editingId}`, body).then((r) => r.data);
      }
      return api.post('/pre-post-inspection-repairs', body).then((r) => r.data);
    },
    onSuccess: (data: RecordRow, status) => {
      toast.success(status === 'draft' ? 'Draft saved' : editingId ? 'Record updated' : `Saved ${data.control_number}`);
      setEditingId(data.id);
      setFormStatus(data.status as 'draft' | 'finalized');
      setForm((prev) => ({
        ...prev,
        control_number: data.control_number,
        requisitioner_signature_path: data.requisitioner_signature_path ?? null,
      }));
      setSignatureFile(null);
      setClearSignature(false);
      if (signatureLocalUrl) {
        URL.revokeObjectURL(signatureLocalUrl);
        setSignatureLocalUrl(null);
      }
      queryClient.invalidateQueries({ queryKey: ['pre-post-inspection-repairs'] });
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e.response?.data?.message ?? 'Failed to save');
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/pre-post-inspection-repairs/${id}`),
    onSuccess: () => {
      toast.success('Record deleted');
      handleNew();
      queryClient.invalidateQueries({ queryKey: ['pre-post-inspection-repairs'] });
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
    const preferPost = Boolean(record.post_inspection) && !record.pre_inspection;
    setForm({
      control_number: record.control_number,
      form_date: record.form_date?.slice(0, 10) ?? '',
      pre_inspection: !preferPost,
      pre_inspection_date: preferPost ? '' : (record.pre_inspection_date?.slice(0, 10) ?? ''),
      post_inspection: preferPost,
      post_inspection_date: preferPost ? (record.post_inspection_date?.slice(0, 10) ?? '') : '',
      equipment_category: record.equipment_category ?? '',
      equipment_category_notes: record.equipment_category_notes ?? '',
      property_no: record.property_no ?? '',
      type: record.type ?? '',
      brand: record.brand ?? '',
      model: record.model ?? '',
      engine_no: record.engine_no ?? '',
      chassis_no: record.chassis_no ?? '',
      serial_no: record.serial_no ?? '',
      plate_no: record.plate_no ?? '',
      date_of_acquisition: record.date_of_acquisition?.slice(0, 10) ?? '',
      date_of_last_repair: record.date_of_last_repair?.slice(0, 10) ?? '',
      location_of_eqpt: record.location_of_eqpt ?? '',
      date_of_request: record.date_of_request?.slice(0, 10) ?? '',
      office: record.office ?? '',
      requisitioner: record.requisitioner ?? '',
      requisitioner_signature_path: record.requisitioner_signature_path ?? null,
      approved_name: record.approved_name ?? 'MERCY M. BONTAO',
      approved_position: record.approved_position ?? 'Acting PGSO',
      approval_date: record.approval_date?.slice(0, 10) ?? '',
      inspector_1: record.inspector_1 ?? '',
      inspector_2: record.inspector_2 ?? '',
      inspector_3: record.inspector_3 ?? '',
    });
  };

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

  const clearRequisitionerSignature = () => {
    if (signatureLocalUrl) URL.revokeObjectURL(signatureLocalUrl);
    setSignatureFile(null);
    setSignatureLocalUrl(null);
    setClearSignature(true);
    setForm((prev) => ({ ...prev, requisitioner_signature_path: null }));
    if (signatureInputRef.current) signatureInputRef.current.value = '';
  };

  const set = <K extends keyof PrePostInspectionRepairForm>(key: K, value: PrePostInspectionRepairForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const hasRequisitionerSignature = Boolean(signaturePreviewUrl || form.requisitioner.trim());
  const canFinalize = Boolean(form.form_date && form.equipment_category && hasRequisitionerSignature);
  const previewForm = useMemo(() => form, [form]);

  return (
    <div className="min-h-screen bg-white">
      <div className="space-y-4 md:space-y-6">
        <PageHeader
          title="Pre & Post Inspection of Repair"
          description="GSO Form #3 — request for pre and post inspection of repair"
          action={
            <div className="flex flex-wrap items-center gap-2">
              {formStatus === 'draft' && editingId && (
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">Draft</span>
              )}
              {canWrite && (
                <button type="button" className="btn-secondary" onClick={handleNew}>
                  <Plus size={18} /> New
                </button>
              )}
              <button
                type="button"
                className="btn-secondary"
                onClick={() => openPrePostInspectionRepairPrintPreview(previewForm, {
                  requisitionerSignatureUrl: signaturePreviewUrl,
                })}
              >
                <Printer size={18} /> Print
              </button>
              {canWrite && (
                <>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={save.isPending}
                    onClick={() => save.mutate('draft')}
                  >
                    <FilePenLine size={18} /> {save.isPending ? 'Saving…' : 'Save as Draft'}
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={!canFinalize || save.isPending}
                    onClick={() => save.mutate('finalized')}
                  >
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
              <h2 className="text-sm font-bold text-slate-800">Saved Forms</h2>
              <p className="text-xs text-slate-500">Select a draft or finalized form to continue editing</p>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search control no, plate, office…"
                className="input-field !pl-9 text-sm"
              />
            </div>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-1">
            {isLoading ? (
              <p className="py-6 text-sm text-slate-500">Loading…</p>
            ) : records.length === 0 ? (
              <p className="py-6 text-sm text-slate-500">No saved forms yet.</p>
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
                  <p className="mt-1 truncate text-xs text-slate-700">{record.property_no || record.plate_no || 'No property/plate'}</p>
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
              <ClipboardPen size={16} className="text-palawan-700" />
              Form fields
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Control No.">
                <input className="input-field font-mono text-sm" value={form.control_number ?? ''} readOnly placeholder="Auto on save" />
              </Field>
              <Field label="Date">
                <input type="date" className="input-field text-sm" value={form.form_date} onChange={(e) => set('form_date', e.target.value)} disabled={!canWrite} />
              </Field>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Inspection type</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="inspection_type"
                    className="h-4 w-4 border-slate-300 text-palawan-600"
                    checked={form.pre_inspection && !form.post_inspection}
                    disabled={!canWrite}
                    onChange={() => setForm((prev) => ({
                      ...prev,
                      pre_inspection: true,
                      post_inspection: false,
                      post_inspection_date: '',
                      pre_inspection_date: prev.pre_inspection_date || today(),
                    }))}
                  />
                  Pre-Inspection
                </label>
                <Field label="Pre-Inspection Date">
                  <input
                    type="date"
                    className="input-field text-sm"
                    value={form.pre_inspection_date}
                    onChange={(e) => set('pre_inspection_date', e.target.value)}
                    disabled={!canWrite || !form.pre_inspection}
                  />
                </Field>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="inspection_type"
                    className="h-4 w-4 border-slate-300 text-palawan-600"
                    checked={form.post_inspection && !form.pre_inspection}
                    disabled={!canWrite}
                    onChange={() => setForm((prev) => ({
                      ...prev,
                      pre_inspection: false,
                      post_inspection: true,
                      pre_inspection_date: '',
                      post_inspection_date: prev.post_inspection_date || today(),
                    }))}
                  />
                  Post-Inspection
                </label>
                <Field label="Post-Inspection Date">
                  <input
                    type="date"
                    className="input-field text-sm"
                    value={form.post_inspection_date}
                    onChange={(e) => set('post_inspection_date', e.target.value)}
                    disabled={!canWrite || !form.post_inspection}
                  />
                </Field>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Equipment / Unit</p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {EQUIPMENT_CATEGORIES.map((c) => (
                  <label key={c.value} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="radio"
                      name="equipment_category"
                      className="h-4 w-4 border-slate-300 text-palawan-600"
                      checked={form.equipment_category === c.value}
                      disabled={!canWrite}
                      onChange={() => set('equipment_category', c.value)}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
              <Field label="Notes / Others" className="mt-3">
                <input
                  className="input-field text-sm"
                  value={form.equipment_category_notes}
                  onChange={(e) => set('equipment_category_notes', e.target.value)}
                  disabled={!canWrite}
                  placeholder="Optional specification"
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {([
                ['property_no', 'Property No.'],
                ['type', 'Type'],
                ['brand', 'Brand'],
                ['model', 'Model'],
                ['engine_no', 'Engine No.'],
                ['chassis_no', 'Chassis No.'],
                ['serial_no', 'Serial No.'],
                ['plate_no', 'Plate No.'],
              ] as const).map(([key, label]) => (
                <Field key={key} label={label}>
                  <input className="input-field text-sm" value={form[key]} onChange={(e) => set(key, e.target.value)} disabled={!canWrite} />
                </Field>
              ))}
              <Field label="Date of Acquisition">
                <input type="date" className="input-field text-sm" value={form.date_of_acquisition} onChange={(e) => set('date_of_acquisition', e.target.value)} disabled={!canWrite} />
              </Field>
              <Field label="Date of Last Repair">
                <input type="date" className="input-field text-sm" value={form.date_of_last_repair} onChange={(e) => set('date_of_last_repair', e.target.value)} disabled={!canWrite} />
              </Field>
              <Field label="Location of Eqpt." className="sm:col-span-2">
                <input className="input-field text-sm" value={form.location_of_eqpt} onChange={(e) => set('location_of_eqpt', e.target.value)} disabled={!canWrite} />
              </Field>
              <Field label="Date of Request">
                <input type="date" className="input-field text-sm" value={form.date_of_request} onChange={(e) => set('date_of_request', e.target.value)} disabled={!canWrite} />
              </Field>
              <Field label="Office">
                <input className="input-field text-sm" value={form.office} onChange={(e) => set('office', e.target.value)} disabled={!canWrite} />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <p className="mb-1.5 text-xs font-semibold text-slate-600">Requisitioner *</p>
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
                    <img src={signaturePreviewUrl} alt="Requisitioner signature" className="mx-auto max-h-24 max-w-full object-contain" />
                    {canWrite && (
                      <div className="mt-3 flex flex-wrap justify-center gap-2">
                        <button type="button" className="btn-secondary text-xs" onClick={() => signatureInputRef.current?.click()}>
                          <Upload size={14} /> Replace
                        </button>
                        <button type="button" className="btn-secondary text-xs text-rose-600" onClick={clearRequisitionerSignature}>
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
                <Field label="Printed name (optional)" className="mt-3">
                  <input
                    className="input-field text-sm"
                    value={form.requisitioner}
                    onChange={(e) => set('requisitioner', e.target.value)}
                    disabled={!canWrite}
                    placeholder="Signature over printed name"
                  />
                </Field>
              </div>
              <Field label="Approved">
                <input className="input-field text-sm" value={form.approved_name} onChange={(e) => set('approved_name', e.target.value)} disabled={!canWrite} />
              </Field>
              <Field label="Position">
                <input className="input-field text-sm" value={form.approved_position} onChange={(e) => set('approved_position', e.target.value)} disabled={!canWrite} />
              </Field>
              <Field label="Approval Date" className="sm:col-span-2">
                <input type="date" className="input-field text-sm" value={form.approval_date} onChange={(e) => set('approval_date', e.target.value)} disabled={!canWrite} />
              </Field>
            </div>

            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Assigned Inspector</p>
              <div className="space-y-2">
                {([
                  ['inspector_1', '1'],
                  ['inspector_2', '2'],
                  ['inspector_3', '3'],
                ] as const).map(([key, n]) => (
                  <Field key={key} label={`Inspector ${n}`}>
                    <input className="input-field text-sm" value={form[key]} onChange={(e) => set(key, e.target.value)} disabled={!canWrite} />
                  </Field>
                ))}
              </div>
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
