import { describe, expect, it } from 'vitest';
import { ACTION_LABEL, fmtDate, fmtDateTime, PART_LABEL, portalUrl, REQUEST_LABEL, STATE_LABEL } from './format';
import { canExport, specFromDetails } from './siteExport';

describe('fmtDate', () => {
  it.each([[undefined], [null], ['']])('returns an empty string for %s', (v) => {
    expect(fmtDate(v as string | null | undefined)).toBe('');
  });

  it('does not shift a bare date by timezone', () => {
    expect(fmtDate('2026-03-01')).toMatch(/1/);
    expect(fmtDate('2026-03-01')).toMatch(/2026/);
    expect(fmtDate('2026-12-31')).toMatch(/31/);
    expect(fmtDate('2026-12-31')).toMatch(/2026/);
  });

  it('formats a full ISO instant', () => {
    expect(fmtDate('2026-07-04T12:00:00Z')).toMatch(/2026/);
  });

  it('echoes back text it cannot parse instead of showing "Invalid Date"', () => {
    expect(fmtDate('sometime soon')).toBe('sometime soon');
  });
});

describe('fmtDateTime', () => {
  it('returns empty for empty input and the original text for junk', () => {
    expect(fmtDateTime('')).toBe('');
    expect(fmtDateTime(null)).toBe('');
    expect(fmtDateTime('garbage')).toBe('garbage');
  });

  it('includes the time of day', () => {
    expect(fmtDateTime('2026-07-04T15:45:00Z')).toMatch(/\d{1,2}:\d{2}/);
  });
});

describe('portalUrl', () => {
  it('points at the static portal', () => {
    expect(portalUrl()).toBe('/portal/index.html');
  });

  it('encodes the client id so it cannot break out of the query string', () => {
    expect(portalUrl('abc-123')).toBe('/portal/index.html?viewAs=abc-123');
    expect(portalUrl('a&b=c d')).toBe('/portal/index.html?viewAs=a%26b%3Dc%20d');
  });

  it('treats an empty id as "no impersonation"', () => {
    expect(portalUrl('')).toBe('/portal/index.html');
  });
});

describe('labels', () => {
  it('cover every portal state, request status and request part', () => {
    expect(Object.keys(STATE_LABEL).sort()).toEqual(['in_progress', 'not_started', 'reopened', 'submitted']);
    expect(Object.keys(REQUEST_LABEL).sort()).toEqual(['pending', 'resolved']);
    expect(Object.keys(PART_LABEL).sort()).toEqual(['business', 'team', 'website', 'you']);
  });

  it('have a readable label for audit actions the backend emits', () => {
    for (const a of ['client.signup', 'portal.submit', 'request.created', 'request.resolved', 'admin.reopen', 'admin.lock']) {
      expect(ACTION_LABEL[a]).toBeTruthy();
    }
  });
});

describe('site export validation', () => {
  const ok = { bizNameInput: 'Ada & Co', personalEmail: 'ada@x.co' };

  it('specFromDetails trims, builds the address and falls back to info@domain', () => {
    const spec = specFromDetails({ bizNameInput: '  Ada  ', domainInput: ' adaco.com ', mailingStreet: '1 Main', mailingCity: '', mailingState: 'TX', mailingZip: '78701' });
    expect(spec.entity).toBe('Ada');
    expect(spec.email).toBe('info@adaco.com');
    expect(spec.address).toBe('1 Main, TX, 78701');
  });

  it('prefers the personal email over the domain fallback', () => {
    expect(specFromDetails({ personalEmail: 'me@x.co', domainInput: 'adaco.com' }).email).toBe('me@x.co');
  });

  it('copes with non-string field values', () => {
    const spec = specFromDetails({ bizNameInput: 42 as unknown as string, taglineInput: null as unknown as string });
    expect(spec.entity).toBe('42');
    expect(spec.tagline).toBe('');
  });

  it('allows an export when design, business name and email exist', () => {
    expect(canExport(ok, { tpl: 'split' })).toBeNull();
  });

  it('blocks with a specific reason in priority order', () => {
    expect(canExport(ok, {})).toMatch(/not chosen a website design/);
    expect(canExport({ personalEmail: 'a@b.co' }, { tpl: 'split' })).toMatch(/business name/);
    expect(canExport({ bizNameInput: 'X' }, { tpl: 'split' })).toMatch(/email or domain/);
  });

  it('treats a whitespace-only business name as missing', () => {
    expect(canExport({ bizNameInput: '   ', personalEmail: 'a@b.co' }, { tpl: 'split' })).toMatch(/business name/);
  });
});
