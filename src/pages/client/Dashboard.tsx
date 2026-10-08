import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { fmtDate, fmtDateTime, portalUrl } from '../../lib/format';
import type { Overview, PortalState } from '../../lib/types';
import { btnPrimary, CardSkeleton, ErrorState, HoverCard, Notice, PageHeader, ProgressRing, StateBadge } from '../../components/ui';

const CTA: Record<PortalState, string> = {
  not_started: 'Start your portal',
  in_progress: 'Continue your portal',
  reopened: 'Make your changes',
  submitted: 'View your portal',
};

export function Dashboard() {
  const { data, error, isLoading, refetch } = useQuery({ queryKey: ['client', 'overview'], queryFn: () => api<Overview>('/api/client/overview') });

  if (isLoading) {
    return (
      <>
        <PageHeader title="Welcome" subtitle="Loading your dashboard..." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr]">
          <CardSkeleton lines={5} />
          <CardSkeleton lines={4} />
          <CardSkeleton lines={2} />
          <CardSkeleton lines={2} />
        </div>
      </>
    );
  }
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;

  const { summary: s, design } = data;
  const first = s.name.split(' ')[0] || 'there';

  return (
    <>
      <PageHeader
        title={`Hello, ${first}`}
        subtitle={s.businessName ? `Your business: ${s.businessName}` : 'Welcome to your Brown Diamond client portal.'}
        actions={
          <a className={`${btnPrimary} gap-2`} href={portalUrl()}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            {CTA[s.state]}
          </a>
        }
      />

      <div className="mb-6 space-y-3">
        {s.state === 'submitted' && (
          <Notice tone="ok">
            <b>Your information was locked on {fmtDateTime(s.lockedOn) || fmtDate(s.completedOn)}.</b> Work on your business has started from these details. To change anything, send a change request.
          </Notice>
        )}
        {s.state === 'reopened' && (
          <Notice tone="warn">
            <b>Your portal is open until {fmtDateTime(s.changesUntil)}.</b> Make your changes, then Save and Submit again. After that time it locks again.
          </Notice>
        )}
        {s.pendingRequests > 0 && (
          <Notice tone="info">You have {s.pendingRequests} change request{s.pendingRequests > 1 ? 's' : ''} waiting for review.</Notice>
        )}
      </div>

      {/* Bento grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr]">
        {/* Website card */}
        <HoverCard
          title="Your website"
          action={
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-surface">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6F6A60" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4v5"/></svg>
            </span>
          }
        >
          {design.template ? (
            <div className="flex flex-col justify-between">
              <div className="flex items-center gap-4">
                <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl bg-brand shadow-[0_8px_20px_-8px_rgba(11,46,34,0.5)]">
                  <span className="inline-block h-4 w-4 rounded-full border-2 border-white/50" style={{ background: design.paletteHex || '#ccc' }} />
                </span>
                <div>
                  <div className="font-serif text-lg font-semibold text-ink">{design.templateLabel} template</div>
                  <div className="mt-0.5 text-[13px] text-muted">{design.palette} palette &middot; {design.fonts} fonts</div>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link to="/dashboard/website" className="flex items-center gap-1.5 text-[13px] font-semibold text-brand hover:underline">
                  Details
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                </Link>
                {s.site.previewUrl && (
                  <a className="text-[13px] font-semibold text-brand hover:underline" href={s.site.previewUrl} target="_blank" rel="noreferrer">Preview your site</a>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">You have not chosen a design yet. Open your portal to design your website.</p>
          )}
        </HoverCard>

        {/* Account card */}
        <HoverCard title="Account">
          <div className="flex flex-col gap-3">
            <div className="flex justify-between text-[13px]"><span className="text-muted">Email</span><span className="font-medium text-ink">{data.profile.email}</span></div>
            <div className="flex justify-between text-[13px]"><span className="text-muted">Member since</span><span className="font-medium text-ink">{fmtDate(data.profile.createdAt)}</span></div>
            {s.site.clientNumber && (
              <div className="flex justify-between text-[13px]"><span className="text-muted">Client #</span><span className="rounded-md bg-surface px-2 py-0.5 font-medium text-ink">{s.site.clientNumber}</span></div>
            )}
            <div className="flex justify-between text-[13px]"><span className="text-muted">Status</span><StateBadge state={s.state} /></div>
          </div>
        </HoverCard>

        {/* Progress rings */}
        <HoverCard>
          <ProgressRing label="Your information" filled={s.progress.information.filled} total={s.progress.information.total} color="brand" />
        </HoverCard>

        <HoverCard>
          <ProgressRing label="Your website" filled={s.progress.website.filled} total={s.progress.website.total} color="gold" />
        </HoverCard>
      </div>
    </>
  );
}
