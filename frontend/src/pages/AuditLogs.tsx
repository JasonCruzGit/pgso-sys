import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client';
import DataTable from '../components/DataTable';
import Pagination from '../components/Pagination';
import PageHeader from '../components/PageHeader';
import type { AuditLog } from '../types';

export default function AuditLogs() {
  const [page, setPage] = useState(1);
  const [module, setModule] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, module],
    queryFn: () => api.get('/audit-logs', { params: { page, module: module || undefined } }).then((r) => r.data),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Trail"
        description="Read-only log of all system activities — cannot be modified"
      />

      <div className="card p-4">
        <select value={module} onChange={(e) => { setModule(e.target.value); setPage(1); }} className="input-field max-w-xs">
          <option value="">All Modules</option>
          <option value="auth">Authentication</option>
          <option value="inventory">Inventory</option>
          <option value="issuance">Issuance</option>
          <option value="users">Users</option>
          <option value="assets">Assets</option>
        </select>
      </div>

      <DataTable<AuditLog>
        loading={isLoading}
        data={data?.data ?? []}
        emptyTitle="No audit logs"
        emptyDescription="System activity will be recorded here."
        columns={[
          { key: 'created_at', label: 'Timestamp', render: (r) => (
            <span className="font-mono text-xs text-slate-500">{new Date(r.created_at).toLocaleString()}</span>
          )},
          { key: 'user', label: 'User', render: (r) => r.user?.name ?? <span className="text-slate-400">System</span> },
          { key: 'action', label: 'Action', render: (r) => (
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold capitalize text-slate-700">{r.action}</span>
          )},
          { key: 'module', label: 'Module', render: (r) => <span className="capitalize text-slate-600">{r.module}</span> },
          { key: 'description', label: 'Description', render: (r) => r.description ?? '—' },
          { key: 'ip_address', label: 'IP', render: (r) => <span className="font-mono text-xs">{r.ip_address ?? '—'}</span> },
        ]}
      />
      <Pagination currentPage={data?.current_page ?? 1} lastPage={data?.last_page ?? 1} onPageChange={setPage} />
    </div>
  );
}
