# DIGITAL-only regression evidence — 2026-08-21

## Static checks

| Check | Result |
|---|---|
| `git diff --check` | Passed; no whitespace errors |
| Vercel API function files | 1 file: `api/[...route].ts` |
| Internal server handlers | 16 handlers behind the single gateway; these are not separate Vercel functions |
| Secret references in client bundle paths | No Firebase service account or Supabase service-role key reference under `src/` |
| Secret references in server paths | Present only where expected: `_server-auth.ts` and push service handler |
| Server auth import extension scan | No missing `_server-auth.js` import found |
| `npm run build` | Passed; Vite emitted only the existing large-chunk advisory |
| `npm run lint` | Passed with 0 errors; only the pre-existing `AuthContext` Fast Refresh warning remains |

## Notes

The scan for `VITE_` secret names matched a Bengali documentation sentence warning users not to use `VITE_AGENT_ROUTER_API_KEY`; this is documentation text, not an environment variable or client secret. No `VITE_` secret variable was found in application source, API code, or deployment configuration.

The database migration file still requires manual execution in Supabase SQL Editor. The local TypeScript build cannot execute or validate remote PostgreSQL state, so migration application must be followed by Supabase SQL success output and a production smoke test for payment webhook, escrow transition, delivery record, wallet settlement, and dispute resolution.
