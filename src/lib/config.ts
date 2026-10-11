// Where the backend API lives.
//
// The refresh token is an HttpOnly SameSite=Lax cookie, and browsers never store or send such a cookie
// for a request to a different *site*. So in production the app must call the API same-origin: leave
// VITE_API_URL unset and /api is forwarded by the Vercel rewrite (vercel.json). VITE_API_URL is only
// honoured when the API is on the same site as the app (for example localhost:5174 -> localhost:8000 in
// development, or app.example.com -> api.example.com).
const raw = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '');

// Hosting platforms where every project is its own site, even though they share a domain.
const SHARED_SUFFIXES = [
  'vercel.app', 'fastapicloud.dev', 'onrender.com', 'netlify.app', 'pages.dev', 'railway.app',
  'fly.dev', 'herokuapp.com', 'github.io', 'azurewebsites.net', 'cloudfront.net',
];

// The registrable domain ("site") of a hostname: example.com for api.example.com, but the whole
// project host for names under a shared hosting suffix (my-app.vercel.app).
function siteOf(host: string): string {
  const labels = host.toLowerCase().split('.');
  const shared = SHARED_SUFFIXES.find((s) => host === s || host.endsWith('.' + s));
  const keep = shared ? shared.split('.').length + 1 : 2;
  return labels.slice(-keep).join('.');
}

export const sameSite = (a: string, b: string) => a === b || siteOf(a) === siteOf(b);

function chooseBase(): string {
  if (!raw) return '';
  if (!import.meta.env.PROD) return raw; // development: ports do not matter for "site"
  try {
    if (sameSite(new URL(raw).hostname, window.location.hostname)) return raw;
  } catch {
    /* not a URL: fall through and ignore it */
  }
  console.warn(
    `VITE_API_URL (${raw}) is on a different site than this app, so the session cookie could never be stored. ` +
      'Using same-origin /api instead; remove VITE_API_URL from the production environment.',
  );
  return '';
}

export const API_BASE = chooseBase();

export const apiUrl = (path: string) => `${API_BASE}${path}`;

// The static portal page (public/portal/index.html) is not part of this bundle, so it cannot see
// VITE_API_URL. It must call the SAME backend that issued the session: any other backend rejects
// the token (401), which bounced users between the portal and the login page. We hand it the base
// through localStorage (same origin), refreshed on every app start.
try {
  if (API_BASE) localStorage.setItem('bdcap-api-base', API_BASE);
  else localStorage.removeItem('bdcap-api-base');
} catch {
  /* storage unavailable */
}
