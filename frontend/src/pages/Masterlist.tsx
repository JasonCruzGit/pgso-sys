import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Eye, Search, Users } from 'lucide-react';
import api from '../api/client';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import Badge from '../components/Badge';
import { useAuth } from '../context/AuthContext';
import type { AssetAssignment, Department, MaterialRelease, User } from '../types';
import {
  AccountabilityDetailModal,
  openAccountabilityPrintPreview,
} from './PropertyAccountability';

type MasterlistItem = {
  id: number;
  quantity: number;
  unit_cost?: number | string;
  serial_number?: string;
  inventory_item?: {
    id: number;
    name: string;
    item_code?: string;
    unit_of_measure?: string;
    unit_cost?: number;
    property_number?: string;
  };
};

type MasterlistMr = MaterialRelease & {
  items?: MasterlistItem[];
};

type MasterlistEmployee = User & {
  department?: Department;
  material_releases?: MasterlistMr[];
  accountability_assignments?: AssetAssignment[];
};

function formatMoney(value?: number | string) {
  const amount = Number(value ?? 0);
  return `₱${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

type MasterlistFocus = 'mr' | 'mr-items' | 'ics' | 'par';

function SummaryBadge({
  label,
  count,
  tone,
  onClick,
}: {
  label: string;
  count: number;
  tone: 'emerald' | 'blue' | 'amber' | 'violet';
  onClick: (e: React.MouseEvent) => void;
}) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 ring-emerald-300',
    blue: 'bg-blue-50 text-blue-700 hover:bg-blue-100 ring-blue-300',
    amber: 'bg-amber-50 text-amber-700 hover:bg-amber-100 ring-amber-300',
    violet: 'bg-violet-50 text-violet-700 hover:bg-violet-100 ring-violet-300',
  };

  return (
    <button
      type="button"
      disabled={count === 0}
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-xs font-medium transition hover:ring-2 disabled:cursor-not-allowed disabled:opacity-40 ${tones[tone]}`}
    >
      {count} {label}
    </button>
  );
}

