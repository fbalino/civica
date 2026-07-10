# CLM-019 evidence — measured compact provenance coverage

Status: implementation complete on 2026-07-10.

## Outcome

Civica no longer promises source provenance on every rendered value. A typed,
closed registry measures ten compact empirical renderer classes across the
homepage, Atlas, rankings, and embeds. Four currently expose source,
date/vintage, and rights linkage at point of use: rankings metric cells and the
three fixed embed sizes. Six exceptions are named publicly: the homepage
jurisdiction count, homepage country cards, homepage Index teaser, Atlas
choropleth layers, Atlas hover card, and custom selected-fact embeds.

The generated result is **4/10 (40%)**. It is explicitly renderer-class
coverage, not a claim that 40% of database facts have statement-level
provenance. DAT-005 remains responsible for the later dataset-wide fact-key
report.

Fixed embeds derive their machine-readable source attribution from the same
normalization table that generates the public Index methodology; they do not
count an unexplained `CI` label or a downstream country link as source proof.

## Executable contract

- `src/lib/claims/provenance-coverage.ts` — canonical ten-class registry,
  generated summary, required surfaces, completeness rules, and universal-claim
  scanner
- `scripts/validate-provenance-claims.ts` — DB/network/clock-free registry,
  public-copy, marker, and 320-file universal-claim gate
- `src/lib/claims/__tests__/provenance-coverage.test.ts` — seven adversarial
  fixtures covering exact registry membership, derived counts, point-of-use
  linkage, required surface markers, and scanner behavior
- `src/lib/ci/claims-docs-gate.ts` — registers provenance validation as the
  thirteenth aggregate claims/documentation child
- `content/data-approach.md` and `/about` — generated public count, percentage,
  complete classes, exceptions, and DAT-005 boundary

## Verification

- focused provenance suite: **7/7**
- full suite through `npm run validate:claims-docs`: **356/356**
- aggregate gate: all 13 children across all seven categories passed
- provenance validator: **4/10 (40%)**, 320 public files scanned
- public claims: 41 claims, 14/14 required surfaces, 47 markers, zero
  authority/grade/unregistered leaks
- content templates, API contracts, terminology, policy, rights, metadata,
  Pulse runtime, TypeScript, targeted ESLint, design tokens, and diff checks:
  passed
- production build: passed; 86/86 static pages, with only the known existing
  Turbopack broad-trace warning
- browser QA: affected desktop/mobile routes had no horizontal overflow;
  renderer coverage and exceptions were visible; the small embed displayed
  quarter/year vintage and fit its frame; all six isolated route loads were
  console-clean. See `browser-checks.md` and the PNGs in this directory.

## Worker routing

Primary Codex performed the audit, implementation, validation, browser QA, and
closure directly. No Claude or delegated subagent was used for CLM-019.

## Deliberate boundary

CLM-019 does not make universal point-of-use provenance true and does not use a
surface-level denominator to imply dataset completeness. DAT-003 still owns the
complete rights manifest. DAT-005 owns total/source-linked/multi-source/stale/
disputed fact coverage by country and fact key. DAT-027 owns future per-row
provenance in bulk exports.
