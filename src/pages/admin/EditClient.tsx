import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, errorMessage } from '../../lib/api';
import { FIELD_GROUPS, TIMES, str } from '../../lib/fields';
import type { ClientDetail, FieldValues } from '../../lib/types';
import { useToast } from '../../components/Toast';
import { Button, ErrorBox, inputCls } from '../../components/ui';

const TEMPLATES = ['editorial', 'split', 'sidebar', 'centered'];
const FONTS = ['Classic', 'Contemporary'];
const PALETTES = ['Forest', 'Navy', 'Charcoal', 'Oxblood', 'Umber', 'Aubergine', 'Slate', 'Ironstone'];
const TEAM_KEYS = ['name', 'role', 'relationship', 'phone', 'email'] as const;
const TEAM_LABEL: Record<(typeof TEAM_KEYS)[number], string> = { name: 'Name', role: 'Role', relationship: 'Relationship', phone: 'Phone', email: 'Email' };

const teamKey = (kind: string, row: number) => `team_${kind}_${row}`;
const allKeys = (): string[] => [
  ...FIELD_GROUPS.flatMap((g) => g.items.map((i) => i.key)),
  ...TIMES.map((t) => t.key),
  ...[1, 2, 3, 4, 5].flatMap((r) => TEAM_KEYS.map((k) => teamKey(k, r))),
];

// Rows 2-5 are stored as one JSON value, and the three contact times as one multi-select,
// so if any part of those groups changed the whole group must be sent.
function changedPayload(initial: FieldValues, current: FieldValues): FieldValues {
  const out: FieldValues = {};
  const differs = (k: string) => (initial[k] ?? '') !== (current[k] ?? '') && !(initial[k] === undefined && current[k] === false);
  for (const k of allKeys()) if (differs(k)) out[k] = current[k] ?? '';
  const groupChanged = (keys: string[]) => keys.some((k) => k in out);
  const extra = [2, 3, 4, 5].flatMap((r) => TEAM_KEYS.map((k) => teamKey(k, r)));
  if (groupChanged(extra)) for (const k of extra) out[k] = current[k] ?? '';
  const times = TIMES.map((t) => t.key as string);
  if (groupChanged(times)) for (const k of times) out[k] = current[k] === true;
  return out;
}

export function EditClient({ id, detail, onClose }: { id: string; detail: ClientDetail; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [fields, setFields] = useState<FieldValues>({ ...detail.fields });
  const [design, setDesign] = useState({
    tpl: str(detail.sel.tpl),
    fnt: str(detail.sel.fnt),
    pal: str(detail.sel.pal),
    variant: typeof detail.sel.variant === 'number' ? detail.sel.variant : 0,
  });

  const save = useMutation({
    mutationFn: () => {
      const body: { fields: FieldValues; sel?: Record<string, unknown> } = { fields: changedPayload(detail.fields, fields) };
      const sel: Record<string, unknown> = {};
      if (design.tpl && design.tpl !== detail.sel.tpl) sel.tpl = design.tpl;
      if (design.fnt && design.fnt !== detail.sel.fnt) sel.fnt = design.fnt;
      if (design.pal && design.pal !== detail.sel.pal) sel.pal = design.pal;
      if (design.variant !== detail.sel.variant) sel.variant = design.variant;
      if (Object.keys(sel).length) body.sel = sel;
      return api(`/api/admin/clients/${id}/details`, { method: 'PUT', body });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      toast.success('Client details saved.');
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const set = (k: string, v: string | boolean) => setFields((f) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-2 sm:p-4" role="dialog" aria-modal="true" aria-label="Edit client details">
      <div className="my-2 w-full max-w-3xl rounded-xl bg-white p-4 shadow-xl sm:my-8 sm:p-6">
        <h2 className="text-lg font-semibold">Edit details</h2>
        <p className="mt-1 text-sm text-muted">Changes are saved to the client's record and noted as made by an admin. The lock is not affected.</p>

        <div className="mt-5 space-y-6">
          {FIELD_GROUPS.map((g) => (
            <fieldset key={g.title}>
              <legend className="mb-2 text-sm font-semibold">{g.title}</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {g.items.map((f) => (
                  <label key={f.key} className={`block text-sm ${f.type === 'textarea' ? 'sm:col-span-2' : ''}`}>
                    <span className="mb-1 block text-muted">{f.label}</span>
                    {f.type === 'select' ? (
                      <select className={inputCls} value={str(fields[f.key])} onChange={(e) => set(f.key, e.target.value)}>
                        <option value="">—</option>
                        {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : f.type === 'textarea' ? (
                      <textarea className={inputCls} rows={3} value={str(fields[f.key])} onChange={(e) => set(f.key, e.target.value)} />
                    ) : (
                      <input className={inputCls} type={f.type ?? 'text'} value={str(fields[f.key])} onChange={(e) => set(f.key, e.target.value)} />
                    )}
                  </label>
                ))}
                {g.title === 'Contact preferences' && (
                  <div className="text-sm">
                    <span className="mb-1 block text-muted">Preferred contact time</span>
                    <div className="flex gap-4 py-2">
                      {TIMES.map((t) => (
                        <label key={t.key} className="flex items-center gap-1.5">
                          <input type="checkbox" checked={fields[t.key] === true} onChange={(e) => set(t.key, e.target.checked)} /> {t.label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </fieldset>
          ))}

          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Team</legend>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((r) => (
                <div key={r} className="grid gap-2 rounded-lg border border-line p-2 sm:grid-cols-5 sm:border-0 sm:p-0">
                  {TEAM_KEYS.map((k) => (
                    <input key={k} className={inputCls} placeholder={`${TEAM_LABEL[k]} (row ${r})`} aria-label={`${TEAM_LABEL[k]} row ${r}`} value={str(fields[teamKey(k, r)])} onChange={(e) => set(teamKey(k, r), e.target.value)} />
                  ))}
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Website design</legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <label className="block text-sm"><span className="mb-1 block text-muted">Template</span>
                <select className={`${inputCls} capitalize`} value={design.tpl} onChange={(e) => setDesign({ ...design, tpl: e.target.value })}>
                  {TEMPLATES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="block text-sm"><span className="mb-1 block text-muted">Fonts</span>
                <select className={inputCls} value={design.fnt} onChange={(e) => setDesign({ ...design, fnt: e.target.value })}>
                  {FONTS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="block text-sm"><span className="mb-1 block text-muted">Palette</span>
                <select className={inputCls} value={design.pal} onChange={(e) => setDesign({ ...design, pal: e.target.value })}>
                  {PALETTES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="block text-sm"><span className="mb-1 block text-muted">Copy variant</span>
                <select className={inputCls} value={design.variant} onChange={(e) => setDesign({ ...design, variant: Number(e.target.value) })}>
                  {['A', 'B', 'C', 'D'].map((t, i) => <option key={t} value={i}>{t}</option>)}
                </select>
              </label>
            </div>
            <p className="mt-2 text-xs text-muted">Page names and hero images are chosen by the client in the portal.</p>
          </fieldset>
        </div>

        {save.error && <div className="mt-4"><ErrorBox error={save.error} /></div>}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" disabled={save.isPending} onClick={onClose}>Cancel</Button>
          <Button loading={save.isPending} loadingText="Saving…" onClick={() => save.mutate()}>Save changes</Button>
        </div>
      </div>
    </div>
  );
}
