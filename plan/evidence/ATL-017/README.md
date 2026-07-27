# ATL-017 — government taxonomy & peer-lens verification

Completed 2026-07-12. Verified that government-taxonomy and peer-lens outputs
match the adopted external classifications and current source vintages, via
source-backed fixtures that run with no database.

## Refactor (behavior-preserving)
The fallback-ladder / minimum-n / non-coverage decision logic in
`src/lib/peer-grouping/index.ts` was intertwined with DB reads and could not be
exercised by fixtures. Extracted three pure, exported seams (the DAT-012
pure-seam pattern) — `resolveMaterialPeerSet`, `resolveGovernancePeerSet`,
`resolveRegimeAlternateLens`. The async `get*PeerSet` functions now fetch the
classification map + provenance and delegate. Output is identical; the only
change is `getMaterialPeerSet` pre-fetches both region and income provenance
(additive, output-identical).

## How each Done-when clause is met (`atl-017-taxonomy-peer-lens.test.ts`)
- **structural description** — `deriveStructuralTaxonomy` fixtures map 9 raw CIA
  labels to the adopted structural families, set the `isFederal` primitive,
  degrade unknown labels to `other`, and honour the deliberate-divergence
  overrides (Switzerland → directorial republic, Vatican → theocratic elective
  monarchy, Andorra → co-principality). Family labels pinned exactly.
- **V-Dem RoW** — `VDEM_ROW_META` is exactly the four Lührmann et al. tiers; the
  governance resolver returns the RoW cohort, flat-global fallback, and an
  explicit unavailable marker. (Ordinal Closed=1…Liberal=4 locked by the
  existing `vdem-row-tier.test.ts`.)
- **BR/CGV** — `deriveRegimeTypeCgv` follows the adopted signal thresholds
  (democracy+presidential → presidential democracy; semi-presidential structure
  → semi-presidential democracy; non-democracy + monarch → royal dictatorship;
  military → military dictatorship; else civilian dictatorship; no BR signal →
  `null`, fail closed). `REGIME_TYPE_META` is exactly the six regime types.
  Switzerland keeps its regime coding despite the structural override.
- **World Bank region/income** — metadata is exactly the seven source-native
  regions (incl. the non-standard MENA+AfPak label) and four income tiers; the
  material resolver walks region+income → region → income → global with exact
  `fallbackChain` assertions.
- **monarchy status** — `MONARCHY_STATUS_META` is the six-value descriptive enum
  (not an analytical taxonomy).
- **fallbacks** — every ladder rung is asserted with its exact fallback reason,
  including the `no_classification` branch for a subject with only one axis.
- **n-minimums** — boundary test at `DEFAULT_MIN_N` (8): a cohort of exactly 8
  renders; 7 falls back. Resolver determinism is asserted.
- **noncoverage cases** — a subject with no classification returns an explicit
  `non_sovereign_or_uncovered` unavailable marker (n=0, no peers) — never a
  silent global cohort.
- **current source vintages** — BR/CGV cross-section reference year `2022`,
  dataset `QoG Standard Jan26`, source dataset `v6.1`, taxonomy version
  `2026_v1`, and the derivation-version envelope's source basket are pinned.
- **retired `structural_family` cannot re-enter new paths** — the peer-lens
  contract has exactly the five adopted lenses and none is `structural_family`;
  no peer-grouping fact key resurrects it. (Descriptive government-form
  `structuralFamily` and the deprecation/redirect compatibility layer are
  unchanged and out of scope.)

## Verification
- `atl-017-taxonomy-peer-lens.test.ts` — 28 fixtures, all pass.
- Full suite 1053/1053; `tsc --noEmit` clean.
- Switzerland `/country/switzerland/civica-data` renders in the live dev server
  with real data and zero console errors (resolver refactor safe in SSR).

## Incidental build repair
`tsc --noEmit` surfaced five type errors in files committed earlier this session
(they slipped because `npm test` uses tsx, which strips types without checking):
`fs.globSync` (absent from the pinned @types/node) in `error-boundary.test.ts`
and `link-asset-integrity.test.ts` → replaced with a typed recursive walker; the
`s` (dotAll) regex flag in `headers-policy.test.ts` (needs es2018) → rewritten as
`[\s\S]`; and `MonetizationEnv` weak-type vs `process.env` → index signature
added. `npm run typecheck`/`next build` are green again.
