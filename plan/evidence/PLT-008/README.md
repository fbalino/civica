# PLT-008 — Route handler security/exposure inventory

Status: complete (validator, 17 tests, tsc, and the aggregate claims-docs gate
all pass; concurrent-QA-004 note below).

## Outcome

Every `route.ts` handler under `src/app` (99 files as of 2026-07-12) is now
registered in a single, mechanically-verified inventory covering exposure
class, HTTP methods, mutation/sensitivity flags, declared controls, and a
human-readable note. An unregistered ("phantom") route, a stale registry
entry, or a methods-declaration drift now fails the build. Mutable or
sensitive routes lacking an adequate control are flagged; two real (benign)
findings were discovered and are documented rather than hidden.

## New files

- `src/lib/api/route-inventory/registry.ts` — the 99-entry
  `ROUTE_INVENTORY` array. Each entry: `filePath` (relative to `src/app`,
  matching `find src/app -name route.ts | sed 's|src/app/||'`), `exposure`
  (`public-read | public-mutation | admin | cron | chat | embed | export |
  pulse-coding | internal`), `methods`, `mutation`, `sensitive`, `controls`
  (closed set: `admin-session | pulse-coding-session | oauth-bootstrap |
  credential-check | cron-secret | rate-limit | input-validation | public`),
  and `note`.
- `src/lib/api/route-inventory/checks.ts` — pure functions (no fs/db):
  `findPhantomRoutes`, `findStaleEntries`, `findUncontrolledMutations`,
  `diffMethods`.
- `scripts/validate-route-inventory.ts` — the real `find src/app -name
  route.ts` walk, a real static scan of each source for exported HTTP
  method handlers (`export (async )?function GET|POST|...` AND the
  `export { handler as GET, handler as POST }` re-export pattern every
  cron route uses) and control markers, then runs the pure checks and a
  methods-drift check against the registry.
- `src/lib/api/route-inventory/__tests__/route-inventory.test.ts` —
  positive coverage against the real 99-route filesystem/registry, plus
  seeded negative fixtures for every failure mode (phantom route, stale
  entry, uncontrolled cron/admin/pulse-coding/public-mutation route,
  methods drift, the cron re-export scan pattern).

## Wiring

- `package.json`: added `"validate:route-inventory": "tsx
  scripts/validate-route-inventory.ts"`.
- `src/lib/ci/claims-docs-gate.ts`: added a `route-inventory` check
  (category `routes-anchors`) to `CLAIMS_DOCS_GATE_MANIFEST.checks`,
  following the exact pattern of the sibling `api-docs` check, and
  extended the `routes-anchors` entry in `STALE_COPY_FIXTURE_EVIDENCE` to
  also point at the new test file. `npm run validate:claims-docs` now runs
  `validate:route-inventory` as one of its required children.

## Exposure-class breakdown (99 routes total)

| Exposure | Count |
|---|---|
| admin | 11 |
| chat | 1 |
| cron | 39 |
| embed | 1 |
| export | 3 |
| public-mutation | 3 |
| public-read | 35 |
| pulse-coding | 6 |
| **Total** | **99** |

## Design notes on the "flag, don't hide" rule

`findUncontrolledMutations` flags every mutation-or-sensitive entry whose
declared `controls` don't clear its exposure class's minimum bar:

- `cron` routes must declare `cron-secret`.
- `admin`/`pulse-coding` routes must declare a session-like control
  (`admin-session`, `pulse-coding-session`, `oauth-bootstrap`, or
  `credential-check` — the last two cover the pre-session OAuth bootstrap
  and the login route itself, which by definition cannot require the
  session they create).
- `public-mutation` routes must declare `input-validation` or
  `rate-limit`.
- Anything else (chat, export, embed, public-read, internal) just needs at
  least one real (non-`public`) control once it is a mutation or flagged
  sensitive.

