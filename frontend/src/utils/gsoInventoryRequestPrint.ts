import { BRANDING, LOGO_PATH, PGSO_LOGO_PATH } from '../constants/branding';

export type GsoInventoryRequestForm = {
  control_number?: string;
  requested_at: string;
  employee_name: string;
  office_name: string;
  request_type: string;
  par_is_new: boolean;
  par_is_transfer: boolean;
  ics_is_new: boolean;
  ics_is_transfer: boolean;
  ics_to_name: string;
  ics_employee_signature: string;
  ics_office: string;
  ics_position: string;
  ics_id_no: string;
  horm_property_or_plate: string;
  others_specify: string;
  purpose: string;
  requester_signature: string;
  contact_no: string;
  pgso_instruction: string;
  remarks: string;
  processor_signature: string;
  processor_signature_path?: string | null;
  approved_name: string;
  approved_position: string;
};

export const REQUEST_TYPES: { value: string; label: string; letter: string }[] = [
  { value: 'clearance', letter: 'A', label: 'Clearance (Leave/Travel/Retirement/Transfer)' },
  { value: 'par', letter: 'B', label: 'Property Acknowledgement Receipt (PAR)' },
  { value: 'ics', letter: 'C', label: 'Inventory Custodian Slip (ICS)' },
  { value: 'prs', letter: 'D', label: 'Property Return Slip (PRS)' },
  { value: 'wmr', letter: 'E', label: 'Waste Material Report (WMR)' },
  { value: 'horm', letter: 'F', label: 'History of Repair & Maintenance (HORM)' },
  { value: 'individual_property_accountability', letter: 'G', label: 'Individual Property Accountability' },
  { value: 'others', letter: 'H', label: 'Others — please specify' },
];

function mark(on: boolean) {
  return on ? '☑' : '☐';
}

function formatDateTime(value?: string) {
  if (!value) return '____________________';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function openGsoInventoryRequestPrintPreview(
  form: GsoInventoryRequestForm,
  options?: { processorSignatureUrl?: string | null },
) {
  const typeRows = REQUEST_TYPES.map((t) => {
    const on = form.request_type === t.value;
    let extra = '';
    if (t.value === 'par' && on) {
      extra = ` &nbsp; ${mark(form.par_is_new)} New &nbsp; ${mark(form.par_is_transfer)} Transfer`;
    }
    if (t.value === 'ics' && on) {
      extra = ` &nbsp; ${mark(form.ics_is_new)} New &nbsp; ${mark(form.ics_is_transfer)} Transfer
        <div style="margin:6px 0 0 18px;font-size:11px;">
          To: <u>${form.ics_to_name || '____________'}</u><br/>
          Signature of Employee: <u>${form.ics_employee_signature || '____________'}</u><br/>
          Office: <u>${form.ics_office || '____________'}</u>
          &nbsp; Position: <u>${form.ics_position || '____________'}</u>
          &nbsp; ID No.: <u>${form.ics_id_no || '____________'}</u>
        </div>`;
    }
    if (t.value === 'horm' && on) {
      extra = ` &nbsp; Property No./Plate No.: <u>${form.horm_property_or_plate || '____________'}</u>`;
    }
    if (t.value === 'others' && on) {
      extra = ` &nbsp; <u>${form.others_specify || '____________'}</u>`;
    }
    return `<div style="margin:3px 0;">${mark(on)} <strong>${t.letter}.</strong> ${t.label}${extra}</div>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>GSO Control Slip — ${form.control_number || 'Draft'}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:24px;font-size:12px;}
  .header{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:12px;}
  .header img{width:64px;height:64px;object-fit:contain;}
  .center{text-align:center;line-height:1.35;}
  h1{font-size:14px;text-transform:uppercase;margin:12px 0;text-align:center;}
  .box{border:1px solid #111;padding:10px;margin-top:10px;}
  .row{display:flex;justify-content:space-between;gap:16px;margin-bottom:8px;}
  @media print{body{margin:12mm;}}
</style></head><body>
  <div class="header">
    <img src="${LOGO_PATH}" alt="" />
    <div class="center">
      <div>${BRANDING.republic}</div>
      <div style="font-weight:700;text-transform:uppercase;">${BRANDING.lguName}</div>
      <div style="font-weight:700;color:#006633;">PROVINCIAL GENERAL SERVICES OFFICE</div>
      <div>${BRANDING.capitalCity}</div>
    </div>
    <img src="${PGSO_LOGO_PATH}" alt="" />
  </div>
  <h1>New Inventory Request — GSO Control Slip</h1>
  <div class="row">
    <div><strong>GSO Control Slip No.:</strong> <u>${form.control_number || '____________'}</u></div>
    <div><strong>Date & Time:</strong> <u>${formatDateTime(form.requested_at)}</u></div>
  </div>
  <div class="box"><strong>I. Name of Employee:</strong> ${form.employee_name || '____________________'}</div>
  <div class="box"><strong>II. Name of Office:</strong> ${form.office_name || '____________________'}</div>
  <div class="box"><strong>III. Request for:</strong><div style="margin-top:6px;">${typeRows}</div></div>
  <div class="box"><strong>IV. Purpose:</strong><div style="min-height:48px;margin-top:6px;white-space:pre-wrap;">${form.purpose || ''}</div>
    <div style="margin-top:12px;">Signature over Printed Name of Requester: <u>${form.requester_signature || '____________________'}</u></div>
    <div style="margin-top:6px;color:#b91c1c;"><strong>Contact No.:</strong> <u>${form.contact_no || '____________________'}</u></div>
  </div>
  <div class="box"><strong>V. PGSO Instruction:</strong><div style="min-height:48px;margin-top:6px;white-space:pre-wrap;">${form.pgso_instruction || ''}</div></div>
  <div class="box" style="text-align:center;margin-top:16px;">
    <div style="font-weight:700;text-transform:uppercase;">${form.approved_name || 'MERCY M. BONTAO'}</div>
    <div>${form.approved_position || 'Acting PGSO'}</div>
    <div>Provincial General Services Office</div>
  </div>
  <div class="box"><strong>VI. Remarks:</strong><div style="min-height:48px;margin-top:6px;white-space:pre-wrap;">${form.remarks || ''}</div>
    <div style="margin-top:16px;">Processor's Signature:</div>
    ${options?.processorSignatureUrl
      ? `<div style="margin-top:8px;"><img src="${options.processorSignatureUrl}" alt="Processor signature" style="max-height:72px;max-width:240px;object-fit:contain;" /></div>`
      : `<div style="margin-top:8px;"><u>${form.processor_signature || '____________________'}</u></div>`}
  </div>
  <script>window.onload=()=>window.print();</script>
</body></html>`;

  const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1000');
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
}
