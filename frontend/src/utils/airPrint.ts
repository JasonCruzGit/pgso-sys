import type { AcceptanceInspectionItem } from '../types';
import { BRANDING } from '../constants/branding';
import {
  escapeHtml,
  formatPrintMoney,
  formatPrintQty,
  dualLogoPrintLetterhead,
  openGovernmentPrintWindow,
  AIR_PRINT_STYLES,
} from './governmentPrint';

export type AirPrintData = {
  air_number: string;
  supplier?: string;
  po_number?: string;
  po_date?: string;
  invoice_number?: string;
  invoice_date?: string;
  requisitioning_office?: string;
  obligation_request_no?: string;
  remarks_for_use_of?: string;
  remarks?: string;
  abc_amount?: number | string;
  amount?: number | string;
  acceptance_date?: string;
  inspection_date?: string;
  acceptance_complete?: boolean;
  acceptance_partial?: boolean;
  acceptance_spec_accepted?: boolean;
  inspection_correct?: boolean;
  property_officer?: string;
  inspection_officer?: string;
  items?: AcceptanceInspectionItem[];
};

function formatDateLong(value?: string) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-PH', { dateStyle: 'long' });
}

function airPrintLetterhead(): string {
  return dualLogoPrintLetterhead({
    showCity: true,
    officeTitle: BRANDING.gsoOfficeTitle,
    provinceLine: BRANDING.lguName,
    includeDivider: false,
  });
}

function airItemsTableHeader(): string {
  return `
    <thead>
      <tr>
        <th class="center" style="width:6%">Item No.</th>
        <th class="center" style="width:8%">Unit</th>
        <th>Description</th>
        <th class="center" style="width:8%">Quantity</th>
        <th class="num" style="width:12%">Unit Price</th>
        <th class="num" style="width:12%">Total Price</th>
      </tr>
    </thead>
  `;
}

function renderItemRows(
  items: AcceptanceInspectionItem[],
  startIndex: number,
  padToMinRows = 0,
): string {
  const rowCount = Math.max(padToMinRows, items.length);
  return Array.from({ length: rowCount }, (_, index) => {
    const item = items[index];
    const itemNo = startIndex + index + 1;
    return `
      <tr>
        <td class="center">${item ? itemNo : ''}</td>
        <td class="center">${escapeHtml((item?.unit_of_measure ?? '').toUpperCase())}</td>
        <td>${escapeHtml(item?.description ?? '')}</td>
        <td class="center">${item ? formatPrintQty(item.quantity_accepted ?? 0) : ''}</td>
        <td class="num">${item ? formatPrintMoney(Number(item.unit_cost ?? 0)) : ''}</td>
        <td class="num">${item ? formatPrintMoney(Number(item.quantity_accepted ?? 0) * Number(item.unit_cost ?? 0)) : ''}</td>
      </tr>
    `;
  }).join('');
}

function airInfoTable(data: AirPrintData): string {
  return `
    <table class="info-table" style="margin-bottom:10px;">
      <tr>
        <td class="label" style="width:14%">Supplier</td>
        <td colspan="3">${escapeHtml(data.supplier ?? '—')}</td>
        <td class="label" style="width:10%">AIR No.</td>
        <td>${escapeHtml(data.air_number)}</td>
      </tr>
      <tr>
        <td class="label">P.O. No.</td>
        <td>${escapeHtml(data.po_number ?? '—')}</td>
        <td class="label" style="width:8%">Date</td>
        <td>${escapeHtml(formatDateLong(data.po_date))}</td>
        <td class="label">Invoice No.</td>
        <td>${escapeHtml(data.invoice_number ?? '—')}</td>
      </tr>
      <tr>
        <td class="label">Date</td>
        <td>${escapeHtml(formatDateLong(data.invoice_date))}</td>
        <td class="label" colspan="2">Requisitioning Office/Department</td>
        <td colspan="2">${escapeHtml(data.requisitioning_office ?? '—')}</td>
      </tr>
      <tr>
        <td class="label" colspan="2">Obligation Request No.</td>
        <td colspan="2">${escapeHtml(data.obligation_request_no ?? '—')}</td>
        <td class="label">ABC</td>
        <td class="num">${formatPrintMoney(Number(data.abc_amount ?? 0))}</td>
      </tr>
      <tr>
        <td class="label">Amount</td>
        <td class="num" colspan="5"><strong>${formatPrintMoney(Number(data.amount ?? 0))}</strong></td>
      </tr>
    </table>
  `;
}

const FIRST_PAGE_ITEM_ROWS = 16;
const CONTINUATION_PAGE_ITEM_ROWS = 16;
const LAST_PAGE_ITEM_ROWS_WITH_FOOTER = 10;

function airFullPrintHeader(data: AirPrintData, pageNumber: number, totalPages: number): string {
  const pageNote = totalPages > 1
    ? `<p class="air-page-number">Page ${pageNumber} of ${totalPages}</p>`
    : '';
  return `
    ${airPrintLetterhead()}
    <h1 class="doc-title">Acceptance &amp; Inspection Report</h1>
    ${pageNote}
    ${airInfoTable(data)}
  `;
}

type AirPrintPage = {
  kind: 'first' | 'continued' | 'last';
  items: AcceptanceInspectionItem[];
  startIndex: number;
};

