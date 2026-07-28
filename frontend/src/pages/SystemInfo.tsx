import { Server, Building2, Shield, Database } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Card from '../components/Card';
import { BRANDING } from '../constants/branding';

const systemDetails = [
  { label: 'Application', value: BRANDING.systemTitle },
  { label: 'Organization', value: BRANDING.fullOrgName },
  { label: 'Version', value: '1.0.0' },
  { label: 'Environment', value: import.meta.env.MODE === 'production' ? 'Production' : 'Development' },
  { label: 'API Base URL', value: import.meta.env.VITE_API_URL || '/api' },
];

export default function SystemInfo() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="System Information"
        description="Application metadata and deployment details"
      />

      <Card title="General" subtitle="Core system identification">
        <dl className="grid gap-3 sm:grid-cols-2">
          {systemDetails.map(({ label, value }) => (
            <div key={label} className="rounded-xl bg-slate-50 p-4">
              <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</dt>
              <dd className="mt-1 text-sm font-medium text-slate-800">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Security" subtitle="Access and compliance">
          <ul className="space-y-3 text-sm text-slate-600">
            <li className="flex items-start gap-2">
              <Shield size={16} className="mt-0.5 shrink-0 text-palawan-600" />
              Role-based access control (RBAC) enforced on all API routes
            </li>
            <li className="flex items-start gap-2">
              <Shield size={16} className="mt-0.5 shrink-0 text-palawan-600" />
              JWT authentication with refresh token rotation
            </li>
            <li className="flex items-start gap-2">
              <Shield size={16} className="mt-0.5 shrink-0 text-palawan-600" />
              Full audit logging for government accountability
            </li>
          </ul>
        </Card>

        <Card title="Infrastructure" subtitle="Runtime components">
          <ul className="space-y-3 text-sm text-slate-600">
            <li className="flex items-start gap-2">
              <Server size={16} className="mt-0.5 shrink-0 text-palawan-600" />
              Laravel API backend
            </li>
            <li className="flex items-start gap-2">
              <Building2 size={16} className="mt-0.5 shrink-0 text-palawan-600" />
              React frontend with PGP PGSO branding
            </li>
            <li className="flex items-start gap-2">
              <Database size={16} className="mt-0.5 shrink-0 text-palawan-600" />
              PostgreSQL database with soft deletes
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
