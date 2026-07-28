import { escapeHtml, governmentPrintLetterhead, openGovernmentPrintWindow } from './governmentPrint';
import { BRANDING } from '../constants/branding';
import type { FleetBorrowerSlip } from '../types';

export type FleetBorrowerSlipPrintForm = {
  slip_number?: string;
  borrower_name: string;
  office_name?: string;
  contact_no?: string;
  purpose: string;
  destination: string;
  departure_at: string;
  expected_return_at: string;
  passengers: string | number;
  requested_vehicle_type?: string;
  driver_needed: boolean;
  preferred_driver_note?: string;
  remarks?: string;
  created_at?: string;
};

function formatDateTime(value?: string) {
  if (!value) return '____________________';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function row(label: string, value: string) {
  return `
    <tr>
      <th>${escapeHtml(label)}</th>
      <td>${value}</td>
    </tr>
  `;
}

export function slipToPrintForm(slip: FleetBorrowerSlip): FleetBorrowerSlipPrintForm {
  return {
    slip_number: slip.slip_number,
    borrower_name: slip.borrower_name,
    office_name: slip.department?.name,
    contact_no: slip.contact_no ?? '',
    purpose: slip.purpose,
    destination: slip.destination,
    departure_at: slip.departure_at,
    expected_return_at: slip.expected_return_at,
    passengers: slip.passengers,
    requested_vehicle_type: slip.requested_vehicle_type ?? '',
    driver_needed: slip.driver_needed,
    preferred_driver_note: slip.preferred_driver_note ?? '',
    remarks: slip.remarks ?? '',
    created_at: slip.created_at,
  };
}

export function buildFleetBorrowerSlipDocument(form: FleetBorrowerSlipPrintForm) {
  const slipNo = form.slip_number?.trim() || '—';
  const filed = formatDateTime(form.created_at);
  const driverLine = form.driver_needed
    ? `Yes${form.preferred_driver_note?.trim() ? ` — ${escapeHtml(form.preferred_driver_note.trim())}` : ''}`
    : 'No';
  const vehicleType = form.requested_vehicle_type?.trim()
    ? escapeHtml(form.requested_vehicle_type.trim().toUpperCase())
    : 'Any';

  return `
    ${governmentPrintLetterhead()}
    <div class="fbs-meta">
      <p><strong>Slip No.:</strong> ${escapeHtml(slipNo)}</p>
      <p><strong>Date filed:</strong> ${escapeHtml(filed)}</p>
    </div>
    <h1 class="fbs-title">Vehicle Borrower's Slip</h1>
    <p class="fbs-sub">Provincial General Services Office — Fleet Management</p>
    <table class="fbs-fields">
      ${row('Borrower Name', escapeHtml(form.borrower_name || '—'))}
      ${row('Office / Department', escapeHtml(form.office_name || '—'))}
      ${row('Contact No.', escapeHtml(form.contact_no || '—'))}
      ${row('Purpose', escapeHtml(form.purpose || '—'))}
      ${row('Destination', escapeHtml(form.destination || '—'))}
      ${row('Departure', escapeHtml(formatDateTime(form.departure_at)))}
      ${row('Expected Return', escapeHtml(formatDateTime(form.expected_return_at)))}
      ${row('Passengers', escapeHtml(String(form.passengers || 1)))}
      ${row('Requested Vehicle Type', vehicleType)}
      ${row('Driver Needed', driverLine)}
      ${row('Remarks', escapeHtml(form.remarks || '—'))}
    </table>
    <div class="fbs-signatures">
      <div class="fbs-sig-col">
        <div class="sig-line"></div>
        <p class="sig-label">Borrower Signature</p>
      </div>
      <div class="fbs-sig-col">
        <div class="sig-line"></div>
        <p class="sig-label">Authorized / Approving Officer</p>
      </div>
    </div>
    <p class="fbs-footer">${escapeHtml(BRANDING.printFooter)} · Fleet Management</p>
  `;
}

const FBS_STYLES = `
  .fbs-meta {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin: 8px 0 12px;
    font-size: 12px;
  }
  .fbs-meta p { margin: 0; }
  .fbs-title {
    margin: 0;
    text-align: center;
    font-size: 18px;
    text-transform: uppercase;
    color: #006633;
  }
  .fbs-sub {
    margin: 4px 0 16px;
    text-align: center;
    font-size: 11px;
    color: #555;
  }
  .fbs-fields {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 28px;
  }
  .fbs-fields th, .fbs-fields td {
    border: 1px solid #999;
    padding: 8px 10px;
    vertical-align: top;
    text-align: left;
  }
  .fbs-fields th {
    width: 32%;
    background: #f3f6f4;
    font-weight: 700;
  }
  .fbs-signatures {
    display: flex;
    justify-content: space-between;
    gap: 40px;
    margin-top: 40px;
  }
  .fbs-sig-col { flex: 1; }
  .sig-line {
    border-bottom: 1px solid #111;
    min-height: 36px;
    margin-bottom: 6px;
  }
  .sig-label {
    margin: 0;
    text-align: center;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    color: #444;
  }
  .fbs-footer {
    margin-top: 36px;
    padding-top: 10px;
    border-top: 1px solid #ddd;
    font-size: 10px;
    color: #666;
    text-align: center;
  }
`;

export function openFleetBorrowerSlipPrintPreview(form: FleetBorrowerSlipPrintForm) {
  openGovernmentPrintWindow(
    `Borrower's Slip${form.slip_number ? ` — ${form.slip_number}` : ''}`,
    buildFleetBorrowerSlipDocument(form),
    FBS_STYLES,
  );
}