function paginateAirItems(items: AcceptanceInspectionItem[]): AirPrintPage[] {
  if (!items.length) {
    return [{ kind: 'last', items: [], startIndex: 0 }];
  }

  const pages: AirPrintPage[] = [];
  let offset = 0;

  const firstItems = items.slice(0, FIRST_PAGE_ITEM_ROWS);
  offset += firstItems.length;

  if (offset >= items.length) {
    return [{ kind: 'last', items: firstItems, startIndex: 0 }];
  }

  pages.push({ kind: 'first', items: firstItems, startIndex: 0 });

  while (offset < items.length) {
    const remaining = items.length - offset;
    if (remaining <= LAST_PAGE_ITEM_ROWS_WITH_FOOTER) break;

    const chunkSize = Math.min(
      CONTINUATION_PAGE_ITEM_ROWS,
      remaining - LAST_PAGE_ITEM_ROWS_WITH_FOOTER,
    );
    if (chunkSize <= 0) break;

    pages.push({
      kind: 'continued',
      items: items.slice(offset, offset + chunkSize),
      startIndex: offset,
    });
    offset += chunkSize;
  }

  pages.push({
    kind: 'last',
    items: items.slice(offset),
    startIndex: offset,
  });

  return pages;
}

function airFooterSection(
  data: AirPrintData,
  generatedAt: string,
  check: (on: boolean) => string,
): string {
  return `
    <table class="info-table" style="margin-top:8px;">
      <tr>
        <td class="label" style="width:12%">REMARKS</td>
        <td colspan="3">For the use of ${escapeHtml(data.remarks_for_use_of ?? '—')}${data.remarks ? `<br/>${escapeHtml(data.remarks)}` : ''}</td>
      </tr>
    </table>
    <div class="signatures" style="margin-top:12px;">
      <div class="sig-block" style="border:1px solid #333;padding:10px;">
        <p style="font-weight:700;text-transform:uppercase;margin:0 0 8px;">Acceptance</p>
        <p style="margin:0 0 6px;font-size:11px;"><strong>Date Received:</strong> ${escapeHtml(formatDateLong(data.acceptance_date))}</p>
        <p style="margin:0 0 4px;font-size:11px;">${check(!!data.acceptance_complete)} Complete</p>
        <p style="margin:0 0 4px;font-size:11px;">${check(!!data.acceptance_partial)} Partial</p>
        <p style="margin:0 0 10px;font-size:11px;">${check(!!data.acceptance_spec_accepted)} Specification Accepted</p>
        <div class="sig-line"></div>
        <p class="sig-name">${escapeHtml(data.property_officer ?? '')}</p>
        <p class="sig-role">Property Officer</p>
      </div>
      <div class="sig-block" style="border:1px solid #333;padding:10px;">
        <p style="font-weight:700;text-transform:uppercase;margin:0 0 8px;">Inspection</p>
        <p style="margin:0 0 6px;font-size:11px;"><strong>Date Inspected:</strong> ${escapeHtml(formatDateLong(data.inspection_date))}</p>
        <p style="margin:0 0 10px;font-size:11px;">${check(!!data.inspection_correct)} Inspected and found correct as to quantity and specification</p>
        <div class="sig-line"></div>
        <p class="sig-name">${escapeHtml(data.inspection_officer ?? '')}</p>
        <p class="sig-role">Inspection Officer</p>
      </div>
    </div>
    <div class="footer">
      <span>${escapeHtml(BRANDING.printFooter)}</span>
      <span>Generated: ${escapeHtml(generatedAt)}</span>
      <span>${escapeHtml(data.air_number)}</span>
    </div>
  `;
}

export function openAirPrintPreview(data: AirPrintData) {
  const items = (data.items ?? []).filter((item) => item.description?.trim());
  const generatedAt = new Date().toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' });
  const lineItemsTotal = items.reduce(
    (sum, item) => sum + Number(item.quantity_accepted ?? 0) * Number(item.unit_cost ?? 0),
    0,
  );
  const printData: AirPrintData = {
    ...data,
    amount: data.amount ?? lineItemsTotal,
    abc_amount: data.abc_amount ?? data.amount ?? lineItemsTotal,
  };
  const check = (on: boolean) => (on ? '☑' : '☐');

  const pages = paginateAirItems(items);
  const totalPages = pages.length;
  const singlePage = totalPages === 1;

  const content = pages.map((page, pageIndex) => {
    const pageNumber = pageIndex + 1;
    const padRows = singlePage ? 30 : 0;
    const itemRows = renderItemRows(page.items, page.startIndex, padRows);

    let pageBody = airFullPrintHeader(printData, pageNumber, totalPages);

    pageBody += `
      <table class="items-table">
        ${airItemsTableHeader()}
        <tbody>${itemRows}</tbody>
      </table>
    `;

    if (page.kind === 'last') {
      pageBody += airFooterSection(printData, generatedAt, check);
    } else {
      pageBody += `
        <div class="air-page-continued-note">— Continued on page ${pageNumber + 1} —</div>
      `;
    }

    return `<div class="print-page">${pageBody}</div>`;
  }).join('');

  openGovernmentPrintWindow(`${data.air_number} — Acceptance and Inspection Report`, content, AIR_PRINT_STYLES);
}
