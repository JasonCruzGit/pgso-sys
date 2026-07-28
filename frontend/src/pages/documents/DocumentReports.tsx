import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileText, Printer, Search, X } from 'lucide-react';
import api from '../../api/client';
import PageHeader from '../../components/PageHeader';
import type { TrackedDocument } from '../../types';
import toast from 'react-hot-toast';
import {
  formatDailyReportDateLabel,
  mapDocumentsToDailyReportRows,
  openDocumentDailyReportPrint,
} from '../../utils/documentDailyReportPrint';

type ReportPayload = {
  from: string;
  to: string;
  documents: TrackedDocument[];
};

type ReportMode = 'INVENTORY' | 'ALL';

function particularPreview(doc: TrackedDocument): string {
  return [
    doc.title?.trim(),
    doc.document_type ? String(doc.document_type).replace(/_/g, ' ') : '',
    doc.department?.name?.trim(),
    doc.instruction_task?.trim() || doc.description?.trim() || '',
  ].filter(Boolean).join(' — ') || '—';
}

export default function DocumentReports() {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [mode, setMode] = useState<ReportMode>('INVENTORY');
  const [queryEnabled, setQueryEnabled] = useState(false);
  const [appliedFrom, setAppliedFrom] = useState(today);
  const [appliedTo, setAppliedTo] = useState(today);
  const [appliedMode, setAppliedMode] = useState<ReportMode>('INVENTORY');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [exportingPdf, setExportingPdf] = useState(false);

  const { data, isFetching, isFetched } = useQuery({
    queryKey: ['documents-report', appliedFrom, appliedTo],
    queryFn: () => api.get('/documents/report', {
      params: { from: appliedFrom, to: appliedTo },
    }).then((r) => r.data as ReportPayload),
    enabled: queryEnabled,
  });

  const documents = data?.documents ?? [];

  const filteredDocs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter((d) =>
      [
        d.reference_no,
        d.title,
        d.sender_name,
        d.recipient_name,
        d.document_type,
        d.department?.name,
        d.description,
        d.instruction_task,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [documents, search]);

  // Reset selection when a new report is loaded (not on search typing).
  useEffect(() => {
    if (!data) return;
    setSelectedIds(data.documents.map((d) => d.id));
  }, [data]);

  const selectedDocs = useMemo(
    () => filteredDocs.filter((d) => selectedIds.includes(d.id)),
    [filteredDocs, selectedIds],
  );

  const allVisibleSelected = filteredDocs.length > 0 && filteredDocs.every((d) => selectedIds.includes(d.id));

  const generateReport = () => {
    if (!from || !to) {
      toast.error('Select a date range');
      return;
    }
    if (from > to) {
      toast.error('From date must be on or before To date');
      return;
    }
    setAppliedFrom(from);
    setAppliedTo(to);
    setAppliedMode(mode);
    setSearch('');
    setQueryEnabled(true);
  };

  const toggleOne = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectAll = () => setSelectedIds(filteredDocs.map((d) => d.id));
  const unselectAll = () => setSelectedIds([]);

  const printReport = () => {
    if (selectedDocs.length === 0) {
      toast.error('Select at least one record to print');
      return;
    }
    openDocumentDailyReportPrint({
      reportDateLabel: formatDailyReportDateLabel(appliedFrom, appliedTo),
      mode: appliedMode,
      rows: mapDocumentsToDailyReportRows(selectedDocs),
    });
  };

  const generatePdf = async () => {
    if (selectedDocs.length === 0) {
      toast.error('Select at least one record to export');
      return;
    }
    setExportingPdf(true);
    try {
      const response = await api.post(
        '/documents/report/pdf',
        {
          ids: selectedDocs.map((d) => d.id),
          from: appliedFrom,
          to: appliedTo,
          mode: appliedMode,
        },
        { responseType: 'blob' },
      );
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `Daily-Report-${appliedFrom}-to-${appliedTo}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('PDF downloaded');
    } catch {
      toast.error('Failed to generate PDF');
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Generate a Daily Report by date range, then choose which records to print or download"
      />

      <div className="card w-full overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-palawan-600" />
            <h2 className="text-lg font-bold text-slate-900">Daily Report</h2>
          </div>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">From date</label>
              <input
                type="date"
                className="input-field w-full"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">To date</label>
              <input
                type="date"
                className="input-field w-full"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Include the document’s upload / received date (e.g. Jul 14, 2026 for current records), then click Generate Report.
          </p>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Mode:</p>
            <div className="flex flex-wrap gap-4">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="report-mode"
                  checked={mode === 'INVENTORY'}
                  onChange={() => setMode('INVENTORY')}
                  className="text-palawan-600 focus:ring-palawan-500"
                />
                Inventory
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="radio"
                  name="report-mode"
                  checked={mode === 'ALL'}
                  onChange={() => setMode('ALL')}
                  className="text-palawan-600 focus:ring-palawan-500"
                />
                All
              </label>
            </div>
          </div>

          <button
            type="button"
            className="btn-primary"
            onClick={generateReport}
            disabled={isFetching}
          >
            {isFetching ? 'Loading…' : 'Generate Report'}
          </button>

          {(queryEnabled || isFetched) && (
            <>
              <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative min-w-0 flex-1 sm:max-w-md">
                  <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search record…"
                    className="input-field w-full !pl-9"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100"
                      aria-label="Clear search"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className="btn-secondary text-sm" onClick={selectAll} disabled={filteredDocs.length === 0}>
                    Select All
                  </button>
                  <button type="button" className="btn-secondary text-sm" onClick={unselectAll} disabled={selectedIds.length === 0}>
                    Unselect All
                  </button>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200">
                {isFetching ? (
                  <p className="px-4 py-10 text-center text-sm text-slate-500">Loading records…</p>
                ) : filteredDocs.length === 0 ? (
                  <p className="px-4 py-10 text-center text-sm text-slate-500">
                    No records found for this date range{search ? ' and search' : ''}.
                  </p>
                ) : (
                  <div className="max-h-[min(55vh,420px)] overflow-y-auto">
                    <table className="table-zebra min-w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="w-10 px-3 py-2.5">
                            <input
                              type="checkbox"
                              checked={allVisibleSelected}
                              onChange={() => (allVisibleSelected ? unselectAll() : selectAll())}
                              className="rounded border-slate-300 text-palawan-600 focus:ring-palawan-500"
                              aria-label="Select all visible"
                            />
                          </th>
                          <th className="px-3 py-2.5">Control No</th>
                          <th className="px-3 py-2.5">Particular</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDocs.map((doc) => {
                          const checked = selectedIds.includes(doc.id);
                          return (
                            <tr key={doc.id} className="cursor-pointer" onClick={() => toggleOne(doc.id)}>
                              <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleOne(doc.id)}
                                  className="rounded border-slate-300 text-palawan-600 focus:ring-palawan-500"
                                />
                              </td>
                              <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs font-semibold text-palawan-700">
                                {doc.reference_no}
                              </td>
                              <td className="px-3 py-2.5 text-slate-700">
                                <p className="leading-snug">{particularPreview(doc)}</p>
                                {doc.sender_name && (
                                  <p className="mt-0.5 text-xs text-slate-500">Origin: {doc.sender_name}</p>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-600">
                  Selected:{' '}
                  <span className="font-semibold text-slate-900">
                    {selectedDocs.length} of {filteredDocs.length}
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={printReport}
                    disabled={selectedDocs.length === 0}
                  >
                    <Printer size={16} /> Print Report
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => void generatePdf()}
                    disabled={selectedDocs.length === 0 || exportingPdf}
                  >
                    <Download size={16} /> {exportingPdf ? 'Generating…' : 'Generate PDF'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
