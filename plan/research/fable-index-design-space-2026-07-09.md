# The Future of the Civica Index — Design-Space Analysis and Validation Tournament

**Date:** 2026-07-09
**Author:** Independent methodology review (Fable 5 research agent, single-session)
**Status:** Research artifact for owner decision. No product changes were made; this document is the only file written.
**Companion documents:** `~/Downloads/resolution (1).md` (the three-reviewer joint resolution recommending retirement of the composite), read *after* the independent diagnosis in §2 was formed and recorded.

---

## How to read this document

Every substantive claim is tagged:

- **[FACT]** — verified directly in the repository (file references given) or in the attached resolution.
- **[INFERENCE]** — my judgment from the facts; a competent reviewer could disagree.
- **[PROPOSAL]** — a design or decision recommendation for the owner.

Plain-language summaries open each section so the whole document is readable without technical background. The technical detail below each summary is there so a future implementer or an external academic reviewer can check the work.

A note on method, per the task protocol: sections 2 and 3 record a diagnosis formed **before** reading anything under `plan/` or the attached resolution. The resolution was read afterward and is pressure-tested in §2.6 and throughout §4–5. One caution stated up front: the resolution presents itself as a unanimous three-reviewer consensus. Whatever its provenance, unanimity among reviewers — human or model — is not academic validation. The resolution's force comes from its arguments and citations, which are evaluated on their merits here, not from its vote count.

---

## 1. Executive recommendation

**Plain language:** The current Civica Index should not launch as a headline 0–100 score. It repackages four famous third-party ratings that already agree with each other ~90%, so it adds no new knowledge — and no engineering effort can fix that, because the problem is what the score is made *of*, not how it is computed. The attached resolution reaches the same conclusion and is right. But the resolution stops too early: it never asks whether Civica could measure something *original* using the assets no one else has — its provenance engine, officeholder records, election records, constitutions, and multi-source disagreement data. Two candidate measurements built on those assets are cheap to prototype, make only auditable factual claims, and should compete in a pre-registered validation tournament. If they fail their gates, Civica ships the evidence dashboard alone and loses nothing.

**The recommendation in seven points:**

1. **[PROPOSAL] Retire the 0–100 composite, the A–F bands, and the Civica-manufactured confidence intervals before launch.** I reached this conclusion independently (§2) before reading the resolution, on the same core evidence plus implementation findings the resolution did not have (§2.2–2.4). This part of the resolution should be adopted.

2. **[PROPOSAL] Adopt the resolution's Governance Evidence Dashboard as the floor, not the ceiling.** Native scales, upstream uncertainty passed through where published (V-Dem's Bayesian intervals), honest "no published uncertainty" flags elsewhere, no letter grades at any level. This requires real data ingestion first — the current adapters are hardcoded ~50-country tables (§2.2), so even the dashboard has a data-engineering prerequisite.

3. **[PROPOSAL] Amend the resolution where it overreaches.** Its evidence supports retiring *recomposited collinear judgment indices*. It does not support a permanent ban on all original Civica measurement — a question it never examined. Its §2.6 allocates "zero" to "Civica Index v2 (recalibrated weights, expanded basket)"; that specific zero is correct. But the design space of original measurement is larger than reweighted composites (§4).

