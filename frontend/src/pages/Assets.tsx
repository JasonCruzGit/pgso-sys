import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { Search, QrCode, MapPin, User, Eye, Package, X, FileText } from 'lucide-react';
import api from '../api/client';
import DataTable from '../components/DataTable';
import Pagination from '../components/Pagination';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import Badge from '../components/Badge';
import InventoryItemPhoto from '../components/InventoryItemPhoto';
import type { MaterialReleaseItem, MaterialRelease } from '../types';
import { MrDetailModal } from './MaterialRelease';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleDateString() : '—';
}

function formatQtyInt(qty: string | number): string {
  const n = Number(qty);
  if (Number.isNaN(n)) return '0';
  return String(Math.round(n));
}

function isReleasedItem(data: MaterialReleaseItem | { property_number?: string }): data is MaterialReleaseItem {
  return 'material_release' in data || 'inventory_item_id' in data;
}

export default function Assets() {
  const { isEmployee } = useAuth();
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selected, setSelected] = useState<MaterialReleaseItem | null>(null);
  const [viewMr, setViewMr] = useState<MaterialRelease | null>(null);
  const [scanInput, setScanInput] = useState('');
  const detailsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = searchParams.get('search');
    if (q !== null) setSearch(q);
  }, [searchParams]);

  const { data, isLoading } = useQuery({
    queryKey: ['released-assets', page, search, departmentFilter, categoryFilter],
    queryFn: () => api.get('/assets/released-items', {
      params: {
        page,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(departmentFilter ? { department_id: departmentFilter } : {}),
        ...(categoryFilter ? { category_id: categoryFilter } : {}),
      },
    }).then((r) => r.data),
  });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments', { params: { per_page: 100, is_active: true } }).then((r) => r.data),
    enabled: !isEmployee,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories', { params: { per_page: 100, is_active: true } }).then((r) => r.data),
  });

  const deptList = departments?.data ?? departments ?? [];
  const categoryList = categories?.data ?? categories ?? [];

  const scrollToDetails = () => {
    requestAnimationFrame(() => detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const loadDetails = async (id: number) => {
    try {
      const { data: full } = await api.get(`/assets/released-items/${id}`);
      setSelected(full);
      scrollToDetails();
    } catch {
      toast.error('Failed to load item details');
    }
  };

  const viewMrRelease = async (mrId?: number) => {
    if (!mrId) return;
    try {
      const { data: mr } = await api.get(`/assets/material-releases/${mrId}`);
      setViewMr(mr);
    } catch {
      toast.error('Failed to load MR details');
    }
  };

  const handleScan = async () => {
    if (!scanInput.trim()) return;
    try {
      const { data } = await api.get(`/assets/scan/${encodeURIComponent(scanInput.trim())}`);
      if (isReleasedItem(data)) {
        setSelected(data);
        scrollToDetails();
        return;
      }
      toast.error('This property number is not on an MR release record');
    } catch {
      toast.error('Released item not found');
    }
  };

  const item = selected?.inventory_item;
  const release = selected?.material_release;
  const propertyNumber = item?.property_number ?? item?.item_code ?? '—';
  const qrValue = propertyNumber !== '—' ? propertyNumber : (item?.item_code ?? '');

  return (
    <div className="space-y-6">
      <PageHeader
        title="QR Asset Tracking"
        description={
          isEmployee
            ? 'View government property issued to you through Material Release (MR)'
            : 'Track government property issued through Material Release (MR)'
        }
      />

      <div className="card flex flex-col gap-3 p-4 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <QrCode className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            placeholder="Enter property number to scan..."
            className="input-field pl-11"
            onKeyDown={(e) => e.key === 'Enter' && handleScan()}
          />
        </div>
        <button type="button" onClick={handleScan} className="btn-primary w-full shrink-0 sm:w-auto">Scan Asset</button>
      </div>

      {selected && (
        <div ref={detailsRef}>
          <Card
            title="MR Released Item"
            subtitle={release?.mr_number ?? propertyNumber}
            action={(
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close details"
              >
                <X size={18} />
              </button>
            )}
          >
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-4">
                {item && (
                  <InventoryItemPhoto
                    itemId={item.id}
                    hasPhoto={item.has_photo ?? !!item.photo_path}
                    alt={item.name}
                    className="h-48 w-full"
                  />
                )}
                <div className="flex flex-col items-center justify-center rounded-2xl bg-slate-50 p-6 ring-1 ring-slate-100">
                  <QRCodeSVG value={qrValue} size={160} level="M" />
                  <p className="mt-3 text-center text-xs text-slate-500">Scan to identify this property</p>
                  <p className="mt-1 font-mono text-sm font-semibold text-palawan-700">{propertyNumber}</p>
                </div>
              </div>

              <div className="space-y-5 lg:col-span-2">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{item?.name ?? '—'}</h3>
                  {item?.item_code && (
                    <p className="mt-1 font-mono text-sm text-palawan-700">{item.item_code}</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {release?.mr_number && (
                    <span className="rounded-full bg-palawan-50 px-2.5 py-0.5 text-xs font-semibold text-palawan-700">
                      {release.mr_number}
                    </span>
                  )}
                  {item?.status && <Badge status={item.status} />}
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">MR Released</span>
                  {release?.department && (
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">{release.department.name}</span>
                  )}
                </div>

                <dl className="grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-slate-400">Property Number</dt>
                    <dd className="font-mono font-semibold text-palawan-700">{propertyNumber}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Serial Number</dt>
                    <dd className="font-mono font-medium text-slate-900">{selected?.serial_number ?? item?.serial_number ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">MR Number</dt>
                    <dd className="font-mono font-medium text-slate-900">{release?.mr_number ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Released Date</dt>
                    <dd className="text-slate-900">{formatDate(release?.release_date)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Quantity Released</dt>
                    <dd className="font-semibold text-slate-900">
                      {selected ? `${formatQtyInt(selected.quantity)} ${item?.unit_of_measure ?? ''}` : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Unit Cost</dt>
                    <dd className="text-slate-900">{item ? `₱${Number(item.unit_cost).toLocaleString()}` : '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Brand / Model</dt>
                    <dd className="text-slate-900">{[item?.brand, item?.model].filter(Boolean).join(' · ') || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Category</dt>
                    <dd className="font-medium text-slate-900">{item?.category?.name ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Assigned Employee</dt>
                    <dd className="flex items-center gap-2 text-slate-900">
                      <User size={14} className="text-slate-400" />
                      {release?.recipient?.name ?? '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Department</dt>
                    <dd className="text-slate-900">{release?.department?.name ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Released By</dt>
                    <dd className="text-slate-900">{release?.releaser?.name ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Storage Location</dt>
                    <dd className="flex items-center gap-2 text-slate-900">
                      <MapPin size={14} className="text-slate-400" />
                      {item?.storage_location ?? '—'}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-slate-400">Purpose</dt>
                    <dd className="mt-1 flex items-start gap-2 text-slate-700">
                      <FileText size={14} className="mt-0.5 shrink-0 text-slate-400" />
                      {release?.purpose ?? '—'}
                    </dd>
                  </div>
                  {release?.notes && (
                    <div className="sm:col-span-2">
                      <dt className="text-slate-400">Notes</dt>
                      <dd className="mt-1 text-slate-700">{release.notes}</dd>
                    </div>
                  )}
                  {item?.description && (
                    <div className="sm:col-span-2">
                      <dt className="text-slate-400">Description</dt>
                      <dd className="mt-1 text-slate-700">{item.description}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="text-slate-400">Date Acquired</dt>
                    <dd className="flex items-center gap-2 text-slate-900">
                      <Package size={14} className="text-slate-400" />
                      {formatDate(item?.date_acquired)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Supplier</dt>
                    <dd className="text-slate-900">{item?.supplier?.name ?? '—'}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </Card>
        </div>
      )}

      <div className={`card grid gap-4 p-4 sm:items-end ${isEmployee ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
        <div className={`min-w-0 ${isEmployee ? '' : 'sm:col-span-2 lg:col-span-1'}`}>
          <label htmlFor="asset-search" className="mb-1.5 block text-sm font-medium text-slate-700">Search</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              id="asset-search"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder={isEmployee ? 'Search your MR items...' : 'Search MR number, property no., item, department...'}
              className="input-field w-full !pl-11"
            />
          </div>
        </div>
        {!isEmployee && (
          <div className="min-w-0">
            <label htmlFor="asset-department" className="mb-1.5 block text-sm font-medium text-slate-700">Department</label>
            <select
              id="asset-department"
              value={departmentFilter}
              onChange={(e) => { setDepartmentFilter(e.target.value); setPage(1); }}
              className="filter-select w-full"
            >
              <option value="">All Departments</option>
              {deptList.map((d: { id: number; name: string }) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="min-w-0">
          <label htmlFor="asset-category" className="mb-1.5 block text-sm font-medium text-slate-700">Category</label>
          <select
            id="asset-category"
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="filter-select w-full"
          >
            <option value="">All Categories</option>
            {categoryList.map((c: { id: number; name: string }) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <DataTable<MaterialReleaseItem>
        loading={isLoading}
        data={data?.data ?? []}
        emptyTitle={isEmployee ? 'No property assigned to you yet' : 'No MR released items yet'}
        emptyDescription={
          search || departmentFilter || categoryFilter
            ? 'No released items match your search or filters.'
            : isEmployee
              ? 'Property released to you through MR will appear here.'
              : 'Property issued through Material Release will appear here.'
        }
        columns={[
          { key: 'mr_number', label: 'MR No.', render: (r) => (
            <span className="font-mono text-xs font-semibold text-palawan-700">{r.material_release?.mr_number ?? '—'}</span>
          ) },
          { key: 'property_number', label: 'Property No.', render: (r) => (
            <span className="font-mono text-xs font-semibold text-palawan-700">{r.inventory_item?.property_number ?? r.inventory_item?.item_code ?? '—'}</span>
          ) },
          { key: 'name', label: 'Item', mobilePrimary: true, render: (r) => r.inventory_item?.name ?? '—' },
          { key: 'serial_number', label: 'Serial', render: (r) => (
            <span className="font-mono text-xs">{r.serial_number ?? r.inventory_item?.serial_number ?? '—'}</span>
          ) },
          { key: 'quantity', label: 'Qty', render: (r) => formatQtyInt(r.quantity) },
          { key: 'unit', label: 'Unit', render: (r) => (
            <span className="uppercase text-slate-600">{r.inventory_item?.unit_of_measure ?? '—'}</span>
          ) },
          { key: 'recipient', label: 'Employee', render: (r) => r.material_release?.recipient?.name ?? '—' },
          { key: 'department', label: 'Department', render: (r) => r.material_release?.department?.name ?? '—' },
          { key: 'release_date', label: 'Released', render: (r) => formatDate(r.material_release?.release_date) },
          {
            key: 'actions',
            label: '',
            render: (r) => (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => loadDetails(r.id)}
                  className="inline-flex items-center gap-1 rounded-lg bg-palawan-50 px-2.5 py-1 text-xs font-semibold text-palawan-700 hover:bg-palawan-100"
                >
                  <Eye size={14} /> View
                </button>
                {r.material_release?.id && (
                  <button
                    type="button"
                    onClick={() => viewMrRelease(r.material_release?.id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                  >
                    MR Slip
                  </button>
                )}
              </div>
            ),
          },
        ]}
      />
      <Pagination currentPage={data?.current_page ?? 1} lastPage={data?.last_page ?? 1} onPageChange={setPage} />

      {viewMr && <MrDetailModal mr={viewMr} onClose={() => setViewMr(null)} />}
    </div>
  );
}
