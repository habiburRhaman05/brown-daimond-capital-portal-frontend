import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../../lib/api';
import { ACTION_LABEL, fmtDate, fmtDateTime, portalUrl } from '../../lib/format';
import type { ClientDetail as Detail, ClientNumber } from '../../lib/types';
import { btnGhost, Button, Card, CardSkeleton, Empty, ErrorBox, HeaderSkeleton, inputCls, KV, Notice, PageHeader, ProgressBar, StateBadge } from '../../components/ui';
import { FieldGroups } from '../../components/FieldGroups';
import { DesignCard } from '../../components/DesignCard';
import { RequestList } from '../../components/RequestList';
import { DecideButtons } from '../../components/DecideButtons';
import { DownloadSiteButton } from '../../components/DownloadSiteButton';
import { EditClient } from './EditClient';

function ClientNumbers({ clientId, numbers }: { clientId: string; numbers: ClientNumber[] }) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin'] });
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const [err, setErr] = useState('');

  const addNum = useMutation({
    mutationFn: () => api(`/api/admin/clients/${clientId}/numbers`, { method: 'POST', body: { number: draft } }),
    onSuccess: () => { setAdding(false); setDraft(''); setErr(''); refresh(); },
    onError: (e) => setErr(errorMessage(e)),
  });
  const updateNum = useMutation({
    mutationFn: (id: string) => api(`/api/admin/clients/${clientId}/numbers/${id}`, { method: 'PUT', body: { number: editVal } }),
    onSuccess: () => { setEditId(null); setEditVal(''); setErr(''); refresh(); },
    onError: (e) => setErr(errorMessage(e)),
  });
  const deleteNum = useMutation({
    mutationFn: (id: string) => api(`/api/admin/clients/${clientId}/numbers/${id}`, { method: 'DELETE' }),
    onSuccess: () => { setErr(''); refresh(); },
    onError: (e) => setErr(errorMessage(e)),
  });

  return (
    <div className="mt-2 text-sm">
      <span className="text-muted">Client #</span>
      {numbers.length === 0 && !adding && <span className="ml-2 text-muted">—</span>}
      {numbers.map((n) =>
        editId === n.id ? (
          <span key={n.id} className="ml-2 inline-flex items-center gap-1">
            <input className={`${inputCls} !w-32 !py-1 !text-xs`} value={editVal} onChange={(e) => setEditVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') updateNum.mutate(n.id); if (e.key === 'Escape') setEditId(null); }} autoFocus />
            <button className="text-xs text-brand hover:underline" onClick={() => updateNum.mutate(n.id)} disabled={updateNum.isPending}>Save</button>
            <button className="text-xs text-muted hover:underline" onClick={() => setEditId(null)}>Cancel</button>
          </span>
        ) : (
          <span key={n.id} className="ml-2 inline-flex items-center gap-1">
            <span className="rounded bg-paper px-2 py-0.5">{n.number}</span>
            <button className="text-xs text-muted hover:text-ink" onClick={() => { setEditId(n.id); setEditVal(n.number); }} title="Edit">✎</button>
            <button className="text-xs text-muted hover:text-red-600" onClick={() => confirm('Remove this client number?') && deleteNum.mutate(n.id)} title="Remove">×</button>
          </span>
        ),
      )}
      {adding ? (
        <span className="ml-2 inline-flex items-center gap-1">
          <input className={`${inputCls} !w-32 !py-1 !text-xs`} placeholder="e.g. 1234" value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addNum.mutate(); if (e.key === 'Escape') setAdding(false); }} autoFocus />
          <button className="text-xs text-brand hover:underline" onClick={() => addNum.mutate()} disabled={addNum.isPending}>Add</button>
          <button className="text-xs text-muted hover:underline" onClick={() => { setAdding(false); setDraft(''); }}>Cancel</button>
        </span>
      ) : (
        <button className="ml-2 text-xs text-brand hover:underline" onClick={() => setAdding(true)}>+ Add number</button>
      )}
      {err && <span className="ml-2 text-xs text-red-600">{err}</span>}
    </div>
  );
}

type Tab = 'information' | 'design' | 'requests' | 'activity';

