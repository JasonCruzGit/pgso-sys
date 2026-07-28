import type { ReactNode } from 'react';
import EmptyState from './EmptyState';
import { Inbox } from 'lucide-react';

interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  /** Highlighted title on mobile cards */
  mobilePrimary?: boolean;
  /** Omit from mobile card body */
  hideOnMobile?: boolean;
  align?: 'left' | 'center' | 'right';
  /** Allow cell content to wrap (overrides default nowrap) */
  wrap?: boolean;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  toolbar?: React.ReactNode;
  /** Tighter row padding and stronger row dividers */
  dense?: boolean;
  /** Optional row click handler (desktop + mobile cards) */
  onRowClick?: (row: T) => void;
}

function alignClass(align?: 'left' | 'center' | 'right') {
  if (align === 'right') return 'text-right';
  if (align === 'center') return 'text-center';
  return 'text-left';
}

function TableSkeleton({ cols }: { cols: number }) {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="skeleton h-8 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

function getCellValue<T>(row: T, col: Column<T>) {
  return col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '');
}

function isActionColumn<T>(col: Column<T>) {
  return col.key === 'actions' || (!col.label && col.key === 'actions');
}

function MobileCardList<T extends { id?: number | string }>({
  columns,
  data,
  onRowClick,
}: {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
}) {
  const primaryCol =
    columns.find((c) => c.mobilePrimary)
    ?? columns.find((c) => c.label && !isActionColumn(c));

  const bodyCols = columns.filter(
    (c) => c !== primaryCol && c.label && !c.hideOnMobile && !isActionColumn(c),
  );

  const actionCol = columns.find((c) => isActionColumn(c));

  const wideKeys = new Set(['name', 'description', 'item', 'purpose', 'notes', 'department', 'recipient', 'employee']);

  return (
    <div className="divide-y divide-slate-100 md:hidden">
      {data.map((row, i) => (
        <div
          key={row.id ?? i}
          role={onRowClick ? 'button' : undefined}
          tabIndex={onRowClick ? 0 : undefined}
          onClick={onRowClick ? () => onRowClick(row) : undefined}
          onKeyDown={onRowClick ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onRowClick(row);
            }
          } : undefined}
          className={`px-4 py-4 ${onRowClick ? 'cursor-pointer active:bg-slate-50' : ''}`}
        >
          {primaryCol && (
            <div className="mb-3 text-sm font-semibold leading-snug text-slate-900">
              {getCellValue(row, primaryCol)}
            </div>
          )}
          {bodyCols.length > 0 && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
              {bodyCols.map((col) => (
                <div
                  key={col.key}
                  className={wideKeys.has(col.key) ? 'col-span-2 min-w-0' : 'min-w-0'}
                >
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {col.label}
                  </dt>
                  <dd className="mt-0.5 break-words text-slate-700">{getCellValue(row, col)}</dd>
                </div>
              ))}
            </dl>
          )}
          {actionCol && (
            <div
              className="mt-3 border-t border-slate-50 pt-3"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {getCellValue(row, actionCol)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function DataTable<T extends { id?: number | string }>({
  columns,
  data,
  loading,
  emptyTitle = 'No records found',
  emptyDescription = 'There are no items to display.',
  toolbar,
  dense = false,
  onRowClick,
}: DataTableProps<T>) {
  const cellPad = dense ? 'px-3 py-2 sm:px-4 sm:py-2.5' : 'px-3 py-3 sm:px-5 sm:py-3.5';
  const headPad = dense ? 'px-3 py-2 sm:px-4 sm:py-2.5' : 'px-3 py-2.5 sm:px-5 sm:py-3';

  if (loading) {
    return <div className="card overflow-hidden"><TableSkeleton cols={columns.length} /></div>;
  }

  if (!data.length) {
    return (
      <div className="card">
        {toolbar && <div className="border-b border-slate-100 px-5 py-4">{toolbar}</div>}
        <EmptyState icon={Inbox} title={emptyTitle} description={emptyDescription} />
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {toolbar && <div className="border-b border-slate-100 px-5 py-4">{toolbar}</div>}
      <MobileCardList columns={columns} data={data} onRowClick={onRowClick} />
      <div className="hidden overflow-x-auto md:block">
        <table className="table-zebra w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`whitespace-nowrap font-semibold ${headPad} ${alignClass(col.align)} ${col.headerClassName ?? ''}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr
                key={row.id ?? i}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={onRowClick ? 'cursor-pointer transition hover:bg-palawan-50/40' : undefined}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`${col.wrap ? 'whitespace-normal' : 'whitespace-nowrap'} ${cellPad} text-slate-700 ${alignClass(col.align)} ${col.className ?? ''}`}
                  >
                    {getCellValue(row, col)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
