import type { TrackedDocument } from '../types';
import { BRANDING } from '../constants/branding';
import { dualLogoPrintLetterhead, escapeHtml, openGovernmentPrintWindow } from './governmentPrint';

export type DailyReportRow = {
  controlNo: string;
  origin: string;
  particular: string;
  admin: string;
  endUser: string;
};

const ROWS_PER_PAGE = 12;

const DAILY_REPORT_STYLES = `
  .daily-report {
    font-family: Arial, Helvetica, sans-serif;
  }
  .daily-report .gov-letterhead-text .office {
    font-size: 13px;
    font-weight: 700;
  }
  .daily-title {
    text-align: center;
    margin: 4px 0 14px;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 0.02em;
  }
  .daily-meta {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 12px;
    font-size: 13px;
  }
  .daily-meta .label {
    font-weight: 700;
    margin-right: 6px;
  }
  .daily-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
  }
  .daily-table th,
  .daily-table td {
    border: 1px solid #222;
    padding: 6px 7px;
    vertical-align: top;
  }
  .daily-table th {
    background: #f3f4f6;
    font-size: 11px;
    font-weight: 700;
    text-align: left;
  }
  .daily-table th.num,
  .daily-table td.num {
    width: 36px;
    text-align: center;
  }
  .daily-table th.ctrl,
  .daily-table td.ctrl {
    width: 92px;
    white-space: nowrap;
    font-family: ui-monospace, Menlo, Consolas, monospace;
    font-size: 10px;
  }
  .daily-table th.origin,
  .daily-table td.origin {
    width: 140px;
  }
  .daily-table th.admin,
  .daily-table td.admin,
  .daily-table th.enduser,
  .daily-table td.enduser {
    width: 110px;
  }
  .daily-footer {
    margin-top: 14px;
    padding-top: 8px;
    border-top: 1px solid #ccc;
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 10px;
    color: #555;
  }
  @media print {
    .print-page {
      border: none !important;
      padding: 12px 16px !important;
    }
  }
`;

function formatLongDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function buildParticular(doc: TrackedDocument): string {
  const parts = [
    doc.title?.trim(),
    doc.document_type ? String(doc.document_type).replace(/_/g, ' ').toUpperCase() : '',
    doc.department?.name?.trim(),
    doc.instruction_task?.trim() || doc.description?.trim() || '',
  ].filter(Boolean);
  return parts.join(' - ') || '—';
}

export function mapDocumentsToDailyReportRows(documents: TrackedDocument[]): DailyReportRow[] {
  return documents.map((doc) => ({
    controlNo: doc.reference_no || '—',
    origin: doc.sender_name?.trim() || doc.creator?.name?.trim() || '—',
    particular: buildParticular(doc),
    admin: doc.responsible?.name?.trim() || '',
    endUser: doc.recipient_name?.trim() || doc.instruction_for?.trim() || doc.department?.name?.trim() || '',
  }));
}

function chunkRows<T>(rows: T[], size: number): T[][] {
  if (rows.length === 0) return [[]];
  const pages: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    pages.push(rows.slice(i, i + size));
  }
  return pages;
}

export function openDocumentDailyReportPrint(options: {
  reportDateLabel: string;
  mode: string;
  rows: DailyReportRow[];
}) {
  const letterhead = dualLogoPrintLetterhead({
    showCity: true,
    officeTitle: BRANDING.gsoOfficeTitle,
    provinceLine: BRANDING.lguName,
    includeDivider: true,
  });

  const pages = chunkRows(options.rows, ROWS_PER_PAGE);
  const totalPages = pages.length;
  const modeLabel = escapeHtml(options.mode || 'ALL');
  const dateLabel = escapeHtml(options.reportDateLabel);

  const pagesHtml = pages.map((pageRows, pageIndex) => {
    const startIndex = pageIndex * ROWS_PER_PAGE;
    const body = pageRows.length === 0
      ? `<tr><td colspan="6" style="text-align:center;padding:18px;color:#666">No documents for this report.</td></tr>`
      : pageRows.map((row, i) => `
          <tr>
            <td class="num">${startIndex + i + 1}</td>
            <td class="ctrl">${escapeHtml(row.controlNo)}</td>
            <td class="origin">${escapeHtml(row.origin)}</td>
            <td>${escapeHtml(row.particular)}</td>
            <td class="admin">${escapeHtml(row.admin)}</td>
            <td class="enduser">${escapeHtml(row.endUser)}</td>
          </tr>
        `).join('');

    return `
      <div class="print-page daily-report">
        ${letterhead}
        <h1 class="daily-title">Daily Report</h1>
        <div class="daily-meta">
          <div><span class="label">Date:</span>${dateLabel}</div>
          <div><span class="label">Selected Mode:</span>${modeLabel}</div>
        </div>
        <table class="daily-table">
          <thead>
            <tr>
              <th class="num">#</th>
              <th class="ctrl">Control No</th>
              <th class="origin">Origin</th>
              <th>Particular</th>
              <th class="admin">Admin</th>
              <th class="enduser">End-User</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
        <div class="daily-footer">
          <span>Generated by ${escapeHtml(BRANDING.printFooter)} — Document Tracking</span>
          <span>Page ${pageIndex + 1} of ${totalPages}</span>
        </div>
      </div>
    `;
  }).join('');

  openGovernmentPrintWindow('Daily Report', pagesHtml, DAILY_REPORT_STYLES);
}

export function formatDailyReportDateLabel(from: string, to: string): string {
  if (from && to && from === to) return formatLongDate(from);
  if (from && to) return `${formatLongDate(from)} – ${formatLongDate(to)}`;
  return formatLongDate(to || from || new Date().toISOString().slice(0, 10));
}
