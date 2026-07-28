import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search, User, Printer, Eye, ClipboardList, Building2, ShieldCheck, FileDown,
} from 'lucide-react';
import api from '../api/client';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import toast from 'react-hot-toast';
import type { AssetAssignment, Department, User as AppUser } from '../types';
import {
  AccountabilityDetailModal,
  openAccountabilityPrintPreview,
} from './PropertyAccountability';
import { openIpaListPrintPreview } from '../utils/ipaPrint';

type IpaEmployee = AppUser & {
  department?: Department;
  property_count?: number;
};

type IpaPropertyRow = {
  id: number;
  property_number: string;
  reference_number: string;
  document_type: string;
  description: string;
  date_acquired?: string;
  quantity: number;
  unit_of_measure: string;
  unit_value: number;
  total_value: number;
  status: string;
  responsibility_center?: string;
  inspector?: string;
  mr_reference?: string;
  assignment: AssetAssignment;
};

type IpaDetailResponse = {
  employee: AppUser & {
    designation?: string;
    department?: Department;
  };
  summary: {
    total: number;
    active: number;
    surrendered: number;
    total_value: number;
  };
  properties: IpaPropertyRow[];
};

type PropertyView = 'all' | 'active' | 'surrendered';

function formatMoney(value?: number | string) {
  const amount = Number(value ?? 0);
  return `₱${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value?: string) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function IndividualPropertyAccountability() {
  const [employeePage, setEmployeePage] = useState(1);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [propertyView, setPropertyView] = useState<PropertyView>('all');
  const [propertyNo, setPropertyNo] = useState('');
  const [responsibilityCenter, setResponsibilityCenter] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<number[]>([]);
  const [viewingAssignment, setViewingAssignment] = useState<AssetAssignment | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  const { data: employeesData, isLoading: loadingEmployees } = useQuery({
    queryKey: ['ipa-employees', employeePage, employeeSearch],
    queryFn: () => api.get('/individual-property-accountability/employees', {
      params: {
        page: employeePage,
        per_page: 50,
        search: employeeSearch || undefined,
      },
    }).then((r) => r.data),
  });

  const employees = (employeesData?.data ?? []) as IpaEmployee[];

  useEffect(() => {
    if (!selectedEmployeeId && employees.length > 0) {
      setSelectedEmployeeId(employees[0].id);
    }
  }, [employees, selectedEmployeeId]);

  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: [
      'ipa-employee-detail',
      selectedEmployeeId,
      propertyNo,
      responsibilityCenter,
      referenceNo,
      documentType,
    ],
    queryFn: () => api.get(`/individual-property-accountability/employees/${selectedEmployeeId}`, {
      params: {
        property_no: propertyNo || undefined,
        responsibility_center: responsibilityCenter || undefined,
        reference_no: referenceNo || undefined,
        document_type: documentType || undefined,
      },
    }).then((r) => r.data as IpaDetailResponse),
    enabled: !!selectedEmployeeId,
  });

  const visibleProperties = useMemo(() => {
    const rows = detail?.properties ?? [];
    if (propertyView === 'active') return rows.filter((r) => r.status === 'active');
    if (propertyView === 'surrendered') return rows.filter((r) => r.status !== 'active');
    return rows;
  }, [detail?.properties, propertyView]);

  const toggleProperty = (id: number) => {
    setSelectedPropertyIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleAllVisible = () => {
    const ids = visibleProperties.map((p) => p.id);
    const allSelected = ids.length > 0 && ids.every((id) => selectedPropertyIds.includes(id));
    if (allSelected) {
      setSelectedPropertyIds((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSelectedPropertyIds((prev) => [...new Set([...prev, ...ids])]);
    }
  };

  const printAllListed = () => {
    if (!detail || visibleProperties.length === 0) {
      toast.error('No properties to print');
      return;
    }

    openIpaListPrintPreview(
      {
        name: detail.employee.name,
        employee_id: detail.employee.employee_id,
        designation: detail.employee.designation,
        department: detail.employee.department?.name,
      },
      visibleProperties.map(({ assignment: _assignment, ...row }) => row),
      {
        total: visibleProperties.length,
        active: visibleProperties.filter((p) => p.status === 'active').length,
        surrendered: visibleProperties.filter((p) => p.status !== 'active').length,
        total_value: visibleProperties.reduce((sum, p) => sum + Number(p.total_value), 0),
      },
      propertyView,
    );
  };

  const exportToPdf = async () => {
    if (!selectedEmployeeId) return;

    setExportingPdf(true);
    try {
      const response = await api.get(
        `/individual-property-accountability/employees/${selectedEmployeeId}/export/pdf`,
        {
          params: {
            property_no: propertyNo || undefined,
            responsibility_center: responsibilityCenter || undefined,
            reference_no: referenceNo || undefined,
            document_type: documentType || undefined,
            property_view: propertyView,
          },
          responseType: 'blob',
        },
      );

      const slug = detail?.employee.employee_id ?? String(selectedEmployeeId);
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `IPA-${slug}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('PDF exported');
    } catch {
      toast.error('Failed to export PDF');
    } finally {
      setExportingPdf(false);
    }
  };

  const printSelected = async () => {
    const selected = visibleProperties.filter((p) => selectedPropertyIds.includes(p.id));
    for (const row of selected) {
      const { data } = await api.get(`/property-accountability/${row.assignment.id}`);
      openAccountabilityPrintPreview(data as AssetAssignment);
    }
  };

  const openDetail = async (row: IpaPropertyRow) => {
    const { data } = await api.get(`/property-accountability/${row.assignment.id}`);
    setViewingAssignment(data as AssetAssignment);
  };

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Individual Property Accountability"
        description="View PAR and ICS property records assigned to each employee"
      />

      <div className="grid min-h-[calc(100vh-12rem)] gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Employee list */}
        <aside className="card flex flex-col overflow-hidden">
          <div className="border-b border-slate-100 p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-palawan-50 text-palawan-700">
                <User size={18} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Employees</h2>
                <p className="text-xs text-slate-500">All active employees</p>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                value={employeeSearch}
                onChange={(e) => { setEmployeeSearch(e.target.value); setEmployeePage(1); }}
                placeholder="Search name or employee no..."
                className="input-field !pl-9 text-sm"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingEmployees ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="skeleton h-16 rounded-xl" />
                ))}
              </div>
            ) : employees.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                No employees found.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 p-2">
                {employees.map((employee) => {
                  const active = employee.id === selectedEmployeeId;
                  return (
                    <li key={employee.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedEmployeeId(employee.id);
                          setSelectedPropertyIds([]);
                          setPropertyView('all');
                        }}
                        className={`w-full rounded-xl px-3 py-3 text-left transition ${
                          active
                            ? 'bg-palawan-600 text-white shadow-sm'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <p className={`text-sm font-semibold ${active ? 'text-white' : 'text-slate-900'}`}>
                          {employee.name}
                        </p>
                        <p className={`mt-0.5 font-mono text-[11px] ${active ? 'text-white/80' : 'text-slate-500'}`}>
                          {employee.employee_id ?? 'No employee ID'}
                        </p>
                        <p className={`mt-1 text-[11px] ${active ? 'text-white/75' : 'text-slate-400'}`}>
                          {employee.property_count ?? 0} propert{(employee.property_count ?? 0) === 1 ? 'y' : 'ies'}
                          {employee.department?.name ? ` · ${employee.department.name}` : ''}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {employeesData?.last_page > 1 && (
            <div className="border-t border-slate-100 p-3">
              <Pagination
                currentPage={employeesData.current_page}
                lastPage={employeesData.last_page}
                onPageChange={setEmployeePage}
              />
            </div>
          )}
        </aside>

        {/* Main panel */}
        <section className="flex min-h-0 flex-col gap-4">
          {!selectedEmployeeId ? (
            <EmptyState
              icon={ClipboardList}
              title="Select an employee"
              description="Choose an employee from the list to view their individual property accountability."
            />
          ) : (
            <>
              {/* Employee details card */}
              <div className="card overflow-hidden">
                <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Employee Details</p>
                      <h2 className="mt-1 text-xl font-bold text-slate-900">
                        {detail?.employee.name ?? selectedEmployee?.name}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        {detail?.employee.designation ?? selectedEmployee?.role?.name ?? '—'}
                        {detail?.employee.department?.name ? ` · ${detail.employee.department.name}` : ''}
                      </p>
                    </div>
                    {detail?.summary && (
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                          {detail.summary.active} active
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          {detail.summary.surrendered} surrendered
                        </span>
                        <span className="rounded-full bg-palawan-50 px-3 py-1 text-xs font-semibold text-palawan-700">
                          {formatMoney(detail.summary.total_value)} total value
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid gap-3 p-5 sm:grid-cols-3">
                  <div className="rounded-xl bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Employee No.</p>
                    <p className="mt-1 font-mono text-sm font-bold text-slate-900">
                      {detail?.employee.employee_id ?? selectedEmployee?.employee_id ?? '—'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Employee Name</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">{detail?.employee.name ?? '—'}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Designation</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {detail?.employee.designation ?? '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Filters */}
              <div className="card p-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Property No.</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                      <input
                        value={propertyNo}
                        onChange={(e) => setPropertyNo(e.target.value)}
                        placeholder="Search property no..."
                        className="input-field !pl-9 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Responsibility Center</label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                      <input
                        value={responsibilityCenter}
                        onChange={(e) => setResponsibilityCenter(e.target.value)}
                        placeholder="Office / department..."
                        className="input-field !pl-9 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Reference No.</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                      <input
                        value={referenceNo}
                        onChange={(e) => setReferenceNo(e.target.value)}
                        placeholder="PAR / ICS / MR ref..."
                        className="input-field !pl-9 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">Document Type</label>
                    <select
                      value={documentType}
                      onChange={(e) => setDocumentType(e.target.value)}
                      className="input-field text-sm"
                    >
                      <option value="">All Types</option>
                      <option value="par">PAR</option>
                      <option value="ics">ICS</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Properties table */}
              <div className="card flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={18} className="text-palawan-600" />
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Accountability Properties</h3>
                      <p className="text-xs text-slate-500">{visibleProperties.length} record(s)</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={printAllListed}
                      disabled={loadingDetail || visibleProperties.length === 0}
                      className="btn-secondary inline-flex items-center gap-2 text-sm disabled:opacity-50"
                    >
                      <Printer size={16} />
                      Print All
                    </button>
                    <button
                      type="button"
                      onClick={exportToPdf}
                      disabled={loadingDetail || visibleProperties.length === 0 || exportingPdf}
                      className="btn-secondary inline-flex items-center gap-2 text-sm disabled:opacity-50"
                    >
                      <FileDown size={16} />
                      {exportingPdf ? 'Exporting...' : 'Export PDF'}
                    </button>
                    <div className="inline-flex rounded-lg bg-slate-100 p-1">
                      {(['all', 'active', 'surrendered'] as PropertyView[]).map((view) => (
                        <button
                          key={view}
                          type="button"
                          onClick={() => setPropertyView(view)}
                          className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition ${
                            propertyView === view
                              ? 'bg-white text-slate-900 shadow-sm'
                              : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          {view}
                        </button>
                      ))}
                    </div>
                    {selectedPropertyIds.length > 0 && (
                      <button type="button" onClick={printSelected} className="btn-secondary inline-flex items-center gap-2 text-sm">
                        <Printer size={16} />
                        Print Selected ({selectedPropertyIds.length})
                      </button>
                    )}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  {loadingDetail ? (
                    <div className="space-y-2 p-4">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="skeleton h-12 rounded-lg" />
                      ))}
                    </div>
                  ) : visibleProperties.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-500">
                      No property records match the current filters.
                    </div>
                  ) : (
                    <table className="table-zebra min-w-full text-sm">
                      <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={visibleProperties.length > 0 && visibleProperties.every((p) => selectedPropertyIds.includes(p.id))}
                              onChange={toggleAllVisible}
                              className="rounded border-slate-300"
                            />
                          </th>
                          <th className="px-3 py-3">Property No.</th>
                          <th className="px-3 py-3">Reference No.</th>
                          <th className="px-3 py-3">Type</th>
                          <th className="min-w-[220px] px-3 py-3">Description</th>
                          <th className="px-3 py-3">Date Acquired</th>
                          <th className="px-3 py-3 text-right">Qty</th>
                          <th className="px-3 py-3">Unit</th>
                          <th className="px-3 py-3 text-right">Unit Value</th>
                          <th className="px-3 py-3 text-right">Total Value</th>
                          <th className="px-3 py-3">Status</th>
                          <th className="px-3 py-3" />
                        </tr>
                      </thead>
                      <tbody>
                        {visibleProperties.map((row) => (
                          <tr key={row.id}>
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={selectedPropertyIds.includes(row.id)}
                                onChange={() => toggleProperty(row.id)}
                                className="rounded border-slate-300"
                              />
                            </td>
                            <td className="px-3 py-3 font-mono text-xs font-semibold text-palawan-700">
                              {row.property_number}
                            </td>
                            <td className="px-3 py-3 font-mono text-xs text-slate-600">{row.reference_number}</td>
                            <td className="px-3 py-3">
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                row.document_type === 'PAR'
                                  ? 'bg-violet-100 text-violet-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}>
                                {row.document_type}
                              </span>
                            </td>
                            <td className="max-w-xs px-3 py-3 text-slate-700">
                              <p className="line-clamp-2">{row.description}</p>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 text-slate-600">{formatDate(row.date_acquired)}</td>
                            <td className="px-3 py-3 text-right font-medium">{row.quantity}</td>
                            <td className="px-3 py-3 text-slate-600">{row.unit_of_measure}</td>
                            <td className="whitespace-nowrap px-3 py-3 text-right">{formatMoney(row.unit_value)}</td>
                            <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-slate-900">
                              {formatMoney(row.total_value)}
                            </td>
                            <td className="px-3 py-3">
                              <Badge status={row.status} />
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => openDetail(row)}
                                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                  title="View details"
                                >
                                  <Eye size={16} />
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const { data } = await api.get(`/property-accountability/${row.assignment.id}`);
                                    openAccountabilityPrintPreview(data as AssetAssignment);
                                  }}
                                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                  title="Print"
                                >
                                  <Printer size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {viewingAssignment && (
        <AccountabilityDetailModal
          assignment={viewingAssignment}
          onClose={() => setViewingAssignment(null)}
        />
      )}
    </div>
  );
}
