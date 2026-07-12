# PLT-013 — security headers, CSP, framing, and origins

Completed 2026-07-12. Policy lives in `next.config.ts` (enforced at the edge)
and is guarded by `src/lib/security/headers-policy.test.ts`.

## Documented policy (verified live via curl)
On every route:
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (**added**)
- `Content-Security-Policy-Report-Only` (**added**) — see below.

Framing (all routes **except** `/embed/*`, via a negative-lookahead source):
- `X-Frame-Options: SAMEORIGIN` + `Content-Security-Policy: frame-ancestors 'self'`.
- `/embed/[slug]` sets its own `frame-ancestors *` so the widget stays
  cross-origin embeddable. Verified: `/` is frame-locked; `/embed/japan` is not.

## CSP — minimal allowlist, Report-Only rollout
Externally **loaded** origins (not link targets, which CSP ignores) are only map
resources: OpenFreeMap (2D fallback), the self-hosted Protomaps PMTiles archive
on Vercel Blob, and Mapbox (opt-in 3D). Fonts are self-hosted by `next/font`;
there are no external scripts or image CDNs. The policy:
`default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self'
'unsafe-inline'; img-src 'self' data: blob: <openfreemap> <mapbox>; font-src
'self'; connect-src 'self' <openfreemap> https://*.blob.vercel-storage.com
<mapbox> <events.mapbox>; worker-src 'self' blob:; frame-ancestors 'self';
base-uri 'self'; form-action 'self'; object-src 'none'`.

Shipped as **Report-Only** because enforcing `script-src`/`style-src` under the
Next 16 App Router requires per-request nonces (streaming injects inline
scripts) — enforcing blindly breaks hydration. Report-only lets production
reports confirm the allowlist is complete before flipping to enforcing (which
is paired with a nonce pass). No CSP violation was observed locally on the home
and atlas-map routes.

## Verification
- `curl -I` on `/` and `/embed/japan` matches the policy above.
- `headers-policy.test.ts` — 4 tests assert the config carries every header,
  a strong HSTS, a locked CSP with only the map allowlist (no bare wildcard),
  and embed-only framability.
- Atlas map renders with no console or CSP-report-only errors; lint clean.

## Follow-up (not blocking)
Flip the resource CSP from Report-Only to enforcing after a production
observation window confirms zero violations, together with a nonce
implementation for `script-src`/`style-src`.
