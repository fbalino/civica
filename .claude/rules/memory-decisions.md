# Project Memory Decisions

## 2026-07-09 — Index retained during validation; prelaunch docs state current truth

- Removing A–F grades and qualitative country bands does **not** retire the
  Civica Index. The current 0–100 composite, dimensions, histories, rankings,
  pipeline, and APIs remain active research-beta outputs while they compete in
  the validation tournament.
- Civica currently has no user or API migration burden. Public product and
  methodology pages describe the best current system in the present tense;
  implementation history, superseded approaches, and migration tables stay in
  internal plans/version control unless needed to interpret a released
  scholarly artifact.
- The obsolete public peer-grouping migration page and endpoint were removed.
  Do not recreate public change-history theater merely to document private
  prelaunch development.
- Bounded subagent and subscription-authenticated Claude/Fable delegation is
  encouraged when it materially improves speed or audit independence. Fable 5
  remains the key decision-maker for consequential design choices; paid API
  fallbacks remain unauthorized.

Durable records: APR-D018 through APR-D020 in `plan/DECISIONS.md`.

## 2026-07-09 — Public uncertainty and Pulse cadence terminology

- The current Civica Index Monte Carlo bounds are input-variation ranges under
  declared perturbation assumptions, not confidence intervals for a latent
  true score.
- Pulse v2 is scheduled daily in `vercel.json`, but public copy distinguishes
  schedule from successful completion and from live/continuous measurement.
  Reader surfaces should expose the most recent completed computation.
- The durable records are APR-D016 and APR-D017 in `plan/DECISIONS.md`.

## 2026-07-09 — One evidence tier per public claim

Every headline public claim must be registered and assigned exactly one of
seven canonical tiers: institutional posture, source-reported fact, reconciled
fact, derived descriptive metric, research-beta estimate, experimental
heuristic, or retired/deprecated output. Registration is inventory, not
endorsement; overclaims remain subject to qualification/removal and the G3/G5
gates. The durable contract is `plan/decisions/claim-tier-v1.md`; the typed
implementation and validator live under `src/lib/claims/` and
`scripts/validate-public-claims.ts`.

## 2026-07-09 — Atlas-first academic publication readiness (owner decision)

Civica Atlas is primarily a trusted, provenance-first comparative reference to
how every country is governed. The atlas, structured institutional data,
source trail, and reconciliation are the flagship. The Civica Index and Pulse
are secondary research experiments and must earn stronger claims through the
gated program in `plan/MASTER-CHECKLIST.md`.

Locked direction:

- Remove A–F country grading and judgmental country bands from the target
  product.
- Run a preregistered Index tournament against simple baselines, a source-native
  Governance Evidence Dashboard, and genuinely Civica-native candidates. The
  process may redesign, demote, or retire the current composite; no candidate is
  guaranteed to win.
- Pulse becomes a versioned governance-event ledger first. Numeric governance
  deltas remain experimental unless prospective, representative, human-anchored
  validation supports a separate signal.
- Complete all feasible agent/code/data/documentation/browser work before
  soliciting qualified external reviewers. Human review remains a publication
  gate and is not replaced by model consensus.
- The working positioning is: “Civica Atlas is a provenance-first comparative
  reference to how every country is governed.”
- Reviewer discovery, advisory-board repair, release/DOI work, brand/legal
  review, and outreach are in the master plan; contact waits for the G4
  agent-complete gate.
- A rename remains available if professional trademark/confusion review shows
  material risk. No rename is presumed.

`plan/DECISIONS.md` is the detailed decision record. This entry supersedes any
older memory that treats the Index/Pulse as required headline products, treats
ensemble agreement as validation, or says Pulse is paused.

## 2026-07-05 — Pulse classifier: CROSS-MODEL ENSEMBLE (owner decision; supersedes both the 3-temperature scheme and the brief single-engine plan)

