// Builds a client's website as a ZIP of three self-contained HTML files (CSS and hero image inlined,
// no other files). It renders in the admin's browser with the same engine the client portal uses
// for its live preview (embedded in /portal/index.html), the same steps as the kit's generate.py.
import type { FieldValues } from './types';

type Sel = Record<string, unknown>;

interface Spec {
  entity: string;
  tagline: string;
  cta: string;
  email: string;
  phone: string;
  address: string;
}

const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function specFromDetails(fields: FieldValues): Spec {
  const domain = str(fields.domainInput).trim();
  const email = str(fields.personalEmail).trim() || (domain ? `info@${domain}` : '');
  return {
    entity: str(fields.bizNameInput).trim(),
    tagline: str(fields.taglineInput).trim(),
    cta: str(fields.ctaSel).trim(),
    email,
    phone: str(fields.personalPhone).trim(),
    address: [fields.mailingStreet, fields.mailingCity, fields.mailingState, fields.mailingZip].map(str).filter(Boolean).join(', '),
  };
}

export function canExport(fields: FieldValues, sel: Sel): string | null {
  const spec = specFromDetails(fields);
  if (!str(sel.tpl)) return 'This client has not chosen a website design yet.';
  if (!spec.entity) return 'This client has not entered a business name yet.';
  if (!spec.email) return 'This client has no email or domain to use for the contact page.';
  return null;
}

// The engine ships inside the portal page as text (its closing script tags are encoded).
async function loadEngineSource(): Promise<string> {
  const res = await fetch('/portal/index.html', { cache: 'no-store' });
  if (!res.ok) throw new Error('ENGINE_UNAVAILABLE');
  const html = await res.text();
  const open = html.indexOf('<script id="previewEngineSrc" type="text/plain">');
  if (open < 0) throw new Error('ENGINE_UNAVAILABLE');
  const start = html.indexOf('>', open) + 1;
  const end = html.indexOf('</script>', start);
  if (end < 0) throw new Error('ENGINE_UNAVAILABLE');
  return html.slice(start, end).split('<BDCAPCLOSESCRIPT').join('</script');
}

type Win = Window & { EMBED?: Record<string, string>; [k: string]: unknown };

function setSelect(doc: Document, id: string, value: string): boolean {
  const el = doc.getElementById(id) as HTMLSelectElement | null;
  if (!el) return false;
  const opt = Array.from(el.options).find((o) => o.value === value || o.text === value);
  if (!opt) return false;
  el.value = opt.value;
  if (typeof el.onchange === 'function') el.onchange({ target: el } as unknown as Event);
  return true;
}

export interface SiteZip {
  blob: Blob;
  filename: string;
  files: string[];
}

