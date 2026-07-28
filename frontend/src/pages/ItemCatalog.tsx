import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, Package, Plus, Minus, ShoppingBag, X, MapPin } from 'lucide-react';
import api from '../api/client';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import CatalogItemImage from '../components/CatalogItemImage';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

interface CatalogItem {
  id: number;
  item_code: string;
  name: string;
  description?: string;
  category?: { id: number; name: string; code: string };
  categories?: { id: number; name: string; code: string }[];
  unit_of_measure: string;
  quantity: number;
  reorder_level?: number;
  storage_location?: string;
  has_photo?: boolean;
}

interface CartLine {
  inventory_item_id: number;
  name: string;
  unit_of_measure: string;
  max_qty: number;
  quantity_requested: number;
}

export default function ItemCatalog() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');

  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canRequest = Boolean(user?.permissions?.includes('requests.create'));

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-catalog', page, search, categoryId],
    queryFn: () => api.get('/inventory/catalog', {
      params: { page, per_page: 30, search: search || undefined, category_id: categoryId || undefined },
    }).then((r) => r.data),
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories', { params: { per_page: 100 } }).then((r) => r.data),
  });

  const categories: { id: number; name: string }[] = categoriesData?.data ?? categoriesData ?? [];

  const { data: detailItem, isLoading: detailLoading } = useQuery({
    queryKey: ['inventory-catalog-item', selectedItem?.id],
    queryFn: () => api.get(`/inventory/catalog/${selectedItem!.id}`).then((r) => r.data as CatalogItem),
    enabled: !!selectedItem,
  });

  const displayItem = detailItem ?? selectedItem;
  const displayCategories = displayItem?.categories?.length
    ? displayItem.categories
    : displayItem?.category
      ? [displayItem.category]
      : [];

  const addToCart = (item: CatalogItem) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.inventory_item_id === item.id);
      if (existing) {
        if (existing.quantity_requested >= item.quantity) {
          toast.error('Cannot exceed available stock');
          return prev;
        }
        return prev.map((l) =>
          l.inventory_item_id === item.id
            ? { ...l, quantity_requested: l.quantity_requested + 1 }
            : l,
        );
      }
      return [...prev, {
        inventory_item_id: item.id,
        name: item.name,
        unit_of_measure: item.unit_of_measure,
        max_qty: item.quantity,
        quantity_requested: 1,
      }];
    });
    toast.success(`Added ${item.name}`);
  };

  const updateCartQty = (id: number, delta: number) => {
    setCart((prev) => {
      const line = prev.find((l) => l.inventory_item_id === id);
      if (!line) return prev;

      const next = line.quantity_requested + delta;
      if (next <= 0) {
        return prev.filter((l) => l.inventory_item_id !== id);
      }
      if (next > line.max_qty) {
        toast.error('Cannot exceed available stock');
        return prev;
      }
      return prev.map((l) =>
        l.inventory_item_id === id ? { ...l, quantity_requested: next } : l,
      );
    });
  };

  const removeFromCart = (id: number) => {
    setCart((prev) => prev.filter((l) => l.inventory_item_id !== id));
  };

  const submitRequest = useMutation({
    mutationFn: () => api.post('/issuance', {
      department_id: user?.department?.id,
      purpose,
      notes: notes || undefined,
      items: cart.map((l) => ({
        inventory_item_id: l.inventory_item_id,
        quantity_requested: l.quantity_requested,
      })),
    }),
    onSuccess: () => {
      toast.success('Request submitted successfully');
      setCart([]);
      setPurpose('');
      setNotes('');
      setShowCheckout(false);
      queryClient.invalidateQueries({ queryKey: ['issuance'] });
      navigate('/requests');
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e.response?.data?.message ?? 'Failed to submit request');
    },
  });

  const cartCount = cart.reduce((sum, l) => sum + l.quantity_requested, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={hasPermission('issuance.*') ? 'Consumables' : 'Request Items'}
        description={canRequest
          ? hasPermission('issuance.*')
            ? 'Browse available consumable supplies in inventory'
            : 'Browse available supplies and add them to your issuance request'
          : 'Browse available consumable supplies in inventory'}
        action={
          canRequest && cart.length > 0 ? (
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setCart([])} className="btn-secondary text-sm">
                Clear All
              </button>
              <button type="button" onClick={() => setShowCheckout(true)} className="btn-primary inline-flex items-center gap-2">
                <ShoppingBag size={18} />
                Review Request ({cartCount})
              </button>
            </div>
          ) : undefined
        }
      />

      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search available items..."
            className="input-field !pl-11"
          />
        </div>
        <select
          value={categoryId}
          onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}
          className="input-field min-w-[160px] sm:min-w-[200px]"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-5">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton h-48 rounded-xl" />
          ))}
        </div>
      ) : (data?.data ?? []).length === 0 ? (
        <EmptyState
          icon={Package}
          title="No items available"
          description="There are no consumable supplies in stock right now. Check back later or contact GSO."
        />
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-5">
          {(data?.data as CatalogItem[]).map((item) => {
            const inCart = cart.find((l) => l.inventory_item_id === item.id);
            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedItem(item)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedItem(item); }}
                className="card card-hover flex cursor-pointer flex-col overflow-hidden p-2.5 text-left transition hover:ring-2 hover:ring-palawan-200"
              >
                <CatalogItemImage
                  itemId={item.id}
                  hasPhoto={item.has_photo}
                  categoryCode={item.category?.code}
                  alt={item.name}
                />
                <p className="mt-2 font-mono text-[9px] font-semibold uppercase tracking-wide text-palawan-600">{item.item_code}</p>
                <h3 className="mt-0.5 line-clamp-2 text-xs font-semibold leading-tight text-slate-900">{item.name}</h3>
                <p className="mt-0.5 truncate text-[10px] text-slate-500">
                  {(item.categories?.length ? item.categories : item.category ? [item.category] : [])
                    .map((c) => c.name)
                    .join(', ') || 'Supply'}
                </p>
                <p className="mt-1 text-[10px] text-slate-600">
                  <span className="font-semibold text-emerald-700">{item.quantity}</span> {item.unit_of_measure}
                </p>
                {canRequest && (
                <div className="mt-auto pt-2" onClick={(e) => e.stopPropagation()}>
                  {inCart ? (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between rounded-lg bg-palawan-50 px-1.5 py-1">
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.id, -1)}
                          title={inCart.quantity_requested === 1 ? 'Remove from request' : 'Decrease quantity'}
                          className="rounded p-1 hover:bg-white"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="text-[10px] font-semibold">{inCart.quantity_requested}</span>
                        <button type="button" onClick={() => updateCartQty(item.id, 1)} title="Increase quantity" className="rounded p-1 hover:bg-white">
                          <Plus size={14} />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                        className="w-full text-[9px] font-medium text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => addToCart(item)}
                      className="w-full rounded-lg bg-palawan-600 px-2 py-1.5 text-[10px] font-semibold text-white hover:bg-palawan-700"
                    >
                      Add
                    </button>
                  )}
                </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {data?.last_page > 1 && (
        <Pagination currentPage={data.current_page} lastPage={data.last_page} onPageChange={setPage} />
      )}

      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelectedItem(null)}>
          <div className="card-elevated max-h-[90vh] w-full max-w-lg overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Item Details</p>
                <p className="mt-1 font-mono text-xs font-semibold text-palawan-600">{displayItem?.item_code}</p>
                <h2 className="text-lg font-bold text-slate-900">{displayItem?.name}</h2>
              </div>
              <button type="button" onClick={() => setSelectedItem(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>

            <div className="p-5">
              <CatalogItemImage
                itemId={selectedItem.id}
                hasPhoto={displayItem?.has_photo}
                categoryCode={displayItem?.category?.code}
                alt={displayItem?.name ?? selectedItem.name}
                className="h-52 w-full"
              />

              {detailLoading ? (
                <div className="mt-4 space-y-2">
                  <div className="skeleton h-4 w-full rounded" />
                  <div className="skeleton h-4 w-2/3 rounded" />
                  <div className="skeleton h-16 w-full rounded" />
                </div>
              ) : (
                <dl className="mt-4 space-y-4 text-sm">
                  <div>
                    <dt className="text-slate-400">Description</dt>
                    <dd className="mt-1 text-slate-700">
                      {displayItem?.description || 'No description provided.'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Categories</dt>
                    <dd className="mt-1.5 flex flex-wrap gap-1.5">
                      {displayCategories.length > 0 ? displayCategories.map((c) => (
                        <span
                          key={c.id}
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            c.id === displayItem?.category?.id
                              ? 'bg-palawan-100 text-palawan-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {c.name}
                        </span>
                      )) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </dd>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <dt className="text-slate-400">Available Stock</dt>
                      <dd className="mt-1 font-semibold text-emerald-700">
                        {displayItem?.quantity} {displayItem?.unit_of_measure}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Unit of Measure</dt>
                      <dd className="mt-1 font-medium text-slate-900">{displayItem?.unit_of_measure}</dd>
                    </div>
                  </div>
                  {displayItem?.storage_location && (
                    <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3">
                      <MapPin size={16} className="mt-0.5 shrink-0 text-slate-400" />
                      <div>
                        <dt className="text-slate-400">Storage Location</dt>
                        <dd className="font-medium text-slate-700">{displayItem.storage_location}</dd>
                      </div>
                    </div>
                  )}
                </dl>
              )}

              {canRequest && (
                <div className="mt-6 border-t border-slate-100 pt-4">
                  {cart.find((l) => l.inventory_item_id === selectedItem.id) ? (
                    <div className="flex items-center justify-between rounded-xl bg-palawan-50 px-4 py-3">
                      <span className="text-sm font-medium text-slate-700">In your request</span>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => updateCartQty(selectedItem.id, -1)}
                          className="rounded-lg bg-white p-2 shadow-sm hover:bg-slate-50"
                        >
                          <Minus size={16} />
                        </button>
                        <span className="min-w-[2rem] text-center font-semibold">
                          {cart.find((l) => l.inventory_item_id === selectedItem.id)?.quantity_requested}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartQty(selectedItem.id, 1)}
                          className="rounded-lg bg-white p-2 shadow-sm hover:bg-slate-50"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => addToCart(selectedItem)}
                      className="btn-primary w-full"
                    >
                      Add to Request
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {canRequest && showCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowCheckout(false)}>
          <div className="card-elevated max-h-[90vh] w-full max-w-lg overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Submit Request</h2>
              <button type="button" onClick={() => setShowCheckout(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!user?.department?.id) {
                  toast.error('Your account has no department assigned');
                  return;
                }
                submitRequest.mutate();
              }}
              className="space-y-4 p-6"
            >
              <div className="rounded-xl bg-slate-50 p-3 text-sm">
                <p className="text-slate-500">Requesting as</p>
                <p className="font-semibold text-slate-900">{user?.name}</p>
                <p className="text-slate-600">{user?.department?.name ?? 'No department'}</p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">Items ({cartCount})</p>
                {cart.map((line) => (
                  <div key={line.inventory_item_id} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium">{line.name}</p>
                      <p className="text-xs text-slate-500">{line.quantity_requested} {line.unit_of_measure}</p>
                    </div>
                    <button type="button" onClick={() => removeFromCart(line.inventory_item_id)} className="text-xs text-red-600 hover:underline">
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Purpose *</label>
                <textarea
                  required
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  rows={3}
                  className="input-field resize-none"
                  placeholder="Describe why these items are needed..."
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="input-field resize-none"
                  placeholder="Optional additional details"
                />
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => setShowCheckout(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={submitRequest.isPending || cart.length === 0} className="btn-primary">
                  {submitRequest.isPending ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
