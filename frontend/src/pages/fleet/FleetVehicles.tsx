import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, X } from 'lucide-react';
import api from '../../api/client';
import PageHeader from '../../components/PageHeader';
import DataTable from '../../components/DataTable';
import Pagination from '../../components/Pagination';
import Badge from '../../components/Badge';
import { useAuth } from '../../context/AuthContext';
import type { Department, FleetVehicle, User } from '../../types';
import toast from 'react-hot-toast';

export default function FleetVehicles() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('fleet.*') || hasPermission('fleet.manage');
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    plate_number: '',
    name: '',
    vehicle_type: 'sedan',
    brand: '',
    model: '',
    year: '',
    capacity: '',
    fuel_type: 'Diesel',
    gps_device_id: '',
    gps_provider: 'simulated',
    assigned_driver_id: '',
    department_id: '',
    status: 'active',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['fleet-vehicles', page, search],
    queryFn: () => api.get('/fleet/vehicles', {
      params: { page, ...(search.trim() ? { search: search.trim() } : {}) },
    }).then((r) => r.data),
  });

  const { data: departments } = useQuery({
    queryKey: ['departments-active'],
    queryFn: () => api.get('/departments', { params: { is_active: true } }).then((r) => (r.data.data ?? r.data) as Department[]),
    enabled: showForm,
  });

  const { data: drivers } = useQuery({
    queryKey: ['fleet-drivers'],
    queryFn: () => api.get('/custodians').then((r) => r.data.data as User[]),
    enabled: showForm,
  });

  const create = useMutation({
    mutationFn: () => api.post('/fleet/vehicles', {
      ...form,
      year: form.year ? Number(form.year) : null,
      capacity: form.capacity ? Number(form.capacity) : null,
      assigned_driver_id: form.assigned_driver_id ? Number(form.assigned_driver_id) : null,
      department_id: form.department_id ? Number(form.department_id) : null,
    }),
    onSuccess: () => {
      toast.success('Vehicle registered');
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['fleet-vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['fleet-dashboard'] });
    },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e.response?.data?.message ?? 'Failed to save vehicle'),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Fleet Vehicles"
        description="Register and manage GPS-enabled provincial vehicles"
        action={canManage ? (
          <button type="button" className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={18} /> Add Vehicle
          </button>
        ) : undefined}
      />

      <div className="card p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input className="input-field w-full !pl-10" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search plate, name, GPS ID..." />
        </div>
      </div>

      <DataTable<FleetVehicle>
        loading={isLoading}
        data={data?.data ?? []}
        emptyTitle="No vehicles"
        emptyDescription="Register fleet vehicles to begin GPS tracking."
        columns={[
          { key: 'plate_number', label: 'Plate', render: (r) => <span className="font-mono text-xs font-semibold">{r.plate_number}</span> },
          { key: 'name', label: 'Name', render: (r) => <span className="font-medium">{r.name}</span> },
          { key: 'vehicle_type', label: 'Type', render: (r) => <span className="capitalize">{r.vehicle_type}</span> },
          { key: 'driver', label: 'Driver', render: (r) => r.driver?.name ?? '—' },
          { key: 'motion_status', label: 'GPS Status', render: (r) => <Badge status={r.motion_status} /> },
          { key: 'status', label: 'Status', render: (r) => <Badge status={r.status === 'active' ? 'available' : r.status} /> },
          { key: 'last_gps_at', label: 'Last Update', render: (r) => (r.last_gps_at ? new Date(r.last_gps_at).toLocaleString('en-PH') : '—') },
        ]}
      />
      <Pagination currentPage={data?.current_page ?? 1} lastPage={data?.last_page ?? 1} onPageChange={setPage} />

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
          <div className="card-elevated max-h-[95vh] w-full max-w-2xl overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2 className="text-lg font-bold">Register Vehicle</h2>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={20} /></button>
            </div>
            <form className="grid gap-4 px-5 py-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
              {[
                ['plate_number', 'Plate Number *', 'text'],
                ['name', 'Vehicle Name *', 'text'],
                ['brand', 'Brand', 'text'],
                ['model', 'Model', 'text'],
                ['year', 'Year', 'number'],
                ['capacity', 'Capacity', 'number'],
                ['fuel_type', 'Fuel Type', 'text'],
                ['gps_device_id', 'GPS Device ID', 'text'],
              ].map(([key, label, type]) => (
                <div key={key}>
                  <label className="mb-1.5 block text-sm font-medium">{label}</label>
                  <input
                    required={key === 'plate_number' || key === 'name'}
                    type={type}
                    className="input-field w-full"
                    value={(form as Record<string, string>)[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  />
                </div>
              ))}
              <div>
                <label className="mb-1.5 block text-sm font-medium">Type *</label>
                <select className="input-field w-full" value={form.vehicle_type} onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}>
                  {['sedan', 'van', 'pickup', 'truck', 'motorcycle', 'bus', 'utility'].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">GPS Provider</label>
                <select className="input-field w-full" value={form.gps_provider} onChange={(e) => setForm({ ...form, gps_provider: e.target.value })}>
                  {['simulated', 'rest', 'webhook', 'mqtt', 'tcp', 'custom'].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Driver</label>
                <select className="input-field w-full" value={form.assigned_driver_id} onChange={(e) => setForm({ ...form, assigned_driver_id: e.target.value })}>
                  <option value="">Unassigned</option>
                  {(drivers ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Department</label>
                <select className="input-field w-full" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
                  <option value="">Select</option>
                  {(departments ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2 flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={create.isPending}>Save Vehicle</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
