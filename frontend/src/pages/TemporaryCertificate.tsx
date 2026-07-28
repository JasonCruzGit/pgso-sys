import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Printer, Save, ScrollText, Search, Trash2, FilePenLine } from 'lucide-react';
import api from '../api/client';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import toast from 'react-hot-toast';
import {
  openTemporaryCertificatePrintPreview,
  type TemporaryCertificateForm,
} from '../utils/temporaryCertificatePrint';
import { BRANDING, LOGO_PATH, PGSO_LOGO_PATH } from '../constants/branding';

type TemporaryCertificateRecord = TemporaryCertificateForm & {
  id: number;
  control_number: string;
  status: string;
};

const EMPTY_FORM: TemporaryCertificateForm = {
  request_date: new Date().toISOString().slice(0, 10),
  requester_name: '',
  requester_position: '',
  requester_office: '',
  recipient_name: '',
  recipient_position: '',
  recipient_office: '',
  transfer_reason: 'on the duration of my travel',
  conformed_name: '',
  conformed_position: '',
  conformed_office: '',
  attested_name: 'YOLANDA L. CAABAY',
  attested_position: 'PGADH',
  attested_office: 'Provincial General Services Office',
  approved_name: 'MERCY M. BONTAO, MPA',
  approved_position: 'Acting PGSO',
};

function formatPreviewDate(value: string) {
  if (!value) return '________________';
  return new Date(value).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
}

