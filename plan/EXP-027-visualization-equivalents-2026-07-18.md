# EXP-027 — Research-visualization equivalents and data access

## Design brief

- **Reader promise:** a visual is an optional way to inspect a research claim,
  never the only path to its values, provenance, vintage, missingness, or
  permitted export.
- **Scope:** live reader-facing research visualizations only. Interface icons,
  decorative art, and already-semantic native tables are excluded; a map,
  chart, timeline, data band, or distribution plot is included when it encodes
  research data.
- **Rights posture:** a download control must either provide the same permitted
  rows shown by the visual or state that export is unavailable because the
  checked source-rights contract does not permit redistribution. It must not
  substitute a generic download for an unrelated field set.

## Completion path

1. Create a checked visualization inventory that names every in-scope component,
   its reader surface, equivalent, source/vintage witness, missing-data policy,
   and data-access path.
2. Add one reusable disclosure pattern for title, description, provenance,
   vintage, missingness, and permitted/unavailable data access without inventing
   source rights.
3. Upgrade the remaining live research visualizations and their immediate
   reader surfaces, using an adjacent native table or textual equivalent rather
   than hiding essential values in an SVG or hover-only control.
4. Add static contract tests and browser coverage across Atlas, country,
   comparison, party, factbook, and methodology surfaces.
5. Run type, design-token, claims/docs, browser, and master-plan validation
   before recording completion evidence.

## Audited inventory

- Atlas choropleth: synchronized country table, source/freshness/vintage
  disclosure, and the permitted frozen Atlas release.
- Organization membership map: full dated roster as the textual equivalent;
  source-specific publisher terms visibly withhold redistribution.
- Indicator history: country table/export and comparison table that stays
  synchronized with the selected series.
- Legislature composition and party compass: source-backed party tables are
  the equivalent; their export state is explicitly withheld pending
  source-specific redistribution terms.
- Civica Index position, history, and methodology weights: score card or
  table equivalent with the current temporary public history/methodology API
  endpoint while that research API remains available.
- Leader-tenure timeline, PCA scree figure, and archived Pulse trajectories:
  exact roster/table alternatives with source/vintage and the correct
  permitted-download or rights-withheld state.

### Excluded after live-import audit

- The retained comparison-composite, outcomes-band, and government-type
  explorer modules have no live reader import path. They remain classified in
  `NON_RESEARCH_VISUAL_SURFACES` rather than being represented as current
  public research views.

## Verification target

```sh
npx tsc --noEmit
node --import tsx --test src/lib/research/visualization-contract.test.ts
npm run validate:design-tokens
npm run validate:claims-docs
E2E_BASE_URL=http://localhost:3100 \
  npm run test:e2e -- e2e/exp-027-visualization-equivalents.spec.ts
node plan/tools/validate-master-plan.mjs
```

Browser verification will use an isolated disposable worktree and local port
3100. It will issue reader GET requests only; it will not submit forms, mutate
production data, deploy, or invoke paid models.

## Completion evidence

Completed 2026-07-18. The checked `research-visualization-contract/v1`
registers the ten live research visualizations and the shared disclosure
provides their title/description, provenance/vintage, missingness, equivalent,
and permitted or withheld data-access state. Type checking, the three-contract
test suite, design-token and claims/documentation gates passed. Isolated
Chromium checks passed 6/6 for the cross-surface contract and 4/4 for the Atlas
source-map matrix across desktop/mobile and light/dark. See
`plan/evidence/EXP-027/README.md`.
