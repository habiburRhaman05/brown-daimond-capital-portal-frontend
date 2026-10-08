import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { fmtDate, STATE_LABEL } from '../../lib/format';
import type { PortalState, Summary } from '../../lib/types';
import { Badge, btnPrimary, Empty, ErrorState, HeaderSkeleton, inputCls, PageHeader, Skeleton, StateBadge, TableSkeleton } from '../../components/ui';

const FILTERS: ('all' | PortalState)[] = ['all', 'submitted', 'reopened', 'in_progress', 'not_started'];

export function Clients() {
  const navigate = useNavigate();
  const { data, error, isLoading, refetch } = useQuery({ queryKey: ['admin', 'clients'], queryFn: () => api<{ clients: Summary[] }>('/api/admin/clients') });
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.clients ?? []).filter((c) => {
      if (filter !== 'all' && c.state !== filter) return false;
      return !needle || [c.name, c.email, c.businessName, ...(c.clientNumbers || [])].some((v) => v.toLowerCase().includes(needle));
    });
  }, [data, q, filter]);

  if (isLoading) {
    return (
      <div role="status" aria-label="Loading">
        <HeaderSkeleton />
        <Skeleton className="mb-4 h-9 w-full sm:w-72" />
        <TableSkeleton />
      </div>
    );
  }
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <>
      <PageHeader title="Clients" subtitle={`${data.clients.length} total`} actions={<Link className={btnPrimary} to="/admin/invites">Invite a client</Link>} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input className={`${inputCls} sm:max-w-xs`} placeholder="Search name, email or business" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          {FILTERS.map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`shrink-0 cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold ${filter === f ? 'bg-ink text-white' : 'bg-white text-muted ring-1 ring-line hover:text-ink'}`}>
              {f === 'all' ? 'All' : STATE_LABEL[f]}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        data.clients.length === 0 ? (
          <Empty
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="text-muted" aria-hidden="true">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
              </svg>
            }
            title="No clients yet"
            action={<Link className={btnPrimary} to="/admin/invites">Invite a client</Link>}
          >
            Send a signup link and they will show up here once they create an account.
          </Empty>
        ) : (
          <Empty>No clients match your search or filter.</Empty>
        )
      ) : (
        <>
        <ul className="space-y-3 md:hidden">
          {rows.map((c) => (
            <li key={c.id}>
              <Link to={`/admin/clients/${c.id}`} className="block rounded-xl border border-line bg-white p-4 hover:border-brand">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{c.name}</div>
                    <div className="truncate text-xs text-muted">{c.email}</div>
                  </div>
                  <StateBadge state={c.state} />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div><dt className="text-muted">Business</dt><dd className="truncate">{c.businessName || '—'}</dd></div>
                  <div><dt className="text-muted">Client #</dt><dd className="truncate">{c.clientNumbers?.length ? c.clientNumbers.join(', ') : '—'}</dd></div>
                  <div><dt className="text-muted">Design</dt><dd className="truncate capitalize">{c.template ? `${c.template} · ${c.palette}` : '—'}</dd></div>
                  <div><dt className="text-muted">Submitted</dt><dd>{fmtDate(c.completedOn) || '—'}</dd></div>
                  <div><dt className="text-muted">Requests</dt><dd>{c.pendingRequests > 0 ? <Badge tone="amber">{c.pendingRequests} pending</Badge> : '—'}</dd></div>
                </dl>
                {c.loadError && <div className="mt-2"><Badge tone="red">GHL error</Badge></div>}
              </Link>
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto rounded-xl border border-line bg-white md:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Business</th>
                <th className="px-4 py-3">Client #</th>
                <th className="px-4 py-3">Design</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Requests</th>
                <th className="px-4 py-3">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((c) => (
                <tr key={c.id} onClick={() => navigate(`/admin/clients/${c.id}`)} className="cursor-pointer hover:bg-paper">
                  <td className="px-4 py-3">
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted">{c.email}</div>
                  </td>
                  <td className="px-4 py-3">{c.businessName || <span className="text-muted">—</span>}</td>
                  <td className="px-4 py-3">{c.clientNumbers?.length ? c.clientNumbers.join(', ') : <span className="text-muted">—</span>}</td>
                  <td className="px-4 py-3 capitalize">{c.template ? `${c.template} · ${c.palette}` : <span className="text-muted">—</span>}</td>
                  <td className="px-4 py-3">
                    <StateBadge state={c.state} />
                    {c.loadError && <span className="ml-2"><Badge tone="red">GHL error</Badge></span>}
                  </td>
                  <td className="px-4 py-3">{c.pendingRequests > 0 ? <Badge tone="amber">{c.pendingRequests} pending</Badge> : <span className="text-muted">—</span>}</td>
                  <td className="px-4 py-3">{fmtDate(c.completedOn) || <span className="text-muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </>
  );
}
