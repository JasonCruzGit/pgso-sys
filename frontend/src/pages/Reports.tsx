import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, BarChart3, Package, Truck, ClipboardList, Wrench, ShoppingCart, PhilippinePeso } from 'lucide-react';
import api from '../api/client';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';

const reports = [
  { id: 'current-inventory', name: 'Current Inventory', desc: 'Complete stock listing with values', endpoint: '/reports/current-inventory', icon: BarChart3 },
  { id: 'issuance', name: 'Issuance Report', desc: 'Released items by date range', endpoint: '/reports/issuance', icon: FileText },
  { id: 'asset-registry', name: 'Asset Registry', desc: 'Government property accountability', endpoint: '/reports/asset-registry', icon: FileSpreadsheet },
  { id: 'disposal', name: 'Disposal Report', desc: 'Disposed items and write-offs', endpoint: '/reports/disposal', icon: FileText },
  { id: 'stock-in', name: 'Stock In Report', desc: 'Incoming stock transactions', endpoint: '/reports/stock-in', icon: Truck },
  { id: 'stock-out', name: 'Stock Out Report', desc: 'Outgoing stock transactions', endpoint: '/reports/stock-out', icon: Package },
  { id: 'reconciliation', name: 'Reconciliation Report', desc: 'Physical count variances', endpoint: '/reports/reconciliation', icon: ClipboardList },
  { id: 'asset-assignments', name: 'Asset Assignments', desc: 'Property accountability records', endpoint: '/reports/asset-assignments', icon: FileSpreadsheet },
  { id: 'maintenance', name: 'Maintenance Report', desc: 'Scheduled and completed maintenance', endpoint: '/reports/maintenance', icon: Wrench },
  { id: 'repairs', name: 'Repair Report', desc: 'Asset repair history', endpoint: '/reports/repairs', icon: Wrench },
  { id: 'inspections', name: 'Inspection Report', desc: 'Inspection schedules and results', endpoint: '/reports/inspections', icon: ClipboardList },
  { id: 'procurement-status', name: 'Procurement Status', desc: 'PR and PO pipeline summary', endpoint: '/reports/procurement-status', icon: ShoppingCart },
  { id: 'suppliers', name: 'Supplier Report', desc: 'Supplier directory and activity', endpoint: '/reports/suppliers', icon: FileText },
  { id: 'budget-utilization', name: 'Budget Utilization', desc: 'Allocated vs spent by department', endpoint: '/reports/budget-utilization', icon: PhilippinePeso },
];

export default function Reports() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const download = async (endpoint: string, format: string, name: string) => {
    const response = await api.get(endpoint, {
      params: { format, from: from || undefined, to: to || undefined },
      responseType: format === 'json' ? 'json' : 'blob',
    });

    if (format === 'json') return;

    const ext = format === 'excel' ? 'xls' : format;
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${name}.${ext}`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Generate and export official inventory reports"
      />

      <Card title="Date Range Filter" subtitle="Optional — applies to issuance reports">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input-field" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input-field" />
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {reports.map((report) => (
          <div key={report.id} className="card card-hover p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-palawan-50 text-palawan-600">
                <report.icon size={22} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-slate-800">{report.name}</h3>
                <p className="mt-0.5 text-xs text-slate-500">{report.desc}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={() => download(report.endpoint, 'pdf', report.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-palawan-300 hover:bg-palawan-50 hover:text-palawan-700">
                    <FileText size={14} /> PDF
                  </button>
                  <button onClick={() => download(report.endpoint, 'excel', report.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-palawan-300 hover:bg-palawan-50 hover:text-palawan-700">
                    <FileSpreadsheet size={14} /> Excel
                  </button>
                  <button onClick={() => download(report.endpoint, 'csv', report.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-palawan-300 hover:bg-palawan-50 hover:text-palawan-700">
                    <Download size={14} /> CSV
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
