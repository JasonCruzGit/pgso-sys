import { escapeHtml, governmentPrintLetterhead, openGovernmentPrintWindow } from './governmentPrint';
import { BRANDING } from '../constants/branding';

export type TemporaryCertificateForm = {
  control_number?: string;
  request_date: string;
  requester_name: string;
  requester_position?: string;
  requester_office?: string;
  recipient_name: string;
  recipient_position?: string;
  recipient_office?: string;
  transfer_reason: string;
  conformed_name?: string;
  conformed_position?: string;
  conformed_office?: string;
  attested_name?: string;
  attested_position?: string;
  attested_office?: string;
  approved_name?: string;
  approved_position?: string;
};

function formatLongDate(value: string) {
  if (!value) return '________________';
  return new Date(value).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function signatureBlock(name?: string, position?: string, office?: string) {
  const displayName = name?.trim() || '&nbsp;';
  const displayPosition = position?.trim() || '&nbsp;';
  const displayOffice = office?.trim();

  return `
    <p class="sig-name">${escapeHtml(displayName)}</p>
    <p class="sig-role">${escapeHtml(displayPosition)}</p>
    ${displayOffice ? `<p class="sig-office">${escapeHtml(displayOffice)}</p>` : ''}
  `;
}

export function buildTemporaryCertificateDocument(form: TemporaryCertificateForm) {
  const controlNo = form.control_number?.trim() || '—';
  const requestDate = formatLongDate(form.request_date);
  const recipientName = form.recipient_name?.trim() || '________________';
  const recipientPosition = form.recipient_position?.trim() || '________________';
  const recipientOffice = form.recipient_office?.trim() || '________________';
  const transferReason = form.transfer_reason?.trim() || '________________';

  return `
    ${governmentPrintLetterhead()}
    <div class="tc-meta">
      <p><strong>Control No.:</strong> ${escapeHtml(controlNo)}</p>
      <p><strong>Date:</strong> ${escapeHtml(requestDate)}</p>
    </div>
    <h1 class="tc-title">Request for Temporary Transfer of Property Accountability</h1>
    <p class="tc-salutation">The General Services Officer:</p>
    <p class="tc-body">
      This is to request the transfer of items under my Individual Property Accountability (IPA) to
      <strong>${escapeHtml(recipientName)}</strong>,
      <strong>${escapeHtml(recipientPosition)}</strong>,
      <strong>${escapeHtml(recipientOffice)}</strong>,
      ${escapeHtml(transferReason)}.
    </p>
    <p class="tc-body">The above said accountabilities are revocable upon my return to office.</p>
    <div class="tc-signatures">
      <div class="tc-sig-col">
        <div class="sig-line"></div>
        ${signatureBlock(form.requester_name, form.requester_position, form.requester_office)}
        <p class="sig-label">Requester</p>
      </div>
      <div class="tc-sig-col">
        <div class="sig-line"></div>
        ${signatureBlock(form.conformed_name, form.conformed_position, form.conformed_office)}
        <p class="sig-label">Conformed</p>
      </div>
    </div>
    <div class="tc-signatures tc-signatures--bottom">
      <div class="tc-sig-col tc-sig-col--right">
        <div class="sig-line"></div>
        ${signatureBlock(form.attested_name, form.attested_position, form.attested_office)}
        <p class="sig-label">Attested by</p>
      </div>
    </div>
    <div class="tc-approved">
      <div class="sig-line sig-line--center"></div>
      ${signatureBlock(form.approved_name, form.approved_position)}
      <p class="sig-label">Approved by</p>
    </div>
    <div class="tc-footer">
      <span>${escapeHtml(BRANDING.printFooter)}</span>
    </div>
  `;
}

const TEMP_CERT_PRINT_STYLES = `
  .document {
    max-width: 816px;
    border: none;
    box-shadow: none;
    padding: 36px 48px 40px;
  }
  .tc-meta {
    margin: 18px 0 24px;
    font-size: 12px;
    line-height: 1.6;
  }
  .tc-meta p { margin: 0; }
  .tc-title {
    text-align: center;
    margin: 0 0 28px;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    line-height: 1.45;
  }
  .tc-salutation {
    margin: 0 0 16px;
    font-size: 12px;
    font-weight: 700;
  }
  .tc-body {
    margin: 0 0 16px;
    font-size: 12px;
    line-height: 1.75;
    text-align: justify;
    text-indent: 2.5em;
  }
  .tc-body strong { font-weight: 700; }
  .tc-signatures {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 48px;
    margin-top: 48px;
  }
  .tc-signatures--bottom {
    grid-template-columns: 1fr;
    margin-top: 40px;
  }
  .tc-sig-col { min-width: 0; }
  .tc-sig-col--right {
    justify-self: end;
    width: min(100%, 280px);
    text-align: center;
  }
  .sig-line {
    border-bottom: 1px solid #111;
    margin-bottom: 6px;
    min-height: 1px;
  }
  .sig-line--center {
    max-width: 280px;
    margin-left: auto;
    margin-right: auto;
  }
  .sig-name {
    margin: 0;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    text-align: center;
    line-height: 1.4;
  }
  .sig-role, .sig-office {
    margin: 2px 0 0;
    font-size: 11px;
    text-align: center;
    line-height: 1.35;
  }
  .sig-label {
    margin: 8px 0 0;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    text-align: center;
    color: #444;
  }
  .tc-approved {
    margin-top: 48px;
    text-align: center;
  }
  .tc-footer {
    margin-top: 40px;
    padding-top: 12px;
    border-top: 1px solid #ddd;
    font-size: 9px;
    color: #666;
    text-align: center;
  }
`;

export function openTemporaryCertificatePrintPreview(form: TemporaryCertificateForm) {
  const content = buildTemporaryCertificateDocument(form);
  const title = form.control_number
    ? `Temporary Certificate ${form.control_number}`
    : 'Request for Temporary Transfer of Property Accountability';

  openGovernmentPrintWindow(title, content, TEMP_CERT_PRINT_STYLES);
}
