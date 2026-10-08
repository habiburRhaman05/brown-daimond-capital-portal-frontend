import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { REQUEST_LABEL, STATE_LABEL } from '../lib/format';
import type { PortalState, RequestStatus } from '../lib/types';
import { errorMessage } from '../lib/api';

export const btnPrimary =
  'inline-flex cursor-pointer items-center justify-center rounded-xl bg-gradient-to-b from-brand-light to-brand px-5 py-2.5 text-sm font-semibold text-white shadow-[0_1px_1px_rgba(0,0,0,0.1),0_8px_20px_-6px_rgba(11,46,34,0.55)] transition-all duration-150 hover:-translate-y-px hover:shadow-[0_1px_1px_rgba(0,0,0,0.1),0_12px_28px_-6px_rgba(11,46,34,0.6)] active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50';
export const btnGhost =
  'inline-flex cursor-pointer items-center justify-center rounded-xl border-[1.5px] border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink transition-all duration-150 hover:-translate-y-px hover:border-[#D8D1C0] hover:bg-surface active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50';
export const btnDanger =
  'inline-flex cursor-pointer items-center justify-center rounded-xl border-[1.5px] border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition-all duration-150 hover:bg-red-50 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50';
export const inputCls =
  'w-full rounded-xl border-[1.5px] border-[#E6E1D6] bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-[#AFA998] focus:border-brand focus:shadow-[0_0_0_4px_rgba(11,46,34,0.10)]';

const BUTTON_VARIANT = { primary: btnPrimary, ghost: btnGhost, danger: btnDanger } as const;

export function InlineSpinner({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} />;
}

