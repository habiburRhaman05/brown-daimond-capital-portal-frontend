// Where the backend API lives. Set VITE_API_URL at build time (Vercel env var, .env.production)
// to call a backend on another origin, e.g. https://api.example.com. Leave it unset to use
// same-origin /api, which `npm run dev` proxies (VITE_API_TARGET) and Vercel rewrites.
const raw = (import.meta.env.VITE_API_URL ?? '').trim();

export const API_BASE = raw.replace(/\/+$/, '');

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
