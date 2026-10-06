import { FIELD_GROUPS, WEBSITE_GROUP, contactTimes, str, teamRows } from '../lib/fields';
import type { FieldValues } from '../lib/types';
import { Card, KV } from './ui';

// Everything the client filled in, grouped like the portal's own sections. Read only.
export function FieldGroups({ fields }: { fields: FieldValues }) {
  const rows = teamRows(fields);
  const times = contactTimes(fields);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {FIELD_GROUPS.map((g) => (
        <Card key={g.title} title={g.title}>
          <dl className="divide-y divide-line">
            {g.items.map((f) => (
              <KV key={f.key} label={f.label}>
                {str(fields[f.key])}
              </KV>
            ))}
            {g.title === 'Contact preferences' && <KV label="Preferred contact time">{times}</KV>}
          </dl>
        </Card>
      ))}
      <Card title="Team" className="lg:col-span-2">
        {rows.length === 0 ? (
          <p className="text-sm text-muted">No team members added.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="py-2 pr-4">#</th>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Role / relationship</th>
                  <th className="py-2 pr-4">Phone</th>
                  <th className="py-2">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.row}>
                    <td className="py-2 pr-4 text-muted">{r.row}</td>
                    <td className="py-2 pr-4">{r.name}</td>
                    <td className="py-2 pr-4">{[r.role, r.relationship].filter(Boolean).join(' / ')}</td>
                    <td className="py-2 pr-4">{r.phone}</td>
                    <td className="py-2">{r.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Card title={WEBSITE_GROUP.title}>
        <dl className="divide-y divide-line">
          {WEBSITE_GROUP.items.map((f) => (
            <KV key={f.key} label={f.label}>
              {str(fields[f.key])}
            </KV>
          ))}
        </dl>
      </Card>
    </div>
  );
}
