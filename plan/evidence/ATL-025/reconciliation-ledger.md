# ATL-025 — dated plan / mockup reconciliation ledger

Reconciled 2026-07-12. Every pre-master-plan dated document and mockup is
tagged against the atlas-first master plan. Statuses:
**imported** (fed the master plan / blind-audit input), **completed** (its
feature shipped; verified by live route/lib presence), **superseded** (replaced
by the master plan or a shipped surface), **deferred** (still-open work now
carried by a master task ID), **post-release** (out of scope until a later gate).

All dated docs are retained as historical evidence per
`00-mission-and-operating-rules.md` ("existing dated plans remain historical
evidence and are not deleted"). None is an execution source.

## Dated plan documents (20)

| Document | Status | Evidence / carrier |
|---|---|---|
| civica-academic-readiness-blind-audit-2026-07-09.md | imported | Source blind audit for this entire master plan; preserved as the ledger it derives from. |
| civica-audit-2026-07-01.md | imported | Earlier blind-audit ledger folded into the plan's Area findings. |
| implementation-audit-2026-07-04.md | imported | Audit findings imported as Area 02–09 tasks. |
| civica-feature-roadmap-2026-06-30.md | superseded | Explicitly a historical input per AGENTS.md "Active plan"; unchecked items only execute via a master task ID. |
| civica-drift-wave-2026-06-30.md | completed | Drift-cleanup wave shipped (design-token + layout fixes in git history). |
| civica-drift-wave-2-2026-07-02.md | completed | 18-finding sweep shipped; residual design work carried by EXP-001–004. |
| constitution-explorer-redesign-v2.md | completed | Constitution Explorer live (`src/app/constitution`, country Constitution tab). |
| constitution-explorer-wave2-v1.md | completed | Wave 2 shipped; cross-corpus search added by ATL-009 (`/constitution/search`). |
| elections-data-sourcing-resolution-v1.md | completed | Elections corpus qualified/shipped (ATL-007/008; `src/app/elections`). |
| electoral-systems-implementation-v1.md | completed | Electoral Systems Explainer live (`src/app/elections/systems`, `src/lib/elections/electoral-systems.ts`). |
| party-ideology-sourcing-resolution-v1.md | completed | Party browser + ideology live (`src/app/parties`, `src/lib/parties`); deeper audit deferred to ATL-011. |
| gov-leadership-enrichment-plan-2026-06-30.md | completed | Officeholder/leadership enrichment live (`sync-officeholders` cron). |
| gov-p4-cabinets-judiciary-plan-2026-06-30.md | completed | CIA World Leaders cabinet sync live (`sync-cia-cabinets` cron). |
| pulse-classifier-cost-resolution-v1.md | completed | Cheap-model replacement adopted; superseded by the ensemble decision below. |
| pulse-ensemble-classifier-implementation-2026-07-05.md | completed | Cross-model ensemble live (`src/lib/pulse/v2/classify.ts`); documented in AGENTS.md and `.env.example` (reference comment only). |
| record-hero-cover-generation-plan.md | completed | Record hero covers shipped (`public/blog/*`). |
| record-image-generation-plan.md | completed | Record/engraving imagery shipped (394 country engravings; EXP-005–008 govern the grade). |
| self-hosted-tiles-v1.md | completed | Self-hosted PMTiles basemap live (`NEXT_PUBLIC_BASEMAP_PMTILES_URL`; referenced in `.env.example` as design reference only). |
| civica-country-map-hybrid-v1.md | completed | Hybrid 2D + Mapbox map live (`src/components/**` map components; `src/lib/map`). |
| footer-trust-strip-alignment-fix-2026-07-05.md | completed | Footer trust strip + Status Page link live (`statuspage.incident.io`). |

## Mockups (36, `mockups/04-1x-2026-*.html`)

Per the CIV-208 convention these are dated **PM design references**, not
execution plans. The corpus is retained as historical design input.
Where the mockup's surface shipped, it is **superseded** by the live feature;
none is an execution pointer:

- constitution-explorer, election-timeline, electoral-systems-explainer,
  political-party-browser, legislature-deep-dive, world-leader-profiles,
  government-hierarchy-chart, embeddable-country-cards, democracy-dashboard,
  global-governance-pulse → superseded by the corresponding shipped reader
  surfaces (constitution, elections, parties, factbook legislature, leaders,
  gov org chart, embeds, Civica Data, Pulse).
- Any mockup whose surface is not yet built remains a **design reference** for
  the relevant open master task (e.g. Explore nav concepts are owned by
  EXP-014/015, not by a mockup).

## Still-valid open work → carried by master task IDs

No dated plan leaves orphaned open work. Residual items are already imported:
party depth ATL-011, organizations ATL-012, bills ATL-013, map layers ATL-015,
Conditions ATL-026–031, government-type trajectories ATL-032, Explore
navigation EXP-014–016, engraving grade EXP-005–009.

## Active-pointer check (the load-bearing acceptance clause)

A repository search of the canonical surfaces (AGENTS.md, CLAUDE.md, README.md,
`00-mission-and-operating-rules.md`, MASTER-CHECKLIST.md) found **no active
pointer that targets a noncanonical dated plan as an execution source**. The
only references are:

- AGENTS.md "Active plan" — names the 2026-06-30 roadmap and other dated plans
  explicitly as *historical inputs*, directing execution to the master
  checklist. This is the correct disposition, not a violation.
- `.env.example` lines 44 and 245 — comments citing
  `pulse-ensemble-classifier-implementation-2026-07-05.md` and
  `self-hosted-tiles-v1.md` as *design references* for an operator, not as
  execution plans. Acceptable and retained.

`.claude/worktrees/**` copies are stale, lint/build-ignored, non-canonical and
out of scope.
