# EXP-027 — Research-visualization equivalents and data access

Completed 2026-07-18.

## Contract

`research-visualization-contract/v1` inventories the ten live reader-facing
research visualizations: the Atlas source-native map, methodology weights,
organization membership map, indicator history, legislature composition,
party ideology, leader tenure, Index history, PCA eigenvalues, and archived
Pulse backtest trajectories. Each entry names its route and component,
accessible SVG title/description where applicable, provenance and vintage
witness, missing-data semantics, a nonvisual table or text equivalent, and
the exact permitted data access or rights-withheld policy path.

The shared `ResearchVisualizationDisclosure` makes those details visible at
the visual rather than relying on hover state. A permitted path links only to
the matching released/API data; a restricted path states the governing
source-rights limitation instead of offering an unrelated export. The
inventory explicitly excludes retained comparison-composite, outcomes-band,
and government-type explorer modules because the live-import audit found no
reader route importing them.

## Verification

Static and contract checks passed:

```sh
npx tsc --noEmit
node --import tsx --test src/lib/research/visualization-contract.test.ts
# 3 passed
npm run validate:design-tokens
# no new drift; 206 pre-existing legacy baseline entries remain
npm run validate:claims-docs
```

Browser checks ran in an isolated disposable worktree against a local server
on port 3100:

```sh
E2E_BASE_URL=http://localhost:3100 \
  npm run test:e2e -- e2e/exp-027-visualization-equivalents.spec.ts
# 6 passed

E2E_BASE_URL=http://localhost:3100 \
  npm run test:e2e -- e2e/atl-015-source-native-map.spec.ts
# 4 passed (desktop/mobile, light/dark)
```

The six EXP-027 checks cover the Atlas, methodology, organization, party,
country legislature/leader-tenure, and comparison routes. The source-map
matrix also proves the live Atlas disclosure in both themes and viewport
classes. The runs issued reader GET requests only: no production writes,
deployments, form submissions, or paid-model requests occurred.
