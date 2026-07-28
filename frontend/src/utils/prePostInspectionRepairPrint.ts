import { BRANDING, LOGO_PATH, PGSO_LOGO_PATH } from '../constants/branding';

export type PrePostInspectionRepairForm = {
  control_number?: string;
  form_date: string;
  pre_inspection: boolean;
  pre_inspection_date: string;
  post_inspection: boolean;
  post_inspection_date: string;
  equipment_category: string;
  equipment_category_notes: string;
  property_no: string;
  type: string;
  brand: string;
  model: string;
  engine_no: string;
  chassis_no: string;
  serial_no: string;
  plate_no: string;
  date_of_acquisition: string;
  date_of_last_repair: string;
  location_of_eqpt: string;
  date_of_request: string;
  office: string;
  requisitioner: string;
  requisitioner_signature_path?: string | null;
  approved_name: string;
  approved_position: string;
  approval_date: string;
  inspector_1: string;
  inspector_2: string;
  inspector_3: string;
};

export const EQUIPMENT_CATEGORIES: { value: string; label: string }[] = [
  { value: 'heavy_equipment', label: 'Heavy Equipment' },
  { value: 'pick_up', label: 'Pick-Up' },
  { value: 'motorcycle', label: 'Motorcycle' },
  { value: 'van', label: 'Van' },
  { value: 'truck', label: 'Truck' },
  { value: 'ambulance', label: 'Ambulance' },
  { value: 'coaster', label: 'Coaster' },
  { value: 'bus', label: 'Bus' },
  { value: 'seacraft', label: 'Seacraft' },
  { value: 'office_it_equipment', label: 'Office/IT Equipment' },
  { value: 'others', label: 'Others' },
];

function formatDate(value?: string) {
  if (!value) return '____________';
  return new Date(value).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
}

function mark(checked: boolean) {
  return checked ? '☑' : '☐';
}

function line(label: string, value?: string) {
  return `<tr><td style="padding:2px 8px 2px 0;white-space:nowrap;vertical-align:bottom;">${label}</td><td style="padding:2px 0;border-bottom:1px solid #111;width:100%;">${value || '&nbsp;'}</td></tr>`;
}

export function openPrePostInspectionRepairPrintPreview(
  form: PrePostInspectionRepairForm,
  options?: { requisitionerSignatureUrl?: string | null },
) {
  const categoryLabel = EQUIPMENT_CATEGORIES.find((c) => c.value === form.equipment_category)?.label ?? '';
  const categoryRows = EQUIPMENT_CATEGORIES.map((c) => {
    const on = form.equipment_category === c.value;
    const notes = on && form.equipment_category_notes ? ` ${form.equipment_category_notes}` : '';
    return `<div style="margin:2px 0;">${mark(on)} ${c.label}${on ? ` <span style="border-bottom:1px solid #111;padding:0 24px;">${notes || '&nbsp;'}</span>` : ''}</div>`;
  }).join('');

  const requisitionerBlock = options?.requisitionerSignatureUrl
    ? `<img src="${options.requisitionerSignatureUrl}" alt="Requisitioner signature" style="max-height:56px;max-width:180px;object-fit:contain;margin:0 auto 4px;" /><div style="font-weight:700;text-transform:uppercase;">${form.requisitioner || '&nbsp;'}</div>`
    : `<div style="font-weight:700;text-transform:uppercase;">${form.requisitioner || '&nbsp;'}</div>`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>GSO Form #3 — ${form.control_number || 'Draft'}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 24px; font-size: 12px; }
  .header { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:12px; }
  .header img { width:64px; height:64px; object-fit:contain; }
  .center { text-align:center; line-height:1.35; }
  h1 { font-size:14px; text-transform:uppercase; margin:16px 0; text-align:center; }
  table { width:100%; border-collapse:collapse; }
  .box { border:1px solid #111; padding:10px; margin-top:10px; }
  .sig { display:grid; grid-template-columns:1fr 1fr; gap:32px; margin-top:28px; }
  .sig .line { border-top:1px solid #111; margin-top:40px; padding-top:4px; text-align:center; }
  @media print { body { margin: 12mm; } }
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
  <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
    <div><strong>GSO Form #3</strong> — Control No. <u>${form.control_number || '____________'}</u></div>
    <div>Date: <u>${formatDate(form.form_date)}</u></div>
  </div>
  <h1>Request for Pre and Post Inspection of Repair</h1>
  <div>
    ${mark(form.pre_inspection)} Pre-Inspection &nbsp;&nbsp; Date: <u>${formatDate(form.pre_inspection_date)}</u>
    &nbsp;&nbsp;&nbsp;
    ${mark(form.post_inspection)} Post-Inspection &nbsp;&nbsp; Date: <u>${formatDate(form.post_inspection_date)}</u>
  </div>
  <div class="box">
    <strong>Equipment / Unit</strong>
    ${categoryRows}
  </div>
  <div class="box">
    <strong>Please Indicate</strong>
    <table style="margin-top:6px;">
      ${line('Property No.', form.property_no)}
      ${line('Type', form.type)}
      ${line('Brand', form.brand)}
      ${line('Model', form.model)}
      ${line('Engine No.', form.engine_no)}
      ${line('Chassis No.', form.chassis_no)}
      ${line('Serial No.', form.serial_no)}
      ${line('Plate No.', form.plate_no)}
      ${line('Date of Acquisition', formatDate(form.date_of_acquisition))}
      ${line('Date of Last Repair', formatDate(form.date_of_last_repair))}
      ${line('Location of Eqpt.', form.location_of_eqpt)}
      ${line('Date of Request', formatDate(form.date_of_request))}
      ${line('Office', form.office)}
      ${categoryLabel ? line('Category', categoryLabel) : ''}
    </table>
  </div>
  <div class="sig">
    <div>
      <div class="line">
        ${requisitionerBlock}
        <div>Requisitioner</div>
        <div style="font-size:10px;">Signature over Printed Name</div>
      </div>
    </div>
    <div>
      <div class="line">
        <div style="font-weight:700;text-transform:uppercase;">${form.approved_name || 'MERCY M. BONTAO'}</div>
        <div>${form.approved_position || 'Acting PGSO'}</div>
        <div>Approved</div>
        <div style="margin-top:6px;">Date: ${formatDate(form.approval_date)}</div>
      </div>
    </div>
  </div>
  <div class="box" style="margin-top:24px;">
    <strong>Assigned Inspector:</strong>
    <ol style="margin:8px 0 0;padding-left:18px;">
      <li style="border-bottom:1px solid #111;min-height:20px;">${form.inspector_1 || '&nbsp;'}</li>
      <li style="border-bottom:1px solid #111;min-height:20px;">${form.inspector_2 || '&nbsp;'}</li>
      <li style="border-bottom:1px solid #111;min-height:20px;">${form.inspector_3 || '&nbsp;'}</li>
    </ol>
  </div>
  <script>window.onload = () => window.print();</script>
</body></html>`;

  const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1000');
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
}
