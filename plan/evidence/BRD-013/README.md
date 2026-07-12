# BRD-013 — Align terms/API/embed/download conditions with real capabilities and rights

## Outcome

Terms of Use, API Docs, and the bulk-export rate-limit docstring now describe
only capabilities Civica actually has and rights it actually holds. A new
typed clause registry (`terms-contract/v1`) closes ten Terms clause topics —
acceptable use, attribution, rate limits, uptime/no-warranty,
data-accuracy/no-liability, embedding, downloads/reuse-rights, account
(none required), governing-terms-change, and contact — against the terms
prose itself and cross-checks every clause for contradiction anywhere across
Terms, API Docs, and Licensing. `npm run validate:terms-conditions` (once
wired into `package.json`) fails closed on drift.

## Stale-copy bugs fixed

### 1. `src/app/api-docs/page.tsx` — overview, Rate Limits, and CORS paragraphs

Verified against the running dev server (`curl` against
`/api/countries/france/export?format=json&as_of=live` returned **HTTP 200**
with real resolver output, not 503) and against code:

- `src/lib/rights/manifest.ts` — the `country-export-json-csv` product has
  `publicBulkExport: "allowed"`, and the route calls
  `evaluatePublicExport("country-export-json-csv", [])` with a hardcoded
  empty `sourceIds` array, so the 503 branch in
  `src/app/api/countries/[slug]/export/route.ts` is currently unreachable —
  the route always returns real, rights-filtered data today.
- `src/lib/api/contract/registry.ts` (route id `country-export`) declares
  `rateLimit: null` and `cors: false` — the route has no per-IP throttle and
  sends no CORS headers, but it is not "withheld."
- `plan/evidence/DAT-027/README.md` and git history (`17512381 feat(exports):
  publish canonical research evidence (DAT-027)`) confirm DAT-027 already
  replaced the legacy blocked mixed-source route at this same file path with
  `country-research-export/v1`. Per-fact withholding (a fact whose canonical
  source lacks verified export terms is individually omitted) is real and
  still happens — but the *route* itself is not blocked.

**Note on the original task brief:** the brief instructed treating this route
as "withheld/503 per DAT-017/DAT-027" and writing the Terms Downloads section
to say "the mixed-source country export is withheld." That premise was
current when DAT-017/DAT-027 were open items in `AGENTS.md`, but both are now
complete (confirmed live, via git history, and via
`src/lib/claims/reuse-rights.ts`'s own `downloads-api` artifact-class row,
which already documents the route as working). Writing "withheld" today would
itself have been a new stale-copy bug — the opposite direction from BRD-013's
goal. All new copy states the current, verified truth: the route works, and
withholding happens at the individual-fact level, not the whole-route level.

Corrected:
- Overview intro: removed the false "former mixed-source per-country download
  remains withheld" sentence; states that both the frozen Atlas package and
  the per-country export are available and rights-filtered.
- Rate Limits paragraph: removed the false "withheld ... returns 503" claim;
  now states the bulk export route "is not currently rate-limited" (matching
  `rateLimit: null` in the contract).
- CORS paragraph: removed the false "It currently returns only a
  rights-blocked status response" sentence; states the accurate effect of
  sending no CORS headers (cross-origin browser fetches are blocked;
  same-origin/server-side requests are unaffected).

### 2. `src/lib/api/contract/rate-limits.ts` — false import-wiring docstring

`grep -rn "EXPORT_RATE_LIMIT" src` confirmed `EXPORT_RATE_LIMIT_MAX` and
`EXPORT_RATE_LIMIT_WINDOW_MS` are defined and exported but never imported
anywhere, including by `route.ts` or `registry.ts`. The docstring's claim
that "`route.ts` and `contract/registry.ts` ... both import these constants"
was false. Rewrote the docstring to state plainly that the constants are
currently unused/reserved, that the export route's contract entry declares
`rateLimit: null`, and what to do (wire them into both the route and the
registry entry together) if the route is ever rate-limited in the future.

## Deliverables

