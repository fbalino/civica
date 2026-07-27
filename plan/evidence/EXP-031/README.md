# EXP-031 — retired embed field/provenance contract

**Completed:** 2026-07-18

The selected public disposition retires `/embed/[slug]`; it is not a live
data renderer. Consequently, the legacy document has no score, taxonomy,
Pulse, or fact field to style, source, date, or attribute. It must never
pretend otherwise by retaining invisible data or unrelated attribution.

## Contract

- The response contains only the semantic retirement notice, its
  country-specific Governance Evidence successor, and a visible `Rights and
  reuse` link.
- The same point-of-use rights registry URL is exposed in
  `meta[name="civica:rights"]`.
- Source and vintage are explicitly `not-applicable` for the
  `embeds.retired-index` renderer class in
  `src/lib/claims/provenance-coverage.ts`; rights are `point-of-use`.
- No CSS/token contract is needed because the route returns no styled widget
  or data field. The browser contract rejects data-bearing containers and any
  inline style/script payload, so a future live embed cannot inherit this
  retirement classification by accident.

## Verification

```sh
node --import tsx --test src/lib/api/pulse-scalar-retirement.test.ts
# 4 passed

E2E_BASE_URL=http://localhost:3100 npm run test:e2e:embed
# 8 passed (all legacy dimensions, both theme query variants)

npx tsc --noEmit --pretty false
# exit 0

npm run validate:claims-docs
# pass

node plan/tools/validate-master-plan.mjs
# 223/306 complete, exit 0
```

Browser verification used the same disposable detached worktree as EXP-030,
with GET-only legacy URLs. It made no database write, deployment, or provider
call.
