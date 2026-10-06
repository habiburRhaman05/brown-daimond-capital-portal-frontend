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
  resolved: 'Resolved',
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
  'request.resolved': 'Change request marked resolved',
  'request.reopened': 'Change request moved back to pending',
  'admin.edit_details': 'Details edited by admin',
  'admin.site_info': 'Site info updated by admin',
  'admin.reopen': 'Portal reopened',
  'admin.lock': 'Portal locked',
  'signup.approved': 'Signup request approved',
  'signup.rejected': 'Signup request rejected',
  'invite.sent': 'Invite sent',
  'invite.link_created': 'Invite link created',
  'invite.revoked': 'Invite revoked',
  'client_number.added': 'Client number added',
  'client_number.updated': 'Client number updated',
  'client_number.deleted': 'Client number removed',
};

export const portalUrl = (viewAs?: string) => (viewAs ? `/portal/index.html?viewAs=${encodeURIComponent(viewAs)}` : '/portal/index.html');
