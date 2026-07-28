import { useMemo, useState } from 'react';
import { CalendarDays, Lock, Save, Shield, X } from 'lucide-react';
import type { Department } from '../types';

export type DocumentTaskFormValues = {
  direction: 'incoming' | 'outgoing';
  is_confidential: boolean;
  reference_no: string;
  document_type: string;
  department_id: string;
  title: string;
  event_at: string;
};

type Props = {
  title?: string;
  subtitle?: string;
  values: DocumentTaskFormValues;
  onChange: (next: DocumentTaskFormValues) => void;
  departments: Department[];
  controlSuggestions?: string[];
  referencePlaceholder?: string;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: () => void;
};

const TYPE_CHIPS = ['EO', 'MO', 'Letter', 'Endorsement', 'Memo', 'Indorsement'];

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
      {children}
      {required && <span className="ml-0.5 text-rose-500">*</span>}
    </label>
  );
}

export default function DocumentTaskFormModal({
  title = 'New Task',
  subtitle = 'Log routing details for this document',
  values,
  onChange,
  departments,
  controlSuggestions = [],
  referencePlaceholder = 'Control number',
  submitting = false,
  onClose,
  onSubmit,
}: Props) {
  const [suggestOpen, setSuggestOpen] = useState(false);

  const suggestions = useMemo(() => {
    const q = values.reference_no.trim().toLowerCase();
    const filtered = q
      ? controlSuggestions.filter((r) => r.toLowerCase().includes(q))
      : controlSuggestions;
    return [...new Set(filtered)].slice(0, 8);
  }, [controlSuggestions, values.reference_no]);

  const set = <K extends keyof DocumentTaskFormValues>(key: K, value: DocumentTaskFormValues[K]) => {
    onChange({ ...values, [key]: value });
  };

  const stampNow = () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    set(
      'event_at',
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`,
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(92vh,44rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-slate-200/80 bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative shrink-0 overflow-hidden border-b border-palawan-800/10 bg-gradient-to-br from-palawan-700 via-palawan-600 to-palawan-800 px-5 py-4 text-white">
          <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-10 right-10 h-24 w-24 rounded-full bg-palawan-accent/20" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-palawan-100/80">Document tracking</p>
              <h3 className="mt-0.5 text-lg font-bold tracking-tight">{title}</h3>
              <p className="mt-0.5 text-xs text-palawan-100/85">{subtitle}</p>
            </div>
            <button
              type="button"
              className="rounded-lg p-1.5 text-white/70 transition hover:bg-white/15 hover:text-white"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5">
                {(['incoming', 'outgoing'] as const).map((mode) => {
                  const active = values.direction === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => set('direction', mode)}
                      className={`rounded-[0.65rem] px-3.5 py-1.5 text-xs font-semibold capitalize transition ${
                        active
                          ? 'bg-white text-palawan-800 shadow-sm ring-1 ring-slate-200/80'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {mode}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => set('is_confidential', !values.is_confidential)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                  values.is_confidential
                    ? 'border-amber-300 bg-amber-50 text-amber-800'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
                }`}
              >
                {values.is_confidential ? <Lock size={13} /> : <Shield size={13} />}
                Confidential
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="relative sm:col-span-1">
                <FieldLabel>Control No</FieldLabel>
                <input
                  className="input-field w-full font-mono text-sm"
                  value={values.reference_no}
                  placeholder={referencePlaceholder}
                  onFocus={() => setSuggestOpen(true)}
                  onBlur={() => setTimeout(() => setSuggestOpen(false), 150)}
                  onChange={(e) => {
                    set('reference_no', e.target.value);
                    setSuggestOpen(true);
                  }}
                />
                {suggestOpen && suggestions.length > 0 && (
                  <ul className="absolute z-20 mt-1 max-h-36 w-full overflow-auto rounded-xl border border-slate-700 bg-slate-900 py-1 text-sm text-slate-100 shadow-xl">
                    {suggestions.map((ref) => (
                      <li key={ref}>
                        <button
                          type="button"
                          className="block w-full px-3 py-1.5 text-left font-mono hover:bg-slate-700"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            set('reference_no', ref);
                            setSuggestOpen(false);
                          }}
                        >
                          {ref}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <FieldLabel>Document Type</FieldLabel>
                <input
                  className="input-field w-full text-sm"
                  value={values.document_type}
                  onChange={(e) => set('document_type', e.target.value)}
                  placeholder="EO, MO, Letter…"
                  list="doc-task-type-suggestions"
                />
                <datalist id="doc-task-type-suggestions">
                  {TYPE_CHIPS.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {TYPE_CHIPS.map((chip) => {
                    const active = values.document_type.toLowerCase() === chip.toLowerCase();
                    return (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => set('document_type', chip)}
                        className={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition ${
                          active
                            ? 'bg-palawan-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {chip}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div>
              <FieldLabel>Document Origin</FieldLabel>
              <select
                className="input-field w-full text-sm"
                value={values.department_id}
                onChange={(e) => set('department_id', e.target.value)}
              >
                <option value="">Select Office</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
                ))}
              </select>
            </div>

            <div>
              <FieldLabel required>Particular</FieldLabel>
              <textarea
                required
                rows={3}
                className="input-field w-full resize-y text-sm leading-relaxed"
                value={values.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="Title, particular, or subject matter for searching this document"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Used for search and the task timeline entry.
              </p>
            </div>

            <div>
              <FieldLabel>Date and Time</FieldLabel>
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <CalendarDays
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="datetime-local"
                    className="input-field w-full pl-9 text-sm"
                    value={values.event_at}
                    onChange={(e) => set('event_at', e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  onClick={stampNow}
                  className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:border-palawan-300 hover:bg-palawan-50 hover:text-palawan-800"
                >
                  Now
                </button>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 px-5 py-3.5">
            <button
              type="button"
              className="text-sm font-medium text-slate-500 transition hover:text-slate-800"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-palawan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-palawan-600/20 transition hover:bg-palawan-700 disabled:opacity-60"
              disabled={submitting}
            >
              <Save size={15} />
              {submitting ? 'Saving…' : 'Submit form'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
