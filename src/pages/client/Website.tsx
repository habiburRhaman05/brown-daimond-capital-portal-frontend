import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { fmtDate, portalUrl } from '../../lib/format';
import type { Details } from '../../lib/types';
import { btnPrimary, Card, CardSkeleton, ErrorState, KV, PageHeader } from '../../components/ui';
import { DesignCard } from '../../components/DesignCard';

export function Website() {
  const { data, error, isLoading, refetch } = useQuery({ queryKey: ['client', 'details'], queryFn: () => api<Details>('/api/client/details') });
  if (isLoading) {
    return (
      <div role="status" aria-label="Loading">
        <PageHeader title="My website" subtitle="The design you selected. Your portal shows a live preview." />
        <div className="grid gap-5 lg:grid-cols-2"><CardSkeleton lines={8} /><CardSkeleton lines={4} /></div>
      </div>
    );
  }
  if (error || !data) return <ErrorState error={error} onRetry={refetch} />;

  const { site } = data;
  return (
    <>
      <PageHeader
        title="My website"
        subtitle="The design you selected. Your portal shows a live preview."
        actions={<a className={btnPrimary} href={portalUrl()}>Open design in portal</a>}
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <DesignCard design={data.design} />
        <Card title="Your site">
          <dl className="divide-y divide-line">
            <KV label="Preview">
              {site.previewUrl && <a className="text-brand hover:underline" href={site.previewUrl} target="_blank" rel="noreferrer">{site.previewUrl}</a>}
            </KV>
            <KV label="Live site">
              {site.url && <a className="text-brand hover:underline" href={site.url} target="_blank" rel="noreferrer">{site.url}</a>}
            </KV>
            <KV label="Published on">{fmtDate(site.deployedOn)}</KV>
          </dl>
          {!site.previewUrl && !site.url && (
            <p className="mt-3 text-sm text-muted">Your site is built after you submit your portal. A preview link will appear here.</p>
          )}
        </Card>
      </div>
    </>
  );
}
