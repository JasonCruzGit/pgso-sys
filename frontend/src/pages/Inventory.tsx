import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, X, Eye, ImagePlus } from 'lucide-react';
import api from '../api/client';
import DataTable from '../components/DataTable';
import Pagination from '../components/Pagination';
import PageHeader from '../components/PageHeader';
import Badge from '../components/Badge';
import InventoryItemModal from '../components/InventoryItemModal';
import type { InventoryItem } from '../types';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { UNITS_OF_MEASURE } from '../constants/units';

function formatOnHandQty(qty: number): string {
  const n = Number(qty);
  if (Number.isNaN(n)) return '0';
  return String(Math.round(n));
}

function sanitizeWholeNumberInput(value: string): string {
  if (value === '') return '';
  const digits = value.replace(/\D/g, '');
  if (digits === '') return '';
  return String(Math.max(0, parseInt(digits, 10)));
}

function blockDecimalKey(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key === '.' || e.key === ',' || e.key === 'e' || e.key === 'E' || e.key === '-') {
    e.preventDefault();
  }
}

export default function Inventory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(searchParams.get('search') ?? '');

  useEffect(() => {
    const q = searchParams.get('search');
    if (q !== null) setSearch(q);
  }, [searchParams]);

  const clearItemDeepLinkParams = () => {
    if (!searchParams.has('id') && !searchParams.has('property') && !searchParams.has('code')) return;
    const next = new URLSearchParams(searchParams);
    next.delete('id');
    next.delete('property');
    next.delete('code');
    setSearchParams(next, { replace: true });
  };
  const [consumableFilter, setConsumableFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [itemCode, setItemCode] = useState('');
  const [propertyNumber, setPropertyNumber] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [primaryCategoryId, setPrimaryCategoryId] = useState('');
  const [unitOfMeasure, setUnitOfMeasure] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reorderLevel, setReorderLevel] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [storageLocation, setStorageLocation] = useState('GSO Main Warehouse');
  const [dateAcquired, setDateAcquired] = useState(new Date().toISOString().slice(0, 10));
  const [condition, setCondition] = useState('good');
  const [isAsset, setIsAsset] = useState(false);
  const [isConsumable, setIsConsumable] = useState(true);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [viewItem, setViewItem] = useState<InventoryItem | null>(null);
  const { hasPermission, user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading || !user) return;

    const id = searchParams.get('id')?.trim();
    const property = searchParams.get('property')?.trim();
    const code = searchParams.get('code')?.trim();
    if (!id && !property && !code) return;

    let cancelled = false;

    (async () => {
      try {
        const identifier = id || property || code;
        if (!identifier) return;
        const { data } = await api.get(`/inventory/scan/${encodeURIComponent(identifier)}`);
        if (!cancelled) setViewItem(data);
      } catch {
        if (!cancelled) toast.error('Item not found');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, authLoading, user]);

  const queryClient = useQueryClient();
  const canCreate = hasPermission('inventory.create') || hasPermission('inventory.*');

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', page, search, consumableFilter, stockFilter],
    queryFn: () => api.get('/inventory', {
      params: {
        page,
        search,
        ...(consumableFilter === 'consumable' ? { is_consumable: true } : {}),
        ...(consumableFilter === 'non_consumable' ? { is_consumable: false } : {}),
        ...(stockFilter === 'low' ? { low_stock: true } : {}),
        ...(stockFilter === 'out' ? { out_of_stock: true } : {}),
      },
    }).then((r) => r.data),
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data),
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get('/suppliers', { params: { per_page: 100 } }).then((r) => r.data),
    enabled: showForm,
  });

  const requiresSerialNumber = !isConsumable;

  const resetForm = () => {
    setItemCode('');
    setPropertyNumber('');
    setSerialNumber('');
    setName('');
    setDescription('');
    setCategoryIds([]);
    setPrimaryCategoryId('');
    setUnitOfMeasure('');
    setQuantity('');
    setReorderLevel('');
    setUnitCost('');
    setSupplierId('');
    setStorageLocation('GSO Main Warehouse');
    setDateAcquired(new Date().toISOString().slice(0, 10));
    setCondition('good');
    setIsAsset(false);
    setIsConsumable(true);
    setPhoto(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
  };

  const closeForm = () => {
    setShowForm(false);
    resetForm();
  };

  const createItem = useMutation({
    mutationFn: () => {
      const formData = new FormData();
      formData.append('item_code', itemCode);
      if (propertyNumber) formData.append('property_number', propertyNumber);
      if (requiresSerialNumber) formData.append('serial_number', serialNumber.trim());
      else if (serialNumber.trim()) formData.append('serial_number', serialNumber.trim());
      formData.append('name', name);
      if (description) formData.append('description', description);
      categoryIds.forEach((id) => formData.append('category_ids[]', String(id)));
      formData.append('primary_category_id', primaryCategoryId || String(categoryIds[0]));
      formData.append('unit_of_measure', unitOfMeasure);
      formData.append('quantity', String(Math.round(Number(quantity) || 0)));
      formData.append('reorder_level', String(Math.round(Number(reorderLevel) || 0)));
      formData.append('unit_cost', unitCost);
      if (supplierId) formData.append('supplier_id', supplierId);
      if (storageLocation) formData.append('storage_location', storageLocation);
      if (dateAcquired) formData.append('date_acquired', dateAcquired);
      formData.append('condition', condition);
      formData.append('status', 'available');
      formData.append('is_asset', isAsset ? '1' : '0');
      formData.append('is_consumable', isAsset ? '0' : (isConsumable ? '1' : '0'));
      if (photo) formData.append('photo', photo);

      return api.post('/inventory', formData);
    },
    onSuccess: ({ data: created }) => {
      toast.success('Inventory item added');
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      closeForm();
      setViewItem(created);
    },
    onError: (e: { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }) => {
      const errors = e.response?.data?.errors;
      const firstError = errors ? Object.values(errors)[0]?.[0] : null;
      toast.error(firstError ?? e.response?.data?.message ?? 'Failed to add item');
    },
  });

  const toggleCategory = (id: number) => {
    setCategoryIds((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((c) => c !== id);
        if (primaryCategoryId === String(id)) {
          setPrimaryCategoryId(next[0] ? String(next[0]) : '');
        }
        return next;
      }
      const next = [...prev, id];
      if (!primaryCategoryId) setPrimaryCategoryId(String(id));
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (categoryIds.length === 0) {
      toast.error('Select at least one category');
      return;
    }
    if (requiresSerialNumber && !serialNumber.trim()) {
      toast.error('Serial number is required for non-consumable items');
      return;
    }
    createItem.mutate();
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Photo must be 5MB or less');
      return;
    }
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleView = async (item: InventoryItem) => {
    try {
      const { data } = await api.get(`/inventory/${item.id}`);
      setViewItem(data);
    } catch {
      toast.error('Failed to load item details');
    }
  };

  const categoryList = categories?.data ?? categories ?? [];
  const supplierList = suppliers?.data ?? suppliers ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stocks"
        description="Manage consumable supplies and government property"
        action={
          canCreate ? (
            <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>
              <Plus size={18} /> Add Item
            </button>
          ) : undefined
        }
      />

      <div className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_11rem_11rem] sm:items-end">
        <div className="sm:col-span-2 lg:col-span-1">
          <label htmlFor="inventory-search" className="mb-1.5 block text-sm font-medium text-slate-700">Search</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              id="inventory-search"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by item name or code..."
              className="input-field w-full !pl-11"
            />
          </div>
        </div>
        <div>
          <label htmlFor="inventory-consumable" className="mb-1.5 block text-sm font-medium text-slate-700">Consumable</label>
          <select
            id="inventory-consumable"
            value={consumableFilter}
            onChange={(e) => { setConsumableFilter(e.target.value); setPage(1); }}
            className="input-field w-full"
          >
            <option value="">All Types</option>
            <option value="consumable">Consumable</option>
            <option value="non_consumable">Non-Consumable</option>
          </select>
        </div>
        <div>
          <label htmlFor="inventory-stock" className="mb-1.5 block text-sm font-medium text-slate-700">Stock</label>
          <select
            id="inventory-stock"
            value={stockFilter}
            onChange={(e) => { setStockFilter(e.target.value); setPage(1); }}
            className="input-field w-full"
          >
            <option value="">All Stock</option>
            <option value="low">Low Stock</option>
            <option value="out">Out of Stock</option>
          </select>
        </div>
      </div>

      <DataTable<InventoryItem>
        loading={isLoading}
        data={data?.data ?? []}
        columns={[
          { key: 'item_code', label: 'Code', render: (r) => <span className="font-mono text-xs font-semibold">{r.item_code}</span> },
          { key: 'name', label: 'Item', render: (r) => <span className="font-medium text-slate-900">{r.name}</span> },
          { key: 'type', label: 'Type', render: (r) => (
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              r.is_consumable !== false ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700'
            }`}>
              {r.is_consumable !== false ? 'Consumable' : 'Non-Consumable'}
            </span>
          )},
          { key: 'quantity', label: 'On Hand', render: (r) => (
            <span
              className={r.quantity <= r.reorder_level ? 'font-semibold text-amber-600' : ''}
              title={`${formatOnHandQty(r.quantity)} ${r.unit_of_measure} remaining in stock`}
            >
              {formatOnHandQty(r.quantity)}
            </span>
          )},
          { key: 'unit_of_measure', label: 'Unit', render: (r) => (
            <span className="uppercase text-slate-600">{r.unit_of_measure}</span>
          )},
          { key: 'unit_cost', label: 'Cost', render: (r) => `₱${Number(r.unit_cost).toLocaleString()}` },
          { key: 'status', label: 'Status', render: (r) => <Badge status={r.status} /> },
          { key: 'storage_location', label: 'Location', render: (r) => r.storage_location ?? '—' },
          {
            key: 'actions',
            label: '',
            render: (r) => (
              <button
                type="button"
                onClick={() => handleView(r)}
                className="inline-flex items-center gap-1 rounded-lg bg-palawan-50 px-2.5 py-1 text-xs font-semibold text-palawan-700 hover:bg-palawan-100"
              >
                <Eye size={14} /> View
              </button>
            ),
          },
        ]}
      />
      <Pagination currentPage={data?.current_page ?? 1} lastPage={data?.last_page ?? 1} onPageChange={setPage} />

      {viewItem && (
        <InventoryItemModal
          item={viewItem}
          onClose={() => {
            setViewItem(null);
            clearItemDeepLinkParams();
          }}
        />
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card-elevated flex max-h-[90vh] w-full max-w-2xl flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Add Inventory Item</h2>
                <p className="text-sm text-slate-500">Register a new supply or government property</p>
              </div>
              <button type="button" onClick={closeForm} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Item Code</label>
                  <input required value={itemCode} onChange={(e) => setItemCode(e.target.value)} placeholder="OS-003" className="input-field" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Property Number</label>
                  <input value={propertyNumber} onChange={(e) => setPropertyNumber(e.target.value)} placeholder="PROP-2026-001" className="input-field" />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Item Name</label>
                  <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Stapler (Heavy Duty)" className="input-field" />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Description</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="input-field resize-none" />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Categories <span className="text-red-500">*</span>
                  </label>
                  <p className="mb-2 text-xs text-slate-500">Select all categories this item belongs to (e.g. alcohol may be Emergency, Office, and ICT).</p>
                  <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3 sm:grid-cols-2">
                    {categoryList.map((c: { id: number; name: string; code: string }) => (
                      <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white">
                        <input
                          type="checkbox"
                          checked={categoryIds.includes(c.id)}
                          onChange={() => toggleCategory(c.id)}
                          className="rounded border-slate-300 text-palawan-600 focus:ring-palawan-500"
                        />
                        <span className="text-slate-700">{c.code} — {c.name}</span>
                      </label>
                    ))}
                  </div>
                  {categoryIds.length > 0 && (
                    <div className="mt-3">
                      <label className="mb-1.5 block text-sm font-medium text-slate-700">Primary Category</label>
                      <select
                        required
                        value={primaryCategoryId}
                        onChange={(e) => setPrimaryCategoryId(e.target.value)}
                        className="input-field"
                      >
                        {categoryList
                          .filter((c: { id: number }) => categoryIds.includes(c.id))
                          .map((c: { id: number; name: string; code: string }) => (
                            <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                          ))}
                      </select>
                      <p className="mt-1 text-xs text-slate-500">Used as the main category in reports and listings.</p>
                    </div>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Unit of Measure</label>
                  <select required value={unitOfMeasure} onChange={(e) => setUnitOfMeasure(e.target.value)} className="input-field uppercase">
                    <option value="">SELECT UNIT</option>
                    {UNITS_OF_MEASURE.map((unit) => (
                      <option key={unit} value={unit}>{unit.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Qty on Hand</label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={quantity}
                    onKeyDown={blockDecimalKey}
                    onChange={(e) => setQuantity(sanitizeWholeNumberInput(e.target.value))}
                    className="input-field"
                    placeholder="Starting stock quantity"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Reorder Level</label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={reorderLevel}
                    onKeyDown={blockDecimalKey}
                    onChange={(e) => setReorderLevel(sanitizeWholeNumberInput(e.target.value))}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Unit Cost (₱)</label>
                  <input required type="number" min="0" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Supplier</label>
                  <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="input-field">
                    <option value="">None</option>
                    {supplierList.map((s: { id: number; name: string }) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Storage Location</label>
                  <input value={storageLocation} onChange={(e) => setStorageLocation(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Date Acquired</label>
                  <input type="date" value={dateAcquired} onChange={(e) => setDateAcquired(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Condition</label>
                  <select value={condition} onChange={(e) => setCondition(e.target.value)} className="input-field">
                    <option value="excellent">Excellent</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                    <option value="damaged">Damaged</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Serial Number{requiresSerialNumber && <span className="text-red-500"> *</span>}
                  </label>
                  <input
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    required={requiresSerialNumber}
                    placeholder={requiresSerialNumber ? 'e.g. SN-ABC123456' : 'Optional for consumable items'}
                    className="input-field"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Item Photo</label>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm font-medium text-slate-600 transition hover:border-palawan-400 hover:bg-palawan-50 hover:text-palawan-700 sm:flex-1">
                      <ImagePlus size={18} />
                      {photo ? 'Change photo' : 'Upload photo (JPG, PNG, max 5MB)'}
                      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} className="hidden" />
                    </label>
                    {photoPreview && (
                      <div className="relative shrink-0">
                        <img src={photoPreview} alt="Preview" className="h-24 w-24 rounded-xl object-cover ring-1 ring-slate-200" />
                        <button
                          type="button"
                          onClick={() => {
                            setPhoto(null);
                            if (photoPreview) URL.revokeObjectURL(photoPreview);
                            setPhotoPreview(null);
                          }}
                          className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white shadow-sm hover:bg-red-600"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:col-span-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={isConsumable}
                      disabled={isAsset}
                      onChange={(e) => {
                        setIsConsumable(e.target.checked);
                        if (e.target.checked) setSerialNumber('');
                      }}
                      className="rounded border-slate-300 text-palawan-600 focus:ring-palawan-500 disabled:opacity-50"
                    />
                    Consumable supply (depleted when issued)
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={isAsset}
                      onChange={(e) => {
                        setIsAsset(e.target.checked);
                        if (e.target.checked) setIsConsumable(false);
                      }}
                      className="rounded border-slate-300 text-palawan-600 focus:ring-palawan-500"
                    />
                    Register as government property asset
                  </label>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
                <button type="button" className="btn-secondary" onClick={closeForm}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={createItem.isPending}>
                  {createItem.isPending ? 'Saving...' : 'Save Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
