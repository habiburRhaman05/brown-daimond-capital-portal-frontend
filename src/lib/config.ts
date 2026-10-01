// Where the backend API lives. Set VITE_API_URL at build time (Vercel env var, .env.production)
// to call a backend on another origin, e.g. https://api.example.com. Leave it unset to use
// same-origin /api, which `npm run dev` proxies (VITE_API_TARGET) and Vercel rewrites.
const raw = (import.meta.env.VITE_API_URL ?? '').trim();

export const API_BASE = raw.replace(/\/+$/, '');

export const apiUrl = (path: string) => `${API_BASE}${path}`;