export function Button({
  variant = 'primary', loading = false, loadingText, disabled, className = '', children, type = 'button', ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof BUTTON_VARIANT; loading?: boolean; loadingText?: ReactNode }) {
  return (
    <button type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={`${BUTTON_VARIANT[variant]} gap-2 ${className}`} {...rest}>
      {loading && <InlineSpinner />}
      <span className="inline-flex items-center gap-2">{loading && loadingText ? loadingText : children}</span>
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
    <div className={`rounded-[20px] border border-line bg-white p-6 ${className}`}>
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
        <div key={i} className="rounded-[20px] border border-line bg-white p-4">
          <div className="flex gap-2"><Skeleton className="h-5 w-16 rounded-full" /><Skeleton className="h-5 w-24" /></div>
          <Skeleton className="mt-3 h-3.5 w-full" />
          <Skeleton className="mt-2 h-3.5 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton({ cards = 2, tiles = 0 }: { cards?: number; tiles?: number }) {
  return (
    <div role="status" aria-label="Loading">
      <HeaderSkeleton />
      {tiles > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
          {Array.from({ length: tiles }, (_, i) => (
            <div key={i} className="rounded-[20px] border border-line bg-white p-5"><Skeleton className="h-8 w-12" /><Skeleton className="mt-3 h-3.5 w-24" /></div>
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
    <div className="divide-y divide-line rounded-[20px] border border-line bg-white" role="status" aria-label="Loading">
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

export function ShellSkeleton() {
  return (
    <div className="flex min-h-screen">
      <div className="hidden w-64 bg-brand lg:block" />
      <div className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:px-11 lg:py-10"><PageSkeleton /></div>
    </div>
  );
}

export function Card({ title, action, children, className = '' }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[20px] border border-[#ECE8DE] bg-white p-5 shadow-[0_1px_2px_rgba(20,18,16,0.03),0_10px_28px_-14px_rgba(20,18,16,0.10)] transition-[transform,box-shadow] duration-200 sm:p-6 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-[13px] font-semibold text-ink">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function HoverCard({ title, action, children, className = '' }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[20px] border border-[#ECE8DE] bg-white p-5 shadow-[0_1px_2px_rgba(20,18,16,0.03),0_10px_28px_-14px_rgba(20,18,16,0.10)] transition-[transform,box-shadow] duration-200 hover:-translate-y-[3px] hover:shadow-[0_1px_2px_rgba(20,18,16,0.04),0_18px_36px_-14px_rgba(20,18,16,0.18)] sm:p-6 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-[13px] font-semibold text-ink">{title}</h2>}
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
        <h1 className="font-serif text-[30px] font-semibold tracking-tight text-ink max-sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex w-full flex-wrap gap-2 sm:w-auto">{actions}</div>}
    </div>
  );
}

const TONES = {
  gray: 'bg-[#F3F2EE] text-[#6F6A60]',
  amber: 'bg-amber-100 text-amber-800',
  green: 'bg-green-100 text-green-800',
  red: 'bg-red-100 text-red-800',
  blue: 'bg-blue-100 text-blue-800',
} as const;

export function Badge({ tone, children }: { tone: keyof typeof TONES; children: ReactNode }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${TONES[tone]}`}>{children}</span>;
}

const STATE_TONE: Record<PortalState, keyof typeof TONES> = { not_started: 'gray', in_progress: 'blue', submitted: 'green', reopened: 'amber' };
export const StateBadge = ({ state }: { state: PortalState }) => <Badge tone={STATE_TONE[state]}>{STATE_LABEL[state]}</Badge>;

const REQUEST_TONE: Record<RequestStatus, keyof typeof TONES> = { pending: 'amber', resolved: 'green' };
export const RequestBadge = ({ status }: { status: RequestStatus }) => <Badge tone={REQUEST_TONE[status]}>{REQUEST_LABEL[status]}</Badge>;

export function ErrorBox({ error }: { error: unknown }) {
  return <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMessage(error)}</div>;
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="rounded-[20px] border-[1.5px] border-red-200 bg-white px-6 py-14 text-center">
      <div className="mx-auto mb-5 flex h-[60px] w-[60px] items-center justify-center rounded-2xl bg-red-50">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#B91C1C" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
      </div>
      <p className="font-serif text-lg font-semibold text-ink">Something went wrong</p>
      <p className="mx-auto mt-2 max-w-sm text-[13.5px] text-muted">{errorMessage(error)}</p>
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
  const styles = {
    info: 'border-blue-200 bg-blue-50 text-blue-900',
    warn: 'border-amber-200 bg-amber-50/80 text-amber-900',
    ok: 'border-green-200 bg-green-50 text-green-900',
  }[tone];
  return <div className={`rounded-2xl border px-4 py-3.5 text-[13.5px] leading-relaxed ${styles}`}>{children}</div>;
}

export function Empty({ icon, title, action, children }: { icon?: ReactNode; title?: string; action?: ReactNode; children?: ReactNode }) {
  if (!icon && !title && !action) {
    return <p className="rounded-[20px] border-[1.5px] border-dashed border-[#DED7C7] bg-white px-4 py-8 text-center text-sm text-muted">{children}</p>;
  }
  return (
    <div className="rounded-[20px] border-[1.5px] border-dashed border-[#DED7C7] bg-white px-6 py-14 text-center">
      {icon && <div className="mx-auto mb-5 flex h-[60px] w-[60px] items-center justify-center rounded-2xl bg-surface">{icon}</div>}
      {title && <p className="font-serif text-lg font-semibold text-ink">{title}</p>}
      {children && <p className="mx-auto mt-2 max-w-sm text-[13.5px] text-muted">{children}</p>}
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
      <div className="h-2 overflow-hidden rounded-full bg-surface">
        <div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function ProgressRing({ label, filled, total, color = 'brand' }: { label: string; filled: number; total: number; color?: 'brand' | 'gold' }) {
  const pct = total ? Math.round((filled / total) * 100) : 0;
  const r = 36;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  const strokeColor = color === 'gold' ? '#C8A875' : '#0B2E22';
  return (
    <div className="flex items-center gap-5">
      <svg width="92" height="92" viewBox="0 0 92 92" className="shrink-0">
        <circle cx="46" cy="46" r={r} fill="none" stroke="#F0EEE6" strokeWidth="9"/>
        <circle cx="46" cy="46" r={r} fill="none" stroke={strokeColor} strokeWidth="9" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} transform="rotate(-90 46 46)" className="transition-[stroke-dashoffset] duration-700"/>
        <text x="46" y="51" textAnchor="middle" fontFamily="Inter" fontSize="19" fontWeight="700" fill="#171412">{pct}%</text>
      </svg>
      <div>
        <div className="text-[13px] font-semibold text-ink">{label}</div>
        <div className="mt-0.5 text-[12.5px] text-muted">{filled} of {total} answered</div>
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