The classify pass runs once each on THREE heterogeneous engines (DeepSeek
v4-flash, GLM, Haiku 4.5; optional 4th voter gpt-4.1-mini only when explicitly
named in `PULSE_CLASSIFY_ENSEMBLE` and its OpenAI key exists) — the owner's own proposal, and stronger than the retired
same-model 3-temperature vote because the voters are more heterogeneous. Their
errors are **not** assumed independent; shared prompts, sources, taxonomy, and
training ecosystems can correlate them.
Consensus maps onto the EXISTING published agreement semantics: 3/3 = 'all',
2/3 = 'two_of_three' (+ adversarial verify pass on one engine), no majority =
'none' → human-review queue. The verify pass is a SIGNAL, not a veto (owner
loosened the gate same day): a refuted verify sends only WEAK majorities
(low self-confidence or degraded runs) to review; severe tiers always review. IMPORTANT calibration rule the owner stated
emphatically: his past manual approvals were smoke tests, NOT gold labels —
never benchmark engines against "what Fernando approved before." Per the
superseding 2026-07-09 decision, ensemble consensus and queue size are process
diagnostics, not quality validation; representative independent human labels,
retrieval/clustering tests, calibration, and subgroup results are required. The
China-domiciled-model optics flag from the research doc is mitigated by
design: no single vendor decides a label alone. Backtests stay on Anthropic.

## 2026-07-05 — IDEA voter-turnout adopted under its NON-COMMERCIAL license (owner sign-off)

