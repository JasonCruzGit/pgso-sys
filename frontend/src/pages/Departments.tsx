import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import DataTable from '../components/DataTable';
import Pagination from '../components/Pagination';
import PageHeader from '../components/PageHeader';
import type { Department } from '../types';

export default function Departments() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['departments', page],
    queryFn: () => api.get('/departments', { params: { page, per_page: 15 } }).then((r) => r.data),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        description="Provincial offices and divisions using the inventory system"
      />

      <DataTable<Department>
        loading={isLoading}
        data={data?.data ?? []}
        columns={[
          { key: 'code', label: 'Code', render: (r) => (
            <span className="font-mono text-xs font-semibold text-palawan-700">{r.code}</span>
          )},
          { key: 'name', label: 'Name', render: (r) => <span className="font-medium">{r.name}</span> },
          { key: 'head_name', label: 'Department Head', render: (r) => r.head_name ?? '—' },
          { key: 'email', label: 'Email', render: (r) => r.email ?? '—' },
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
    </div>
  );
}
