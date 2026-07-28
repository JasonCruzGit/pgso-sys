import { escapeHtml, dualLogoPrintLetterhead, openGovernmentPrintWindow } from './governmentPrint';
import type { AcceptanceInspectionReport } from '../types';
import { BRANDING } from '../constants/branding';

function formatMoney(value?: number | string) {
  const n = Number(value ?? 0);
  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value?: string) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-PH', { dateStyle: 'long' });
}

function coaBlock(report: AcceptanceInspectionReport) {
  const poNumber = report.po_number ?? report.purchase_order?.po_number ?? '—';
  const supplier = report.purchase_order?.supplier?.name ?? '—';
  const projectName =
    report.remarks_for_use_of
    ?? report.purchase_order?.purchase_request?.title
    ?? report.purchase_order?.purchase_request?.description
    ?? '—';
  const amount = report.amount ?? report.purchase_order?.total_amount ?? 0;
  const inspectionPeriod = report.inspection_date ? formatDate(report.inspection_date) : '—';
  const endUser = report.requisitioning_office ?? report.purchase_order?.purchase_request?.department?.name ?? '—';

  const letterhead = dualLogoPrintLetterhead({
    showCity: true,
    officeTitle: BRANDING.gsoOfficeTitle,
    provinceLine: BRANDING.lguName,
    includeDivider: false,
  });

  return `
    <div class="coa-doc">
      ${letterhead}
      <div class="coa-meta">
        <div class="coa-meta-row"><span class="label">Date:</span> <span class="line"></span></div>
        <div class="coa-meta-row"><span class="label">CN:</span> <span class="line"></span></div>
      </div>

      <div class="coa-to">
        <p class="name"><strong>RUDOLPH M. GARRAEZ</strong></p>
        <p>State Auditor IV</p>
        <p>Audit Team Leader</p>
        <p>Commission on Audit</p>
        <p>Provincial Auditor's Office</p>
      </div>

      <p class="coa-body">
        Dear Mr. Garraez:
      </p>
      <p class="coa-body">
        We are pleased to notify you on the schedule delivery of goods described as follows: (Copy-attached Purchase Order).
      </p>

      <table class="coa-table">
        <tr>
          <td class="k">Project Reference No. :</td>
          <td class="v"><span class="fill">${escapeHtml(poNumber)}</span></td>
        </tr>
        <tr>
          <td class="k">Supplier :</td>
          <td class="v"><span class="fill">${escapeHtml(supplier)}</span></td>
        </tr>
        <tr>
          <td class="k">Name of Project :</td>
          <td class="v"><span class="fill">${escapeHtml(projectName)}</span></td>
        </tr>
        <tr>
          <td class="k">Amount of Project :</td>
          <td class="v"><span class="fill">${escapeHtml(formatMoney(amount))}</span></td>
        </tr>
        <tr>
          <td class="k">Period of Inspection :</td>
          <td class="v"><span class="fill">${escapeHtml(inspectionPeriod)}</span></td>
        </tr>
        <tr>
          <td class="k">End-User :</td>
          <td class="v"><span class="fill">${escapeHtml(endUser)}</span></td>
        </tr>
      </table>

      <div class="coa-footer">
        <div class="left">
          <p>Thank you.</p>
          <div class="sign">
            <div class="row"><span class="k2">Received by:</span> <span class="line"></span></div>
            <div class="row"><span class="k2">Received Date:</span> <span class="line"></span></div>
          </div>
        </div>
        <div class="right">
          <p>Very truly yours,</p>
          <p class="sig-name"><strong>MERCY M. BONTAO, MPA</strong></p>
          <p class="sig-role">Acting PGSO</p>
        </div>
      </div>
    </div>
  `;
}

export function openCoaRequestPrintPreview(report: AcceptanceInspectionReport) {
  const content = `
    <style>
      .coa-doc { font-family: Arial, sans-serif; font-size: 12px; color: #111; }
      .gov-letterhead { padding: 0 44px; margin-bottom: 6px; }
      .coa-meta { display: flex; justify-content: flex-end; margin-top: 6px; }
      .coa-meta-row { display: flex; gap: 8px; align-items: center; margin-left: 22px; }
      .coa-meta .label { min-width: 34px; font-weight: 700; }
      .coa-meta .line { display: inline-block; width: 160px; border-bottom: 1px solid #111; height: 14px; }
      .coa-to { margin-top: 14px; line-height: 1.35; }
      .coa-to .name { margin: 0 0 4px; }
      .coa-to p { margin: 0; }
      .coa-body { margin: 14px 0 0; line-height: 1.45; }
      .coa-table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      .coa-table td { padding: 6px 0; vertical-align: top; }
      .coa-table .k { width: 200px; padding-right: 10px; }
      .coa-table .v { border-bottom: 2px solid #111; }
      .coa-table .fill { font-weight: 700; letter-spacing: 0.2px; }
      .coa-footer { display: flex; justify-content: space-between; gap: 18px; margin-top: 16px; }
      .coa-footer .left { flex: 1; }
      .coa-footer .right { width: 260px; text-align: center; }
      .coa-footer p { margin: 0; }
      .coa-footer .sign { margin-top: 18px; }
      .coa-footer .row { display: flex; gap: 8px; align-items: center; margin-top: 10px; }
      .coa-footer .k2 { min-width: 96px; }
      .coa-footer .line { flex: 1; border-bottom: 1px solid #111; height: 14px; }
      .coa-footer .sig-name { margin-top: 24px; }
      .coa-footer .sig-role { margin-top: 2px; }
      .coa-cut { margin: 20px 0; border: 0; border-top: 1px dashed #999; }
      @media print { .coa-cut { page-break-after: avoid; } }
    </style>
    ${coaBlock(report)}
    <hr class="coa-cut" />
    ${coaBlock(report)}
  `;

  openGovernmentPrintWindow(`${report.air_number} — COA Request`, content);
}

