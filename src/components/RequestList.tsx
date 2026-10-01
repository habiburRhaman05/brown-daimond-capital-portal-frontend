import type { ReactNode } from 'react';
import { fmtDateTime, PART_LABEL } from '../lib/format';
import type { ChangeRequest } from '../lib/types';
import { Empty, RequestBadge } from './ui';

export function RequestList({ requests, renderActions, showClient }: {
  requests: ChangeRequest[];
  renderActions?: (r: ChangeRequest) => ReactNode;
  showClient?: (r: ChangeRequest) => ReactNode;
}) {
  if (requests.length === 0) return <Empty>No change requests.</Empty>;
  return (
    <ul className="space-y-3">
      {requests.map((r) => (
        <li key={r.id} className="rounded-xl border border-line bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <RequestBadge status={r.status} />
              <span className="font-medium">{PART_LABEL[r.part]}</span>
              {showClient && <span className="text-muted">· {showClient(r)}</span>}
              <span className="text-muted">· {fmtDateTime(r.createdAt)}</span>
            </div>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm">{r.text}</p>
          {r.adminNote && (
            <p className="mt-2 rounded-md bg-paper px-3 py-2 text-sm text-muted">
              <span className="font-medium text-ink">Note from your manager:</span> {r.adminNote}
            </p>
          )}
          {r.decidedAt && <p className="mt-1 text-xs text-muted">Decided {fmtDateTime(r.decidedAt)}</p>}
          {renderActions && <div className="mt-3">{renderActions(r)}</div>}
        </li>
      ))}
    </ul>
  );
}