4. **[PROPOSAL] Run a small validation tournament (§5) among four materially different candidates plus baselines:** the hardened status-quo composite (K1, competing fairly), the evidence dashboard (K2), a **Measurement Concordance layer** (K3 — where the world's governance raters agree and disagree, per country), and a **Power & Transfer Ledger** (K4 — auditable facts about executive tenure, alternation in power, and term-limit compliance). A constitution-vs-practice pairing (K5) and the Pulse-as-event-chronicle (K6) run as gated research tracks.

5. **[INFERENCE] The tournament's novelty gate is already decidable for K1: it fails by construction.** The composite is a deterministic function of four public indices — a regression of its output on its inputs recovers it exactly (R² = 1.0). No future data collection changes this; only changing what feeds it would, and that produces a different candidate, not a rescued K1. This is why a recommendation *can* be made today rather than waiting for evidence: for K1 the evidence cannot come out any other way.

6. **[PROPOSAL] Redirect effort roughly as the resolution says — reconciliation engine first, Pulse validation second** — with one carve-out: a time-boxed research track (~2–4 agent-weeks of prototyping plus human expert checks) for K3 and K4, which mostly reuse data and infrastructure the reconciliation roadmap builds anyway.

7. **[PROPOSAL] Whatever survives, publish under pre-registered falsification and retirement rules (§8).** Every original Civica measure ships with a public statement of what evidence would kill it, and an annual re-validation. This is the posture that earns academic citation; it is also the posture the reconciliation methodology page already models well.

---

## 2. Independent diagnosis of the current Index

*(Formed and recorded before reading `plan/` or the resolution. File references verified first-hand or by three read-only survey agents; load-bearing numbers re-verified directly.)*

**Plain language:** The Index today is four borrowed numbers averaged together, computed for only ~46 countries from data typed into the code by hand in 2023, wrapped in a confidence interval that is the same width for everyone, and graded A–F with labels like "Failed / authoritarian." The parts of the system around it — source citations, versioning, honesty about missing data — are genuinely good. The number in the middle is the weak part.

### 2.1 What the Index is [FACT]

- **Four dimensions, each measured by exactly one third-party indicator.** Democratic quality ← V-Dem Liberal Democracy Index (`v2x_libdem`); rule of law ← World Bank WGI Rule of Law; freedoms & rights ← Freedom House PR+CL sum; corruption control ← Transparency International CPI (`scripts/ingest-ci-vdem.ts:9-16`, `ingest-ci-wgi.ts:9-15`, `ingest-ci-freedom-house.ts:9-15`, `ingest-ci-cpi.ts:9-15`). Each "dimension" is not a Civica measurement; it is a relabeled upstream index.
- **Weights 0.27 / 0.26 / 0.23 / 0.24** (`src/lib/ci/dimensions-v2.ts:49-54`), the squared PC1 loadings from a PCA on n = 46 countries × one year (2023), rounded and hand-nudged to sum to 1.00. Verified in `analysis/phase-5-3/results.json`: eigenvalues 3.707 / 0.343 / 0.027 / 0.011; PC1 explains **90.66%** of variance; only one Kaiser component. Pairwise correlations 0.740–0.977 (`analysis/phase-5-3/correlations.csv`); rule of law × corruption control = **0.977**.
- **Fixed-bound normalization** to 0–100 per source (`src/lib/ci/normalize-v2.ts:45-113`), Monte Carlo composite with 10,000 draws (`src/lib/ci/monte-carlo.ts`), point estimate = simulation median, 90% interval = 5th/95th percentiles (`src/lib/ci/calculate-v2.ts:145-156`).
- **A–F bands** with labels Exceptional / Strong / Mixed / Weak / Very weak / **Failed / authoritarian** at cutoffs 85/70/55/40/25 (`src/lib/ci/bands.ts:20-27`).
- **Two methodology versions coexist** in `ci_composite_scores`: legacy `v1.0` (six dimensions, observed-min/max normalization, author-asserted weights 0.30/0.20/0.15/0.15/0.10/0.10 — `scripts/seed-ci-methodology.ts:16-28`, `src/lib/ci/normalize.ts`) and `beta` (the four-dimension pipeline above). Every live surface defaults to `beta` (`src/app/api/v1/index/[country_slug]/route.ts:33`, `src/lib/db/queries.ts:1101` etc.).

### 2.2 The data underneath is a hardcoded demo, not a pipeline [FACT]

All six ingestion adapters contain hand-typed reference tables of ~49–56 countries each, with the same comment: *"In production, download from <URL>"* (`scripts/ingest-ci-vdem.ts:14`, and identically in the WGI, HDI, Freedom House, CPI, and GPI adapters). The live-fetch path was never built. The intersection of countries with all four dimensions is the PCA's n = 46. The public methodology page's metadata describes "an original governance score for 190+ sovereign states" (`src/app/(reader)/civica-index/page.tsx:71-74`); the data can support roughly a quarter of that. Separately, `src/lib/ci/history-adapters.ts` *does* implement real download paths (OWID grapher CSVs, World Bank API) for the multi-year `indicator_history` table — so the engineering pattern for real ingestion exists in the repo; it feeds trend charts, not the Index.

### 2.3 The uncertainty interval is decoration [FACT → INFERENCE]

- [FACT] Every source is assigned the identical default uncertainty, σ = 5 normalized points (`normalize-v2.ts:45-113`, `defaultUncertaintyV2`); no per-country or per-source published uncertainty is wired in, despite the comment noting V-Dem publishes it (`monte-carlo.ts:13-17`). Dimension errors are sampled **independently** (`monte-carlo.ts:76-85`).
- [INFERENCE] With near-equal weights w ≈ 0.25 and equal σ = 5, the composite's simulated standard deviation is ≈ 5·√Σw² ≈ 2.5 points for *every* full-coverage country, so every published "90% CI" is ≈ ±4 points wide regardless of country. It carries no country-specific information — it is a constant dressed as a measurement. Worse, the independence assumption is anti-conservative: the four inputs share one latent factor (r = 0.74–0.98), so their measurement errors are almost certainly positively correlated; independent sampling *narrows* the interval below what honest error propagation would give. The interval thus overstates precision twice over.

### 2.4 Implementation findings the resolution did not have [FACT]

These come from tracing code, not from the published methodology pages the resolution reviewed:

1. **Prose–implementation gaps.** The methodology page (`content/methodology-civica-index.md`) promises: PCA on a 2000–2024 panel (§4 — actual: n=46, one year, hedged only in §12); sampling from "published-uncertainty distributions" (§5 — actual: flat ±5 for all); an "anchored z-score transform" for unbounded sources (§3 — not implemented anywhere); an annually recomputed "harmonized back-cast" series (§11 — not implemented); a source-substitution sensitivity test (§4 — "deferred," admitted in the appendix). The Pulse section (§10) names ACLED, CIVICUS, RSF alerts, V-Dem pulse, HRW/Amnesty as drivers; the pulse methodology page itself concedes GDELT "carries more of the signal than the specialist-first design intends" (`content/methodology-pulse.md`, Sources section).
2. **Presentation drift across surfaces.** The methodology page defines six bands (A–F); the runtime tier engine implements five, visually merging E and F (`src/lib/ci/tiers.ts`). The embed widget uses different cutoffs entirely — 90/75/50/25 vs canonical 85/70/55/40 (`src/app/embed/[slug]/route.ts:271-277`) — so a country at 72 renders "Strong" on the site and "Mixed" in the embed.
3. **A stale scoring path is still publicly served.** The legacy scalar Pulse (`pulse_daily_scores`, `pulseScore = clamp(ciBaseline + eventImpact, 0, 100)` — `src/lib/pulse/calculate.ts:170`) has **no cron entry** in `vercel.json`, yet `/api/v1/index/rankings?sort=cp` and the embed's "CP" field still read it live (`rankings/route.ts:145-198`, `embed/[slug]/route.ts:185-189`). Its baseline lookup takes the most recent composite across *any* methodology version (`calculate.ts:108-114`).
4. **The scoring core is essentially untested.** One unit test exists for the whole CI/Pulse system (`src/lib/ci/__tests__/normalize-v2.test.ts`, the normalization transforms). No tests cover the composite, completeness rules, Monte Carlo, bands/tiers (where the embed drift would have been caught), decoupling, or any Pulse v2 module. The 10-case backtest harness is real but live-DB/live-LLM, not CI-gated.

### 2.5 What is genuinely good and must survive [FACT + INFERENCE]

- The **reconciliation engine** and its methodology page (`content/methodology-reconciliation.md`): deterministic rule-based resolver (`src/lib/factbook/reconcile/resolver.ts`), 25,821 canonical rows across 88 fact-keys and 20 sources, alternates preserved, public disputes log, quarterly frozen vintages with content hashes (`country_fact_vintages`, `schema.ts:639-700`), hashed upstream payload snapshots for replay. This is publication-grade infrastructure and the strongest citation claim in the project.
- The **missing-data honesty** of the beta pipeline — refusing to re-proportion weights over missing dimensions because it "silently biases fragile states upward" (`calculate-v2.ts:53-71`) — is better methodology than many published indices.
- **Vintage citability** (as-published quarterly snapshots with embedded methodology version), the **Conditions separation** (refusing to merge HDI/GPI into the headline), the **display reconciliation discipline** (`displayDimensionScore` as single source of truth), the **dispute/correction infrastructure**, the **decouple** double-counting guard, and the **backtest harness design** (named historical shocks with expected directional trajectories) are all worth keeping regardless of what happens to the score.
- [INFERENCE] The pattern across all of this: **Civica's craftsmanship is in provenance, versioning, and honesty about data. Its weakness is the one place it manufactures a judgment.** The Index is the least Civica-like thing in the codebase.

### 2.6 Pressure-testing the resolution [INFERENCE]

I agree with the resolution's conclusion and most of its reasoning. Points of divergence and correction:

1. **Its empirical anchor is weaker than it presents.** The r = 0.98 and 90.7% figures come from the same n = 46, single-year, coverage-biased panel the resolution elsewhere dismisses as underpowered. One cannot lean on a panel for the kill-shot while discrediting it as evidence. On a full 2000–2024 panel the correlations would very likely be lower (V-Dem LDI × CPI globally runs nearer 0.6–0.75 across full coverage), and PC2 would carry more weight. **The retirement case should therefore rest on the architectural ground, which is decisive regardless of panel:** the Index consumes no observation Civica makes. It is a deterministic reweighting of four public indices, so its incremental information content is zero *by construction*, at any correlation level (§5, gate G1). The resolution gestures at this ("heavy derivative dependency") but leads with the fragile statistics.
2. **Its §1.6 documentation-inconsistency claim is stale.** The README today describes "the v2-Beta four-dimension composite" (`README.md:73`); the six-dimension README language the resolution quotes has already been reconciled (`src/lib/content/site-state.ts:70-77` documents the fix). The residual six-vs-four confusion that *does* still exist is subtler: the Pulse scores five dimensions including `stability`, which has no CI counterpart (`src/lib/pulse/v2/types.ts:11-13`), and the legacy v1.0 six-dimension rows still sit in the same table as beta rows.
3. **It evaluates one alternative.** The resolution compares the composite to exactly one successor (the dashboard) and declares the winner. A retirement decision this consequential deserves a design-space search — which is what §4–5 supply. Notably, nothing in the resolution's own logic forecloses fact-anchored or meta-measurement constructs; its arguments are all aimed at latent-variable judgment composites.
4. **Its "zero allocation" line needs a scope note.** "Civica Index v2 = recalibrated weights + expanded basket" deserves zero, agreed — an expanded basket of governance indicators would raise collinearity, not lower it. But reading that as "zero original measurement, forever" would over-apply the evidence.
5. **Where the resolution is stronger than my initial diagnosis:** its "if it exists, it will be cited" argument (Ravallion's point that the number detaches from its caveats) is the right answer to "keep it but hedge harder," which I had entertained as a fallback; and its insistence that bands and Monte Carlo intervals are presentation-layer properties that don't require the composite is exactly right and generalizes (§6).

---

## 3. What distinctive value Civica can measure

**Plain language:** Civica's real assets are not opinions about how well countries are governed — V-Dem, Freedom House, and the World Bank already sell those, with armies of coders. Civica's assets are *receipts*: who holds every office and since when, what every constitution says, when every election happened and who won, which sources disagree about which facts, and a machine that keeps all of it fresh, cited, and versioned. Original Civica measurement should be built out of receipts, not opinions.

### 3.1 Asset inventory [FACT]

| Asset | What it contains | Where |
|---|---|---|
| Reconciliation layer | 25,821 canonical fact rows, 88 fact-keys, 20 active sources; per-row source, license, vintage, decision reason; alternates preserved; public disputes log; quarterly frozen vintages with SHA-256 content hashes; hashed upstream payload snapshots (replayable) | `country_facts`, `country_fact_vintages`, `data_disputes`, `fact_snapshots` (`src/lib/db/schema.ts:377-828`); resolver `src/lib/factbook/reconcile/resolver.ts` |
| Statement-level provenance | Polymorphic per-fact attribution (source, URL, license, retrieval date, hash, validity window) for jurisdictions, elections, party seats, officeholder terms | `statements` (`schema.ts:830-846`) |
| Officeholder spine | Offices, persons (Wikidata QIDs), terms with start/end dates and party; heads of state/government from Wikidata; cabinets from a sharded CIA World Leaders crawl | `offices`/`persons`/`terms` (`schema.ts:90-146`), `src/lib/factbook/officeholders-sync.ts`, `cia-cabinets-sync.ts` |
| Elections | Election dates, types, turnout (International IDEA, ~54% match rate), registered voters, per-party results and seats; IPU electoral-system families per chamber | `elections`/`election_results` (`schema.ts:232-272`), `governmentBodies.electoralSystemFamily` (`schema.ts:70-87`) |
| Constitutions | Full text + structured articles for ~186 of 253 jurisdictions; per-topic excerpt index over the Constitute ontology (cross-country "how do constitutions handle X" queries with no external calls) | `constitutions`, `constitution_topic_excerpts` (`schema.ts:274-337`), `src/lib/db/queries-constitution.ts` |
| Regime taxonomy | Bjørnskov-Rode/CGV regime layer ingested from QoG (Jan 2026 vintage), 6 buckets, with provenance and override notes | `government_taxonomies` (`schema.ts:857-894`), `src/lib/government-taxonomy/` |
| Longitudinal indicators | Multi-year native-scale series: V-Dem back to 1789, WGI 1996+, HDI 1990+, CPI 2012+, Freedom House 2003+ — with real download adapters | `indicator_history` (`schema.ts:1131-1171`), `src/lib/ci/history-adapters.ts` |
| Party positions | V-Party ideology (economic left-right, anti-pluralism, populism) matched to seat-holding parties, confidence-gated | `party_positions` (`schema.ts:160-230`) |
| Event records | Pulse v2: clustered events with 61-category taxonomy, severity tiers, per-event source lists, 3-vendor classifier agreement labels, human-review audit trail, 10-case historical backtest harness | `pulse_events_v2` and siblings (`schema.ts:1515-1802`) |
| Organizations | 18 IGOs with membership join dates | `organizations`/`organization_memberships` (`schema.ts:1329-1366`) |

### 3.2 The comparative-advantage principle [INFERENCE]

Three kinds of measurement exist in this space:

1. **Judgment measurement** — expert-coded or model-derived assessments of latent concepts ("how democratic is X?"). Crowded, credentialed incumbents: V-Dem (~30M coded data points, published measurement model), Freedom House, WGI, BTI, EIU. Civica cannot out-judge them and should not try. The current Index is a derivative of this kind.
2. **Fact measurement** — dated, documentable events and states: who holds office, when power last changed hands via an election, what Article 64 says, whether a term limit was extended. Auditable to a source and a date. The incumbents here are *stale or slow*: the Database of Political Institutions' last full update is 2020; Archigos leader data ends 2015; the Comparative Constitutions Project updates on academic cycles. **A living, provenance-first fact layer is genuinely scarce**, and Civica already runs the machinery for it.
3. **Meta-measurement** — measuring the measurement ecosystem itself: where independent raters agree, where they diverge, how much they revise. The academic literature compares indices in one-off papers (Boese 2019; Skaaning 2018; the Little–Meng vs. V-Dem exchange, 2024); no one maintains a living, country-level concordance surface. Civica's whole identity — one fact, many sources, disagreement preserved — extends naturally from facts to raters.

**[PROPOSAL] Design rule for any future original Civica measure:** it must be built from kind 2 or kind 3. Kind-1 constructs are welcome on the site only as clearly attributed upstream displays. This single rule encodes the resolution's entire critique and keeps the door open for original work.

---

## 4. Candidate designs

**Plain language:** Six candidates, from "keep the score" to "publish no score at all." Each is described with the exact claim it would make, why it isn't already available elsewhere, how it would be computed and validated, what could go wrong, and what would force its retirement. They are deliberately different in kind — a composite, a dashboard, a meta-measure, a fact ledger, a text-vs-practice pairing, and an event chronicle.

Baselines used throughout §4–5:

- **B1 — single best input:** V-Dem Liberal Democracy Index, rescaled ×100. The null hypothesis for any governance-quality claim.
- **B2 — equal-weight average** of the four current indicators. The null hypothesis for any weighting scheme (Kim's "least controversial" default in the JRC literature).
- **B3 — no derived measure:** raw upstream display. The null product.

### K1 — The status-quo composite, hardened to its own spec

- **Construct & claim:** "General governance quality," 0–100, quarterly: *country X's governing institutions score S, higher is stronger.* The steelman version completes everything the methodology promises: real full-coverage ingestion, PCA re-run on the 2000–2024 panel, V-Dem's published uncertainty wired into the Monte Carlo with correlated error draws, source-substitution sensitivity tests, back-cast series.
- **Why it might add value:** one orientation number with better uncertainty honesty and versioning discipline than Freedom House's popular 0–100 score; a single API field for embeds and journalism.
- **Mechanics:** unit = country-quarter; inputs = the four upstream indices; transformation = fixed-bound normalize → weighted mean; uncertainty = MC with per-source published σ and estimated error correlations; missingness = current mandatory/partial rules; versioning = current vintage discipline.
- **Normative choices & misuse:** the weights, the band cutoffs, and the very act of totalizing "governance" into one number are editorial choices wearing a lab coat. Misuse mode: league-table journalism, government press offices citing band changes.
- **The problem that hardening cannot fix [INFERENCE]:** every input is public. The composite's information content beyond its inputs is zero by construction — not approximately, exactly. Its only non-derivative contributions (interval honesty, vintaging) are presentation-layer properties detachable from the score (resolution §1.3, endorsed). It also inherits every future methodology controversy of four upstream projects simultaneously.
- **Falsification/retirement criteria:** see G1 in §5 — already failed. Retained in the tournament to demonstrate the gates are fair, not rigged.
- **Minimum research artifact if it survived:** the replication package already promised for Q3 2026.

### K2 — Governance Evidence Dashboard (the resolution's replacement)

- **Construct & claim:** none — and that is the point. *"Here is what the major measurement projects say about X, on their own scales, with vintage, license, uncertainty where published, and disagreement visible."*
- **Why it adds value without measuring:** the value is editorial and infrastructural — the same value OWID provides. Nobody currently shows V-Dem, WGI, Freedom House, CPI, and RSF side-by-side with per-value provenance dots, native uncertainty, and a disputes trail. It converts Civica's reconciliation UX (SourceDot, alternates panel) to judgment data *without resolving* the judgments — resolution is only for facts (the reconciliation page already draws this line at `content/methodology-reconciliation.md`, "Out of scope").
- **Mechanics:** unit = country × indicator × year; cadence = each source's release cycle; inputs = full-coverage ingestion of ~7 indicator families (the real adapters `history-adapters.ts` already prototypes); no transformation by default — native scales canonical, an off-by-default 0–100 visual-comparison toggle with a "not a Civica score" disclosure, never in the API (resolution §2.4, endorsed); uncertainty = pass-through only; missingness = shown, never imputed; versioning = source vintages + quarterly page snapshots.
- **Misuse risks:** low. Directionality confusion (Freedom House ratings run inverted) — must be labeled per-indicator. Readers may still mentally average the row of numbers; the design cannot prevent arithmetic in heads, only decline to endorse it.
- **Falsification/retirement:** not applicable (no claim). Acceptance is data-engineering QA (§5, gates G2/G4/G6 only).
- **Minimum artifact:** the page itself plus a "how to read these sources" methods note.

### K3 — Measurement Concordance layer ("where the raters agree")

- **Construct & exact claim:** *meta-measurement of expert consensus.* For each country and each governance construct family (electoral democracy, civil liberties, rule of law, corruption), Civica reports: (a) each independent source's percentile rank of that country within common coverage; (b) a **concordance profile** — the spread of those percentiles (e.g., min–max range and IQR); (c) categorical regime-label agreement across V-Dem RoW, BR/CGV, and Freedom House status. The claim: *"the major measurement projects place Denmark within 3 percentile points of each other; they place Country Y 22 points apart — here is exactly who diverges and on what."* It grades the measurers' agreement, never the country's virtue.
- **Why this isn't already available:** index-comparison exists as static academic papers (Boese 2019; Skaaning 2018; Munck & Verkuilen 2002's framework; the 2024 PS symposium on measuring backsliding), typically at the aggregate level ("the indices correlate at 0.85"). A maintained, country-level, drill-downable concordance surface — updated each release cycle, with the disagreeing values shown on native scales — does not exist anywhere. It is also the intellectually honest successor to the composite: where the Index averaged disagreement away, this measures it.
- **Mechanics:** unit = country × construct family × year. Cadence = annual (source releases), computed per vintage. Inputs = the K2 ingestion (already required) — V-Dem, FH, WGI, CPI at minimum; BTI adds a fifth rater (license check required); plus the already-ingested RoW and BR/CGV regime labels. Transformations: percentile ranks computed *within the common-coverage country set per source pair* (avoids coverage artifacts); disagreement = range and IQR of percentiles; categorical concordance via a published RoW↔CGV↔FH mapping table. Uncertainty: bootstrap over source subsets (drop-one-source) — publish concordance only when stable; where V-Dem publishes measurement intervals, display them as within-source uncertainty alongside between-source spread. Missingness: profiles require ≥3 sources for the construct; below that, "insufficient rater coverage," never imputed. Versioning: annual vintages, methodology-versioned like reconciliation.
- **Normative choices & misuse risks:** choosing the rater set is editorial (criteria must be published: independent methodology, global coverage, public data, named institution). Misuse #1: readers equating "contested" with "bad" — mitigated by copy that frames disagreement as *measurement difficulty* and by showing the actual diverging values. Misuse #2: autocracies weaponizing "even the experts disagree about us" as a legitimacy shield — real, unavoidable in part; mitigated because the drill-down shows *what* they disagree about (often: sources using older data vs. newer, or de jure vs. de facto emphasis), which is less quotable than a naked "contested" badge. Misuse #3: reading rater convergence as truth — convergence can reflect shared blind spots (raters partially train on each other); the methods page must say so.
- **Falsification & retirement criteria [PROPOSAL, pre-registered]:** (i) *Artifact test:* between-source disagreement is mechanically larger mid-scale (raters agree Denmark ≈ top, North Korea ≈ bottom; the middle is where they can diverge). Regress the concordance measure on distance-from-scale-midpoint; if R² ≥ 0.7, the layer is mostly restating "this country is mid-scale" and must not ship as a highlighted measure. (ii) *Stability test:* drop-one-source changes the concordance tercile for > 15% of countries → the measure is a rater-set artifact → don't ship. (iii) *Expert validity test:* fails G3 twice (below) → retire to an internal diagnostic.
- **Validation design:** assemble, before computing anything, a list of ~20 "known contested" country-assessments (documented in the measurement literature and the Little–Meng exchange: e.g., cases where V-Dem and Freedom House trajectories diverge) and ~20 "consensus" cases, via 3+ external comparativists; the concordance measure must separate the two lists with AUC ≥ 0.80. Baselines it must beat: the midpoint-distance artifact predictor, and "just show V-Dem's own uncertainty interval."
- **Presentation:** a "Source agreement" panel per country — dot-strip of percentile placements per rater, one row per construct; chips like "5 of 5 sources within 6 points" / "sources diverge (range 24 points)." No grades, no composite concordance number for the country as a whole in v1.
- **Minimum viable research artifact:** a methods note + dataset release ("Civica Concordance v0.1, annual, N countries × 4 constructs × k raters"), explicitly experimental, with the artifact-test results published in the note itself.

### K4 — Power & Transfer Ledger ("the receipts of power")

- **Construct & exact claims (plural, all factual):** per country, continuously maintained: (1) **date of the most recent alternation** — the last time control of the chief executive changed hands to a different person *and* party/coalition as the direct result of an election; (2) **current chief-executive tenure** (days, from `terms`); (3) **term-limit status** — none / bound and within limits / limit modified while in office (event-coded with the constitutional text before and after) / limit expired-and-departed; (4) **transfer record** — count and dates of peaceful electoral transfers over trailing 30 years. Claim form: *"Executive power in Cameroon last changed hands via election on [date] — [n] years ago"* with statement-level sources on every component. This is the minimalist, Przeworski-style alternation concept — democracy's most auditable observable — published as dated facts rather than as a score.
- **Why this isn't already available:** Archigos (the academic standard for leader spells) ends in 2015; REIGN, its successor, stopped updating circa 2021; DPI's institutional variables sit at 2020. Wikipedia has the raw material but no structure, no provenance discipline, no stable citation handles, and no cross-country queryability. **A living alternation/term-limit ledger with per-row provenance and quarterly vintages would be, immediately, the freshest structured dataset of its kind** — and it is assembled almost entirely from tables Civica already maintains (`terms`, `elections`, `election_results`, `constitution_topic_excerpts` for term-limit clauses, `statements` for provenance).
- **Mechanics:** unit = country (state variables) + event (transfers, term-limit modifications). Cadence = event-driven — the officeholder syncs already run on crons; a transfer is detected when a `terms` row closes and a successor opens. Inputs: existing tables + a hand-written coding rulebook. Transformations: none beyond date arithmetic and rule application — **no aggregation into any score, ever.** Uncertainty: not stochastic; ambiguity is handled by explicit rules plus a `contested` flag with prose (interim leaders, dual executives, disputed elections, collective heads like Switzerland's Federal Council — the taxonomy override table already models this case). Missingness: countries with incomplete term histories get "record begins [year]," never an imputed zero. Versioning: the rulebook is methodology-versioned; the ledger gets quarterly vintages like reconciled facts.
- **Normative choices & misuse risks:** the definition of "alternation" is a normative commitment (person AND party? what counts as the same coalition? indirect elections? monarch-appointed PMs?) — the rulebook must be published and every edge case logged, exactly as the reconciliation worked-examples pattern does. Misuse #1: "long tenure = autocracy" misreads (Merkel: 16 years, four elections, then alternation) — mitigated by leading with *alternation via election*, not tenure, and by showing election events alongside. Misuse #2: opposition/incumbent talking-point use around elections — inherent to publishing facts; provenance is the defense. This candidate deliberately makes **no claim about democracy quality**; the methods page must state that alternation is neither necessary nor sufficient for democratic governance (Japan's LDP dominance; Botswana pre-2024).
- **Falsification & retirement criteria [PROPOSAL, pre-registered]:** (i) *Reliability:* two independent coders (or agent + human) apply the rulebook to a stratified 40-country sample; chance-corrected agreement (Krippendorff's α) must reach ≥ 0.8 on alternation dates and term-limit status, else the definitions are too soft to publish. (ii) *Historical validity:* on the overlap window, agreement with Archigos leader-spell transitions ≥ 95%, every disagreement adjudicated in a public log. (iii) *Freshness SLO:* a real-world transfer must be reflected within 14 days for ≥ 90% of events over two quarters, else the "living dataset" claim fails and the ledger reverts to vintage-only publication. (iv) Any sustained failure → retire the derived states, keep the raw officeholder data.
- **Validation design:** beyond (i)–(iii): audit 100 random published rows to their cited statements (target ≥ 98% verifiable); reconcile against NELDA election records for transfer-triggering elections.
- **Presentation:** a "Power transfers" block on the country page: timeline of transfers with party colors (components exist), a plain sentence for the headline fact, term-limit status with the constitutional excerpt one click away. Site-wide: a sortable *facts table* (dates, not ranks) — sorting by "years since alternation" is a factual sort, not a league table; copy must not attach valence.
- **Minimum viable research artifact:** rulebook + dataset release + validation log ("Civica Power Transfer Ledger v0.1"), a genuinely citable dataset paper candidate (the pattern of Archigos's own dataset paper in *Journal of Peace Research*).

### K5 — Constitution ↔ practice pairing (research track)

- **Construct & claim:** for a small set of constitutional commitments with clean V-Dem practice counterparts (press freedom clauses ↔ `v2mecenefm`-family; judicial independence clauses ↔ `v2juhcind`/`v2juncind`; term limits ↔ K4's ledger; election frequency ↔ `elections`), display the paired evidence: *"X's constitution guarantees Y (Art. N, excerpted); observed practice per V-Dem is Z."* The research literature calls the aggregate phenomenon "sham constitutions" (Law & Versteeg 2013); Civica should publish the **pairing**, not the epithet and not a gap score, at least until validation.
- **Why not already available:** CCP and V-Dem each hold half of this; the join exists only inside a handful of academic papers, static as of their publication date. Civica has both halves live (`constitution_topic_excerpts` + `indicator_history`) and can keep the join current as constitutions are amended.
- **Mechanics:** unit = country × commitment; cadence = annual + amendment-driven; the load-bearing input is a **mapping codebook** (Constitute topic → V-Dem indicator) with inter-coder validation before anything ships. Uncertainty: V-Dem's published intervals shown; the constitutional side is text, shown verbatim. Missingness: no constitution text (67 of 253) or no matching indicator → pairing absent.
- **Risks & normative choices:** mapping validity is the whole game — a topic-tagged excerpt may not mean what the tag implies; qualifier clauses ("except as provided by law") gut commitments in ways topic tags miss. Misuse: "hypocrisy rankings" — avoided by publishing pairings country-by-country with no aggregate, and no adjective.
- **Falsification/retirement:** mapping codebook inter-coder α ≥ 0.7 on a 30-pairing sample, else do not publish; expert review (constitutional scholar) of 20 pairings with ≥ 80% "fair pairing" verdicts, else revise or drop the offending commitment families.
- **Minimum artifact:** methods note + the codebook + 10 worked country examples. Explicitly experimental; ships under `/research/` if at all.

### K6 — Pulse as a validated event chronicle (not a score)

- **Construct & claim:** per event, not per country: *"On [date], [event] of category C and severity tier T occurred in X, per sources [...], classifier agreement [all/two-of-three], human-reviewed [y/n]."* The dimensional deltas (the [−15,+10] clamped sums) stay internal/experimental; the public product is the chronicle — a governance-events layer analogous to ACLED's role for conflict events, with Civica's provenance discipline.
- **Why:** the event tables, 61-category taxonomy, three-vendor ensemble with agreement labels, human-review audit trail, and the 10-case backtest harness already exist (`schema.ts:1515-1802`; `src/lib/pulse/v2/`). The weakest link is the input feed (GDELT-heavy vs. the specialist-first design) and the unrun validation. The resolution's "validate, don't expand" allocation is right; the framing here sharpens *what graduates*: events can graduate case-by-case (per-event provenance is checkable); country-level deltas require the full backtest gate (8/10 named cases) *plus* a false-positive audit before they are anything but experimental.
- **Falsification/retirement:** the existing locked graduation gate (≥ 8/10 backtest cases, `site-state.ts:180-181`); plus [PROPOSAL] a stratified 100-event human audit with ≤ 10% material misclassification (wrong country, wrong direction, or non-event) — fail either twice → the chronicle stays internal.
- **Misuse risks:** event coverage asymmetry (closed regimes under-report — already disclosed on the methodology page); the chronicle must show "coverage confidence" per country, reusing the RSF-tier logic already implemented in `corroborate.ts`.

### Candidate comparison [INFERENCE]

| | Claim type | New information vs. B1–B3? | Buildable from existing assets | Validation cost | Misuse surface | Scholarly upside |
|---|---|---|---|---|---|---|
| K1 composite | judgment (derived) | **None by construction** | needs real ingestion | n/a (fails G1) | high (league tables) | none |
| K2 dashboard | none | n/a (presentation value) | needs real ingestion | low (QA only) | low | indirect (infrastructure citation) |
| K3 concordance | meta-measurement | **yes** — no living equivalent exists | mostly (needs 1–2 more raters) | medium | medium (contested≠bad) | high — measurement literature is active |
| K4 transfer ledger | fact | **yes** — incumbents stale (Archigos 2015, DPI 2020) | **almost entirely** | medium (historical cross-check) | medium (tenure misreads) | high — dataset-paper grade |
| K5 constitution↔practice | fact + judgment pairing | yes — join not maintained anywhere | yes, plus codebook | high (mapping validity) | high if aggregated; low as pairing | highest, slowest |
| K6 event chronicle | fact (event) | partial — vs. ACLED/GDELT it adds governance taxonomy + review + provenance | yes | high (backtest + audit) | medium | medium |

---

## 5. Validation tournament and decision thresholds

**Plain language:** A fair contest with published rules, decided before any results are computed, so nobody can move the goalposts. Every candidate must clear six gates; the current Index competes too. One gate — "does it contain any information not already available for free?" — can be judged today for the Index, and it fails, because the Index is arithmetic on other people's numbers. The other candidates can genuinely win *or lose*: the rules below spell out exactly what failure looks like, and if everything fails, Civica ships the dashboard alone.

### 5.1 Tournament discipline [PROPOSAL]

1. **Pre-registration.** The gates, thresholds, rater sets, contested/consensus country lists, and audit sample sizes below are committed to the repo (this document plus a machine-readable `tournament-spec` file) *before* any candidate's results are computed. Amendments require a logged owner decision.
2. **Baselines always run.** Every quantitative test is reported against B1 (V-Dem alone), B2 (equal weights), and B3 (no measure) — a candidate that cannot beat a baseline on its own claimed value is retired regardless of how it performs in absolute terms.
3. **Separation of roles.** Agents build datasets and run computations; humans (external experts, the owner) supply the validity judgments (contested-case lists, pairing fairness, comprehension tests). Model consensus — including any multi-LLM panel — is treated as *screening*, never as validation. An LLM vote cannot pass gate G3 for any candidate.
4. **Shadow period.** Nothing new appears on public country pages until it has run one full quarterly cycle in shadow (computed, versioned, internally visible, publicly absent).

### 5.2 The gates

Each gate is pass/fail with a measurable threshold. **Ship publicly** requires all six. **Publish as experimental research note** requires G2 + G5 + G6 with G3 pending (one cycle grace). **Retire** on failing G1 once, or G3 twice.

**G1 — Incremental information.** The candidate's headline output must not be reproducible from already-public sources.
*Test:* regress (5-fold cross-validated) the candidate's per-country output on the standard public set (V-Dem LDI + the six WGI + FH + CPI). Fail if out-of-sample R² ≥ 0.90 for continuous outputs; for categorical/event outputs, fail if a trivial classifier over the same inputs reproduces ≥ 95% of published states. *Rationale:* below this bar the candidate is a repackaging, and Ravallion's citation-detachment problem applies.
— K1: **fails identically and permanently** — the score is a deterministic function of the predictor set, R² = 1.0 by construction. No data collection alters this. This is the already-decidable verdict.
— K2: exempt (makes no measurement claim); replaced by fidelity QA: 100% of displayed values must match upstream source files byte-for-value, verified per release.
— K3: passes only if disagreement is not a mechanical artifact — the pre-registered midpoint-artifact test (R² of concordance on distance-from-midpoint < 0.7) plus this gate's regression (fail if percentile-spread is ≥ 0.90 predictable from the public level variables).
— K4: the *states* are derivable in principle from public records — the incremental value claimed is freshness + provenance + structure, so G1 for K4 is reframed measurably: at evaluation date, ≥ 30% of countries' ledger states must differ from, or be absent in, the most recent public structured dataset (DPI 2020 / Archigos 2015 / REIGN final vintage) — i.e., the ledger must demonstrably contain facts the stale incumbents lack.
— K5/K6: event/pairing novelty audited by sampling: ≥ 50% of published pairings/events not present in any single public structured source.

**G2 — Reliability & stability.** The output must be a property of the world, not of arbitrary spec choices.
*Tests:* (a) drop-one-source / spec-variant perturbation: headline output tercile changes for < 10% of countries; rank-order correlation across reasonable spec variants ≥ 0.9 (the Saisana/JRC uncertainty-analysis pattern). (b) For fact candidates (K4–K6): stratified 100-row audit traced to cited statements, ≥ 98% verifiable; inter-coder α ≥ 0.8 (K4) / ≥ 0.7 (K5 mapping). (c) Reproducibility: an agent re-runs the full pipeline from archived payloads and reproduces the vintage bit-for-bit (the reconciliation layer already sets this standard).

**G3 — External validity.** The candidate must agree with ground truth it did not consume.
— K3: separates the expert-assembled contested vs. consensus lists with AUC ≥ 0.80, beating both the midpoint-artifact baseline and "V-Dem's own interval width" baseline by ≥ 0.05 AUC.
— K4: ≥ 95% agreement with Archigos/NELDA on the historical overlap window (30 countries × 30 years sample), all disagreements adjudicated publicly.
— K5: ≥ 80% "fair pairing" verdicts from an external constitutional scholar on 20 sampled pairings.
— K6: the locked backtest gate (≥ 8/10 named historical cases) plus ≤ 10% material-error rate on a 100-event human audit.
— K1 (for fairness, its survival condition stated): demonstrate incremental predictive validity — out-of-sample forecasting of next-year regime-transition events (RoW category changes) with ΔAUC ≥ +0.05 over B1. [INFERENCE] It cannot in principle: a fixed monotone function of the baselines cannot contain predictive information the baselines lack. Stated so the gate is explicit, not rhetorical.

**G4 — Coverage & missingness.** Publishable for ≥ 150 jurisdictions, or launched with explicit scope ("record begins…", "insufficient rater coverage") — silent imputation is disqualifying. Coverage asymmetries that correlate with regime type (Pulse's closed-regime problem, K3's rater-coverage bias toward researched countries) must be quantified in the methods note.

**G5 — Interpretability & misuse resistance.** (a) Comprehension: ≥ 8 of 10 non-expert readers, shown the country-page presentation cold, restate the claim correctly and answer one misuse probe correctly ("does this mean country X is better governed than Y?" — correct answer for K3/K4: "it doesn't say that"). (b) No letter grades, no judgmental band labels, upstream sources named on every surface, a "what this does not mean" line present. (c) The Botswana/Merkel/Japan misread cases render acceptably in review.

**G6 — Sustainability.** One full quarterly cycle unattended: crons run, freshness SLOs met (K4: 14-day transfer reflection ≥ 90%), zero manual patches, licenses verified compatible with public redistribution (note: IDEA turnout and IPU are CC-BY-NC-SA — any K4 surface using them inherits the non-commercial constraint already logged for the project; CPI's CC-BY-ND needs a redistribution-format check; BTI is CC-BY).

### 5.3 Verdict structure and what can be decided today

| Candidate | G1 | G2 | G3 | Decision available now? |
|---|---|---|---|---|
| K1 composite | **Fail (by construction)** | untested (moot) | unpassable in principle | **Yes — retire the public headline now.** No evidence-gathering can change G1. |
| K2 dashboard | exempt | QA-testable | n/a | Yes — ship after ingestion + QA; it is the floor. |
| K3 concordance | testable in ~2 agent-weeks | testable | needs experts (~4–8 human-weeks elapsed) | No — build prototype, run gates. Genuinely can fail (artifact test). |
| K4 transfer ledger | testable immediately (compare vs. DPI/Archigos vintages) | testable | needs Archigos/NELDA cross-check (agent) + adjudication (human) | No — but cheapest path to a win; most tests agent-runnable. |
| K5 pairing | sampling-testable | codebook α is the gate | needs a constitutional scholar | No — research track; slowest. |
| K6 chronicle | sampling-testable | audit-testable | backtest is built but unrun | No — **run the backtest**; it exists and is the named gate. |

**[PROPOSAL] Recommended sequencing:** retire K1's public surface and ship K2 (these need no tournament); run K4 and K6 gates first (most agent-completable), K3 second, K5 as unhurried research. Recommended *expectation-setting*: K4 is the most likely first survivor; K3 has the highest chance of dying honorably at its artifact test — that outcome should be published either way, because "we tested it and it was an artifact" is itself citable methods work and exactly the reputation Civica wants.

**If no candidate passes:** Civica launches with the dashboard, the reconciliation engine, and the (validated or shelved) event chronicle — which is a strong, honest product. The tournament is designed so this outcome is acceptable, not embarrassing; §8's retirement rules make the same true after launch.

---

## 6. Recommended public presentation and language

**Plain language:** How the site talks after the change: no grades, no verdicts, receipts everywhere. Countries are never called "failed" or "exceptional"; sources are named; disagreement is shown, not averaged away. Draft copy below is in English first, per the owner's standing workflow; cascade after approval.

### 6.1 Principles [PROPOSAL]

1. **Attribution over assertion.** Every judgment number on the site is visually owned by its upstream author ("V-Dem: 0.86 (0.82–0.89), 2025 release"), rendered on the native scale, with the SourceDot/alternates-panel pattern extended to judgment data.
2. **No grading register, anywhere.** Retire A–F letters, the tier labels ("Exceptional" … "Failed / authoritarian"), and the tier color ramp *as applied to countries*. The tier tokens can survive for genuinely evaluative non-country uses; countries get neutral encodings (position dots on distribution strips, party colors, source colors). This goes one step beyond the resolution: the leaderboard's judgmental government-type shorthand next to scores ("Dictatorship," "Authoritarian" — `civica-index/page.tsx`, `shortGovLabel()`) should be replaced by the neutral taxonomy labels the BR/CGV layer already provides.
3. **Disagreement is content.** Where sources diverge, the divergence is the story — shown as parallel values, never resolved editorially for judgment data (resolution kept: reconciliation resolves *facts* only).
4. **Facts may headline; judgments may not.** K4-style dated facts can be large type on a country page ("Last electoral transfer of power: March 2022"). Third-party judgments render in the evidence panel at equal visual weight to each other.
5. **Every derived surface carries a "what this does not mean" line.** One sentence, always visible, not a tooltip.

### 6.2 Naming and page architecture [PROPOSAL]

- Replace `/civica-index` with **`/governance`** ("Governance evidence") — of the resolution's candidates, the shortest and least brand-forward, correct since the content is other people's measurements. The Civica-original fact products get plain names: **"Power transfers"** (K4), **"Source agreement"** (K3, if it survives), **"Governance events"** (K6).
- The retired composite follows the resolution's archive treatment (§2.8): deprecated namespace, versioned retrieval only, deprecation notice in every response, absent from country pages, defaults, embeds, and search surfaces. The embed widget drops score/band/CP entirely (it currently also has drifted tier cutoffs and reads the cron-less legacy Pulse table — `embed/[slug]/route.ts:271-277,185-189`).

### 6.3 Draft reader-facing copy (English first)

- Page lede: *"How is [Country] governed, according to the people who measure it? Civica shows the major research projects' assessments side by side — on their own scales, with their own uncertainty, and with every disagreement visible. Civica does not average them into a grade."*
- Uncertainty pass-through: *"V-Dem publishes a credible interval with every estimate; the bar shows it. Sources without published uncertainty are marked 'no published uncertainty interval.'"* (The ±5% manufactured interval is retired with the composite.)
- K3 chip copy: *"Sources agree closely"* / *"Sources diverge — see who and why"*; the does-not-mean line: *"Disagreement means this country is hard to measure, not that it is badly governed."*
- K4 headline pattern: *"Executive power last changed hands through an election on {date} ({n} years ago)."* Does-not-mean line: *"A long time since alternation is a fact about continuity in office, not by itself a verdict on democracy — see how this is coded."*
- Archive notice (adopt the resolution's text nearly verbatim): *"Deprecated beta composite — not recommended for citation. Retired before launch because its inputs were highly inter-correlated third-party indices (r = 0.74–0.98) and the composite added no measurement information beyond its sources."*

### 6.4 Continuity with the design system [FACT-anchored]

Everything above composes from existing primitives: `SourceDot` (extended with a per-source hue or label), the alternates panel, `Chip` tonal variants for agreement chips, `Banner variant="info"` for does-not-mean lines, distribution strips as a new design-system component (per the closed-set mandate: token/component first, then use). The hemicycle, timeline, and party-color components cover K4's transfer timeline.

---

## 7. Research, data, and implementation prerequisites

**Plain language:** What has to exist before any of this can happen — mostly: real data pipelines to replace the hand-typed tables, a few validation datasets, some license homework, and two or three human experts.

### 7.1 Data engineering (required for every path, including dashboard-only) [FACT-anchored]

1. **Real ingestion for the indicator families.** Replace the six hardcoded adapters with live full-coverage syncs. The repo already contains the pattern: `src/lib/ci/history-adapters.ts` pulls OWID grapher CSVs (V-Dem, HDI, CPI, Freedom House) and the World Bank API (WGI) with retry/backoff, multi-year, ISO3-keyed. Extend to: all six WGI components (Government Effectiveness is also the deferred 5th-dimension test's missing input), FH subcategory scores, RSF. Stamp via `markSourcesSynced()` per the repo invariant.
2. **Judgment-data uncertainty pass-through.** Ingest V-Dem's published credible intervals (`*_codelow`/`*_codehigh` columns in the country-year dataset) alongside point estimates — schema extension to `indicator_history` (low/high columns).
3. **Retire the stale serving paths regardless of product decisions:** the legacy scalar Pulse reads in `rankings?sort=cp` and the embed; the embed's divergent tier cutoffs; the v1.0 methodology rows' ambiguity (freeze under an explicit archive version label).

### 7.2 Validation datasets and instruments [PROPOSAL]

- **Archigos v4.1** (leader spells through 2015) and **NELDA** (national elections, competitiveness flags) for K4's historical cross-check; **REIGN** final vintage as a secondary. All are free academic downloads; verify current hosting at implementation time.
- **DPI 2020** (IDB) as the staleness benchmark K4 must beat (G1-K4).
- **Contested/consensus country lists** for K3: assembled by external experts *before* any concordance number is computed; the Little–Meng (2024) exchange and Boese (2019) provide seed cases.
- **Reader comprehension protocol** for G5: 10 non-expert readers, scripted tasks, run by a human (the owner can recruit; agents draft the instrument).
- **Rater-set criteria memo** for K3 (what qualifies as an independent rater) — a one-page methodology resolution per the project's research-lab discipline.

### 7.3 Licensing and legal homework [FACT + PROPOSAL]

| Source | License (as understood; verify before shipping) | Constraint |
|---|---|---|
| V-Dem | CC BY-SA 4.0 (dataset); free academic use | attribution + share-alike on redistributed data |
| WGI | CC BY 4.0 | attribution |
| Freedom House | free use with attribution; redistribution format to verify | check bulk-redistribution terms |
| TI CPI | CC BY-ND 4.0 | **no derivatives** — native-scale display fine; any transformed/normalized redistribution needs review (another independent reason the 0–100 toggle stays out of the API) |
| BTI (if added as K3 rater) | CC BY 4.0 | attribution |
| RSF | verify | — |
| IDEA turnout / IPU / Constitute | CC BY-NC-SA 4.0 | **non-commercial family** — already an owner-accepted constraint (2026-07-05); K4/K5 surfaces inherit it; any future monetization must relicense or remove first |
| Archigos / NELDA / DPI | academic use, citation required | validation-only use is safe; don't redistribute raw |

### 7.4 People [PROPOSAL]

- 2–3 external comparativists (K3 lists, K4 rulebook review) and 1 constitutional scholar (K5) — the "pending external review" posture the site already advertises becomes real here, and the tournament gives reviewers something concrete and bounded to review.
- The owner: naming decision (§6.2), license sign-offs, comprehension-test recruitment, and the retirement decision itself.

---

## 8. Failure modes and explicit retirement rules

**Plain language:** Everything Civica publishes as original measurement carries a public statement of what would prove it wrong and a standing promise to retire it if that happens. This section is that statement, written in advance.

### 8.1 Global rules [PROPOSAL]

1. **Sunset by default.** Every original measure re-passes G2/G3/G6 annually; two consecutive failures on any gate → automatic retirement to the deprecated archive namespace (the resolution's §2.8 semantics), with a public retirement note. Retirement is a planned lifecycle event, not a scandal — the site's credibility grows each time the rule visibly operates.
2. **No silent methodology drift.** Rulebook/rater-set/mapping changes bump the methodology version and re-trigger validation; vintages stay frozen (the reconciliation layer's existing discipline, applied uniformly).
3. **The aggregation firewall.** No Civica surface may sum, average, or grade across (a) K3 constructs, (b) K4 facts, (c) K6 events, or (d) upstream judgment indices — the single rule that prevents the composite from quietly reassembling itself. Enforced by review checklist and, where possible, by lint (no arithmetic across the relevant fields in display code).

### 8.2 Per-candidate failure modes [PROPOSAL]

- **K2 dashboard:** *failure mode* = value drift vs. upstream (a displayed number no longer matches the source's current file) or license breach. *Rule:* per-release fidelity QA; any systematic mismatch → pull the indicator until fixed.
- **K3 concordance:** *failure modes* = midpoint artifact (pre-registered R² test), rater-set fragility (drop-one-source instability), "contested" misread in the wild (monitor citations/social pickup during shadow + first two quarters). *Rules:* artifact/stability tests annually; if press coverage systematically reads concordance as country quality despite the copy, demote from country pages to the methods section — presentation failure is a real failure.
- **K4 ledger:** *failure modes* = coding-rule ambiguity blowups (α < 0.8), freshness SLO misses, edge-case embarrassments (interim leaders, disputed elections coded confidently). *Rules:* the `contested` flag is mandatory where rules don't decide; two quarters of missed freshness SLOs → drop the "living" claim and publish vintage-only; any published row found unverifiable against its citations → correction-log entry (infrastructure exists) and audit-sample re-run.
- **K5 pairing:** *failure mode* = mapping invalidity (a pairing implies a commitment the text doesn't make). *Rule:* scholar review before launch and per annual V-Dem release; any commitment family below 80% fair-pairing → unpublish that family.
- **K6 chronicle:** *failure modes* = the known ones, already partially disclosed: closed-regime under-coverage, GDELT noise, classifier drift when vendors change models. *Rules:* the locked 8/10 backtest gate; 100-event quarterly audits ≤ 10% material error; vendor/model changes re-trigger the backtest (the harness already pins Anthropic-only precisely to keep the yardstick stable — `src/lib/pulse/v2/backtest.ts:68-87`).
- **K1 composite (post-retirement):** *failure mode* = zombie citation of archived beta scores. *Rule:* deprecation metadata in every archival response; annual check that no live surface links the archive.

---

## 9. Atomic master-plan recommendations

**Plain language:** The work, cut into tasks an agent can grind through, each with an objective "done when" test — plus the short list of things only humans can do. Ordered so early tasks are useful under every outcome of the tournament.

Legend: **[agent]** = completable autonomously in this repo; **[human]** = requires owner/external judgment; **[agent→human]** = agent prepares, human decides.

### Phase A — Decisions and hygiene (independent of the tournament)

- **A1 [human] Adopt/modify the retirement decision.** Owner reads §1–2 and the resolution; records the decision as a methodology resolution doc. *Done when:* a signed-off resolution exists in `plan/` naming what retires and what replaces it.
- **A2 [agent] Correct public prose that overclaims.** Methodology page §4 (panel claim), §5 (published-uncertainty claim), §3 (anchored z-transform), §10/Pulse (specialist-feeds framing), hero "190+ sovereign states" metadata. *Done when:* `npm run validate:content-templates` passes and no public sentence asserts an unimplemented mechanism (checklist of the five items above, each verified by grep/render).
- **A3 [agent] Kill the stale/drifted serving paths.** Remove `sort=cp` legacy-Pulse reads and the embed's CP field; align or remove embed tier logic; label v1.0 methodology rows as archived. *Done when:* no API/embed surface reads `pulse_daily_scores`; `grep -rn "getTier" src/app/embed` returns nothing or matches canonical cutoffs; tests added for band boundaries.
- **A4 [agent] Add the missing scoring tests** (bands/tiers boundaries, completeness rules, Monte Carlo percentiles, decouple) so whatever survives is guarded. *Done when:* `npm test` covers each listed module with boundary cases; the embed-drift class of bug is reproducible as a failing test against the old code.

### Phase B — Data engineering (needed for dashboard and all candidates)

- **B1 [agent] Live full-coverage ingestion** for V-Dem (with credible intervals), all six WGI, FH (with subcategories), CPI, RSF via the `history-adapters.ts` pattern. *Done when:* ≥ 190 jurisdictions have current-vintage rows per family in `indicator_history` (count query), sources stamped via `markSourcesSynced()`, `validate:sync-freshness` passes.
- **B2 [agent] Uncertainty pass-through schema + display.** *Done when:* V-Dem values render with published intervals for ≥ 170 countries; sources without intervals render the explicit absence flag; zero Civica-manufactured intervals remain in display code (grep for `defaultUncertaintyV2` usages outside archive paths).
- **B3 [agent→human] License verification table** (§7.3) filled with current terms, flagged decisions to owner. *Done when:* each row carries a source-of-truth URL and a go/no-go; owner has signed the CPI-ND and NC-family calls.

### Phase C — Dashboard (the floor product)

- **C1 [agent] Build `/governance` evidence panels** per §6 (native scales, provenance dots, disagreement display, off-by-default toggle with disclosure, not in API). *Done when:* design-token validation passes; the five §6.3 copy elements render; API exposes native values + vintages only.
- **C2 [agent] Archive the composite** per resolution §2.8 semantics. *Done when:* no default surface serves score/band; archival endpoint requires explicit version and returns deprecation metadata; sitemap/search excludes it.
- **C3 [human] Naming + comprehension check.** Owner picks the page name; 10-reader comprehension test on the shipped panels. *Done when:* ≥ 8/10 correct restatements recorded.

### Phase D — Tournament infrastructure and prototypes

- **D1 [agent] Commit the machine-readable tournament spec** (gates, thresholds, sample sizes from §5) before any results. *Done when:* spec file exists with a content hash recorded in the decisions log, dated prior to all result artifacts.
- **D2 [agent] K4 prototype.** Coding rulebook draft + ledger computation from `terms`/`elections`/`election_results` + provenance joins; contested-flag logic. *Done when:* ledger rows exist for every country with ≥ 1 term row; 100% of rows carry statement citations; rulebook committed; edge-case log (≥ 20 named cases) written.
- **D3 [agent] K4 historical validation run.** Cross-check vs. Archigos/NELDA overlap; produce the agreement stats and adjudication log. *Done when:* agreement ≥ 95% computed and published internally, or a documented failure report exists (either outcome completes the task).
- **D4 [agent] K3 prototype + artifact test.** Percentile concordance over ≥ 4 raters from `indicator_history`; midpoint-artifact regression; drop-one-source stability. *Done when:* profiles computed for ≥ 150 countries and the pre-registered artifact/stability numbers are reported, whatever they show.
- **D5 [human] K3 expert lists + AUC evaluation.** *Done when:* contested/consensus lists (≥ 20 + 20) collected from ≥ 3 experts before D4's numbers are shown to them; AUC computed against the frozen lists.
- **D6 [agent] K6: run the existing backtest** (`npm run backtest:run`) and publish results to the backtest page truthfully. *Done when:* verdicts for all 10 cases are recorded and rendered, pass or fail.
- **D7 [agent→human] K6: 100-event audit.** Agent drafts the sample and pre-fills evidence; human adjudicates material errors. *Done when:* error rate computed against the ≤ 10% gate.
- **D8 [agent] K5 mapping codebook v0** (10 commitment families, worked examples) — research track, no deadline. *Done when:* codebook + 10 worked pairings exist for later scholar review.

### Phase E — Ship/retire decisions

- **E1 [human] Tournament adjudication.** Owner + reviewers apply §5.3 verdicts to the D-phase artifacts. *Done when:* a dated decision doc records ship/experimental/retire per candidate with gate-by-gate results.
- **E2 [agent] Implement survivors** under §6 presentation and §8 rules (per-candidate task breakdowns to be written at that point, per the master-plan discipline).

---

## 10. Sources

### Repository evidence (primary)

Key files cited throughout: `src/lib/ci/dimensions-v2.ts`, `normalize-v2.ts`, `monte-carlo.ts`, `bands.ts`, `tiers.ts`, `calculate-v2.ts`, `calculate.ts`, `history-adapters.ts`; `scripts/ingest-ci-{vdem,wgi,hdi,freedom-house,cpi,gpi}.ts`, `seed-ci-methodology{,-beta}.ts`, `run-backtest.ts`, `divergence-report-ci-v2.ts`; `analysis/phase-5-3/{results.json,correlations.csv,eigenvalues.csv}`; `src/lib/pulse/` (v1) and `src/lib/pulse/v2/` (taxonomy, ensemble, corroborate, decay, score, decouple, backtest); `src/lib/db/schema.ts` (50 tables); `src/lib/factbook/reconcile/resolver.ts`; `content/methodology-civica-index.md`, `methodology-pca-appendix.md`, `methodology-pulse.md`, `methodology-peer-grouping.md`, `methodology-reconciliation.md`; `src/app/api/v1/index/*`, `src/app/embed/[slug]/route.ts`, `src/lib/content/site-state.ts`; `README.md`. The attached joint resolution: `~/Downloads/resolution (1).md`.

### External literature

Cited from reviewer knowledge (cutoff January 2026); verify editions/DOIs at implementation. None of these were consulted post-hoc to fit a conclusion; they are the standard corpus for this problem.

**Composite-index methodology:** Munck, G. & Verkuilen, J. (2002), "Conceptualizing and Measuring Democracy: Evaluating Alternative Indices," *Comparative Political Studies* 35(1): 5–34. — Ravallion, M. (2012), "Mashup Indices of Development," *World Bank Research Observer* 27(1): 1–32. — OECD/JRC (2008), *Handbook on Constructing Composite Indicators*. — Saisana, M., Saltelli, A. & Tarantola, S. (2005), "Uncertainty and Sensitivity Analysis Techniques as Tools for the Quality Assessment of Composite Indicators," *JRSS-A* 168(2): 307–323.

**Democracy/governance measurement and index comparison:** Boese, V. A. (2019), "How (Not) to Measure Democracy," *International Area Studies Review* 22(2): 95–127. — Skaaning, S.-E. (2018), "Different Types of Data and the Validity of Democracy Measures," *Politics and Governance* 6(1). — Little, A. & Meng, A. (2024), "Measuring Democratic Backsliding," *PS: Political Science & Politics* 57(2), and the responses in the same symposium (incl. Knutsen et al.) — the live scholarly debate K3 productizes. — Pemstein, D. et al., "The V-Dem Measurement Model" (V-Dem Working Paper 21; the source of the credible intervals §7.1 passes through). — Coppedge, M. et al., *V-Dem Codebook* (current version). — Lührmann, A., Tannenberg, M. & Lindberg, S. (2018), "Regimes of the World," *Politics and Governance* 6(1). — Kaufmann, D., Kraay, A. & Mastruzzi, M. (2011), "The Worldwide Governance Indicators: Methodology and Analytical Issues," *Hague Journal on the Rule of Law* 3(2). — Treisman, D. (2007), "What Have We Learned About the Causes of Corruption…," *Annual Review of Political Science* 10 (on corruption-measure divergence, relevant to K3).

**Regime classification and alternation (K4):** Przeworski, A. et al. (2000), *Democracy and Development* (the alternation rule). — Cheibub, J. A., Gandhi, J. & Vreeland, J. R. (2010), "Democracy and Dictatorship Revisited," *Public Choice* 143. — Bjørnskov, C. & Rode, M. (2020), "Regime Types and Regime Change: A New Dataset on Democracy, Coups, and Political Institutions," *Review of International Organizations* 15 (already ingested by Civica). — Boix, C., Miller, M. & Rosato, S. (2013), "A Complete Data Set of Political Regimes, 1800–2007," *Comparative Political Studies* 46(12). — Goemans, H., Gleditsch, K. S. & Chiozza, G. (2009), "Introducing Archigos: A Dataset of Political Leaders," *Journal of Peace Research* 46(2). — Hyde, S. & Marinov, N. (2012), "Which Elections Can Be Lost?" (NELDA), *Political Analysis* 20(2). — Cruz, C., Keefer, P. & Scartascini, C., *Database of Political Institutions 2020* (IDB).

**Constitutions (K5):** Elkins, Z., Ginsburg, T. & Melton, J., *The Comparative Constitutions Project / Constitute* (Civica's ingested source). — Law, D. & Versteeg, M. (2013), "Sham Constitutions," *California Law Review* 101: 863. — Chilton, A. & Versteeg, M. (2020), *How Constitutional Rights Matter* (OUP).

**Reference model:** Our World in Data's democracy-data explainers (Herre, B., 2022–) — the presentation posture K2 adopts: upstream indicators surfaced directly, attributed, never recomposited.

---

*End of report. Prepared as a research artifact for owner decision; no repository file other than this one was created or modified.*
