# EXP-003 — Design-token baseline elimination evidence

Completed 2026-07-22.

## Outcome

The checked design-token baseline is intentionally empty. The task's original
wording records a historical baseline of 412 findings; the scan at the start of
this implementation tranche contained 208 remaining findings. The two
intentional reductions were committed separately so the baseline never grew:

- `03651939` — `refactor(design): ratchet typography token baseline`
- `94c5be5d` — `refactor(design): eliminate legacy token baseline`

The final validator reports zero baselined legacy violations. New raw component
or page colours, pixel font sizes, and raw font-family declarations now fail the
validator immediately instead of being absorbed into a legacy allowance.

## Scope and preservation

Live typography and colour references now use canonical design tokens. Dead
code and validator false positives were removed without changing rendered
meaning. Party brand colours and the map stylesheet-unavailable fallback palette
remain available, but as structured data artifacts rather than styling values in
component, page, or stylesheet source. Their public resolver APIs and light/dark
map behavior are covered by preservation tests.

No public claims, production database data, deployment, or external service was
changed by this task.

## Verification

All of the following passed on 2026-07-22:

```sh
node --import tsx --test src/lib/data/party-colors.test.ts src/lib/map/civica-map-style.test.ts
# 2 passed

node --import tsx --test src/lib/peer-grouping/__tests__/atl-017-taxonomy-peer-lens.test.ts src/lib/peer-grouping/__tests__/vdem-row-tier.test.ts
# 31 passed

node --import tsx scripts/validate-design-tokens.ts
# No new design-token drift (0 baselined legacy violations remain)

npx tsc --noEmit

E2E_BASE_URL=http://localhost:3118 \
E2E_WEBSERVER_CMD='npm run dev -- --port 3118' \
ATL015_CAPTURE_DIR=/tmp/civica-exp003-atl015 \
npx playwright test e2e/atl-015-source-native-map.spec.ts \
  --project=chromium --workers=1 --retries=0
# 4 passed: desktop and small-mobile, each in light and dark themes

node plan/tools/validate-master-plan.mjs
```

The isolated browser run also checked the source-native Atlas map and its table
alternative in all four viewport/theme variants. Light and dark desktop captures
were visually inspected; temporary captures remain outside the repository.

The normal `npm run validate:design-tokens` wrapper could not open its macOS
local IPC socket in the managed sandbox. The equivalent checked script was run
directly with `node --import tsx`, including the intentional baseline update,
which wrote an empty `scripts/design-token-baseline.json`.
