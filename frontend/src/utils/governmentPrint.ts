import toast from 'react-hot-toast';
import { BRANDING, LOGO_PATH, PGSO_LOGO_PATH } from '../constants/branding';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatPesoAmount(value: number | string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '₱0.00';
  const negative = n < 0;
  const [whole, fraction = '00'] = Math.abs(n).toFixed(2).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}₱${grouped}.${fraction}`;
}

export function parsePesoAmount(raw: string): number {
  const cleaned = raw.replace(/[₱,\s]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function formatPrintMoney(value: number): string {
  return formatPesoAmount(value);
}

export function formatPrintQty(qty: string | number): string {
  const n = Number(qty);
  if (Number.isNaN(n)) return '0';
  return Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(2)));
}

const GOVERNMENT_PRINT_STYLES = `
    * { box-sizing: border-box; }
    body {
      font-family: "Times New Roman", Times, serif;
      color: #111;
      margin: 0;
      padding: 20px;
      background: #e8ecef;
      font-size: 12px;
      line-height: 1.4;
    }
    .toolbar {
      display: flex;
      gap: 8px;
      margin: 0 auto 16px;
      max-width: 816px;
    }
    .toolbar button {
      padding: 8px 16px;
      border: 1px solid #006633;
      background: #fff;
      cursor: pointer;
      font-size: 12px;
      font-family: Arial, sans-serif;
    }
    .toolbar button.primary { background: #006633; color: #fff; }
    .document {
      max-width: 816px;
      margin: 0 auto;
      background: #fff;
      border: 2px solid #006633;
      padding: 28px 32px 32px;
      box-shadow: 0 2px 12px rgba(0,0,0,.08);
    }
    .gov-letterhead {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 8px;
      padding: 0 8px;
    }
    .gov-letterhead-logo-wrap {
      width: 72px;
      height: 72px;
      flex-shrink: 0;
      border-radius: 50%;
      overflow: hidden;
      background: #fff;
    }
    .gov-letterhead-logo {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
      background: #fff;
    }
    .gov-letterhead-logo--pgp { transform: scale(1.08); transform-origin: center; }
    .gov-letterhead-logo--pgso { transform: scale(1.04); transform-origin: center; }
    .gov-letterhead-text {
      flex: 1;
      min-width: 0;
      text-align: center;
      line-height: 1.35;
    }
    .gov-letterhead-text .republic {
      margin: 0; font-size: 11px; letter-spacing: 0.04em; text-transform: uppercase;
    }
    .gov-letterhead-text .province {
      margin: 2px 0 0; font-size: 13px; font-weight: 700; text-transform: uppercase;
    }
    .gov-letterhead-text .office {
      margin: 2px 0 0; font-size: 12px; font-weight: 600;
      color: #006633; text-transform: uppercase;
    }
    .gov-letterhead-text .city {
      margin: 2px 0 0; font-size: 11px;
    }
    .divider { border: none; border-top: 2px solid #006633; margin: 12px 0 14px; }
    .doc-title {
      text-align: center; margin: 0 0 4px; font-size: 15px; font-weight: 700;
      letter-spacing: 0.08em; text-transform: uppercase;
    }
    .doc-subtitle {
      text-align: center; margin: 0 0 16px; font-size: 11px; color: #444;
      text-transform: uppercase; letter-spacing: 0.06em;
    }
    .ref-bar {
      display: flex; justify-content: space-between; gap: 16px;
      border: 1px solid #006633; padding: 8px 12px; margin-bottom: 14px;
      background: #f4faf6; font-size: 11px;
    }
    .ref-bar strong { color: #006633; }
    .info-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px; }
    .info-table td { border: 1px solid #333; padding: 6px 8px; vertical-align: top; }
    .info-table .label {
      width: 22%; background: #f0f0f0; font-weight: 700;
      text-transform: uppercase; font-size: 10px; letter-spacing: 0.03em;
    }
    .section-title {
      margin: 0 0 6px; font-size: 11px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.06em; color: #006633;
    }
    .items-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 12px; }
    .items-table th, .items-table td { border: 1px solid #333; padding: 6px 7px; vertical-align: top; }
    .items-table th {
      background: #006633; color: #fff; font-size: 10px;
      text-transform: uppercase; letter-spacing: 0.04em; font-weight: 700;
    }
    .items-table td.num, .items-table th.num { text-align: right; }
    .items-table td.center, .items-table th.center { text-align: center; }
    .total-box { display: flex; justify-content: flex-end; margin-bottom: 24px; }
    .total-box table { border-collapse: collapse; font-size: 12px; }
    .total-box td { border: 1px solid #333; padding: 8px 14px; }
    .total-box .label {
      background: #f0f0f0; font-weight: 700; text-transform: uppercase; font-size: 10px;
    }
    .total-box .amount {
      font-weight: 700; font-size: 13px; color: #006633; min-width: 140px; text-align: right;
    }
    .signatures {
      display: grid; grid-template-columns: 1fr 1fr; gap: 24px 32px; margin-top: 8px;
    }
    .sig-block { text-align: center; font-size: 11px; }
    .sig-line { border-bottom: 1px solid #111; height: 36px; margin-bottom: 4px; }
    .sig-name { font-weight: 700; text-transform: uppercase; font-size: 11px; }
    .sig-role {
      font-size: 10px; color: #444; text-transform: uppercase; letter-spacing: 0.03em;
    }
    .sig-sub { font-size: 9px; color: #666; margin-top: 2px; }
    .footer {
      margin-top: 20px; padding-top: 10px; border-top: 1px solid #ccc;
      font-size: 9px; color: #666; display: flex; justify-content: space-between; gap: 12px;
    }
    .status-stamp {
      display: inline-block; border: 2px solid #006633; color: #006633;
      padding: 2px 10px; font-size: 10px; font-weight: 700;
      letter-spacing: 0.06em; text-transform: uppercase;
    }
    @media print {
      body { background: #fff; padding: 0; }
      .toolbar { display: none; }
      .document { box-shadow: none; border: none; max-width: none; margin: 0; padding: 0; }
      .print-page {
        page-break-after: always;
        break-after: page;
        border: 1px solid #006633;
        padding: 16px 20px;
        box-sizing: border-box;
      }
      .print-page:last-child {
        page-break-after: auto;
        break-after: auto;
      }
      .items-table tr { page-break-inside: avoid; break-inside: avoid; }
    }
`;

export const AIR_PRINT_STYLES = `
    .document {
      max-width: 816px;
      background: transparent;
      border: none;
      box-shadow: none;
      padding: 0;
    }
    .print-page {
      max-width: 816px;
      margin: 0 auto 24px;
      background: #fff;
      border: 2px solid #006633;
      padding: 28px 32px 32px;
      box-shadow: 0 2px 12px rgba(0,0,0,.08);
    }
    .air-page-number {
      margin: 0 0 8px;
      text-align: right;
      font-size: 10px;
      color: #444;
    }
    .air-page-continued-note {
      margin-top: 8px;
      text-align: center;
      font-size: 10px;
      font-style: italic;
      color: #666;
    }
    .air-letterhead {
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 8px;
    }
    .air-letterhead-logo-wrap {
      width: 72px;
      height: 72px;
      flex-shrink: 0;
      border-radius: 50%;
      overflow: hidden;
      background: #fff;
    }
    .air-letterhead-text {
      flex: 1;
      min-width: 0;
      text-align: center;
      font-size: 11px;
      line-height: 1.35;
    }
    .air-letterhead-logo {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
      border: none;
      background: #fff;
    }
`;

export function dualLogoPrintLetterhead(options?: {
  showCity?: boolean;
  officeTitle?: string;
  provinceLine?: string;
  includeDivider?: boolean;
}): string {
  const leftLogoUrl = `${window.location.origin}${LOGO_PATH}`;
  const rightLogoUrl = `${window.location.origin}${PGSO_LOGO_PATH}`;
  const showCity = options?.showCity ?? false;
  const officeTitle = options?.officeTitle ?? BRANDING.officeName;
  const provinceLine = options?.provinceLine ?? BRANDING.lguName;
  const includeDivider = options?.includeDivider ?? true;

  return `
    <div class="gov-letterhead">
      <div class="gov-letterhead-logo-wrap">
        <img class="gov-letterhead-logo gov-letterhead-logo--pgp" src="${leftLogoUrl}" alt="Province of Palawan" onerror="this.style.display='none'" />
      </div>
      <div class="gov-letterhead-text">
        <p class="republic">${escapeHtml(BRANDING.republic)}</p>
        <p class="province">${escapeHtml(provinceLine)}</p>
        <p class="office">${escapeHtml(officeTitle)}</p>
        ${showCity ? `<p class="city">${escapeHtml(BRANDING.capitalCity)}</p>` : ''}
      </div>
      <div class="gov-letterhead-logo-wrap">
        <img class="gov-letterhead-logo gov-letterhead-logo--pgso" src="${rightLogoUrl}" alt="PGSO" onerror="this.style.display='none'" />
      </div>
    </div>
    ${includeDivider ? '<hr class="divider" />' : ''}
  `;
}

export function governmentPrintLetterhead(): string {
  return dualLogoPrintLetterhead();
}

export function openGovernmentPrintWindow(pageTitle: string, documentContent: string, extraStyles = '') {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(pageTitle)}</title>
  <style>${GOVERNMENT_PRINT_STYLES}${extraStyles}</style>
</head>
<body>
  <div class="toolbar">
    <button class="primary" onclick="window.print()">Print Document</button>
    <button onclick="window.close()">Close</button>
  </div>
  <div class="document">${documentContent}</div>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=900,height=800');
  if (!win) {
    toast.error('Please allow pop-ups to use print preview');
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
}
