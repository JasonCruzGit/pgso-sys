import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import DataTable from '../components/DataTable';
import PageHeader from '../components/PageHeader';
import type { Category } from '../types';

export default function Categories() {
  const { data, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        description="Manage property and supply classification categories"
      />

      <DataTable<Category>
        loading={isLoading}
        data={data?.data ?? data ?? []}
        columns={[
          { key: 'code', label: 'Code', render: (r) => <span className="font-mono text-xs font-semibold text-palawan-700">{r.code}</span> },
          { key: 'name', label: 'Name', render: (r) => <span className="font-medium">{r.name}</span> },
          { key: 'description', label: 'Description', render: (r) => r.description ?? '—' },
          { key: 'inventory_items_count', label: 'Items', render: (r) => (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">{r.inventory_items_count ?? 0}</span>
          )},
          { key: 'is_active', label: 'Status', render: (r) => (
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
              {r.is_active ? 'Active' : 'Inactive'}
            </span>
          )},
        ]}
      />
    </div>
  );
}
