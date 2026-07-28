import { escapeHtml, openGovernmentPrintWindow } from './governmentPrint';
import type { AcceptanceInspectionReport } from '../types';
import { BRANDING, LOGO_PATH, PGSO_LOGO_PATH } from '../constants/branding';

function formatDateTime(value?: string) {
  const d = value ? new Date(value) : new Date();
  return d.toLocaleString('en-PH', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function buildPurpose(report: AcceptanceInspectionReport) {
  const parts: string[] = [];
  const project =
    report.remarks_for_use_of
    ?? report.purchase_order?.purchase_request?.title
    ?? report.purchase_order?.purchase_request?.description;
  if (project) parts.push(project);

  const poNumber = report.po_number ?? report.purchase_order?.po_number;
  if (poNumber) parts.push(`PO Ref: ${poNumber}`);

  const airNumber = report.air_number;
  if (airNumber) parts.push(`AIR Ref: ${airNumber}`);

  const items = (report.items ?? [])
    .map((item) => {
      const qty = item.quantity_accepted ?? item.quantity_delivered ?? item.quantity_ordered ?? 0;
      const unit = item.unit_of_measure ?? 'unit';
      return `${item.description} (${qty} ${unit})`;
    })
    .filter(Boolean);
  if (items.length) parts.push(`Items: ${items.join('; ')}`);

  return parts.join('. ') || 'Request for issuance of Property Acknowledgement Receipt (PAR).';
}

function checkbox(checked = false) {
  return `<span class="gcs-check${checked ? ' gcs-check--on' : ''}">${checked ? '&#10003;' : ''}</span>`;
}

function lineRow(label: string, value = '') {
  return `
    <div class="gcs-line-row">
      <span class="gcs-line-label">${label}</span>
      <span class="gcs-line-fill">${escapeHtml(value)}</span>
    </div>
  `;
}

function controlSlipBlock(report: AcceptanceInspectionReport) {
  const office =
    report.requisitioning_office
    ?? report.purchase_order?.purchase_request?.department?.name
    ?? '';
  const purpose = buildPurpose(report);
  const slipNo = report.air_number ?? '';
  const dateTime = formatDateTime(report.acceptance_date ?? report.inspection_date);
  const pgpLogoUrl = `${window.location.origin}${LOGO_PATH}`;
  const pgsoLogoUrl = `${window.location.origin}${PGSO_LOGO_PATH}`;

  return `
    <div class="gcs-slip">
      <div class="gcs-header">
        <img class="gcs-logo" src="${pgpLogoUrl}" alt="PGP" onerror="this.style.display='none'" />
        <div class="gcs-header-text">
          <p class="republic">${escapeHtml(BRANDING.republic)}</p>
          <p class="province">${escapeHtml(BRANDING.lguName.toUpperCase())}</p>
          <p class="office">${escapeHtml(BRANDING.gsoOfficeTitle)}</p>
          <p class="city">${escapeHtml(BRANDING.capitalCity)}, Palawan</p>
        </div>
        <img class="gcs-logo" src="${pgsoLogoUrl}" alt="PGSO" onerror="this.style.display='none'" />
      </div>
      <div class="gcs-header-meta">
        <div class="gcs-meta-row">
          <span class="k">GSO Control Slip No.</span>
          <span class="v">${escapeHtml(slipNo)}</span>
        </div>
        <div class="gcs-meta-row">
          <span class="k">Date &amp; Time:</span>
          <span class="v">${escapeHtml(dateTime)}</span>
        </div>
      </div>

      ${lineRow('I. Name of Employee:', '')}
      ${lineRow('II. Name of Office:', office)}

      <div class="gcs-section">
        <p class="gcs-section-title">III. Request for:</p>
        <div class="gcs-checklist">
          <div class="gcs-check-item">${checkbox()} <span>A. Clearance (Leave/Travel/Retirement/Transfer)</span></div>
          <div class="gcs-check-item gcs-check-item--indent">
            ${checkbox(true)} <span>B. Property Acknowledgement Receipt (PAR):</span>
            <span class="gcs-inline-check">${checkbox(true)} New</span>
            <span class="gcs-inline-check">${checkbox()} Transfer</span>
          </div>
          <div class="gcs-check-item gcs-check-item--indent">
            ${checkbox()} <span>C. Inventory Custodian Slip (ICS):</span>
            <span class="gcs-inline-check">${checkbox()} New</span>
            <span class="gcs-inline-check">${checkbox()} Transfer</span>
          </div>
        </div>
        <div class="gcs-employee-sign">
          <div class="gcs-sign-line"></div>
          <p class="gcs-sign-caption">Signature of Employee Over Printed Name</p>
          <div class="gcs-sign-fields">
            <span>Office: <span class="gcs-mini-line"></span></span>
            <span>Position: <span class="gcs-mini-line"></span></span>
            <span>ID No.: <span class="gcs-mini-line"></span></span>
          </div>
        </div>
        <div class="gcs-checklist gcs-checklist--compact">
          <div class="gcs-check-item">${checkbox()} <span>D. Property Return Slip (PRS)</span></div>
          <div class="gcs-check-item">${checkbox()} <span>E. Report of Waste Material (RWM)</span></div>
          <div class="gcs-check-item">
            ${checkbox()} <span>F. History of Repair &amp; Maintenance (HRM)</span>
            <span class="gcs-inline-label">Property No./Plate No.:</span>
            <span class="gcs-inline-line"></span>
          </div>
          <div class="gcs-check-item">${checkbox()} <span>G. Individual Property Accountability</span></div>
          <div class="gcs-check-item">
            ${checkbox()} <span>H. Others-Pls. specify:</span>
            <span class="gcs-inline-line gcs-inline-line--wide"></span>
          </div>
        </div>
      </div>

      <div class="gcs-section">
        <p class="gcs-section-title">IV. Purpose:</p>
        <div class="gcs-purpose-lines">
          <div class="gcs-purpose-line">${escapeHtml(purpose)}</div>
          <div class="gcs-purpose-line"></div>
          <div class="gcs-purpose-line"></div>
        </div>
        <div class="gcs-requester-sign">
          <div class="gcs-sign-line"></div>
          <p class="gcs-sign-caption">Signature Over Printed Name of Requester</p>
          <p class="gcs-contact">Contact No. <span class="gcs-contact-line"></span></p>
        </div>
      </div>

      <div class="gcs-section">
        <p class="gcs-section-title">V. PGSO Instruction:</p>
        <div class="gcs-purpose-lines">
          <div class="gcs-purpose-line"></div>
          <div class="gcs-purpose-line"></div>
          <div class="gcs-purpose-line"></div>
        </div>
        <div class="gcs-pgso-sign">
          <p class="gcs-pgso-name"><strong>MERCY M. BONTAO, MPA</strong></p>
          <p>Acting PGSO</p>
          <p>Provincial General Services Office</p>
        </div>
      </div>

      <div class="gcs-section gcs-section--last">
        <p class="gcs-section-title">VI. Remarks:</p>
        <div class="gcs-purpose-lines">
          <div class="gcs-purpose-line">${escapeHtml(report.findings ?? '')}</div>
          <div class="gcs-purpose-line">${escapeHtml(report.remarks ?? '')}</div>
          <div class="gcs-purpose-line"></div>
        </div>
        <div class="gcs-processor-sign">
          <div class="gcs-sign-line"></div>
          <p class="gcs-sign-caption">Processor's Signature</p>
        </div>
      </div>
    </div>
  `;
}

const GSO_CONTROL_SLIP_STYLES = `
  .gcs-page {
    display: flex;
    gap: 10px;
    align-items: stretch;
    margin-bottom: 12px;
  }
  .gcs-slip {
    flex: 1;
    min-width: 0;
    border: 3px double #1e4f8c;
    padding: 8px 10px 10px;
    font-family: Arial, sans-serif;
    font-size: 8.5px;
    line-height: 1.25;
    color: #111;
  }
  .gcs-header {
    display: grid;
    grid-template-columns: 42px 1fr 42px;
    gap: 6px;
    align-items: start;
    margin-bottom: 4px;
  }
  .gcs-logo {
    width: 40px;
    height: 40px;
    object-fit: contain;
    border-radius: 50%;
    display: block;
  }
  .gcs-header-text { text-align: center; line-height: 1.15; }
  .gcs-header-text p { margin: 0; }
  .gcs-header-text .republic { font-size: 7px; text-transform: uppercase; }
  .gcs-header-text .province { font-size: 8px; font-weight: 700; text-transform: uppercase; }
  .gcs-header-text .office { font-size: 8px; font-weight: 700; text-transform: uppercase; }
  .gcs-header-text .city { font-size: 7px; }
  .gcs-header-meta {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    font-size: 7px;
    margin-bottom: 6px;
  }
  .gcs-meta-row { margin-bottom: 3px; }
  .gcs-meta-row .k { display: block; font-weight: 700; }
  .gcs-meta-row .v {
    display: block;
    border-bottom: 1px solid #111;
    min-height: 11px;
    margin-top: 1px;
    font-weight: 600;
  }
  .gcs-line-row {
    display: flex;
    align-items: flex-end;
    gap: 4px;
    margin-bottom: 4px;
  }
  .gcs-line-label { white-space: nowrap; font-weight: 700; }
  .gcs-line-fill {
    flex: 1;
    border-bottom: 1px solid #111;
    min-height: 12px;
    font-weight: 600;
  }
  .gcs-section { margin-top: 5px; }
  .gcs-section--last { margin-bottom: 0; }
  .gcs-section-title { margin: 0 0 3px; font-weight: 700; }
  .gcs-checklist { margin-left: 2px; }
  .gcs-checklist--compact { margin-top: 4px; }
  .gcs-check-item {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 3px;
    margin-bottom: 2px;
  }
  .gcs-check-item--indent { margin-left: 10px; }
  .gcs-check {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 9px;
    height: 9px;
    border: 1px solid #111;
    font-size: 7px;
    line-height: 1;
    flex-shrink: 0;
  }
  .gcs-check--on { font-weight: 700; }
  .gcs-inline-check { margin-left: 6px; display: inline-flex; align-items: center; gap: 2px; }
  .gcs-inline-label { margin-left: 8px; }
  .gcs-inline-line {
    display: inline-block;
    width: 48px;
    border-bottom: 1px solid #111;
    height: 9px;
    vertical-align: bottom;
  }
  .gcs-inline-line--wide { width: 72px; }
  .gcs-employee-sign { margin: 4px 0 2px; text-align: center; }
  .gcs-sign-line {
    border-bottom: 1px solid #111;
    height: 14px;
    margin: 0 8px;
  }
  .gcs-sign-caption { margin: 1px 0 2px; font-size: 7px; }
  .gcs-sign-fields {
    display: flex;
    justify-content: space-between;
    gap: 4px;
    font-size: 7px;
    margin-top: 2px;
  }
  .gcs-mini-line {
    display: inline-block;
    width: 36px;
    border-bottom: 1px solid #111;
    height: 8px;
    vertical-align: bottom;
  }
  .gcs-purpose-lines { margin-bottom: 4px; }
  .gcs-purpose-line {
    border-bottom: 1px solid #111;
    min-height: 12px;
    margin-bottom: 2px;
    font-weight: 600;
    word-break: break-word;
  }
  .gcs-requester-sign, .gcs-processor-sign { text-align: center; margin-top: 4px; }
  .gcs-contact { margin: 2px 0 0; color: #c00; font-weight: 700; font-size: 7px; }
  .gcs-contact-line {
    display: inline-block;
    width: 80px;
    border-bottom: 1px solid #c00;
    height: 9px;
    vertical-align: bottom;
  }
  .gcs-pgso-sign { text-align: center; margin-top: 6px; line-height: 1.2; }
  .gcs-pgso-sign p { margin: 0; }
  .gcs-pgso-name { margin-bottom: 1px !important; }
  @media print {
    .gcs-page { page-break-inside: avoid; break-inside: avoid; }
    .gcs-slip { border-width: 2px; }
  }
`;

export function openParRequestPrintPreview(report: AcceptanceInspectionReport) {
  const slip = controlSlipBlock(report);
  const content = `
    <style>${GSO_CONTROL_SLIP_STYLES}</style>
    <div class="gcs-page">
      ${slip}
      ${slip}
    </div>
  `;

  openGovernmentPrintWindow(`${report.air_number} — Request for PAR`, content);
}
