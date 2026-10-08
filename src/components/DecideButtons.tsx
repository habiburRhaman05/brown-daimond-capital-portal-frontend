import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../lib/api';
import type { ChangeRequest } from '../lib/types';
import { useToast } from './Toast';
import { Button, ErrorBox, inputCls } from './ui';

// A change request is either Pending or Resolved, and our team can switch it either way.
export function DecideButtons({ request }: { request: ChangeRequest }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const resolving = request.status === 'pending';

  const toggle = useMutation({
    mutationFn: () =>
      api(`/api/admin/change-requests/${request.id}/${resolving ? 'resolve' : 'reopen'}`, {
        method: 'POST',
        body: resolving && note.trim() ? { note: note.trim() } : {},
      }),
    onSuccess: () => {
      setOpen(false);
      setNote('');
      qc.invalidateQueries({ queryKey: ['admin'] });
      toast.success(resolving ? 'Marked resolved.' : 'Moved back to pending.');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (resolving && !open) {
    return <Button onClick={() => setOpen(true)}>Mark resolved</Button>;
  }

  if (!resolving) {
    return (
      <div className="space-y-2">
        {toggle.error && <ErrorBox error={toggle.error} />}
        <Button variant="ghost" loading={toggle.isPending} loadingText="Saving…" onClick={() => toggle.mutate()}>
          Move back to pending
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg bg-paper p-3">
      <p className="text-sm">Marking this resolved tells the client it has been dealt with. You can switch it back to pending at any time.</p>
      <textarea className={inputCls} rows={2} maxLength={1000} placeholder="Optional note for the client" value={note} onChange={(e) => setNote(e.target.value)} />
      {toggle.error && <ErrorBox error={toggle.error} />}
      <div className="flex flex-wrap gap-2">
        <Button loading={toggle.isPending} loadingText="Saving…" onClick={() => toggle.mutate()}>Confirm resolved</Button>
        <button type="button" className="cursor-pointer rounded-lg px-3 py-2 text-sm text-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-50" disabled={toggle.isPending} onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}
