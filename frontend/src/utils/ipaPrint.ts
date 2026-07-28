import { escapeHtml, formatPrintMoney, governmentPrintLetterhead, openGovernmentPrintWindow } from './governmentPrint';
import { BRANDING } from '../constants/branding';

export type IpaPrintEmployee = {
  name: string;
  employee_id?: string | null;
  designation?: string | null;
  department?: string | null;
};

export type IpaPrintProperty = {
  property_number: string;
  reference_number: string;
  document_type: string;
  description: string;
  date_acquired?: string | null;
  quantity: number | string;
  unit_of_measure: string;
  unit_value: number | string;
  total_value: number | string;
  status: string;
};

export type IpaPrintSummary = {
  total: number;
  active: number;
  surrendered: number;
  total_value: number;
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatStatus(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildIpaListDocument(
  employee: IpaPrintEmployee,
  properties: IpaPrintProperty[],
  summary: IpaPrintSummary,
  viewLabel: string,
) {
  const rows = properties.map((row) => `
    <tr>
      <td class="mono">${escapeHtml(row.property_number)}</td>
      <td class="mono">${escapeHtml(row.reference_number)}</td>
      <td class="center"><span class="type type--${row.document_type.toLowerCase()}">${escapeHtml(row.document_type)}</span></td>
      <td>${escapeHtml(row.description)}</td>
      <td class="nowrap">${escapeHtml(formatDate(row.date_acquired))}</td>
      <td class="num">${escapeHtml(String(row.quantity))}</td>
      <td>${escapeHtml(row.unit_of_measure)}</td>
      <td class="num">${escapeHtml(formatPrintMoney(Number(row.unit_value)))}</td>
      <td class="num strong">${escapeHtml(formatPrintMoney(Number(row.total_value)))}</td>
      <td class="center">${escapeHtml(formatStatus(row.status))}</td>
    </tr>
  `).join('');

  return `
    <div class="ipa-doc">
      ${governmentPrintLetterhead()}
      <div class="ipa-title-row">
        <div class="ipa-title-block">
          <h1>Individual Property Accountability</h1>
          <p class="subtitle">Property records assigned to employee</p>
        </div>
        <div class="ipa-meta">
          <p><strong>Generated:</strong> ${escapeHtml(new Date().toLocaleString('en-PH'))}</p>
          <p><strong>View:</strong> ${escapeHtml(viewLabel)}</p>
        </div>
      </div>

      <div class="ipa-employee">
        <div class="field"><span class="label">Employee No.</span><span class="value mono">${escapeHtml(employee.employee_id ?? '—')}</span></div>
        <div class="field"><span class="label">Employee Name</span><span class="value">${escapeHtml(employee.name)}</span></div>
        <div class="field"><span class="label">Designation</span><span class="value">${escapeHtml(employee.designation ?? '—')}</span></div>
        <div class="field"><span class="label">Department</span><span class="value">${escapeHtml(employee.department ?? '—')}</span></div>
      </div>

      <div class="ipa-summary">
        <span class="pill">${summary.total} total</span>
        <span class="pill pill--active">${summary.active} active</span>
        <span class="pill pill--muted">${summary.surrendered} surrendered</span>
        <span class="pill pill--value">${escapeHtml(formatPrintMoney(summary.total_value))} total value</span>
      </div>

      <table class="ipa-table">
        <thead>
          <tr>
            <th>Property No.</th>
            <th>Reference No.</th>
            <th>Type</th>
            <th>Description</th>
            <th>Date Acquired</th>
            <th>Qty</th>
            <th>Unit</th>
            <th>Unit Value</th>
            <th>Total Value</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="10" class="empty">No property records.</td></tr>'}
        </tbody>
      </table>

      <div class="ipa-footer">
        <p>${escapeHtml(BRANDING.printFooter)}</p>
      </div>
    </div>
  `;
}

const IPA_PRINT_STYLES = `
  .ipa-doc { font-family: Arial, sans-serif; font-size: 11px; color: #111; }
  .ipa-title-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 14px;
    padding-bottom: 10px;
    border-bottom: 1px solid #cbd5e1;
  }
  .ipa-title-block { flex: 1; text-align: center; }
  .ipa-title-block h1 { margin: 0; font-size: 16px; letter-spacing: 0.04em; text-transform: uppercase; color: #006633; }
  .ipa-title-block .subtitle { margin: 4px 0 0; font-size: 10px; color: #555; }
  .ipa-meta { text-align: right; font-size: 10px; line-height: 1.5; }
  .ipa-meta p { margin: 0; }
  .ipa-employee {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin-bottom: 12px;
  }
  .ipa-employee .field {
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 8px 10px;
    background: #f8fafc;
  }
  .ipa-employee .label {
    display: block;
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #64748b;
    margin-bottom: 4px;
  }
  .ipa-employee .value { font-size: 11px; font-weight: 700; color: #0f172a; }
  .ipa-summary { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
  .pill {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 700;
    background: #f1f5f9;
    color: #334155;
  }
  .pill--active { background: #dcfce7; color: #166534; }
  .pill--muted { background: #f1f5f9; color: #64748b; }
  .pill--value { background: #ecfdf5; color: #047857; }
  .ipa-table { width: 100%; border-collapse: collapse; font-size: 10px; }
  .ipa-table th {
    background: #006633;
    color: #fff;
    padding: 7px 6px;
    text-align: left;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .ipa-table td { border: 1px solid #cbd5e1; padding: 6px; vertical-align: top; }
  .ipa-table tr:nth-child(even) td { background: #f8fafc; }
  .ipa-table .mono { font-family: Consolas, monospace; font-size: 9px; }
  .ipa-table .num { text-align: right; white-space: nowrap; }
  .ipa-table .center { text-align: center; }
  .ipa-table .strong { font-weight: 700; }
  .ipa-table .nowrap { white-space: nowrap; }
  .ipa-table .empty { text-align: center; color: #64748b; padding: 20px; }
  .type {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 999px;
    font-size: 8px;
    font-weight: 700;
  }
  .type--par { background: #ede9fe; color: #6d28d9; }
  .type--ics { background: #fef3c7; color: #b45309; }
  .ipa-footer {
    margin-top: 16px;
    padding-top: 10px;
    border-top: 1px solid #cbd5e1;
    font-size: 9px;
    color: #64748b;
    text-align: center;
  }
  @media print {
    .ipa-table tr { page-break-inside: avoid; break-inside: avoid; }
  }
`;

export function openIpaListPrintPreview(
  employee: IpaPrintEmployee,
  properties: IpaPrintProperty[],
  summary: IpaPrintSummary,
  viewLabel = 'All',
) {
  const content = `
    <style>${IPA_PRINT_STYLES}</style>
    ${buildIpaListDocument(employee, properties, summary, viewLabel)}
  `;

  const slug = employee.employee_id ?? employee.name.replace(/\s+/g, '-');
  openGovernmentPrintWindow(`${slug} — Individual Property Accountability`, content);
}

export function buildIpaListHtml(
  employee: IpaPrintEmployee,
  properties: IpaPrintProperty[],
  summary: IpaPrintSummary,
  viewLabel = 'All',
) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${IPA_PRINT_STYLES}</style></head><body>${buildIpaListDocument(employee, properties, summary, viewLabel)}</body></html>`;
}