International IDEA turnout data ships on /elections under CC-BY-NC-SA-4.0
(same non-commercial family as IPU Parline and Constitute). **If Civica ever
charges money for anything — subscriptions, paid API, paid embeds — the
NC-licensed sources (IDEA turnout, IPU, Constitute) must be relicensed or
removed FIRST.** Owner accepted this constraint explicitly ("fine,
non-commercial") on 2026-07-05. Any future monetization discussion must
surface this entry.

## 2026-06-20 — `--shadow-hard*` token NAMING is the last leftover of the v2 look — owner-gated (do not "fix" unasked)

The palette convergence the 2026-06-20 blind audit flagged has since landed: the
live site (globals.css), DESIGN.md, and the embed widget
(`src/app/embed/[slug]/route.ts`) now all use the same v2 language — Parchment
paper `#FAF7F2`, terracotta accent `#B7512B`, soft navy-tinted shadows. The
embed no longer hand-defines a divergent v1 palette or true hard-offset shadows.

The ONE remaining leftover is cosmetic and owner-gated: the `--shadow-hard*`
token NAMES still read "hard" while their VALUES are soft (`0 1px 2px
rgba(15,23,42,.06)`). Renaming them is deferred until the owner signs off (DESIGN.md
notes "a rename is pending in a later pass"). Do NOT rename or reconcile the token
names unasked; the values are already correct everywhere.

(The former "rankings dedup" caveat is RESOLVED: both `rankCountriesByFact`
(queries.ts:120) and `getCountryRankings` (queries.ts:289) now select
`DISTINCT ON (jurisdiction_id, fact_key)` over `country_facts`, so a second
source row can never double-count a country in a ranking.)

## 2026-05-02 — `structural_family` retirement adopted; domain-specific peer lenses replace it

Civica's leadership adopted `peer-grouping-resolution-v1` after a multi-LLM
deliberation panel rejected the alternatives (write a methodology paper for
the existing heuristic; keep `structural_family` with a disclaimer). The
resolution retires `structural_family` — the in-house, regex-derived
10-bucket taxonomy used as the site-wide default peer-grouping primitive —
and replaces it with a domain-specific peer-lens architecture:

- **Material outcomes** (HDI, GDP, health, demographics): default to
  World Bank region × World Bank income group.
- **Governance outcomes** (Civica Index, Pulse, democracy, rule of law):
  default to V-Dem Regimes of the World (RoW).
- **Optional alternate regime lens**: Bjørnskov-Rode / CGV (already
  ingested) remains user-toggleable.
- **Constitutional form**: `government_form_description` (free text) +
  `monarchy_status` (small enum) — descriptive metadata only, NOT an
  analytical taxonomy.

Resolution audit trail at `~/civica/plan/peer-grouping-resolution-v1.md` +
`~/civica/plan/peer-grouping-deliberation-transcript.md`. Implementation
plan at `~/civica/plan/structural-family-removal-implementation-plan.md`
(plan v1.1, six phases, Phase 2 + Phase 5 in parallel during the Phase F
sync wait, hard cut at T+2 vintages).

User-locked decisions (2026-05-02):
- Q1: `/government-types` and `/government-types/[type]` archive with 308
  redirects to `/civica-index/methodology#peer-grouping`. Repurposing as
  educational reference would recreate the controlled-vocabulary problem
  the resolution just retired. The bi-lens explorer at
  `/civica-index/government-types` survives, refactored to V-Dem RoW
  (default) + BR/CGV (toggle).
- Q2: Wait for Phase F's sync of the four peer-grouping fact-keys; no
  throwaway local ingestion (would violate the canonical-fact-layer
  architecture).
- Q3: Methodology page ships with "Pending external review by a
  comparative-politics scholar" footer; v1 vintage cut does NOT gate
  on review; revisions ship as methodology v1.1 with a documented
  changelog.
- No BETA pill on the new methodology page — Civica is citing
  externally-attested classifications, not asserting a novel composite.

How to apply:
- Do NOT introduce new code paths that read `structural_family` or
  derive a Civica-asserted government-type taxonomy.
- For peer-grouping logic, use `src/lib/peer-grouping/` helpers
  against Phase F's `resolveFact()` resolver.
- Country pages display two peer-lens panels (material + governance)
  with separate `<SourceDot>`s — different vintages.
- Apply the `n ≥ 8` minimum-n rule with the documented fallback chain
  (region+income → region → income → global for material; RoW tier →
  global for governance).
- Non-coverage cases (Taiwan, Vatican, Western Sahara, etc.) render a
  "limited peer comparison available" pill rather than silently mapping
  to the closest peer.

## 2026-05-02 — Civica is operating as a research lab; treat methodology decisions as first-class artifacts

Civica's scope has progressively shifted from "website with academic data" toward
"academic publication with a UI on top," in the same posture as Our World in Data,
V-Dem, the World Bank statistical division. This is now explicit, not implicit.

Concrete signals: published Civica Index methodology (with PCA-derived weights,
Monte Carlo uncertainty intervals, frozen reference periods, BETA pill until
external review), Pulse v2 backtesting against named historical shocks, Pulse
methodology + replication doc, the in-flight Phase F Wikidata reconciliation
methodology, and the 2026-05-02 peer-grouping resolution which Civica's lead
delegated to a multi-LLM deliberation panel rather than vibe-coding internally.

Implications for how every agent works on this project:

- **Methodology decisions are first-class deliverables, not planning notes.**
  When a substantive methodology question surfaces (peer grouping, indicator
  basket, regime classification, source allowlist, vintage cadence, etc.), the
  artifact you produce is a citable resolution document, not a Slack message
  or an inline code comment. Save under `~/civica/plan/<topic>-v<n>.md`.
- **Audit trail matters.** When a resolution is reached through deliberation,
  the deliberation transcript is preserved alongside the resolution itself
  (see `~/civica/plan/peer-grouping-deliberation-transcript.md` as the
  template). Future external reviewers should be able to see HOW Civica
  reached a methodology decision, not just WHAT was decided.
- **Citations, not vibes.** Methodology recommendations need grounding in
  external academic literature, peer institutions (OWID, World Bank, IMF, UN,
  V-Dem), or named methodological frameworks. "Seems more rigorous" is not
  acceptable justification.
- **Don't conflate "deeply integrated" with "academically defensible."** The
  cost of removing a Civica-derived heuristic from many files is a fact about
  the work, not a reason to keep it. If the methodology fails the rigor bar,
  the integration cost is incidental.
- **Beta posture is the default for novel work.** New Civica-asserted
  methodologies (composites, taxonomies) ship with a BETA pill until reviewed
  externally, mirroring the CI / Pulse pattern. Resolutions that cite
  EXTERNAL methodologies (V-Dem RoW, World Bank classifications, BR/CGV) do
  not need a BETA pill — they inherit the source's standing.
- **Eventual publication.** Methodology resolutions should eventually be
  published as reader-facing pages under `/civica-index/methodology/...` (or
  a future `/research/...` subsection) with the underlying audit trail
  linkable. The deliberation transcript pattern from peer-grouping-v1 is the
  template.
- **Org framing.** Civica is not yet a formal research lab, but it is
  operating like one. The lead has acknowledged that scope is expanding and
  may eventually warrant separating the research function from the
  publication function organisationally. For now, keep both in this repo,
  but maintain the discipline of citable artefact production so the split
  is cheap when it happens.

How to apply, agent-by-agent:

- When you encounter a methodology question mid-task, do NOT silently make a
  call and ship code. Either (a) escalate to the user with the question and
  the options, or (b) produce a methodology mini-resolution in
  `~/civica/plan/` first, get sign-off, then implement.
- When the user delegates a methodology question to deliberation, the
  resolution that comes back is the contract. Do not re-litigate. If you
  find an implementation issue that affects the resolution's feasibility,
  flag it as an open question, not as a basis for ignoring the resolution.
- When writing code that uses a methodology-grade primitive (peer grouping,
  CI dimension weights, taxonomy classifications), comment-link to the
  resolution document so future readers can trace the decision.

This decision is itself a methodology decision. Future agents may revise it
under the same discipline that produced it.

## 2026-04-24 — Civica Index/Pulse methodology is beta and under rework

User disclosed (end of Phase 2.2 session) that the CI v1 composite + CP daily
scoring both have known flaws and will be recalculated with a new methodology.
The rework ships in beta form first. Implications:

- Do NOT optimize code paths around the current dimension weights or adapter
  outputs as if they were stable. The shape of `ci_scores` / `pulse_scores`
  rows may change, as will the composite formula and the dimension list.
- `/civica-index` hero copy currently reads more authoritatively than the
  product's maturity warrants. Add a visible `BETA` marker (hero eyebrow or
  pill) and a one-line "methodology under revision" disclosure in the lede
  before the rework ships — credibility hedge.
