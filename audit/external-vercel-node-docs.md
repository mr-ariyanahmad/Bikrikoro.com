# Official Vercel documentation notes

## Sources

1. https://vercel.com/docs/functions/runtimes/node-js — Vercel detects a root `server.{js,cjs,mjs,ts,cts,mts}` or `src/server.{...}` entrypoint and can route incoming requests through that Node.js server. Vercel also supports Node.js/TypeScript functions under `/api`; those handlers receive `VercelRequest`/`VercelResponse` helper properties such as `request.query`, `request.cookies`, `request.body`, and response `.status()`, `.send()`, `.json()`, and `.redirect()` methods.

2. https://vercel.com/docs/functions/functions-api-reference — Vercel Functions are request handlers; individual functions under `/api` are deployed as functions. The documentation describes the standard Request/Response handler model and function configuration, but it does not document the exact catch-all query-key behavior used by this repository's `[...route].ts` handler.

## Relevance to the BikriKoro gateway issue

The production screenshots show `API route not found` across many URLs after the catch-all gateway consolidation. This means the gateway function is being invoked but its route-name extraction does not match Vercel's actual dynamic-route request shape. The next repair must use a documented/verified path source or a root Node server entrypoint rather than relying on an unverified `req.query.route` assumption.
