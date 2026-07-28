import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Trash2 } from 'lucide-react';
import api from '../api/client';
import DataTable from '../components/DataTable';
import Pagination from '../components/Pagination';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

interface LineItem {
  inventory_item_id: string;
  quantity_received: string;
  unit_cost: string;
  brand: string;
  model: string;
  serial_number: string;
}

const emptyLine = (): LineItem => ({
  inventory_item_id: '',
  quantity_received: '',
  unit_cost: '',
  brand: '',
  model: '',
  serial_number: '',
});

export default function Receiving() {
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [purchaseOrderNumber, setPurchaseOrderNumber] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [deliveryReceiptNumber, setDeliveryReceiptNumber] = useState('');
  const [receivingDate, setReceivingDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([emptyLine()]);

  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canCreate = hasPermission('receiving.*');

  const { data, isLoading } = useQuery({
    queryKey: ['stock-receipts', page],
    queryFn: () => api.get('/stock-receipts', { params: { page } }).then((r) => r.data),
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get('/suppliers', { params: { per_page: 100 } }).then((r) => r.data),
    enabled: showForm,
  });

  const { data: inventory } = useQuery({
    queryKey: ['inventory-select'],
    queryFn: () => api.get('/inventory', { params: { per_page: 200 } }).then((r) => r.data),
    enabled: showForm,
  });

  const resetForm = () => {
    setPurchaseOrderNumber('');
    setSupplierId('');
    setDeliveryReceiptNumber('');
    setReceivingDate(new Date().toISOString().slice(0, 10));
    setNotes('');
    setLineItems([emptyLine()]);
  };

  const closeForm = () => {
    setShowForm(false);
    resetForm();
  };

  const createReceipt = useMutation({
    mutationFn: () => api.post('/stock-receipts', {
      purchase_order_number: purchaseOrderNumber,
      supplier_id: Number(supplierId),
      delivery_receipt_number: deliveryReceiptNumber,
      receiving_date: receivingDate,
      notes: notes || undefined,
      items: lineItems.map((item) => ({
        inventory_item_id: Number(item.inventory_item_id),
        quantity_received: Number(item.quantity_received),
        unit_cost: Number(item.unit_cost),
        brand: item.brand || undefined,
        model: item.model || undefined,
        serial_number: item.serial_number || undefined,
      })),
    }),
    onSuccess: () => {
      toast.success('Stock receipt recorded');
      queryClient.invalidateQueries({ queryKey: ['stock-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      closeForm();
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e.response?.data?.message ?? 'Failed to record receipt');
    },
  });

  const updateLineItem = (index: number, field: keyof LineItem, value: string) => {
    setLineItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const handleInventoryChange = (index: number, itemId: string) => {
    const selected = (inventory?.data ?? []).find((i: { id: number; brand?: string; model?: string; serial_number?: string; unit_cost: number }) => String(i.id) === itemId);
    setLineItems((prev) => prev.map((item, i) => (
      i === index
        ? {
          ...item,
          inventory_item_id: itemId,
          unit_cost: selected ? String(selected.unit_cost) : item.unit_cost,
          brand: selected?.brand ?? '',
          model: selected?.model ?? '',
          serial_number: selected?.serial_number ?? '',
        }
        : item
    )));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lineItems.length || lineItems.some((i) => !i.inventory_item_id || !i.quantity_received || !i.unit_cost)) {
      toast.error('Please complete all line items');
      return;
    }
    createReceipt.mutate();
  };

  const supplierList = suppliers?.data ?? suppliers ?? [];
  const inventoryList = inventory?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Receiving"
        description="Record incoming deliveries and update inventory stock levels"
        action={
          canCreate ? (
            <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>
              <Plus size={18} /> Record Delivery
            </button>
          ) : undefined
        }
      />

      <DataTable<{
        id: number;
        receipt_number: string;
        purchase_order_number: string;
        delivery_receipt_number: string;
        receiving_date: string;
        supplier?: { name: string };
        receiver?: { name: string };
      }>
        loading={isLoading}
        data={data?.data ?? []}
        emptyTitle="No receiving records"
        emptyDescription="Stock receipts will appear here after recording deliveries."
        columns={[
          { key: 'receipt_number', label: 'Receipt No.', render: (r) => <span className="font-mono text-xs font-semibold text-palawan-700">{r.receipt_number}</span> },
          { key: 'purchase_order_number', label: 'PO Number' },
          { key: 'supplier', label: 'Supplier', render: (r) => r.supplier?.name ?? '—' },
          { key: 'delivery_receipt_number', label: 'DR Number' },
          { key: 'receiving_date', label: 'Date', render: (r) => new Date(r.receiving_date).toLocaleDateString() },
          { key: 'receiver', label: 'Received By', render: (r) => r.receiver?.name ?? '—' },
        ]}
      />
      <Pagination currentPage={data?.current_page ?? 1} lastPage={data?.last_page ?? 1} onPageChange={setPage} />

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card-elevated flex max-h-[90vh] w-full max-w-2xl flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Record Delivery</h2>
                <p className="text-sm text-slate-500">Enter delivery details and received items</p>
              </div>
              <button type="button" onClick={closeForm} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Purchase Order No.</label>
                  <input
                    required
                    value={purchaseOrderNumber}
                    onChange={(e) => setPurchaseOrderNumber(e.target.value)}
                    placeholder="PO-2026-001"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Delivery Receipt No.</label>
                  <input
                    required
                    value={deliveryReceiptNumber}
                    onChange={(e) => setDeliveryReceiptNumber(e.target.value)}
                    placeholder="DR-2026-001"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Supplier</label>
                  <select required value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="input-field">
                    <option value="">Select supplier</option>
                    {supplierList.map((s: { id: number; name: string }) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Receiving Date</label>
                  <input
                    required
                    type="date"
                    value={receivingDate}
                    onChange={(e) => setReceivingDate(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Optional remarks..."
                    className="input-field resize-none"
                  />
                </div>
              </div>

              <div className="mt-6">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-800">Received Items</h3>
                  <button
                    type="button"
                    onClick={() => setLineItems((prev) => [...prev, emptyLine()])}
                    className="text-sm font-medium text-palawan-600 hover:text-palawan-700"
                  >
                    + Add line
                  </button>
                </div>

                <div className="space-y-3">
                  {lineItems.map((item, index) => (
                    <div key={index} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <div className="flex-1">
                          <label className="mb-1 block text-xs font-medium text-slate-500">Item</label>
                          <select
                            required
                            value={item.inventory_item_id}
                            onChange={(e) => handleInventoryChange(index, e.target.value)}
                            className="input-field"
                          >
                            <option value="">Select item</option>
                            {inventoryList.map((inv: { id: number; item_code: string; name: string }) => (
                              <option key={inv.id} value={inv.id}>{inv.item_code} — {inv.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="w-full sm:w-28">
                          <label className="mb-1 block text-xs font-medium text-slate-500">Qty</label>
                          <input
                            required
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={item.quantity_received}
                            onChange={(e) => updateLineItem(index, 'quantity_received', e.target.value)}
                            className="input-field"
                          />
                        </div>
                        <div className="w-full sm:w-32">
                          <label className="mb-1 block text-xs font-medium text-slate-500">Unit Cost</label>
                          <input
                            required
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unit_cost}
                            onChange={(e) => updateLineItem(index, 'unit_cost', e.target.value)}
                            className="input-field"
                          />
                        </div>
                        {lineItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setLineItems((prev) => prev.filter((_, i) => i !== index))}
                            className="rounded-xl p-2.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-500">Brand</label>
                          <input value={item.brand} onChange={(e) => updateLineItem(index, 'brand', e.target.value)} placeholder="e.g. HP" className="input-field" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-500">Model</label>
                          <input value={item.model} onChange={(e) => updateLineItem(index, 'model', e.target.value)} placeholder="e.g. LaserJet" className="input-field" />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-500">Serial Number</label>
                          <input value={item.serial_number} onChange={(e) => updateLineItem(index, 'serial_number', e.target.value)} placeholder="For property / equipment" className="input-field font-mono" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-5">
                <button type="button" className="btn-secondary" onClick={closeForm}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={createReceipt.isPending}>
                  {createReceipt.isPending ? 'Saving...' : 'Save Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
