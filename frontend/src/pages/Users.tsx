import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X, Check, XCircle } from 'lucide-react';
import api from '../api/client';
import DataTable from '../components/DataTable';
import Pagination from '../components/Pagination';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';
import type { Department, Role, User } from '../types';
import toast from 'react-hot-toast';
import { BRANDING } from '../constants/branding';

const DOCUMENT_DIVISION_LABELS: Record<string, string> = {
  all: 'All documents (full access)',
  incoming_outgoing: 'Incoming & Outgoing only',
  incoming: 'Incoming documents only',
  outgoing: 'Outgoing documents only',
  routing: 'Document routing / forwarding',
  records: 'Document records & filing',
};

export default function Users() {
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [phone, setPhone] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [roleId, setRoleId] = useState('');
  const [documentTaskDivision, setDocumentTaskDivision] = useState('');

  const { hasPermission, user } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasPermission('users.*');
  const canAssignFleetRole = user?.role?.slug === 'system_administrator' || user?.role?.slug === 'fleet_officer';
  const canAssignDocumentTrackingRole = user?.role?.slug === 'system_administrator'
    || user?.role?.slug === 'document_tracking'
    || user?.role?.slug === 'document_tracking_admin';
  const canAssignDocumentTrackingAdminRole = user?.role?.slug === 'system_administrator'
    || user?.role?.slug === 'document_tracking_admin';

  const { data, isLoading } = useQuery({
    queryKey: ['users', page],
    queryFn: () => api.get('/users', { params: { page, is_active: true } }).then((r) => r.data),
  });

  const { data: pending } = useQuery({
    queryKey: ['users-pending-registrations'],
    queryFn: () => api.get('/users/pending-registrations').then((r) => r.data.data as User[]),
    enabled: canManage,
  });

  const approveRegistration = useMutation({
    mutationFn: (id: number) => api.post(`/users/${id}/approve-registration`),
    onSuccess: () => {
      toast.success('Account approved');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['users-pending-registrations'] });
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e.response?.data?.message ?? 'Failed to approve account');
    },
  });

  const rejectRegistration = useMutation({
    mutationFn: (id: number) => api.post(`/users/${id}/reject-registration`),
    onSuccess: () => {
      toast.success('Registration rejected');
      queryClient.invalidateQueries({ queryKey: ['users-pending-registrations'] });
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e.response?.data?.message ?? 'Failed to reject registration');
    },
  });

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get('/roles').then((r) => r.data as Role[]),
    enabled: showForm,
  });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments', { params: { per_page: 100, is_active: true } }).then((r) => r.data),
    enabled: showForm,
  });

  const departmentList: Department[] = departments?.data ?? departments ?? [];
  const departmentUserRole = roles?.find((r) => r.slug === 'department_user');
  const assignableRoles = (roles ?? []).filter((r) => {
    if (r.slug === 'fleet_officer') return canAssignFleetRole;
    if (r.slug === 'document_tracking') return canAssignDocumentTrackingRole;
    if (r.slug === 'document_tracking_admin') return canAssignDocumentTrackingAdminRole;
    return true;
  });
  const selectedRole = assignableRoles.find((r) => String(r.id) === roleId);
  const isDocumentTrackingRole = selectedRole?.slug === 'document_tracking';
  const taskDivisions = selectedRole?.task_divisions ?? [];

  useEffect(() => {
    if (showForm && departmentUserRole) {
      setRoleId(String(departmentUserRole.id));
    }
  }, [showForm, departmentUserRole]);

  const resetForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setPasswordConfirmation('');
    setEmployeeId('');
    setPhone('');
    setDepartmentId('');
    setRoleId(departmentUserRole ? String(departmentUserRole.id) : '');
    setDocumentTaskDivision('');
  };

  const createUser = useMutation({
    mutationFn: () => api.post('/users', {
      name,
      email,
      password,
      role_id: Number(roleId),
      document_task_division: isDocumentTrackingRole ? documentTaskDivision : undefined,
      department_id: departmentId ? Number(departmentId) : null,
      employee_id: employeeId || undefined,
      phone: phone || undefined,
    }),
    onSuccess: () => {
      toast.success('Employee account created');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowForm(false);
      resetForm();
    },
    onError: (e: { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }) => {
      const errors = e.response?.data?.errors;
      const firstError = errors ? Object.values(errors)[0]?.[0] : null;
      toast.error(firstError ?? e.response?.data?.message ?? 'Failed to create account');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== passwordConfirmation) {
      toast.error('Passwords do not match');
      return;
    }
    if (!roleId) {
      toast.error('Please select a role');
      return;
    }
    if (isDocumentTrackingRole && !documentTaskDivision) {
      toast.error('Select a Document Tracking task division');
      return;
    }
    createUser.mutate();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        description="Create employee accounts for staff who request and receive inventory items"
        action={
          canManage ? (
            <button type="button" onClick={() => setShowForm(true)} className="btn-primary inline-flex items-center gap-2">
              <Plus size={18} /> Add Employee
            </button>
          ) : undefined
        }
      />

      {canManage && (pending?.length ?? 0) > 0 && (
        <div className="card overflow-hidden border-amber-200 bg-amber-50/40">
          <div className="border-b border-amber-100 px-5 py-4">
            <h3 className="font-bold text-slate-900">Pending Account Approvals</h3>
            <p className="text-sm text-slate-600">{pending?.length} registration{(pending?.length ?? 0) === 1 ? '' : 's'} awaiting review</p>
          </div>
          <div className="divide-y divide-amber-100">
            {(pending ?? []).map((user) => (
              <div key={user.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{user.name}</p>
                  <p className="text-sm text-slate-600">{user.email}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {user.department?.name ?? 'No department'}
                    {user.employee_id ? ` · ${user.employee_id}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => approveRegistration.mutate(user.id)}
                    disabled={approveRegistration.isPending}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-palawan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-palawan-700"
                  >
                    <Check size={16} /> Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => rejectRegistration.mutate(user.id)}
                    disabled={rejectRegistration.isPending}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                  >
                    <XCircle size={16} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <DataTable<User>
        loading={isLoading}
        data={data?.data ?? []}
        columns={[
          { key: 'name', label: 'Name', render: (r) => (
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-palawan-100 text-xs font-bold text-palawan-700">
                {r.name.charAt(0)}
              </div>
              <span className="font-medium">{r.name}</span>
            </div>
          )},
          { key: 'email', label: 'Email' },
          { key: 'employee_id', label: 'Employee ID', render: (r) => r.employee_id ?? '—' },
          { key: 'role', label: 'Role', render: (r) => (
            <div>
              <span className="rounded-full bg-palawan-50 px-2.5 py-0.5 text-xs font-semibold text-palawan-700">{r.role?.name ?? '—'}</span>
              {r.document_task_division && (
                <p className="mt-1 text-[11px] text-slate-500">
                  {DOCUMENT_DIVISION_LABELS[r.document_task_division] ?? r.document_task_division.replace(/_/g, ' ')}
                </p>
              )}
            </div>
          )},
          { key: 'department', label: 'Department', render: (r) => r.department?.name ?? '—' },
        ]}
      />
      <Pagination currentPage={data?.current_page ?? 1} lastPage={data?.last_page ?? 1} onPageChange={setPage} />

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowForm(false)}>
          <div className="card-elevated max-h-[90vh] w-full max-w-lg overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Add Employee Account</h2>
                <p className="text-sm text-slate-500">For staff who request supplies and equipment</p>
              </div>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 p-6">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Full Name *</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-field" required placeholder="e.g. Maria Santos" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Email *</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" required placeholder={`employee@${BRANDING.emailDomain}`} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Employee ID</label>
                  <input type="text" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="input-field" placeholder="EMP-005" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Phone</label>
                  <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="input-field" placeholder="0917-000-0000" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Department *</label>
                <select required value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="input-field">
                  <option value="">Select department</option>
                  {departmentList.map((d) => (
                    <option key={d.id} value={d.id}>{d.code} — {d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Role *</label>
                <select
                  required
                  value={roleId}
                  onChange={(e) => {
                    setRoleId(e.target.value);
                    setDocumentTaskDivision('');
                  }}
                  className="input-field"
                >
                  <option value="">Select role</option>
                  {assignableRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                      {r.slug === 'department_user' ? ' (can request items)' : ''}
                      {r.slug === 'fleet_officer' ? ' (GPS tracking & vehicle scheduling)' : ''}
                      {r.slug === 'document_tracking' ? ' (incoming / outgoing docs)' : ''}
                      {r.slug === 'document_tracking_admin' ? ' (receive & send only)' : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-slate-500">
                  Use <strong>Department User</strong> for employees who submit inventory requests.
                  {canAssignFleetRole && <> Use <strong>Fleet Officer</strong> for GPS and vehicle scheduling.</>}
                  {canAssignDocumentTrackingRole && <> Use <strong>Document Tracking</strong> for document control staff.</>}
                  {canAssignDocumentTrackingAdminRole && <> Use <strong>Document Tracking/Admin</strong> for receive and send (incoming / outgoing) only.</>}
                </p>
              </div>

              {isDocumentTrackingRole && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Task division *</label>
                  <select
                    required
                    value={documentTaskDivision}
                    onChange={(e) => setDocumentTaskDivision(e.target.value)}
                    className="input-field"
                  >
                    <option value="">Select division of tasks</option>
                    {taskDivisions.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                  {documentTaskDivision && (
                    <p className="mt-2 text-xs text-slate-600">
                      {taskDivisions.find((d) => d.value === documentTaskDivision)?.description}
                    </p>
                  )}
                </div>
              )}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Password *</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input-field" required minLength={8} placeholder="Min. 8 chars, upper, lower, number" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Confirm Password *</label>
                <input type="password" value={passwordConfirmation} onChange={(e) => setPasswordConfirmation(e.target.value)} className="input-field" required />
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={createUser.isPending} className="btn-primary">
                  {createUser.isPending ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