- Phase 5 in the roadmap (originally "CI/CP academic legitimacy — polish for
  citation") now scoped differently: it's the v2 methodology rebuild +
  beta→stable transition, not a polish pass. Treat the old Phase 5 framing as
  superseded.
- Routing / shell work (Phase 2.3+) is orthogonal. The reader-group migration
  of `/civica-index/methodology` doesn't care what the page says, only where
  the file lives and what layout wraps it. Safe to proceed.

How to apply: if you're writing CI-adjacent code, ask the user whether it
should assume the current methodology or a new one before committing to an
approach. Content changes on `/civica-index` pages should lean toward honest
hedging while the rework is in flight.

## 2026-04-21

- Government classification now uses three layers:
  - raw CIA Factbook label kept unchanged on `jurisdictions.government_type_detail`
  - normalized Bjornskov-Rode / CGV regime layer stored in `government_taxonomies`
  - derived structural form layer stored in `government_taxonomies`
- Structural form is the default public lens on `/civica-index/government-types`.
- Regime type is available as a second lens and is metadata only. It does not affect CI scoring.
- Switzerland is treated as a deliberate divergence case:
  - regime lens: presidential democracy
  - structural lens: federal directorial republic

## 2026-04-24

### Chat context scoping rule (Ask Civica)
The `contextChips` shown in the right-pane chat AND the `apiContext` sent to `/api/chat`
must only include state variables that are semantically relevant to the active tab.

House (upper/lower) is only meaningful on the `chamber` tab (amended 2026-04-24,
narrower than the original chamber+bills rule). It must be stripped from chips and
apiContext on ALL other tabs, including bills.

Why: the chamber tab is the only view with a visible upper/lower toggle driving what
the user is looking at. Bills, structure, democracy, etc. all display country-level
data regardless of which house was last selected. Showing the house chip on them reads
like the chamber selection is bleeding through. Example user report: on
`/atlas/usa/chamber` with lower selected → navigating to structure (which already
strips house) → then to bills, the chip still said "Lower" and felt like leaked state
rather than an intentional scope.

How to apply:
```ts
const tabNeedsHouse = tab === "chamber" || tab === "bills";
const contextChips = [
  { label: "Country", value: country.name },
  ...(tabNeedsHouse ? [{ label: "House", value: houseLabel }] : []),
  { label: "Tab", value: TAB_LABELS[tab] },
];
const apiContext = {
  country: country.name,
  tab,
  ...(tabNeedsHouse ? { house } : {}),
};
```

The URL's `?house=` query param is ALSO stripped when navigating to non-chamber/
non-bills tabs (updated 2026-04-24, supersedes earlier decision to preserve it).
Reason: a shared URL like `/atlas/usa/democracy?house=upper` looks broken to a
reader because house has no meaning on Democracy. If we want to preserve the
user's house choice across navigations, use `localStorage` (pattern: same as the
pane-width persistence in `ShellContext` under key `atlas_panels`), not URL state.
This same principle applies to any future per-tab context (e.g. a future
`currentBillId` should only appear on the bills tab).

## 2026-04-24 — Phase 2.1 extraction plan locked

- `?house=upper` is a URL search param, NOT a path segment. Avoids rebuilding three
  panes on chamber toggle.
