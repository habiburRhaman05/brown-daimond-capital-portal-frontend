import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { fmtDate, fmtDateTime, portalUrl } from '../../lib/format';
import type { Overview, PortalState } from '../../lib/types';
import { btnGhost, btnPrimary, Card, ErrorState, Notice, PageHeader, PageSkeleton, ProgressBar, StateBadge } from '../../components/ui';

const CTA: Record<PortalState, string> = {
  not_started: 'Start your portal',
  in_progress: 'Continue your portal',
  reopened: 'Make your changes',
  submitted: 'View your portal',
};

export function Dashboard() {
  const { data, error, isLoading, refetch } = useQuery({ queryKey: ['client', 'overview'], queryFn: () => api<Overview>('/api/client/overview') });
  if (isLoading) return <PageSkeleton cards={3} />;
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;

  const { summary: s, design } = data;
  const first = s.name.split(' ')[0] || 'there';

  return (
    <>
      <PageHeader
        title={`Hello, ${first}`}
        subtitle={s.businessName ? `Your business: ${s.businessName}` : 'Welcome to your Brown Diamond client portal.'}
        actions={<a className={btnPrimary} href={portalUrl()}>{CTA[s.state]}</a>}
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

      <div className="grid gap-5 md:grid-cols-2">
        <Card title="Your portal" action={<StateBadge state={s.state} />}>
          <div className="space-y-4">
            <ProgressBar label="Your information" filled={s.progress.information.filled} total={s.progress.information.total} />
            <ProgressBar label="Your website" filled={s.progress.website.filled} total={s.progress.website.total} />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link className={btnGhost} to="/dashboard/information">See my information</Link>
            <a className={btnGhost} href={portalUrl()}>Open portal</a>
          </div>
        </Card>

        <Card title="Your website" action={<Link to="/dashboard/website" className="text-sm font-medium text-brand hover:underline">Details</Link>}>
          {design.template ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="inline-block h-4 w-4 rounded-full border border-line" style={{ background: design.paletteHex || '#ccc' }} />
                <span className="font-medium">{design.templateLabel}</span>
                <span className="text-muted">· {design.palette} · {design.fonts}</span>
              </div>
              <p className="text-muted">{design.theme}</p>
              {s.site.previewUrl && <a className="text-brand hover:underline" href={s.site.previewUrl} target="_blank" rel="noreferrer">Preview your site</a>}
              {s.site.url && <div><a className="text-brand hover:underline" href={s.site.url} target="_blank" rel="noreferrer">Visit your live site</a></div>}
            </div>
          ) : (
            <p className="text-sm text-muted">You have not chosen a design yet. Open your portal to design your website.</p>
          )}
        </Card>

        <Card title="Account" className="md:col-span-2">
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div><dt className="text-muted">Email</dt><dd>{data.profile.email}</dd></div>
            <div><dt className="text-muted">Member since</dt><dd>{fmtDate(data.profile.createdAt)}</dd></div>
            {s.site.clientNumber && <div><dt className="text-muted">Client number</dt><dd>{s.site.clientNumber}</dd></div>}
          </dl>
        </Card>
      </div>
    </>
  );
}
