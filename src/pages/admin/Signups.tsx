import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../../lib/api';
import { fmtDateTime } from '../../lib/format';
import { useToast } from '../../components/Toast';
import { Badge, Button, Card, Empty, ErrorState, inputCls, ListSkeleton, PageHeader } from '../../components/ui';

interface SignupRequest {
  id: string;
  email: string;
  fullName: string;
  company: string;
  phone: string;
  message: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNote: string;
  createdAt: string;
  decidedAt: string | null;
}

const TONE = { pending: 'amber', approved: 'green', rejected: 'red' } as const;
const LABEL = { pending: 'Waiting', approved: 'Approved', rejected: 'Rejected' } as const;

export function Signups() {
  const qc = useQueryClient();
  const toast = useToast();
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const qs = filter === 'pending' ? '?status=pending' : '';
  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'signup-requests', filter],
    queryFn: () => api<{ requests: SignupRequest[] }>(`/api/admin/signup-requests${qs}`),
  });

  const decide = useMutation({
    mutationFn: ({ id, action, note }: { id: string; action: 'approve' | 'reject'; note: string }) =>
      api(`/api/admin/signup-requests/${id}/${action}`, { method: 'POST', body: { note } }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['admin', 'signup-requests'] });
      toast.success(vars.action === 'approve' ? 'Approved. An invite email is on its way.' : 'Request rejected.');
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  return (
    <>
      <PageHeader
        title="Signup requests"
        subtitle="People who filled in the public access form. Approving a request sends them a signup email."
        actions={
          <div className="flex gap-2">
            <Button variant={filter === 'pending' ? 'primary' : 'ghost'} onClick={() => setFilter('pending')}>Pending</Button>
            <Button variant={filter === 'all' ? 'primary' : 'ghost'} onClick={() => setFilter('all')}>All</Button>
          </div>
        }
      />

      {isLoading ? (
        <ListSkeleton />
      ) : error || !data ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : data.requests.length === 0 ? (
        <Empty>{filter === 'pending' ? 'No pending requests. Nice work.' : 'No signup requests yet.'}</Empty>
      ) : (
        <div className="space-y-3">
          {data.requests.map((r) => (
            <SignupCard key={r.id} r={r} decide={decide} />
          ))}
        </div>
      )}
    </>
  );
}

function SignupCard({ r, decide }: { r: SignupRequest; decide: ReturnType<typeof useMutation<unknown, Error, { id: string; action: 'approve' | 'reject'; note: string }>> }) {
  const [note, setNote] = useState('');
  const pending = r.status === 'pending';
  const vars = decide.variables as { id: string; action: 'approve' | 'reject' } | undefined;
  const busyWith = decide.isPending && vars?.id === r.id ? vars.action : null;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">{r.fullName || r.email}</h3>
            <Badge tone={TONE[r.status]}>{LABEL[r.status]}</Badge>
          </div>
          <p className="mt-0.5 text-sm text-muted">{r.email}{r.company ? ` · ${r.company}` : ''}{r.phone ? ` · ${r.phone}` : ''}</p>
          <p className="mt-1 text-xs text-muted">Submitted {fmtDateTime(r.createdAt)}{r.decidedAt ? ` · decided ${fmtDateTime(r.decidedAt)}` : ''}</p>
        </div>
      </div>

      {r.message && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-paper px-3 py-2 text-sm">{r.message}</p>}
      {r.adminNote && !pending && (
        <p className="mt-2 text-xs text-muted"><span className="font-semibold">Admin note:</span> {r.adminNote}</p>
      )}

      {pending && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            className={`${inputCls} sm:max-w-md`}
            placeholder="Optional note (shown in audit log)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button
            loading={busyWith === 'approve'}
            loadingText="Approving…"
            disabled={decide.isPending}
            onClick={() => decide.mutate({ id: r.id, action: 'approve', note })}
          >
            Approve &amp; send invite
          </Button>
          <Button
            variant="danger"
            loading={busyWith === 'reject'}
            loadingText="Rejecting…"
            disabled={decide.isPending}
            onClick={() => confirm(`Reject the signup request from ${r.email}?`) && decide.mutate({ id: r.id, action: 'reject', note })}
          >
            Reject
          </Button>
        </div>
      )}
    </Card>
  );
}
