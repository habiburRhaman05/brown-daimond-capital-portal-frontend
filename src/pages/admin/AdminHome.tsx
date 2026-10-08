import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { ChangeRequest, Summary } from '../../lib/types';
import { btnPrimary, Card, ErrorState, PageHeader, PageSkeleton } from '../../components/ui';
import { RequestList } from '../../components/RequestList';
import { DecideButtons } from '../../components/DecideButtons';

function Stat({ label, value, to }: { label: string; value: number; to: string }) {
  return (
    <Link to={to} className="rounded-[20px] border border-[#ECE8DE] bg-white p-5 shadow-[0_1px_2px_rgba(20,18,16,0.03),0_10px_28px_-14px_rgba(20,18,16,0.10)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_1px_2px_rgba(20,18,16,0.04),0_18px_36px_-14px_rgba(20,18,16,0.18)]">
      <div className="font-serif text-3xl font-semibold text-ink">{value}</div>
      <div className="mt-1.5 text-sm text-muted">{label}</div>
    </Link>
  );
}

export function AdminHome() {
  const clients = useQuery({ queryKey: ['admin', 'clients'], queryFn: () => api<{ clients: Summary[] }>('/api/admin/clients') });
  const pending = useQuery({ queryKey: ['admin', 'requests', 'pending'], queryFn: () => api<{ requests: ChangeRequest[] }>('/api/admin/change-requests?status=pending') });
  const signups = useQuery({ queryKey: ['admin', 'signup-requests', 'pending'], queryFn: () => api<{ requests: unknown[] }>('/api/admin/signup-requests?status=pending') });

  if (clients.isLoading || pending.isLoading || signups.isLoading) return <PageSkeleton tiles={5} cards={0} />;
  if (clients.error || !clients.data) return <ErrorState error={clients.error} onRetry={clients.refetch} />;
  if (pending.error || !pending.data) return <ErrorState error={pending.error} onRetry={pending.refetch} />;
  if (signups.error || !signups.data) return <ErrorState error={signups.error} onRetry={signups.refetch} />;

  const list = clients.data.clients;
  const count = (s: Summary['state']) => list.filter((c) => c.state === s).length;
  const byId = Object.fromEntries(list.map((c) => [c.id, c]));

  return (
    <>
      <PageHeader title="Overview" subtitle="Everything across your clients." actions={<Link className={btnPrimary} to="/admin/invites">Invite a client</Link>} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Clients" value={list.length} to="/admin/clients" />
        <Stat label="Submitted" value={count('submitted')} to="/admin/clients" />
        <Stat label="In progress or reopened" value={count('in_progress') + count('reopened')} to="/admin/clients" />
        <Stat label="Pending change requests" value={pending.data.requests.length} to="/admin/requests" />
        <Stat label="Pending signup requests" value={signups.data.requests.length} to="/admin/signups" />
      </div>

      <Card title="Waiting for your decision" className="mt-6" action={<Link to="/admin/requests" className="text-sm font-semibold text-brand hover:underline">See all</Link>}>
        <RequestList
          requests={pending.data.requests.slice(0, 5)}
          showClient={(r) => <Link className="text-brand hover:underline" to={`/admin/clients/${r.clientId}`}>{r.clientEmail || byId[r.clientId ?? '']?.name}</Link>}
          renderActions={(r) => <DecideButtons request={r} />}
        />
      </Card>
    </>
  );
}
