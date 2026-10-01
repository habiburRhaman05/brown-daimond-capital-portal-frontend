import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { ChangeRequest } from '../lib/types';
import { Button, ErrorBox, inputCls } from './ui';

// Approve reopens the client's portal for 24 hours; reject leaves it locked.
export function DecideButtons({ request }: { request: ChangeRequest }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState<'approve' | 'reject' | null>(null);
  const [note, setNote] = useState('');

  const decide = useMutation({
    mutationFn: (action: 'approve' | 'reject') => api(`/api/admin/change-requests/${request.id}/${action}`, { method: 'POST', body: { note } }),
    onSuccess: () => {
      setOpen(null);
      setNote('');
      qc.invalidateQueries({ queryKey: ['admin'] });
    },
  });

  if (request.status !== 'pending') return null;

  if (!open) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setOpen('approve')}>Approve</Button>
        <Button variant="danger" onClick={() => setOpen('reject')}>Reject</Button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg bg-paper p-3">
      <p className="text-sm">
        {open === 'approve'
          ? 'Approving reopens this client\'s portal for 24 hours so they can make the change themselves.'
          : 'Rejecting keeps the portal locked. The client will see your note.'}
      </p>
      <textarea className={inputCls} rows={2} maxLength={1000} placeholder="Optional note for the client" value={note} onChange={(e) => setNote(e.target.value)} />
      {decide.error && <ErrorBox error={decide.error} />}
      <div className="flex flex-wrap gap-2">
        <Button variant={open === 'approve' ? 'primary' : 'danger'} loading={decide.isPending} loadingText="Saving…" onClick={() => decide.mutate(open)}>
          {open === 'approve' ? 'Confirm approve' : 'Confirm reject'}
        </Button>
        <button type="button" className="rounded-lg px-3 py-2 text-sm text-muted hover:text-ink disabled:opacity-50" disabled={decide.isPending} onClick={() => setOpen(null)}>Cancel</button>
      </div>
    </div>
  );
}