1. **`src/lib/policy/terms-contract.ts`** — typed `TERMS_CLAUSES` registry (10
   clauses; anchor + required-phrase patterns + prohibited/contradiction
   patterns per clause) and the pure `validateTermsConditions({ termsSource,
   apiDocsSource, licensingSource }) -> issue[]`, mirroring
   `src/lib/policy/policy-surface.ts`. Also wires in the existing
   `findAllProhibitedRightsLanguage` scanner from
   `src/lib/claims/reuse-rights.ts` against the terms prose. Phrase/anchor
   matching normalizes whitespace first, since JSX text nodes in the real
   `terms/page.tsx` wrap across source lines (e.g. "No\n account is
   required").
2. **`src/app/terms/page.tsx`** — added two new sections inside the existing
   methodology-layout + ReaderSidebar shell (no new layout invented):
   - `#embedding` — states the legacy `/embed/[slug]` widget is retired
     (410 Gone), links `/licensing#source-licenses` (where the `hosted-embeds`
     rights-artifact-class row lives) and `/api-docs#widget-embed`.
   - `#downloads` — states free/no-account downloads are not a reuse
     license, describes per-fact withholding, and links `/licensing#reuse`
     and `/api-docs#bulk-data`.
   Also added an explicit no-liability sentence to `#accuracy`, and added
   both new anchors to `SIDEBAR_ITEMS`.
3. **`src/lib/policy/__tests__/terms-contract.test.ts`** — 30 `node:test`
   cases: one clean-pass fixture (all 10 clauses present/uncontradicted),
   a registry-completeness check, one missing-clause-phrase test per clause
   (10), whole-section-removal anchor tests (unique-anchor clauses
   `embedding`/`downloads-reuse-rights` individually, plus shared-anchor
   sections `use` and `changes` flagging every co-anchored clause), one
   contradicting-claim test per clause (10) with a self-check that each
   fixture actually matches its own `prohibitedPatterns`, two tests proving
   cross-surface contradiction detection (a contradiction planted only in
   `apiDocsSource` or only in `licensingSource` is still caught), and two
   tests proving the shared reuse-rights scanner is wired in (catches an
   open-source overclaim, does not false-positive on a negated denial).
4. **`scripts/validate-terms-conditions.ts`** — thin CLI: reads
   `src/app/terms/page.tsx`, `src/app/api-docs/page.tsx`, and
   `src/app/licensing/page.tsx` via `fs`, calls `validateTermsConditions`,
   prints PASS/FAIL with per-issue detail, exits nonzero on drift.
5. This README.

## package.json / claims-docs-gate wiring (not applied — see task constraints)

`package.json` was not edited (out of scope). The script line to add:

```json
"validate:terms-conditions": "tsx scripts/validate-terms-conditions.ts",
```

`src/lib/ci/claims-docs-gate.ts` was not edited (out of scope). The
`CLAIMS_DOCS_GATE_MANIFEST` entry to add (follows the `terminology` /
`policy-surface` sibling pattern, category `terminology-policy`):

```ts
{
  id: "terms-conditions",
  npmScript: "validate:terms-conditions",
  categories: ["terminology-policy"],
  description:
    "Terms of Use, API Docs, and Licensing prose state only real capabilities and rights; no unsupported access/rate-limit/embed/download claims.",
},
```

## Verification

All run against the existing dev server on `localhost:3000` — no build, no
second dev server started.

- `npx tsc --noEmit` — clean.
- `node --import tsx --test src/lib/policy/__tests__/terms-contract.test.ts`
  — 30/30 pass.
- `npx tsx scripts/validate-terms-conditions.ts` (the real files) — PASS, 0
  issues.
- `npm run validate:api-docs` — PASS (inventory, docs-coverage, param-drift,
  deprecation, examples, csv-contract all green).
- `npm run validate:rights-claims` — PASS (registry invariants, all 10
  required rights-pointer surfaces incl. `terms/page.tsx` and
  `api-docs/page.tsx`, 360-file public sweep, code-license guard, licensing
  marker coverage).
- `npm run validate:policy-surface` — PASS.
- `npm run validate:design-tokens` — PASS (209 baselined legacy violations,
  no new drift; the two new Terms sections and corrected API Docs prose
  introduced zero new hardcoded tokens).
- `npm run test` (full repo suite) — **1197/1197 pass**, no regressions from
  the copy/section changes.
- Live route check: `curl -s -o /dev/null -w "%{http_code}"
  "http://localhost:3000/api/countries/france/export?format=json&as_of=live"`
  → `200` (grounds the "not withheld" correction above).

### Browser verification (localhost:3000)

- `/terms` — full page text extracted via the browser tool. Sidebar now
  shows "Downloads & bulk exports" and "Embedding" alongside the existing six
  entries; both new sections render with the intended copy; the accuracy
  section shows the added no-liability sentence. Zero console errors.
  Screenshot confirms correct dark-mode rendering of the header, sidebar, and
  intro under the shared methodology-layout shell.
- `/api-docs` — full page text and a screenshot confirm the corrected
  overview, Rate Limits, and CORS paragraphs render with the new copy
  (visible: "...not currently rate-limited", "...cross-origin browser fetch
  to it is blocked; same-origin and server-side requests are unaffected").
  Zero console errors.
