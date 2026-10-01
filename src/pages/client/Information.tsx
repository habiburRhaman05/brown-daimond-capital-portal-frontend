import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { portalUrl } from '../../lib/format';
import type { Details } from '../../lib/types';
import { btnPrimary, CardSkeleton, ErrorBox, HeaderSkeleton, PageHeader } from '../../components/ui';
import { FieldGroups } from '../../components/FieldGroups';

export function Information() {
  const { data, error, isLoading } = useQuery({ queryKey: ['client', 'details'], queryFn: () => api<Details>('/api/client/details') });
  if (isLoading) {
    return (
      <div role="status" aria-label="Loading">
        <HeaderSkeleton />
        <div className="grid gap-5 lg:grid-cols-2">{[0, 1, 2, 3].map((i) => <CardSkeleton key={i} lines={5} />)}</div>
      </div>
    );
  }
  if (error || !data) return <ErrorBox error={error} />;

  const locked = !!data.status.lockedOn;
  return (
    <>
      <PageHeader
        title="My information"
        subtitle="Everything you have filled in so far."
        actions={<a className={btnPrimary} href={portalUrl()}>{locked ? 'View in portal' : 'Edit in portal'}</a>}
      />
      <FieldGroups fields={data.fields} />
    </>
  );
}
