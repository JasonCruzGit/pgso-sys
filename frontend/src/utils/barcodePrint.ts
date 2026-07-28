import QRCode from 'qrcode';
import { escapeHtml, openGovernmentPrintWindow } from './governmentPrint';
import { BRANDING } from '../constants/branding';

export type BarcodeLabelItem = {
  propertyNumber: string;
  description: string;
  documentNumber: string;
  documentType: string;
  custodianName?: string;
};

const LABEL_STYLES = `
  * { box-sizing: border-box; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    margin: 0;
    padding: 16px;
    background: #e8ecef;
    color: #111;
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
  }
  .toolbar button.primary { background: #006633; color: #fff; }
  .sheet {
    max-width: 816px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  .label {
    background: #fff;
    border: 1px dashed #94a3b8;
    padding: 12px;
    min-height: 148px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    page-break-inside: avoid;
  }
  .label svg { display: block; margin: 0 auto 8px; }
  .property-no {
    font-family: "Courier New", monospace;
    font-size: 13px;
    font-weight: 700;
    color: #0f766e;
    margin-bottom: 4px;
  }
  .description {
    font-size: 10px;
    line-height: 1.35;
    color: #334155;
    margin-bottom: 6px;
    max-width: 100%;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .meta {
    font-size: 9px;
    color: #64748b;
    line-height: 1.4;
  }
  @media print {
    body { background: #fff; padding: 0; }
    .toolbar { display: none; }
    .sheet { max-width: none; gap: 8px; }
    .label { border-color: #cbd5e1; }
  }
`;

async function buildLabelMarkup(items: BarcodeLabelItem[]): Promise<string> {
  const labels = await Promise.all(items.map(async (item) => {
    const qrPayload = JSON.stringify({
      property_number: item.propertyNumber,
      document_number: item.documentNumber,
      document_type: item.documentType,
    });
    const svg = await QRCode.toString(qrPayload, {
      type: 'svg',
      width: 96,
      margin: 1,
      errorCorrectionLevel: 'M',
    });

    return `
      <div class="label">
        ${svg}
        <div class="property-no">${escapeHtml(item.propertyNumber)}</div>
        <div class="description">${escapeHtml(item.description)}</div>
        <div class="meta">
          ${escapeHtml(item.documentType.toUpperCase())} ${escapeHtml(item.documentNumber)}
          ${item.custodianName ? `<br>${escapeHtml(item.custodianName)}` : ''}
        </div>
      </div>
    `;
  }));

  return labels.join('');
}

export async function openPropertyBarcodePrintPreview(items: BarcodeLabelItem[]) {
  if (items.length === 0) return;

  const labelsHtml = await buildLabelMarkup(items);
  const content = `
    <div class="sheet">
      ${labelsHtml}
    </div>
    <div style="max-width:816px;margin:12px auto 0;font-size:10px;color:#64748b;text-align:center;">
      ${escapeHtml(BRANDING.printFooter)}
    </div>
  `;

  openGovernmentPrintWindow('Property Barcode Labels', content, `
    .document { max-width: none; border: none; padding: 0; box-shadow: none; }
    ${LABEL_STYLES}
  `);
}
