# BDCap portal frontend

React + Vite + TypeScript + Tailwind. Client dashboard and admin dashboard for the BDCap portal.
The backend (`../portal-backend`) is API-only; setup steps are in `../portal-backend/docs/dashboard-setup.md`.

```bash
cp .env.example .env     # no keys needed; the browser only calls the backend
npm install
npm run dev              # http://localhost:5173, /api proxied to http://localhost:3000
npm run build            # type-check + production build into dist/
```

## Pages

| Route | Who | What |
|---|---|---|
| `/login`, `/forgot-password`, `/set-password` | everyone | Supabase email + password. `/set-password` is where signup (invite) and reset links land. |
| `/dashboard` | client | status, progress, lock / reopen notices, selected design, links |
| `/dashboard/information` | client | everything they filled in (read only) |
| `/dashboard/website` | client | selected template, fonts, palette, page names, hero images, site links |
| `/dashboard/requests` | client | send a change request (when locked) and see each one as Pending / Approved / Rejected |
| `/admin` | admin | counts and the requests waiting for a decision |
| `/admin/clients`, `/admin/clients/:id` | admin | client list; per client: information, design, requests, activity; edit, reopen, lock, view portal as client |
| `/admin/requests` | admin | approve (reopens the portal 24h) or reject with a note |
| `/admin/invites` | admin | send / revoke signup links |
| `/portal/index.html` | client | the original portal (questionnaire + website designer), a static page |
| `/portal/index.html?viewAs=<clientId>` | admin | the same page, read only, showing that client's data and design |

## How it fits together

- The browser never talks to Supabase. All auth (login, logout, forgot/set password, refresh) goes
  through the backend `/api/auth/*` routes; the session is kept in `localStorage` under
  `bdcap-session-v1`. The static portal page reads the same key, so signing in here signs the
  portal in too.
- Every API call sends `Authorization: Bearer <access token>`. The backend decides who the user is
  and what role they have; the UI only hides things.
- `public/portal/index.html` is **generated** by `portal-backend/scripts/prepare-portal.js`. Do not edit it by hand.