export async function buildSiteZip(fields: FieldValues, sel: Sel, onProgress?: (msg: string) => void): Promise<SiteZip> {
  const problem = canExport(fields, sel);
  if (problem) throw new Error(problem);
  const spec = specFromDetails(fields);
  const say = (m: string) => onProgress?.(m);

  say('Loading the website engine…');
  const [engine, { default: JSZip }] = await Promise.all([loadEngineSource(), import('jszip')]);

  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.style.cssText = 'position:fixed;left:-20000px;top:0;width:1440px;height:900px;border:0;visibility:hidden';
  document.body.appendChild(frame);

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('ENGINE_TIMEOUT')), 15000);
      frame.addEventListener('load', () => { clearTimeout(timer); resolve(); }, { once: true });
      frame.srcdoc = engine;
    });
    await wait(1200);

    const win = frame.contentWindow as Win;
    const doc = frame.contentDocument as Document;
    if (!win || !doc || !doc.getElementById('site')) throw new Error('ENGINE_UNAVAILABLE');

    win.__BDCAP_ENTITY = spec.entity;
    win.__BDCAP_INITIALS = spec.entity.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    win.__BDCAP_TAGLINE = spec.tagline;
    win.__BDCAP_CTA = spec.cta;
    win.__BDCAP_EMAIL = spec.email;
    win.__BDCAP_PHONE = spec.phone || ' ';
    win.__BDCAP_ADDRESS = spec.address || ' ';

    say('Applying the client’s design…');
    const nav = [sel.nav0, sel.nav1, sel.nav2].map((n) => String(n ?? 0));
    if (!setSelect(doc, 'tpl', str(sel.tpl))) throw new Error('DESIGN_UNAVAILABLE');
    await wait(400);
    const steps: [string, string][] = [
      ['thm', str(sel.thm)], ['pal', str(sel.pal)], ['fnt', str(sel.fnt)], ['variant', String(sel.variant ?? 0)],
      ['nav0', nav[0]], ['nav1', nav[1]], ['nav2', nav[2]],
    ];
    for (const [id, value] of steps) {
      if (value && !setSelect(doc, id, value)) throw new Error('DESIGN_UNAVAILABLE');
    }

    const css = doc.querySelector('style')?.textContent ?? '';
    const fontLinks = Array.from(doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href*="fonts.googleapis"]')).map((l) => l.href);
    const labels = [0, 1, 2].map((i) => (doc.getElementById('nav' + i) as HTMLSelectElement).selectedOptions[0].text);
    const files = ['index.html', `${slug(labels[1]) || 'page-2'}.html`, 'contact.html'];
    const heroes = Array.isArray(sel.heroPg) ? (sel.heroPg as unknown[]).map(str) : ['', '', ''];
    const tplBtn = str(sel.tpl) === 'editorial' ? 'b8-cta-btn' : 'btn';

    const zip = new JSZip();
    for (let i = 0; i < 3; i++) {
      say(`Rendering page ${i + 1} of 3…`);
      setSelect(doc, 'pg', String(i));
      await wait(200);
      if (heroes[i]) setSelect(doc, 'img', heroes[i]);
      await wait(300);

      // Drop contact rows whose value is blank (no phone / address yet).
      doc.querySelectorAll('#site *').forEach((el) => {
        if (el.children.length) return;
        const t = (el.textContent ?? '').trim().toLowerCase();
        if (t !== 'phone' && t !== 'address') return;
        const row = el.closest('.info-row') ?? el.parentElement;
        if (row && (row.textContent ?? '').trim().toLowerCase() === t) row.remove();
      });

      let html = (doc.getElementById('site') as HTMLElement).outerHTML;
      const title = doc.querySelector('#site h1')?.textContent ?? '';
      const desc = (doc.querySelector('#site .b8-hero-sub, #site .spl-hero-sub, #site .sb-hero-sub, #site .ct-hero-sub')?.textContent ?? '').trim();

      // Nav links point at the three files; the engine's own control hooks are removed.
      files.forEach((f, n) => {
        html = html.replace(new RegExp(`href="#"([^>]*data-nav="${n}")`, 'g'), `href="${f}"$1`);
      });
      html = html.replace(/\sdata-nav="\d"/g, '');
      if (i === 2) {
        html = html.replace(
          /<form[\s\S]*?<\/form>/,
          `<p style="margin-top:18px"><a class="${tplBtn}" href="mailto:${esc(spec.email)}">${esc(spec.cta || 'Email us')}</a></p>` +
            `<p style="margin-top:10px"><a href="mailto:${esc(spec.email)}" style="color:inherit">${esc(spec.email)}</a></p>`,
        );
      }
      html = html.replace(/<a href="tel:"[^>]*>\s*<\/a>|<span[^>]*>\s+<\/span>/g, '');
      for (const cls of ['wordmark', 'brand', 'rail-brand']) {
        html = html.replace(`<a class="${cls}" href="#">`, `<a class="${cls}" href="index.html">`);
      }

      const pageTitle = `${esc(spec.entity)} — ${esc(labels[i])}`;
      const page = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${pageTitle}</title><meta name="description" content="${esc(desc)}">
${fontLinks.length ? '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' + fontLinks.map((u) => `<link href="${u}" rel="stylesheet">`).join('') : ''}
<meta property="og:title" content="${pageTitle}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="website"><meta name="twitter:card" content="summary">
<style>${css}</style><style>html,body{margin:0}#bar{display:none}</style>
<!-- ${esc(title) || 'page'} · generated ${new Date().toISOString().slice(0, 10)} -->
</head><body>${html}
</body></html>`;
      zip.file(files[i], page);
    }

    say('Creating the ZIP…');
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 9 } });
    return { blob, filename: `${slug(spec.entity) || 'website'}-website.zip`, files };
  } finally {
    frame.remove();
  }
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
