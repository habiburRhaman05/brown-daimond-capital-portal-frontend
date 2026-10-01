export type Role = 'admin' | 'client';
export type PortalState = 'not_started' | 'in_progress' | 'submitted' | 'reopened';
export type RequestStatus = 'pending' | 'approved' | 'rejected';
export type RequestPart = 'website' | 'team' | 'you' | 'business';

export interface Me {
  user: { id: string; email: string; role: Role };
}

export interface Progress {
  information: { filled: number; total: number };
  website: { filled: number; total: number };
}

export interface SiteInfo {
  previewUrl: string;
  deployedOn: string;
  url: string;
  clientNumber: string;
}

export interface Summary {
  id: string;
  email: string;
  name: string;
  businessName: string;
  theme: string;
  template: string;
  palette: string;
  state: PortalState;
  completedOn: string;
  lockedOn: string;
  changesUntil: string;
  pendingRequests: number;
  progress: Progress;
  site: SiteInfo;
  createdAt: string;
  loadError?: boolean;
}

export interface Design {
  template: string;
  templateLabel: string;
  fonts: string;
  fontPair: string;
  palette: string;
  paletteHex: string;
  theme: string;
  variant: number | null;
  variantLabel: string;
  tier: string;
  pageNames: string[];
  heroImages: string[];
  heroLabels: string[];
  tagline: string;
  cta: string;
  entity: string;
}

export type FieldValues = Record<string, string | boolean | undefined>;

export interface Status {
  completedOn: string;
  lockedOn: string;
  changesUntil: string;
}

export interface Overview {
  profile: { id: string; email: string; role: Role; createdAt: string };
  summary: Summary;
  design: Design;
}

export interface Details {
  fields: FieldValues;
  sel: Record<string, unknown>;
  status: Status;
  site: SiteInfo;
  design: Design;
}

export interface ChangeRequest {
  id: string;
  clientId?: string;
  clientEmail?: string;
  part: RequestPart;
  text: string;
  status: RequestStatus;
  adminNote: string;
  createdAt: string;
  decidedAt: string | null;
}

export interface AuditRow {
  id: number;
  actor_id: string | null;
  action: string;
  client_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface ClientDetail {
  summary: Summary;
  fields: FieldValues;
  sel: Record<string, unknown>;
  design: Design;
  status: Status;
  site: SiteInfo;
  requests: ChangeRequest[];
  audit: AuditRow[];
}

export interface Invite {
  id: string;
  email: string;
  status: 'sent' | 'accepted' | 'revoked';
  created_at: string;
  accepted_at: string | null;
}
