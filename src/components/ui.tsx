import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { REQUEST_LABEL, STATE_LABEL } from '../lib/format';
import type { PortalState, RequestStatus } from '../lib/types';
import { errorMessage } from '../lib/api';

export const btnPrimary =
  'inline-flex cursor-pointer items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50';
export const btnGhost =
  'inline-flex cursor-pointer items-center justify-center rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50';
export const btnDanger =
  'inline-flex cursor-pointer items-center justify-center rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50';
export const inputCls =
  'w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand';

const BUTTON_VARIANT = { primary: btnPrimary, ghost: btnGhost, danger: btnDanger } as const;

export function InlineSpinner({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} />;
}

// Every action button goes through this so users always see that a click registered:
// while `loading` it shows a spinner, swaps the label and ignores further clicks.
export function Button({
  variant = 'primary', loading = false, loadingText, disabled, className = '', children, type = 'button', ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BUTTON_VARIANT; loading?: boolean; loadingText?: ReactNode }) {
  return (
    <button type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={`${BUTTON_VARIANT[variant]} gap-2 ${className}`} {...rest}>
      {loading && <InlineSpinner />}
      <span>{loading && loadingText ? loadingText : children}</span>
    </button>
  );
}

export function Spinner({ full }: { full?: boolean }) {
  return (
    <div className={full ? 'flex min-h-screen items-center justify-center' : 'flex items-center justify-center py-12'}>
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-brand" role="status" aria-label="Loading" />
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-gray-200/70 ${className}`} />;
}

export function CardSkeleton({ lines = 4, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`rounded-xl border border-line bg-white p-5 ${className}`}>
      <Skeleton className="mb-4 h-4 w-1/3" />
      <div className="space-y-3">
        {Array.from({ length: lines }, (_, i) => <Skeleton key={i} className={`h-3.5 ${i % 3 === 2 ? 'w-2/3' : 'w-full'}`} />)}
      </div>
    </div>
  );
}

export function HeaderSkeleton() {
  return (
    <div className="mb-6 space-y-2">
      <Skeleton className="h-7 w-48 sm:w-64" />
      <Skeleton className="h-4 w-64 max-w-full sm:w-96" />
    </div>
  );
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="rounded-xl border border-line bg-white p-4">
          <div className="flex gap-2"><Skeleton className="h-5 w-16 rounded-full" /><Skeleton className="h-5 w-24" /></div>
          <Skeleton className="mt-3 h-3.5 w-full" />
          <Skeleton className="mt-2 h-3.5 w-2/3" />
        </div>
      ))}
    </div>
  );
}

// A page-shaped placeholder: header + a grid of cards. `tiles` adds a row of stat tiles first.
export function PageSkeleton({ cards = 2, tiles = 0 }: { cards?: number; tiles?: number }) {
  return (
    <div role="status" aria-label="Loading">
      <HeaderSkeleton />
      {tiles > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
          {Array.from({ length: tiles }, (_, i) => (
            <div key={i} className="rounded-xl border border-line bg-white p-5"><Skeleton className="h-8 w-12" /><Skeleton className="mt-3 h-3.5 w-24" /></div>
          ))}
        </div>
      )}
      <div className="grid gap-5 md:grid-cols-2">
        {Array.from({ length: cards }, (_, i) => <CardSkeleton key={i} />)}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="divide-y divide-line rounded-xl border border-line bg-white" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4">
          <div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-1/2" /></div>
          <Skeleton className="hidden h-5 w-20 rounded-full sm:block" />
          <Skeleton className="hidden h-4 w-24 md:block" />
        </div>
      ))}
    </div>
  );
}

// Shown while the app works out who is signed in: the real header's shape + page placeholder.
export function ShellSkeleton() {
  return (
    <div className="min-h-screen">
      <div className="border-b border-line bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-5"><Skeleton className="h-4 w-40" /><Skeleton className="h-8 w-24" /></div></div>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-5 sm:py-8"><PageSkeleton /></div>
    </div>
  );
}

export function Card({ title, action, children, className = '' }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-line bg-white p-4 sm:p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex w-full flex-wrap gap-2 sm:w-auto">{actions}</div>}
    </div>
  );
}

const TONES = {
  gray: 'bg-gray-100 text-gray-700',
  amber: 'bg-amber-100 text-amber-800',
  green: 'bg-green-100 text-green-800',
  red: 'bg-red-100 text-red-800',
  blue: 'bg-blue-100 text-blue-800',
} as const;

export function Badge({ tone, children }: { tone: keyof typeof TONES; children: ReactNode }) {
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONES[tone]}`}>{children}</span>;
}

const STATE_TONE: Record<PortalState, keyof typeof TONES> = { not_started: 'gray', in_progress: 'blue', submitted: 'green', reopened: 'amber' };
export const StateBadge = ({ state }: { state: PortalState }) => <Badge tone={STATE_TONE[state]}>{STATE_LABEL[state]}</Badge>;

const REQUEST_TONE: Record<RequestStatus, keyof typeof TONES> = { pending: 'amber', resolved: 'green' };
export const RequestBadge = ({ status }: { status: RequestStatus }) => <Badge tone={REQUEST_TONE[status]}>{REQUEST_LABEL[status]}</Badge>;

export function ErrorBox({ error }: { error: unknown }) {
  return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage(error)}</div>;
}

// For a page or list that failed to load entirely (not a form field error): an icon, a plain
// explanation and a Try again action, instead of a bare red line nobody notices below the fold.
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 bg-white px-6 py-14 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B91C1C" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-ink">Something went wrong</p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="ghost" className="mt-5" onClick={onRetry}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M23 4v6h-6M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'ok'; children: ReactNode }) {
  const cls = { info: 'border-blue-200 bg-blue-50 text-blue-900', warn: 'border-amber-200 bg-amber-50 text-amber-900', ok: 'border-green-200 bg-green-50 text-green-900' }[tone];
  return <div className={`rounded-lg border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}

// Plain mode (just children) keeps the old compact text block. Passing an icon/title/action
// switches to the richer empty-state card used for a list with nothing in it yet.
export function Empty({ icon, title, action, children }: { icon?: ReactNode; title?: string; action?: ReactNode; children?: ReactNode }) {
  if (!icon && !title && !action) {
    return <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-muted">{children}</p>;
  }
  return (
    <div className="rounded-xl border border-dashed border-line bg-white px-6 py-14 text-center">
      {icon && <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-paper">{icon}</div>}
      {title && <p className="text-sm font-semibold text-ink">{title}</p>}
      {children && <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ProgressBar({ label, filled, total }: { label: string; filled: number; total: number }) {
  const pct = total ? Math.round((filled / total) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-muted">
        <span>{label}</span>
        <span>{filled} of {total} answered</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function KV({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-0.5 py-2 text-sm sm:grid-cols-3 sm:gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="whitespace-pre-wrap break-words sm:col-span-2">{children || <span className="text-muted">Not provided</span>}</dd>
    </div>
  );
}
