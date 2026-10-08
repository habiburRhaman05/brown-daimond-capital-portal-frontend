import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { ChangeRequest, RequestStatus } from '../../lib/types';
import { ErrorState, ListSkeleton, PageHeader } from '../../components/ui';
import { RequestList } from '../../components/RequestList';
import { DecideButtons } from '../../components/DecideButtons';

const TABS: { id: RequestStatus | 'all'; label: string }[] = [
  { id: 'pending', label: 'Pending' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'all', label: 'All' },
];

export function AdminRequests() {
  const [tab, setTab] = useState<RequestStatus | 'all'>('pending');
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'requests', tab],
    queryFn: () => api<{ requests: ChangeRequest[] }>(`/api/admin/change-requests${tab === 'all' ? '' : `?status=${tab}`}`),
  });

  return (
    <>
      <PageHeader title="Change requests" subtitle="Mark a request resolved once it is dealt with. You can switch it back to pending." />
      <div className="mb-5 flex gap-1 overflow-x-auto whitespace-nowrap border-b border-line">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`-mb-px shrink-0 cursor-pointer border-b-2 px-3 py-2 sm:px-4 text-sm font-medium ${tab === t.id ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {isLoading ? (
        <ListSkeleton />
      ) : error || !data ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <RequestList
          requests={data.requests}
          showClient={(r) => <Link className="text-brand hover:underline" to={`/admin/clients/${r.clientId}`}>{r.clientEmail}</Link>}
          renderActions={(r) => <DecideButtons request={r} />}
        />
      )}
    </>
  );
}
