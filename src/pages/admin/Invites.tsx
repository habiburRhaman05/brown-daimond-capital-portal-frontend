import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../../lib/api';
import { fmtDateTime } from '../../lib/format';
import type { Invite } from '../../lib/types';
import { useToast } from '../../components/Toast';
import { Badge, Button, Card, Empty, ErrorBox, ErrorState, inputCls, Notice, PageHeader, TableSkeleton } from '../../components/ui';

const TONE = { sent: 'amber', accepted: 'green', revoked: 'gray' } as const;
const LABEL = { sent: 'Waiting', accepted: 'Signed up', revoked: 'Revoked' } as const;

export function Invites() {
  const qc = useQueryClient();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [linkEmail, setLinkEmail] = useState('');
  const [copied, setCopied] = useState(false);
  const { data, error, isLoading, refetch } = useQuery({ queryKey: ['admin', 'invites'], queryFn: () => api<{ invites: Invite[] }>('/api/admin/invites') });

  const send = useMutation({
    mutationFn: () => api('/api/admin/invites', { method: 'POST', body: { email } }),
    onSuccess: () => {
      setEmail('');
      qc.invalidateQueries({ queryKey: ['admin', 'invites'] });
      toast.success('Invite sent.');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const createLink = useMutation({
    mutationFn: () => api<{ link: string }>('/api/admin/invites/create-link', { method: 'POST', body: { email: linkEmail } }),
    onSuccess: () => {
      setCopied(false);
      qc.invalidateQueries({ queryKey: ['admin', 'invites'] });
      toast.success('Link created.');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api(`/api/admin/invites/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'invites'] });
      toast.success('Invite revoked.');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (email.trim()) send.mutate();
  }

  function submitLink(e: FormEvent) {
    e.preventDefault();
    if (linkEmail.trim()) createLink.mutate();
  }

  async function copyLink() {
    if (!createLink.data?.link) return;
    try {
      await navigator.clipboard.writeText(createLink.data.link);
      setCopied(true);
    } catch {
      /* clipboard unavailable; the field below is selectable */
    }
  }

  return (
    <>
      <PageHeader title="Invites" subtitle="Clients cannot sign themselves up. Send a signup link to the email they will use." />

      <Card title="Send a signup link" className="mb-6">
        <form onSubmit={submit} className="flex flex-wrap gap-2">
          <input className={`${inputCls} sm:max-w-sm`} type="email" required placeholder="client@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" loading={send.isPending} loadingText="Sending…">Send invite</Button>
        </form>
        {send.error && <div className="mt-3"><ErrorBox error={send.error} /></div>}
        {send.isSuccess && <div className="mt-3"><Notice tone="ok">Invite sent. They will get an email with a link to choose a password.</Notice></div>}

        <form onSubmit={submitLink} className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
          <input className={`${inputCls} sm:max-w-sm`} type="email" required placeholder="client@example.com" value={linkEmail} onChange={(e) => setLinkEmail(e.target.value)} />
          <Button type="submit" variant="ghost" loading={createLink.isPending} loadingText="Creating…">Create link</Button>
        </form>
        {createLink.error && <div className="mt-3"><ErrorBox error={createLink.error} /></div>}
        {createLink.isSuccess && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input className={`${inputCls} flex-1`} readOnly value={createLink.data.link} onFocus={(e) => e.currentTarget.select()} />
            <Button type="button" variant="ghost" onClick={copyLink}>{copied ? 'Copied' : 'Copy'}</Button>
          </div>
        )}
      </Card>

      {isLoading ? (
        <TableSkeleton rows={4} />
      ) : error || !data ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : data.invites.length === 0 ? (
        <Empty>No invites yet.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Status</th>
                <th className="hidden px-4 py-3 sm:table-cell">Sent</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.invites.map((i) => (
                <tr key={i.id}>
                  <td className="break-all px-4 py-3">{i.email}</td>
                  <td className="px-4 py-3"><Badge tone={TONE[i.status]}>{LABEL[i.status]}</Badge></td>
                  <td className="hidden px-4 py-3 text-muted sm:table-cell">{fmtDateTime(i.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    {i.status === 'sent' && (
                      <Button variant="danger" className="!px-3 !py-1.5" loading={revoke.isPending && revoke.variables === i.id} loadingText="Revoking…" disabled={revoke.isPending} onClick={() => confirm(`Revoke the invite for ${i.email}?`) && revoke.mutate(i.id)}>Revoke</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {revoke.error && <div className="p-3"><ErrorBox error={revoke.error} /></div>}
        </div>
      )}
    </>
  );
}
