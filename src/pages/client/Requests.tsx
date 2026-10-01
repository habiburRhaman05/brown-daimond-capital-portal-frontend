import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { PART_LABEL, portalUrl } from '../../lib/format';
import type { ChangeRequest, Overview, RequestPart } from '../../lib/types';
import { btnGhost, Button, Card, CardSkeleton, ErrorBox, HeaderSkeleton, inputCls, ListSkeleton, Notice, PageHeader } from '../../components/ui';
import { RequestList } from '../../components/RequestList';

export function Requests() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['client', 'requests'], queryFn: () => api<{ requests: ChangeRequest[] }>('/api/client/change-requests') });
  const overview = useQuery({ queryKey: ['client', 'overview'], queryFn: () => api<Overview>('/api/client/overview') });

  const [part, setPart] = useState<RequestPart>('website');
  const [text, setText] = useState('');
  const send = useMutation({
    mutationFn: () => api('/api/portal/change-request', { method: 'POST', body: { type: 'change_request', part, text: text.trim() } }),
    onSuccess: () => {
      setText('');
      qc.invalidateQueries({ queryKey: ['client'] });
    },
  });

  if (list.isLoading || overview.isLoading) {
    return (
      <div role="status" aria-label="Loading">
        <HeaderSkeleton />
        <CardSkeleton lines={3} className="mb-6" />
        <ListSkeleton rows={2} />
      </div>
    );
  }
  if (list.error || !list.data) return <ErrorBox error={list.error} />;

  const state = overview.data?.summary.state;
  const locked = state === 'submitted';

  function submit(e: FormEvent) {
    e.preventDefault();
    if (text.trim()) send.mutate();
  }

  return (
    <>
      <PageHeader title="Change requests" subtitle="Once your portal is submitted it is locked. Ask for a change here and your manager will review it." />

      <div className="mb-6">
        {locked ? (
          <Card title="Request a change">
            <form onSubmit={submit} className="space-y-3">
              <select className={inputCls} value={part} onChange={(e) => setPart(e.target.value as RequestPart)}>
                {(Object.keys(PART_LABEL) as RequestPart[]).map((p) => (
                  <option key={p} value={p}>{PART_LABEL[p]}</option>
                ))}
              </select>
              <textarea className={inputCls} rows={4} maxLength={2000} placeholder="Tell us what needs to change." value={text} onChange={(e) => setText(e.target.value)} />
              {send.error && <ErrorBox error={send.error} />}
              {send.isSuccess && <Notice tone="ok">Request received. Your Capital Success Manager will confirm by email.</Notice>}
              <Button type="submit" className="w-full sm:w-auto" loading={send.isPending} loadingText="Sending…" disabled={!text.trim()}>Send request</Button>
            </form>
          </Card>
        ) : (
          <Notice tone="info">
            {state === 'reopened'
              ? 'Your portal is open for changes right now. Make them directly in your portal.'
              : 'You can send a change request after you submit your portal. Until then, edit it directly.'}{' '}
            <a className="font-semibold underline" href={portalUrl()}>Open portal</a>
          </Notice>
        )}
      </div>

      <RequestList requests={list.data.requests} />
      <div className="mt-6">
        <a className={btnGhost} href={portalUrl()}>Back to my portal</a>
      </div>
    </>
  );
}