`scripts/validate-route-inventory.ts` prints every finding, but only
**fails the build** on an **undocumented** finding (`note` is empty) — a
**documented** finding (the registry entry's `note` explains it) prints as
a non-blocking warning. This matches PLT-008's done-when ("flags mutable or
sensitive endpoints without explicit controls") without turning an honest,
intentional design choice into a build blocker.

### Open findings (real, documented, non-blocking)

Two routes are genuinely uncontrolled by strict definition — both are
sign-out endpoints that clear a session cookie with no prior session
check:

| Route | Why it's flagged | Why it's safe |
|---|---|---|
| `api/admin/sign-out/route.ts` | POST, admin exposure, `controls: []` | Clearing cookies for an already-unauthenticated caller is a no-op; there is no confidentiality or integrity risk in letting anyone request logout. |
| `api/pulse-coding/sign-out/route.ts` | POST, pulse-coding exposure, `controls: []` | Same pattern as above. |

No other genuinely uncontrolled mutable/sensitive route was found. Every
other admin/cron/pulse-coding mutation is gated on `getAdminSession()`,
`getPulseCodingSession()` (with role checks where relevant), or
`requireCronAuth()`; every public-mutation intake route (contact,
advisory-applications, civica-index/corrections) has both per-IP rate
limiting and hand-rolled field validation; `/api/chat` has two-layer
(in-memory + durable) rate limiting and hard input-size caps.

## All mutable/sensitive routes and their controls (60 of 99)

| filePath | exposure | methods | mutation | controls | note |
|---|---|---|---|---|---|
| `api/admin/advisory-applications/[id]/route.ts` | admin | POST | true | admin-session | Flips advisory-application triage status; gated on the admin session cookie via getAdminSession(). |
| `api/admin/advisory-applications/route.ts` | admin | GET | false | admin-session | Lists advisory applicant PII (name/email/affiliation); gated on getAdminSession(). |
| `api/admin/contact/route.ts` | admin | GET | false | admin-session | Lists contact-form submitter PII; gated on getAdminSession(). |
| `api/admin/data-disputes/[id]/route.ts` | admin | POST | true | admin-session | Resolves/reopens data disputes with audit-log write; gated on getAdminSession(). |
| `api/admin/google/callback/route.ts` | admin | GET | false | oauth-bootstrap | Pre-session OAuth code exchange: verifies the short-lived CSRF state cookie AND an exact ADMIN_GOOGLE_EMAIL allowlist match before ever issuing an admin session cookie. |
| `api/admin/google/start/route.ts` | admin | GET | false | oauth-bootstrap | Mints a short-lived HttpOnly CSRF state cookie and 303s to Google; no data access. Pre-session by design. |
| `api/admin/messages/[id]/route.ts` | admin | POST | true | admin-session | Flips a contact submission's triage status; gated on getAdminSession(). |
| `api/admin/pulse-review/[id]/exception/route.ts` | admin | POST | true | admin-session | Grants a review-SLA exception; gated on getAdminSession(). |
| `api/admin/pulse-review/[id]/route.ts` | admin | POST | true | admin-session | Approves/edits/rejects a Pulse event with audit-log write; gated on getAdminSession(). |
| `api/admin/session/route.ts` | admin | DELETE,POST | true | credential-check | POST is the login route itself (constant-time username compare + scrypt password verify). DELETE clears cookies unconditionally, same no-risk pattern as the sign-out routes. |
| `api/admin/sign-out/route.ts` | admin | POST | true | (none) | OPEN FINDING (benign) — see above. |
| `api/advisory-applications/route.ts` | public-mutation | POST | true | rate-limit, input-validation | Public advisory-board application intake; durable per-IP rate limit (5/30min) + field/length checks. Collects applicant PII. |
| `api/chat/route.ts` | chat | POST | true | rate-limit, input-validation | Public Ask Civica chat proxy to a paid Anthropic model; two-layer per-IP rate limit and hard input-size/shape caps before any model call. |
| `api/civica-index/corrections/route.ts` | public-mutation | POST | true | rate-limit, input-validation | Public correction-submission intake; per-IP rate limit (5/10min) + server-side validation. Collects optional submitter PII. |
| `api/contact/route.ts` | public-mutation | OPTIONS,POST | true | rate-limit, input-validation | Public contact-form intake; per-IP rate limit (5/10min) + hand-rolled email/length validation. Collects submitter PII. |
| `api/cron/bills/{br,ca,de,fr,uk,us}/route.ts` (6) | cron | GET,POST | true | cron-secret | Vercel Cron entrypoints; requireCronAuth() rejects requests without CRON_SECRET. |
| `api/cron/factbook/*` (26 routes) | cron | GET,POST | true | cron-secret | Vercel Cron entrypoints; requireCronAuth() rejects requests without CRON_SECRET. |
| `api/cron/pulse/{calculate,classify,ingest}/route.ts` (3) | cron | GET,POST | true | cron-secret | Vercel Cron entrypoints; requireCronAuth() rejects requests without CRON_SECRET. |
| `api/cron/pulse/v2/{classify,cluster,ingest,review-sla,score}/route.ts` (5) | cron | GET,POST | true | cron-secret | Vercel Cron entrypoints; requireCronAuth() rejects requests without CRON_SECRET. |
| `api/pulse-coding/adjudications/[assignmentId]/route.ts` | pulse-coding | POST | true | pulse-coding-session | Records a blinded adjudication decision; gated on getPulseCodingSession() with an explicit adjudicator-role check. |
| `api/pulse-coding/admin/participants/route.ts` | pulse-coding | POST | true | admin-session | Issues a pulse-coding participant access code; gated on the OWNER admin session — coordinator-only provisioning route. |
| `api/pulse-coding/assignments/[id]/route.ts` | pulse-coding | POST | true | pulse-coding-session | Saves/locks a blinded coding submission; gated on getPulseCodingSession(). |
| `api/pulse-coding/exports/[studyId]/route.ts` | pulse-coding | GET | false | pulse-coding-session | Exports a coding study artifact; gated on getPulseCodingSession() plus a per-study authorization check (403 on mismatch). |
| `api/pulse-coding/session/route.ts` | pulse-coding | POST | true | credential-check | Pulse-coding sign-in itself (access-code verification) — cannot require an existing session, since it is what creates one. |
| `api/pulse-coding/sign-out/route.ts` | pulse-coding | POST | true | (none) | OPEN FINDING (benign) — see above. |

(The 39 individual cron rows are collapsed above for readability; the full,
uncollapsed 60-row table was generated directly from `ROUTE_INVENTORY` and
is reproducible with `npx tsx` against `src/lib/api/route-inventory/registry.ts`.)

## Commands run and results

```
$ npx tsc --noEmit
(no output — 0 errors)

$ npm run validate:route-inventory
=== Civica route inventory validation (PLT-008) ===

✓ 99 route.ts file(s) on disk under src/app, 99 registry entr(y/ies)
✓ [inventory] 0 phantom route(s)
✓ [inventory] 0 stale entr(y/ies)
✓ [method-drift] 0 route(s) with methods drift
✓ [uncontrolled] 2 mutable/sensitive route(s) flagged (2 documented/non-blocking, 0 undocumented/blocking)
✓ [breakdown] admin=11, chat=1, cron=39, embed=1, export=3, public-mutation=3, public-read=35, pulse-coding=6

2 warning(s) (non-blocking):

⚠ [uncontrolled] (documented, non-blocking) api/admin/sign-out/route.ts [admin] — mutation-or-sensitive route declares no control beyond (or including) 'public'
⚠ [uncontrolled] (documented, non-blocking) api/pulse-coding/sign-out/route.ts [pulse-coding] — mutation-or-sensitive route declares no control beyond (or including) 'public'

All route-inventory checks passed.
(exit code 0)

$ node --import tsx --test src/lib/api/route-inventory/__tests__/route-inventory.test.ts
ℹ tests 17
ℹ pass 17
ℹ fail 0
(exit code 0)

$ npm test
ℹ tests 1095
ℹ pass 1095
ℹ fail 0
(exit code 0)

$ npm run validate:claims-docs
=== Claims-and-documentation gate report ===
PASS — public-claims [registry-coverage, experimental-labels]
PASS — numeric-claims [numeric-templates]
PASS — content-templates [numeric-templates]
PASS — doc-sources [routes-anchors]
PASS — doc-references [routes-anchors]
PASS — api-docs [api-examples]
PASS — route-inventory [routes-anchors]
PASS — unit-tests [methodology-fixtures]
PASS — pulse-runtime [methodology-fixtures]
PASS — metadata [experimental-labels]
PASS — terminology [terminology-policy]
PASS — policy-surface [terminology-policy]
PASS — rights-claims [terminology-policy]
PASS — provenance-claims [registry-coverage, terminology-policy]

PASS — all claims-and-documentation checks passed.
```

### Note on the concurrent QA-004 workstream

PLT-008 was built in parallel with QA-004 (live-DB read-only test guard).
During the build, QA-004's still-in-development
`src/lib/qa/live-db-test-isolation.test.ts` self-flagged a seeded fixture
string (a benign self-scan bug), which briefly made `npm test` and the
`unit-tests` child of the aggregate gate red. QA-004 has since fixed that
(the scanner excludes its own file) and landed; the full suite and the
aggregate gate are now green as shown above. PLT-008 never touched any
QA-004 file — verified via `git status`/`git diff`.
