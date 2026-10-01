import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { ChangeRequest, Summary } from '../../lib/types';
import { btnPrimary, Card, ErrorBox, PageHeader, PageSkeleton } from '../../components/ui';
import { RequestList } from '../../components/RequestList';
import { DecideButtons } from '../../components/DecideButtons';

function Stat({ label, value, to }: { label: string; value: number; to: string }) {
  return (
    <Link to={to} className="rounded-xl border border-line bg-white p-4 hover:border-brand sm:p-5">
      <div className="text-2xl font-semibold sm:text-3xl">{value}</div>
      <div className="mt-1 text-sm text-muted">{label}</div>
    </Link>
  );
}

export function AdminHome() {
  const clients = useQuery({ queryKey: ['admin', 'clients'], queryFn: () => api<{ clients: Summary[] }>('/api/admin/clients') });
  const pending = useQuery({ queryKey: ['admin', 'requests', 'pending'], queryFn: () => api<{ requests: ChangeRequest[] }>('/api/admin/change-requests?status=pending') });
  const signups = useQuery({ queryKey: ['admin', 'signup-requests', 'pending'], queryFn: () => api<{ requests: unknown[] }>('/api/admin/signup-requests?status=pending') });

  if (clients.isLoading || pending.isLoading || signups.isLoading) return <PageSkeleton tiles={5} cards={0} />;
  if (clients.error || !clients.data) return <ErrorBox error={clients.error} />;
  if (pending.error || !pending.data) return <ErrorBox error={pending.error} />;
  if (signups.error || !signups.data) return <ErrorBox error={signups.error} />;

  const list = clients.data.clients;
  const count = (s: Summary['state']) => list.filter((c) => c.state === s).length;
  const byId = Object.fromEntries(list.map((c) => [c.id, c]));

  return (
    <>
      <PageHeader title="Overview" subtitle="Everything across your clients." actions={<Link className={btnPrimary} to="/admin/invites">Invite a client</Link>} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
        <Stat label="Clients" value={list.length} to="/admin/clients" />
        <Stat label="Submitted" value={count('submitted')} to="/admin/clients" />
        <Stat label="In progress or reopened" value={count('in_progress') + count('reopened')} to="/admin/clients" />
        <Stat label="Pending change requests" value={pending.data.requests.length} to="/admin/requests" />
        <Stat label="Pending signup requests" value={signups.data.requests.length} to="/admin/signups" />
      </div>

      <Card title="Waiting for your decision" className="mt-6" action={<Link to="/admin/requests" className="text-sm font-medium text-brand hover:underline">See all</Link>}>
        <RequestList
          requests={pending.data.requests.slice(0, 5)}
          showClient={(r) => <Link className="text-brand hover:underline" to={`/admin/clients/${r.clientId}`}>{r.clientEmail || byId[r.clientId ?? '']?.name}</Link>}
          renderActions={(r) => <DecideButtons request={r} />}
        />
      </Card>
    </>
  );
}
