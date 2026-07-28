import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, X } from 'lucide-react';
import api from '../api/client';
import DataTable from '../components/DataTable';
import Pagination from '../components/Pagination';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';
import type { Supplier } from '../types';
import toast from 'react-hot-toast';

export default function Suppliers() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasPermission('suppliers.*') || hasPermission('procurement.*') || hasPermission('users.*');

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers', page, search],
    queryFn: () => api.get('/suppliers', { params: { page, per_page: 15, search: search || undefined } }).then((r) => r.data),
  });

  const createSupplier = useMutation({
    mutationFn: () => api.post('/suppliers', {
      name,
      contact_person: contactPerson || undefined,
      email: email || undefined,
      phone: phone || undefined,
      address: address || undefined,
    }),
    onSuccess: () => {
      toast.success('Supplier added');
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      resetForm();
      setShowForm(false);
    },
    onError: () => toast.error('Failed to add supplier'),
  });

  const resetForm = () => {
    setName('');
    setContactPerson('');
    setEmail('');
    setPhone('');
    setAddress('');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suppliers"
        description="Manage vendor and supplier records for procurement and receiving"
        action={
          canManage ? (
            <button type="button" onClick={() => setShowForm(true)} className="btn-primary inline-flex items-center gap-2">
              <Plus size={18} /> Add Supplier
            </button>
          ) : undefined
        }
      />

      <div className="card p-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search suppliers..."
            className="input-field pl-10"
          />
        </div>
      </div>

      <DataTable<Supplier>
        loading={isLoading}
        data={data?.data ?? []}
        columns={[
          { key: 'name', label: 'Supplier', render: (r) => <span className="font-medium">{r.name}</span> },
          { key: 'contact_person', label: 'Contact Person', render: (r) => r.contact_person ?? '—' },
          { key: 'email', label: 'Email', render: (r) => r.email ?? '—' },
          { key: 'phone', label: 'Phone', render: (r) => r.phone ?? '—' },
          { key: 'total_deliveries', label: 'Deliveries', render: (r) => (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
              {r.total_deliveries ?? 0}
            </span>
          )},
          { key: 'is_active', label: 'Status', render: (r) => (
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              r.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
            }`}>
              {r.is_active ? 'Active' : 'Inactive'}
            </span>
          )},
        ]}
      />

      {data?.meta && (
        <Pagination
          currentPage={data.meta.current_page}
          lastPage={data.meta.last_page}
          onPageChange={setPage}
        />
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowForm(false)}>
          <div className="card-elevated w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Add Supplier</h2>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createSupplier.mutate();
              }}
              className="space-y-4 p-6"
            >
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Supplier Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field"
                  required
                  placeholder="e.g. El Nido Office & School Supplies"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Contact Person</label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  className="input-field"
                  placeholder="Primary contact name"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-field"
                    placeholder="sales@supplier.com"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Phone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="input-field"
                    placeholder="048-434-0000"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Address</label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="input-field min-h-[80px]"
                  placeholder="Business address"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={createSupplier.isPending} className="btn-primary">
                  {createSupplier.isPending ? 'Saving...' : 'Add Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
