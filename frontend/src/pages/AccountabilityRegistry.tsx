import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import api from '../api/client';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';
import { PropertyAccountabilityTab } from './PropertyAccountability';

const META = {
  ics: {
    title: 'ICS Heading',
    description: 'Registry of all Inventory Custodian Slips issued',
  },
  par: {
    title: 'PAR Heading',
    description: 'Registry of all Property Acknowledgment Receipts issued',
  },
} as const;

export default function AccountabilityRegistry({ documentType }: { documentType: 'ics' | 'par' }) {
  const [page, setPage] = useState(1);
  const [showManualForm, setShowManualForm] = useState(false);
  const { hasPermission } = useAuth();

  const canRelease = hasPermission('requests.release') || hasPermission('issuance.*');
  const canView = canRelease || hasPermission('property.view') || hasPermission('property.*');
  const canIssue = canRelease || hasPermission('property.*');

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/departments').then((r) => r.data),
    enabled: canView,
  });

  if (!canView) {
    return (
      <div className="card p-8 text-center text-slate-500">
        You do not have permission to view {META[documentType].title.toLowerCase()}.
      </div>
    );
  }

  const meta = META[documentType];
  const deptList = departments?.data ?? departments ?? [];

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        title={meta.title}
        description={meta.description}
        action={
          canIssue ? (
            <button type="button" className="btn-primary" onClick={() => setShowManualForm(true)}>
              <Plus size={18} /> New {documentType.toUpperCase()}
            </button>
          ) : undefined
        }
      />

      <PropertyAccountabilityTab
        variant="registry"
        page={page}
        onPageChange={setPage}
        canView={canView}
        canIssue={canIssue}
        deptList={deptList}
        documentType={documentType}
        manualFormOpen={showManualForm}
        onManualFormOpenChange={setShowManualForm}
      />
    </div>
  );
}

export function IcsRecordsPage() {
  return <AccountabilityRegistry documentType="ics" />;
}

export function ParRecordsPage() {
  return <AccountabilityRegistry documentType="par" />;
}

export function AccountabilityRegistryRedirect() {
  return <Navigate to="/ics-records" replace />;
}
