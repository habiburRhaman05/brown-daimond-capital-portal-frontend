import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { fmtDate, STATE_LABEL } from '../../lib/format';
import type { PortalState, Summary } from '../../lib/types';
import { Badge, btnPrimary, Empty, ErrorState, inputCls, PageHeader, Skeleton, StateBadge, TableSkeleton } from '../../components/ui';

const FILTERS: ('all' | PortalState)[] = ['all', 'submitted', 'reopened', 'in_progress', 'not_started'];

const AVATAR_COLORS = [
  { bg: '#E7F0EB', fg: '#0B2E22' },
  { bg: '#FBEEE4', fg: '#9A4E1C' },
  { bg: '#EDE7F6', fg: '#5B3A91' },
  { bg: '#E3F2FD', fg: '#1565C0' },
  { bg: '#FFF3E0', fg: '#E65100' },
  { bg: '#F3E5F5', fg: '#7B1FA2' },
  { bg: '#E8F5E9', fg: '#2E7D32' },
  { bg: '#FCE4EC', fg: '#C62828' },
];

function avatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('') || '?';
}

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
        <PageHeader title="Clients" subtitle="Loading..." />
        <Skeleton className="mb-5 h-10 w-full sm:w-72" />
        <TableSkeleton />
      </div>
    );
  }
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <>
      <PageHeader title="Clients" subtitle={`${data.clients.length} total`} actions={<Link className={btnPrimary} to="/admin/invites">Invite a client</Link>} />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9A9488" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
          <input className={`${inputCls} !pl-10`} placeholder="Search name, email or business" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 cursor-pointer rounded-full border-[1.5px] px-3.5 py-[7.5px] text-[12.5px] font-semibold transition-all duration-150 ${
                filter === f
                  ? 'border-ink bg-ink text-white'
                  : 'border-line bg-white text-muted hover:border-ink hover:text-ink'
              }`}
            >
              {f === 'all' ? 'All' : STATE_LABEL[f]}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        data.clients.length === 0 ? (
          <Empty
            icon={
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#9A9488" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
        {/* Mobile: cards */}
        <ul className="space-y-3 md:hidden">
          {rows.map((c) => {
            const ac = avatarColor(c.name);
            return (
              <li key={c.id}>
                <Link to={`/admin/clients/${c.id}`} className="block rounded-[20px] border border-[#ECE8DE] bg-white p-4 shadow-[0_1px_2px_rgba(20,18,16,0.03),0_10px_28px_-14px_rgba(20,18,16,0.10)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_1px_2px_rgba(20,18,16,0.04),0_18px_36px_-14px_rgba(20,18,16,0.18)]">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold" style={{ background: ac.bg, color: ac.fg }}>{initials(c.name)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-semibold text-ink">{c.name}</div>
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
            );
          })}
        </ul>

        {/* Desktop: card rows */}
        <div className="hidden flex-col gap-2.5 md:flex">
          {rows.map((c) => {
            const ac = avatarColor(c.name);
            return (
              <div
                key={c.id}
                onClick={() => navigate(`/admin/clients/${c.id}`)}
                className="grid cursor-pointer grid-cols-[2.2fr_1.6fr_1fr_1.3fr_1fr_1.2fr] items-center gap-3 rounded-2xl border border-[#ECE8DE] bg-white px-5 py-4 shadow-[0_1px_2px_rgba(20,18,16,0.03),0_10px_28px_-14px_rgba(20,18,16,0.10)] transition-all duration-200 hover:translate-x-0.5 hover:bg-surface"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold" style={{ background: ac.bg, color: ac.fg }}>{initials(c.name)}</div>
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-semibold text-ink">{c.name}</div>
                    <div className="truncate text-xs text-muted">{c.email}</div>
                  </div>
                </div>
                <div className="truncate text-[13px] text-ink">{c.businessName || <span className="text-muted">—</span>}</div>
                <div className="text-[13px] tabular-nums text-muted">{c.clientNumbers?.length ? c.clientNumbers.join(', ') : '—'}</div>
                <div className="truncate text-[12.5px] capitalize text-muted">{c.template ? `${c.template} · ${c.palette}` : '—'}</div>
                <div>{c.pendingRequests > 0 ? <Badge tone="amber">{c.pendingRequests} pending</Badge> : <Badge tone="gray">—</Badge>}</div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12.5px] text-muted">{fmtDate(c.completedOn) || '—'}</span>
                  <StateBadge state={c.state} />
                  {c.loadError && <Badge tone="red">GHL error</Badge>}
                </div>
              </div>
            );
          })}
        </div>
        </>
      )}
    </>
  );
}