export function ClientDetail() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('information');
  const [editing, setEditing] = useState(false);
  const [hours, setHours] = useState(24);

  const { data, error, isLoading } = useQuery({ queryKey: ['admin', 'client', id], queryFn: () => api<Detail>(`/api/admin/clients/${id}`) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['admin'] });
  const reopen = useMutation({ mutationFn: () => api(`/api/admin/clients/${id}/reopen`, { method: 'POST', body: { hours } }), onSuccess: refresh });
  const lock = useMutation({ mutationFn: () => api(`/api/admin/clients/${id}/lock`, { method: 'POST' }), onSuccess: refresh });

  if (isLoading) {
    return (
      <div role="status" aria-label="Loading">
        <HeaderSkeleton />
        <div className="grid gap-5 lg:grid-cols-2"><CardSkeleton lines={6} /><CardSkeleton lines={6} /></div>
      </div>
    );
  }
  if (error || !data) return <ErrorBox error={error} />;

  const { summary: s } = data;
  const pending = data.requests.filter((r) => r.status === 'pending').length;
  const tabs: { id: Tab; label: string }[] = [
    { id: 'information', label: 'Information' },
    { id: 'design', label: 'Website design' },
    { id: 'requests', label: `Requests${pending ? ` (${pending})` : ''}` },
    { id: 'activity', label: 'Activity' },
  ];

  return (
    <>
      <p className="mb-2 text-sm"><Link to="/admin/clients" className="text-muted hover:text-ink">← All clients</Link></p>
      <PageHeader
        title={s.name}
        subtitle={
          <div>
            <span className="inline-flex flex-wrap items-center gap-2">{s.email}{s.businessName && <> · {s.businessName}</>} <StateBadge state={s.state} /></span>
            <ClientNumbers clientId={id} numbers={data.numbers} />
          </div>
        }
        actions={
          <>
            <a className={btnGhost} href={portalUrl(id)}>View portal as client</a>
            <DownloadSiteButton fields={data.fields} sel={data.sel} design={data.design} submittedOn={s.completedOn} />
            <Button variant="ghost" onClick={() => setEditing(true)}>Edit details</Button>
          </>
        }
      />

      <div className="mb-6 space-y-3">
        {s.state === 'submitted' && (
          <Notice tone="ok">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>Submitted and locked on <b>{fmtDateTime(s.lockedOn) || fmtDate(s.completedOn)}</b>. The client cannot edit until you reopen it.</span>
              <span className="flex flex-wrap items-center gap-2">
                <select className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm" value={hours} onChange={(e) => setHours(Number(e.target.value))} aria-label="Reopen for">
                  <option value={24}>24 hours</option>
                  <option value={48}>48 hours</option>
                  <option value={72}>3 days</option>
                  <option value={168}>7 days</option>
                </select>
                <Button loading={reopen.isPending} loadingText="Reopening…" onClick={() => confirm(`Reopen this portal for ${hours} hours?`) && reopen.mutate()}>
                  Reopen portal
                </Button>
              </span>
            </div>
          </Notice>
        )}
        {s.state === 'reopened' && (
          <Notice tone="warn">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>Reopened. The client can edit until <b>{fmtDateTime(s.changesUntil)}</b>, then it locks again.</span>
              <Button variant="ghost" loading={lock.isPending} loadingText="Locking…" onClick={() => confirm('Lock this portal now?') && lock.mutate()}>Lock now</Button>
            </div>
          </Notice>
        )}
        {s.state === 'in_progress' && (
          <Notice tone="info">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>The client is still filling in their portal.</span>
              <Button variant="ghost" loading={lock.isPending} loadingText="Locking…" onClick={() => confirm('Lock this portal now? The client will no longer be able to edit.') && lock.mutate()}>Lock portal</Button>
            </div>
          </Notice>
        )}
        {(reopen.error || lock.error) && <ErrorBox error={reopen.error || lock.error} />}
      </div>

      <div className="mb-5 flex gap-1 overflow-x-auto whitespace-nowrap border-b border-line">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`-mb-px shrink-0 border-b-2 px-3 py-2 sm:px-4 text-sm font-medium ${tab === t.id ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'information' && (
        <>
          <Card className="mb-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <ProgressBar label="Your information" filled={s.progress.information.filled} total={s.progress.information.total} />
              <ProgressBar label="Website" filled={s.progress.website.filled} total={s.progress.website.total} />
            </div>
          </Card>
          <FieldGroups fields={data.fields} />
        </>
      )}

      {tab === 'design' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <DesignCard design={data.design} />
          <Card title="Site">
            <dl className="divide-y divide-line">
              <KV label="Preview">{data.site.previewUrl && <a className="text-brand hover:underline" href={data.site.previewUrl} target="_blank" rel="noreferrer">{data.site.previewUrl}</a>}</KV>
              <KV label="Live site">{data.site.url && <a className="text-brand hover:underline" href={data.site.url} target="_blank" rel="noreferrer">{data.site.url}</a>}</KV>
              <KV label="Published on">{fmtDate(data.site.deployedOn)}</KV>
            </dl>
            <div className="mt-4"><a className={btnGhost} href={portalUrl(id)}>See the live preview</a></div>
          </Card>
        </div>
      )}

      {tab === 'requests' && <RequestList requests={data.requests} renderActions={(r) => <DecideButtons request={r} />} />}

      {tab === 'activity' &&
        (data.audit.length === 0 ? (
          <Empty>No activity yet.</Empty>
        ) : (
          <Card>
            <ul className="divide-y divide-line">
              {data.audit.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <span>{ACTION_LABEL[a.action] ?? a.action}</span>
                  <span className="text-muted">{fmtDateTime(a.created_at)}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}

      {editing && <EditClient id={id} detail={data} onClose={() => setEditing(false)} />}
    </>
  );
}
