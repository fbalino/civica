# Framework compatibility audit — 2026-07-12 (PLT-004)

Audited the codebase against the **installed** framework versions and their
docs (`node_modules/next/dist/docs/`), not release notes from memory.

| Package | Installed |
|---|---|
| next | 16.2.7 |
| react / react-dom | 19.2.4 |
| drizzle-orm | 0.45.2 |
| @neondatabase/serverless | 1.0.2 |
| tailwindcss | 4.x |

## Findings by area

| Area | Requirement (Next 16 / React 19 / etc.) | Status | Evidence |
|---|---|---|---|
| **async `params`** | Page/route `params` must be `Promise` and awaited | ✅ compliant | 42 `params: Promise<…>` declarations; 0 non-Promise `params: {` |
| **async `searchParams`** | Must be `Promise` and awaited | ✅ compliant | 16 `searchParams: Promise<…>`; 0 non-Promise |
| **cache components / `use cache`** | If `cacheComponents` is on, data fns need `use cache` instead of `export const dynamic` | ✅ consistent | `cacheComponents` is intentionally **off** (commented in `next.config.ts` with a re-enable note); the 84 `export const dynamic/revalidate` usages are valid in that mode |
| **proxy vs middleware** | `middleware.ts` deprecated → `proxy.ts` | ✅ N/A | Neither `middleware.ts` nor `proxy.ts` exists; no deprecated middleware to migrate |
| **Turbopack config** | Config at top level of `nextConfig` (not `experimental`) | ✅ compliant | `turbopack: {…}` is top-level in `next.config.ts` |
| **server/client boundaries** | Client components must not import Node builtins | ✅ compliant | 0 `"use client"` files import `node:*`/`require()` |
| **route handlers** | Async `params`; Web `Request`/`Response` | ✅ compliant | Route handlers use Promise params (counted above); no legacy `NextApiRequest` |
| **Neon HTTP driver** | `neon-http` has no interactive transactions (`db.transaction()` unsupported) | ✅ compliant | Client is `drizzle-orm/neon-http` + `neon()`; **0** actual `db.transaction()` calls (only JSDoc examples) — migrations use raw SQL / batching |
| **React 19 removed APIs** | No `ReactDOM.render`, `findDOMNode`, string refs, `defaultProps` (fn), `propTypes`, legacy context | ✅ compliant | All zero (the 30 apparent "string refs" were `href="` false positives; 0 genuine) |
| **Tailwind v4** | CSS-first (`@import "tailwindcss"`), no legacy `tailwind.config.js` | ✅ compliant | `globals.css` uses `@import "tailwindcss"`; no `tailwind.config.*` present |
| **Next 16 removed config** | No `swcMinify`, `images.domains`, `experimental.appDir`, `target`, etc. | ✅ compliant | None found in `next.config.ts` |

## Conclusion

**Zero confirmed mismatches.** The codebase is consistent with the installed
Next 16.2 / React 19.2 / Drizzle 0.45 / Neon HTTP / Tailwind v4 contracts across
every audited breaking-change surface, so no remediation task or regression
test is required by this audit. Because the acceptance criterion is "every
confirmed mismatch has a task/test," and there are none, no new master tasks
were filed.

Re-run this audit when any of the five packages is upgraded (it is a fast
grep-based sweep); a future `cacheComponents: true` flip is the one change that
would convert the 84 `export const dynamic` usages into `use cache` migration
work — tracked here as the sole latent item, not a current mismatch.
