import type { PortalState, RequestPart, RequestStatus } from './types';

// GHL keeps a bare date (YYYY-MM-DD) when no exact instant is known.
export function fmtDate(v?: string | null): string {
  if (!v) return '';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00`) : new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtDateTime(v?: string | null): string {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export const STATE_LABEL: Record<PortalState, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  submitted: 'Submitted',
  reopened: 'Reopened',
};

export const REQUEST_LABEL: Record<RequestStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const PART_LABEL: Record<RequestPart, string> = {
  website: 'Your website',
  team: 'Your team',
  you: 'About you',
  business: 'About your business',
};

export const ACTION_LABEL: Record<string, string> = {
  'client.signup': 'Client signed up',
  'portal.submit': 'Client submitted the portal',
  'request.created': 'Change request sent',
  'request.approved': 'Change request approved',
  'request.rejected': 'Change request rejected',
  'admin.edit_details': 'Details edited by admin',
  'admin.reopen': 'Portal reopened',
  'admin.lock': 'Portal locked',
  'invite.sent': 'Invite sent',
  'invite.revoked': 'Invite revoked',
};

export const portalUrl = (viewAs?: string) => (viewAs ? `/portal/index.html?viewAs=${encodeURIComponent(viewAs)}` : '/portal/index.html');