function EmployeeMasterlistCard({
  employee,
  expanded,
  onToggle,
  onExpand,
  onViewAssignment,
}: {
  employee: MasterlistEmployee;
  expanded: boolean;
  onToggle: () => void;
  onExpand: () => void;
  onViewAssignment: (assignment: AssetAssignment) => void;
}) {
  const mrs = employee.material_releases ?? [];
  const assignments = employee.accountability_assignments ?? [];
  const mrItemCount = mrs.reduce((sum, mr) => sum + (mr.items?.length ?? 0), 0);
  const icsCount = assignments.filter((a) => a.document_type === 'ics').length;
  const parCount = assignments.filter((a) => a.document_type === 'par').length;

  const [focus, setFocus] = useState<MasterlistFocus | null>(null);
  const [filter, setFilter] = useState('');
  const [openMrIds, setOpenMrIds] = useState<Record<number, boolean>>({});
  const mrSectionRef = useRef<HTMLElement>(null);
  const accountabilityRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!expanded || !focus) return;
    const target = focus === 'ics' || focus === 'par' ? accountabilityRef : mrSectionRef;
    const timer = window.setTimeout(() => {
      target.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [expanded, focus]);

  const jumpTo = (section: MasterlistFocus, e: React.MouseEvent) => {
    e.stopPropagation();
    if (countForSection(section) === 0) return;
    if (!expanded) onExpand();
    setFocus(section);
  };

  const countForSection = (section: MasterlistFocus) => {
    if (section === 'mr') return mrs.length;
    if (section === 'mr-items') return mrItemCount;
    if (section === 'ics') return icsCount;
    return parCount;
  };

  const normalizedFilter = filter.trim().toLowerCase();
  const filteredMrs = useMemo(() => {
    if (!normalizedFilter) return mrs;
    return mrs.filter((mr) => {
      const header = [
        mr.mr_number,
        mr.purpose,
        mr.status,
        mr.release_date ? new Date(mr.release_date).toLocaleDateString() : '',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (header.includes(normalizedFilter)) return true;
      return (mr.items ?? []).some((item) => {
        const blob = [
          item.inventory_item?.name,
          item.inventory_item?.property_number,
          item.inventory_item?.item_code,
          item.serial_number,
          String(item.quantity ?? ''),
          String(item.unit_cost ?? ''),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return blob.includes(normalizedFilter);
      });
    });
  }, [mrs, normalizedFilter]);

  const filteredAssignments = useMemo(() => {
    if (!normalizedFilter) return assignments;
    return assignments.filter((a) => {
      const item = a.asset?.inventory_item ?? a.material_release_item?.inventory_item;
      const blob = [
        a.document_type,
        a.acknowledgment_number,
        a.assignment_number,
        a.material_release?.mr_number,
        a.status,
        a.assignment_date,
        item?.name,
        item?.property_number,
        item?.item_code,
        item?.serial_number,
        String(item?.unit_cost ?? ''),
        a.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return blob.includes(normalizedFilter);
    });
  }, [assignments, normalizedFilter]);

  const visibleAssignments = focus === 'ics'
    ? filteredAssignments.filter((a) => a.document_type === 'ics')
    : focus === 'par'
      ? filteredAssignments.filter((a) => a.document_type === 'par')
      : filteredAssignments;

  const mrSectionTitle = focus === 'mr-items' ? 'Material Release Items' : 'Material Releases';
  const accountabilityTitle = focus === 'ics'
    ? 'ICS Records'
    : focus === 'par'
      ? 'PAR Records'
      : 'ICS / PAR Accountability';

  const sectionHighlight = (matches: boolean) => (
    matches ? 'ring-2 ring-palawan-300 ring-offset-2' : ''
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-4 py-4 text-left hover:bg-slate-50/80 sm:items-center sm:px-5"
      >
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-palawan-50 text-palawan-700 sm:mt-0">
          <Users size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-slate-900">{employee.name}</p>
            {employee.employee_id && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600">
                {employee.employee_id}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-slate-500">{employee.department?.name ?? 'No department'}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <SummaryBadge
              label={`MR${mrs.length === 1 ? '' : 's'}`}
              count={mrs.length}
              tone="emerald"
              onClick={(e) => jumpTo('mr', e)}
            />
            <SummaryBadge
              label={`MR item${mrItemCount === 1 ? '' : 's'}`}
              count={mrItemCount}
              tone="blue"
              onClick={(e) => jumpTo('mr-items', e)}
            />
            <SummaryBadge
              label="ICS"
              count={icsCount}
              tone="amber"
              onClick={(e) => jumpTo('ics', e)}
            />
            <SummaryBadge
              label="PAR"
              count={parCount}
              tone="violet"
              onClick={(e) => jumpTo('par', e)}
            />
          </div>
        </div>
        <div className="shrink-0 text-slate-400">
          {expanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
        </div>
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-slate-100 bg-slate-50/40 px-4 py-4 sm:px-5">
          <div className="rounded-xl border border-slate-100 bg-white p-3">
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">Quick filter</label>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search MR no., item, property no., serial, ICS/PAR no..."
              className="input-field w-full"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Tip: type a serial number or property number to jump quickly.
            </p>
          </div>

          {(focus === null || focus === 'mr' || focus === 'mr-items') && (
          <section
            ref={mrSectionRef}
            className={`rounded-xl transition ${sectionHighlight(focus === 'mr' || focus === 'mr-items')}`}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">{mrSectionTitle}</h3>
              {focus && (focus === 'mr' || focus === 'mr-items') && (
                <button
                  type="button"
                  onClick={() => setFocus(null)}
                  className="text-[11px] font-medium text-palawan-700 hover:underline"
                >
                  Show all
                </button>
              )}
            </div>
            {mrs.length === 0 ? (
              <p className="rounded-xl border border-slate-100 bg-white px-4 py-3 text-sm text-slate-500">
                No material releases recorded for this employee.
              </p>
            ) : (
              <div className="space-y-3">
                {filteredMrs.map((mr) => {
                  const isOpen = openMrIds[mr.id] ?? false;
                  const itemCount = (mr.items ?? []).length;
                  const totalAmount = (mr.items ?? []).reduce((sum, item) => {
                    const qty = Number(item.quantity ?? 0);
                    const cost = Number(item.unit_cost ?? item.inventory_item?.unit_cost ?? 0);
                    if (!Number.isFinite(qty) || !Number.isFinite(cost)) return sum;
                    return sum + qty * cost;
                  }, 0);

                  return (
                    <div key={mr.id} className="overflow-hidden rounded-xl border border-slate-100 bg-white">
                      <button
                        type="button"
                        onClick={() => setOpenMrIds((prev) => ({ ...prev, [mr.id]: !isOpen }))}
                        className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left hover:bg-slate-50"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-mono text-sm font-semibold text-palawan-700">{mr.mr_number}</p>
                            <Badge status={mr.status ?? 'completed'} />
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                              {itemCount} item{itemCount === 1 ? '' : 's'}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                              {formatMoney(totalAmount)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {mr.release_date ? new Date(mr.release_date).toLocaleDateString() : '—'}
                            {mr.purpose ? ` · ${mr.purpose}` : ''}
                          </p>
                        </div>
                        <div className="shrink-0 text-slate-400">
                          {isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </div>
                      </button>

                      {isOpen && itemCount > 0 && (
                        <div className="border-t border-slate-100">
                          <div className="overflow-x-auto">
                            <table className="table-zebra min-w-full text-sm">
                              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                <tr>
                                  <th className="px-3 py-2">Item</th>
                                  <th className="px-3 py-2">Property No.</th>
                                  <th className="px-3 py-2 text-right">Qty</th>
                                  <th className="px-3 py-2 text-right">Unit Cost</th>
                                  <th className="px-3 py-2">Serial</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(mr.items ?? []).map((item) => (
                                  <tr key={item.id}>
                                    <td className="px-3 py-2 text-slate-800">{item.inventory_item?.name ?? '—'}</td>
                                    <td className="px-3 py-2 font-mono text-xs text-slate-600">
                                      {item.inventory_item?.property_number ?? item.inventory_item?.item_code ?? '—'}
                                    </td>
                                    <td className="px-3 py-2 text-right text-slate-700">{item.quantity}</td>
                                    <td className="px-3 py-2 text-right text-slate-700">{formatMoney(item.unit_cost ?? item.inventory_item?.unit_cost)}</td>
                                    <td className="px-3 py-2 font-mono text-xs text-slate-600">{item.serial_number ?? '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
          )}

          {(focus === null || focus === 'ics' || focus === 'par') && (
          <section
            ref={accountabilityRef}
            className={`rounded-xl transition ${sectionHighlight(focus === 'ics' || focus === 'par')}`}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">{accountabilityTitle}</h3>
              {focus && (focus === 'ics' || focus === 'par') && (
                <button
                  type="button"
                  onClick={() => setFocus(null)}
                  className="text-[11px] font-medium text-palawan-700 hover:underline"
                >
                  Show all
                </button>
              )}
            </div>
            {visibleAssignments.length === 0 ? (
              <p className="rounded-xl border border-slate-100 bg-white px-4 py-3 text-sm text-slate-500">
                {focus === 'ics'
                  ? 'No ICS records assigned to this employee.'
                  : focus === 'par'
                    ? 'No PAR records assigned to this employee.'
                    : 'No ICS or PAR records assigned to this employee.'}
              </p>
            ) : (
              <div className="space-y-2">
                {visibleAssignments.map((assignment) => {
                  const item = assignment.asset?.inventory_item ?? assignment.material_release_item?.inventory_item;
                  const doc = (assignment.document_type ?? '').toLowerCase();
                  const isPar = doc === 'par';
                  const docPillClass = isPar
                    ? 'bg-violet-100 text-violet-800 ring-violet-200'
                    : 'bg-amber-100 text-amber-800 ring-amber-200';
                  const cardClass = isPar
                    ? 'border-violet-200/70 bg-violet-50/30'
                    : 'border-amber-200/70 bg-amber-50/30';
                  return (
                    <div
                      key={assignment.id}
                      className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${cardClass}`}
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ${docPillClass}`}>
                            {assignment.document_type}
                          </span>
                          <p className="font-mono text-sm font-semibold text-palawan-700">
                            {assignment.acknowledgment_number ?? assignment.assignment_number}
                          </p>
                          <Badge status={assignment.status} />
                        </div>
                        <p className="mt-1 text-sm font-medium text-slate-900">{item?.name ?? '—'}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          MR: {assignment.material_release?.mr_number ?? '—'}
                          {' · '}
                          Issued: {new Date(assignment.assignment_date).toLocaleDateString()}
                          {' · '}
                          {formatMoney(item?.unit_cost)}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => onViewAssignment(assignment)}
                          className="inline-flex items-center gap-1 rounded-lg bg-palawan-50 px-2.5 py-1.5 text-xs font-semibold text-palawan-700 hover:bg-palawan-100"
                        >
                          <Eye size={14} /> View
                        </button>
                        <button
                          type="button"
                          onClick={() => openAccountabilityPrintPreview(assignment)}
                          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Print
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
          )}
        </div>
      )}
    </div>
  );
}

export default function Masterlist() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [viewAssignment, setViewAssignment] = useState<AssetAssignment | null>(null);
  const { hasPermission } = useAuth();

  const canView = hasPermission('requests.release')
    || hasPermission('issuance.*')
    || hasPermission('property.view')
    || hasPermission('property.*');

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments').then((r) => r.data),
    enabled: canView,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['masterlist', page, search, departmentFilter],
    queryFn: () => api.get('/masterlist', {
      params: {
        page,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(departmentFilter ? { department_id: departmentFilter } : {}),
      },
    }).then((r) => r.data),
    enabled: canView,
  });

  const openAssignmentDetail = async (assignment: AssetAssignment) => {
    const { data: full } = await api.get(`/property-accountability/${assignment.id}`);
    setViewAssignment(full);
  };

  if (!canView) {
    return (
      <div className="card p-8 text-center text-slate-500">
        You do not have permission to view the employee masterlist.
      </div>
    );
  }

  const employees = (data?.data ?? []) as MasterlistEmployee[];
  const deptList = departments?.data ?? departments ?? [];

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title="Masterlist"
        description="All employees with their material releases and ICS / PAR accountability records"
      />

      <div className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_11rem] sm:items-end">
        <div className="sm:col-span-2 lg:col-span-1">
          <label htmlFor="masterlist-search" className="mb-1.5 block text-sm font-medium text-slate-700">Search</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              id="masterlist-search"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search employee name, ID, or email..."
              className="input-field w-full !pl-11"
            />
          </div>
        </div>
        <div>
          <label htmlFor="masterlist-dept" className="mb-1.5 block text-sm font-medium text-slate-700">Department</label>
          <select
            id="masterlist-dept"
            value={departmentFilter}
            onChange={(e) => { setDepartmentFilter(e.target.value); setPage(1); }}
            className="input-field w-full"
          >
            <option value="">All Departments</option>
            {deptList.map((d: Department) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="card p-8 text-center text-sm text-slate-500">Loading masterlist...</div>
      ) : employees.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-500">
          No employees match your search or filters.
        </div>
      ) : (
        <div className="space-y-3">
          {employees.map((employee) => (
            <EmployeeMasterlistCard
              key={employee.id}
              employee={employee}
              expanded={expandedId === employee.id}
              onToggle={() => setExpandedId((current) => (current === employee.id ? null : employee.id))}
              onExpand={() => setExpandedId(employee.id)}
              onViewAssignment={openAssignmentDetail}
            />
          ))}
        </div>
      )}

      <Pagination
        currentPage={data?.current_page ?? 1}
        lastPage={data?.last_page ?? 1}
        onPageChange={setPage}
      />

      {viewAssignment && (
        <AccountabilityDetailModal
          assignment={viewAssignment}
          onClose={() => setViewAssignment(null)}
        />
      )}
    </div>
  );
}