- `BillCard.onAsk` cross-coupling (currently writes to `chatInputRef` directly) is
  being replaced by a `civica:ask` CustomEvent on `window`. `AskCivicaPanel` listens
  (gated by `listenForExternalAsk` prop) and pre-fills. This is the clean pattern
  when chat lives in a separate route slot from the trigger.
- International tab routes by 3-letter `country.id`, NOT by slug (see AtlasApp.tsx:763,
  comment at :761). Every other tab uses slug. `InternationalTab` props should name
  the field `countryId` to make the deviation explicit at call sites.
- Per-route defaults do NOT cascade through segment boundaries in Next.js 16 parallel
  routes. Every depth under `(shell)/atlas/` needs its own `@left/page.tsx` and
  `@right/page.tsx`, not just the root.
- Filter state (`searchQuery`, `regionFilter`, `govFilter`) stays owned by `AtlasApp`
  for the legacy `/` route because `setAtlasControls` at lines 359–415 reads them to
  inject into the global header. `AtlasCountryLeft` receives them as props, does not
  own them.

## 2026-05-01 — Atlas masthead facts must never be generated

The country masthead may only show source-backed facts or the explicit placeholder
`No source`. Do not reintroduce slug-hash/generated/demo values for language,
currency, trade, identifiers, literacy, medals, memberships, or other fact slots.

GDP in the masthead is CIA Factbook real GDP PPP and must be labeled `GDP (PPP)`.
If a future task switches to nominal GDP, update the label and source at the same
time.

## 2026-06-04 — "Gulf of Mexico" adopted as the displayed primary name (render-time normalization)

Civica displays "Gulf of Mexico" as the primary name for the body of water,
with a short, neutral provenance note, on the Geography sections of the United
States, Mexico, and Canada (the only countries whose CIA prose references it).

### The editorial decision
- Primary displayed name: **"Gulf of Mexico."**
- A transparent provenance note appears ONLY on sections where the rename
  actually occurred:
  > "Naming: Civica uses 'Gulf of Mexico,' the name recognized by the
  > International Hydrographic Organization and the United Nations. The source
  > data (CIA World Factbook) adopted 'Gulf of America' following a U.S.
  > executive order in January 2025."
- The note uses the canonical `<Banner variant="info">` primitive (no
  per-page styling, fully tokenized).

### Rationale
For an international, academically-citable reference work, "Gulf of Mexico" is
the defensible primary name — it is used by the International Hydrographic
Organization, the United Nations, Wikipedia, Britannica, AP, Reuters, and the
BBC. The January 2025 U.S. executive order renaming the gulf "Gulf of America"
binds only U.S. federal agencies and carries no international standing; the
United States borders under half of the gulf's coastline. The CIA World
Factbook is itself a U.S. federal publication and adopted the executive order's
wording, which is why our public-domain import surfaced "Gulf of America."

### How it's implemented — render-time only, stored source kept verbatim
- The CIA JSONB in `country_factbook_sections.section_data` is **left
  untouched**. We store the source as-is and display our house naming
  convention with a note — the cleanest provenance posture. No DB mutation,
  and the importer (`scripts/seed-from-factbook.ts`) is unchanged.
- Helper: `src/lib/data/geographic-name-normalization.ts` — a targeted,
  documented phrase map (`normalizeGeographicNames`,
  `geographicNameWasNormalized`, `sectionDataHasNormalizableGeographicName`).
- Applied at the single leaf-text extraction seam: `extractText()` in
  `src/lib/data/factbook-fields.ts`. This covers every nested leaf at every
  depth — including the depth-3 "Major watersheds → Atlantic ocean drainage"
  entry — and both render paths (`/factbook/[slug]` and `/countries/[slug]`),
  since both call `jsonbToFields()`.
- The note is rendered conditionally in both page files using the helper's
  "changed" signal so it never appears on a country/section with no Gulf
  reference (verified: Honduras still shows "Gulf of Fonseca" and the note is
  absent; "Persian Gulf" untouched across 17 sections).

### Scope discipline for future renames
This is intentionally a single, targeted rename. Future U.S.-federal
geographic renames (e.g. Denali/Mt. McKinley) must be evaluated case-by-case
against the same international-reference standard (IHO / UN / major
encyclopedias and wire services) before being added to the phrase map — they
must NOT be auto-applied just because a U.S. executive order changed them.