function PreviewBlock({
  name,
  position,
  office,
  label,
}: {
  name?: string;
  position?: string;
  office?: string;
  label: string;
}) {
  return (
    <div>
      <div className="mb-1 border-b border-slate-900" />
      <p className="text-center text-xs font-bold uppercase text-slate-900">{name || '\u00A0'}</p>
      {position && <p className="text-center text-[11px] text-slate-700">{position}</p>}
      {office && <p className="text-center text-[11px] text-slate-700">{office}</p>}
      <p className="mt-2 text-center text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  );
}

function DocumentPreview({ form }: { form: TemporaryCertificateForm }) {
  return (
    <div className="mx-auto max-w-[816px] bg-white px-8 py-10 text-slate-900 sm:px-12">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-white">
          <img src={LOGO_PATH} alt="" className="h-full w-full object-contain" />
        </div>
        <div className="min-w-0 flex-1 text-center text-xs leading-relaxed">
          <p className="uppercase tracking-wide">{BRANDING.republic}</p>
          <p className="mt-1 text-sm font-bold uppercase">{BRANDING.lguName}</p>
          <p className="mt-1 font-semibold uppercase text-palawan-700">Provincial General Services Office</p>
          <p className="mt-1">{BRANDING.capitalCity}</p>
        </div>
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-white">
          <img src={PGSO_LOGO_PATH} alt="" className="h-full w-full object-contain" />
        </div>
      </div>

      <div className="mb-6 space-y-1 text-sm">
        <p><span className="font-semibold">Control No.:</span> {form.control_number || '—'}</p>
        <p><span className="font-semibold">Date:</span> {formatPreviewDate(form.request_date)}</p>
      </div>

      <h2 className="mb-8 text-center text-sm font-bold uppercase leading-relaxed tracking-wide">
        Request for Temporary Transfer of Property Accountability
      </h2>

      <p className="mb-4 text-sm font-bold">The General Services Officer:</p>

      <p className="mb-4 text-justify text-sm leading-7 indent-8">
        This is to request the transfer of items under my Individual Property Accountability (IPA) to{' '}
        <span className="font-bold uppercase">{form.recipient_name || '________________'}</span>,{' '}
        <span className="font-bold">{form.recipient_position || '________________'}</span>,{' '}
        <span className="font-bold">{form.recipient_office || '________________'}</span>,{' '}
        {form.transfer_reason || '________________'}.
      </p>

      <p className="mb-10 text-justify text-sm leading-7 indent-8">
        The above said accountabilities are revocable upon my return to office.
      </p>

      <div className="grid gap-12 sm:grid-cols-2">
        <PreviewBlock
          name={form.requester_name}
          position={form.requester_position}
          office={form.requester_office}
          label="Requester"
        />
        <PreviewBlock
          name={form.conformed_name}
          position={form.conformed_position}
          office={form.conformed_office}
          label="Conformed"
        />
      </div>

      <div className="mt-10 flex justify-end">
        <div className="w-full max-w-xs">
          <PreviewBlock
            name={form.attested_name}
            position={form.attested_position}
            office={form.attested_office}
            label="Attested by"
          />
        </div>
      </div>

      <div className="mx-auto mt-12 max-w-xs">
        <PreviewBlock
          name={form.approved_name}
          position={form.approved_position}
          label="Approved by"
        />
      </div>
    </div>
  );
}

export default function TemporaryCertificate() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formStatus, setFormStatus] = useState<'draft' | 'finalized'>('draft');
  const [form, setForm] = useState<TemporaryCertificateForm>(EMPTY_FORM);

  const { data: listPage, isLoading } = useQuery({
    queryKey: ['temporary-certificates', page, search],
    queryFn: () => api.get('/temporary-certificates', {
      params: {
        page,
        ...(search.trim() ? { search: search.trim() } : {}),
      },
    }).then((r) => r.data),
  });

  const records = (listPage?.data ?? []) as TemporaryCertificateRecord[];

  const save = useMutation({
    mutationFn: (status: 'draft' | 'finalized') => {
      const payload = {
        ...form,
        requester_name: form.requester_name.trim() || '—',
        recipient_name: form.recipient_name.trim() || '—',
        transfer_reason: form.transfer_reason.trim() || '—',
        status,
      };
      if (editingId) {
        return api.put(`/temporary-certificates/${editingId}`, payload).then((r) => r.data);
      }
      return api.post('/temporary-certificates', payload).then((r) => r.data);
    },
    onSuccess: (data: TemporaryCertificateRecord, status) => {
      const label = status === 'draft' ? 'Draft saved' : editingId ? 'Certificate updated' : `Certificate ${data.control_number} saved`;
      toast.success(label);
      setEditingId(data.id);
      setFormStatus(data.status as 'draft' | 'finalized');
      setForm((prev) => ({ ...prev, control_number: data.control_number }));
      queryClient.invalidateQueries({ queryKey: ['temporary-certificates'] });
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e.response?.data?.message ?? 'Failed to save certificate');
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/temporary-certificates/${id}`),
    onSuccess: () => {
      toast.success('Certificate deleted');
      if (editingId) {
        handleNew();
      }
      queryClient.invalidateQueries({ queryKey: ['temporary-certificates'] });
    },
    onError: () => toast.error('Failed to delete certificate'),
  });

  const handleNew = () => {
    setEditingId(null);
    setFormStatus('draft');
    setForm({ ...EMPTY_FORM, request_date: new Date().toISOString().slice(0, 10) });
  };

  const handleSelect = (record: TemporaryCertificateRecord) => {
    setEditingId(record.id);
    setFormStatus(record.status === 'finalized' ? 'finalized' : 'draft');
    setForm({
      control_number: record.control_number,
      request_date: record.request_date,
      requester_name: record.requester_name,
      requester_position: record.requester_position ?? '',
      requester_office: record.requester_office ?? '',
      recipient_name: record.recipient_name,
      recipient_position: record.recipient_position ?? '',
      recipient_office: record.recipient_office ?? '',
      transfer_reason: record.transfer_reason,
      conformed_name: record.conformed_name ?? '',
      conformed_position: record.conformed_position ?? '',
      conformed_office: record.conformed_office ?? '',
      attested_name: record.attested_name ?? '',
      attested_position: record.attested_position ?? '',
      attested_office: record.attested_office ?? '',
      approved_name: record.approved_name ?? '',
      approved_position: record.approved_position ?? '',
    });
  };

  const updateField = <K extends keyof TemporaryCertificateForm>(key: K, value: TemporaryCertificateForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const canSave = form.requester_name.trim() && form.recipient_name.trim() && form.transfer_reason.trim();

  const printReadyForm = useMemo(() => form, [form]);

  return (
    <div className="min-h-screen bg-white">
      <div className="space-y-4 md:space-y-6">
        <PageHeader
          title="Temporary Certificate"
          description="Request for temporary transfer of property accountability"
          action={
            <div className="flex flex-wrap items-center gap-2">
              {formStatus === 'draft' && editingId && (
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">Draft</span>
              )}
              <button type="button" className="btn-secondary" onClick={handleNew}>
                <Plus size={18} /> New
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => openTemporaryCertificatePrintPreview(printReadyForm)}
              >
                <Printer size={18} /> Print
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={save.isPending}
                onClick={() => save.mutate('draft')}
              >
                <FilePenLine size={18} /> {save.isPending ? 'Saving...' : 'Save as Draft'}
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={!canSave || save.isPending}
                onClick={() => save.mutate('finalized')}
              >
                <Save size={18} /> {save.isPending ? 'Saving...' : editingId && formStatus === 'finalized' ? 'Update' : 'Save'}
              </button>
            </div>
          }
        />

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-800">Saved Certificates</h2>
              <p className="text-xs text-slate-500">Select a draft or finalized certificate to continue editing</p>
            </div>
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search saved certificates..."
                className="input-field !pl-9 text-sm"
              />
            </div>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-1">
            {isLoading ? (
              <p className="py-6 text-sm text-slate-500">Loading...</p>
            ) : records.length === 0 ? (
              <p className="py-6 text-sm text-slate-500">No saved certificates yet. Use Save as Draft or Save to create one.</p>
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
                  <p className="font-mono text-xs font-semibold text-palawan-700">
                    {record.control_number}
                    {record.status === 'draft' && (
                      <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">DRAFT</span>
                    )}
                  </p>
                  <p className="mt-1 truncate font-medium text-slate-900">{record.requester_name}</p>
                  <p className="truncate text-xs text-slate-500">to {record.recipient_name || '—'}</p>
                </button>
              ))
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
            {(listPage?.last_page ?? 1) > 1 ? (
              <Pagination currentPage={listPage?.current_page ?? 1} lastPage={listPage?.last_page ?? 1} onPageChange={setPage} />
            ) : (
              <p className="text-xs text-slate-500">{records.length} certificate(s)</p>
            )}
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Delete this certificate?')) {
                    remove.mutate(editingId);
                  }
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700"
              >
                <Trash2 size={14} /> Delete selected
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(300px,360px)_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <ScrollText size={18} className="text-palawan-700" />
                <h2 className="text-sm font-bold text-slate-800">Certificate Details</h2>
              </div>

              <div className="space-y-4">
                <section>
                  <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">Document</h3>
                  <div className="grid gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Control No.</label>
                      <input
                        readOnly
                        value={form.control_number ?? 'Auto on save'}
                        className="input-field bg-slate-50 font-mono text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600">Date</label>
                      <input
                        type="date"
                        value={form.request_date}
                        onChange={(e) => updateField('request_date', e.target.value)}
                        className="input-field text-sm"
                      />
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">Requester</h3>
                  <div className="grid gap-3">
                    <input
                      placeholder="Full name"
                      value={form.requester_name}
                      onChange={(e) => updateField('requester_name', e.target.value)}
                      className="input-field text-sm"
                    />
                    <input
                      placeholder="Position"
                      value={form.requester_position}
                      onChange={(e) => updateField('requester_position', e.target.value)}
                      className="input-field text-sm"
                    />
                    <input
                      placeholder="Office"
                      value={form.requester_office}
                      onChange={(e) => updateField('requester_office', e.target.value)}
                      className="input-field text-sm"
                    />
                  </div>
                </section>

                <section>
                  <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">Recipient (Temporary Custodian)</h3>
                  <div className="grid gap-3">
                    <input
                      placeholder="Full name"
                      value={form.recipient_name}
                      onChange={(e) => updateField('recipient_name', e.target.value)}
                      className="input-field text-sm"
                    />
                    <input
                      placeholder="Position"
                      value={form.recipient_position}
                      onChange={(e) => updateField('recipient_position', e.target.value)}
                      className="input-field text-sm"
                    />
                    <input
                      placeholder="Office"
                      value={form.recipient_office}
                      onChange={(e) => updateField('recipient_office', e.target.value)}
                      className="input-field text-sm"
                    />
                  </div>
                </section>

                <section>
                  <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">Reason / Duration</h3>
                  <textarea
                    rows={3}
                    value={form.transfer_reason}
                    onChange={(e) => updateField('transfer_reason', e.target.value)}
                    placeholder="e.g. on the duration of my travel to Hong Kong, Macau, Zhuhai and Shenzhen on August 18-21, 2026"
                    className="input-field resize-none text-sm"
                  />
                </section>

                <section>
                  <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">Conformed</h3>
                  <div className="grid gap-3">
                    <input placeholder="Name" value={form.conformed_name} onChange={(e) => updateField('conformed_name', e.target.value)} className="input-field text-sm" />
                    <input placeholder="Position" value={form.conformed_position} onChange={(e) => updateField('conformed_position', e.target.value)} className="input-field text-sm" />
                    <input placeholder="Office" value={form.conformed_office} onChange={(e) => updateField('conformed_office', e.target.value)} className="input-field text-sm" />
                  </div>
                </section>

                <section>
                  <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">Attested By</h3>
                  <div className="grid gap-3">
                    <input placeholder="Name" value={form.attested_name} onChange={(e) => updateField('attested_name', e.target.value)} className="input-field text-sm" />
                    <input placeholder="Position" value={form.attested_position} onChange={(e) => updateField('attested_position', e.target.value)} className="input-field text-sm" />
                    <input placeholder="Office" value={form.attested_office} onChange={(e) => updateField('attested_office', e.target.value)} className="input-field text-sm" />
                  </div>
                </section>

                <section>
                  <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">Approved By</h3>
                  <div className="grid gap-3">
                    <input placeholder="Name" value={form.approved_name} onChange={(e) => updateField('approved_name', e.target.value)} className="input-field text-sm" />
                    <input placeholder="Position" value={form.approved_position} onChange={(e) => updateField('approved_position', e.target.value)} className="input-field text-sm" />
                  </div>
                </section>
              </div>
            </div>
          </aside>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-500">
              Document Preview
            </div>
            <DocumentPreview form={form} />
          </section>
        </div>
      </div>
    </div>
  );
}
