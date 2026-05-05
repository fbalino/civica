# Pulse methodology

<!-- Source: src/app/(reader)/civica-index/methodology/pulse/page.tsx · Extracted 2026-05-04 -->

*Beta — methodology under active validation*

A real-time governance shock monitor layered on top of the quarterly Civica Index. Beta — methodology under active validation.

> **This is an experimental system.** Pulse values are not yet peer-reviewed and should not be cited as authoritative. The pipeline is under active validation; backtesting against historical governance shocks is in progress, with at least 80% of the 10 named test cases required to match expert consensus before the Pulse graduates to publishable status.

---

<a id="what-pulse-is"></a>
## What the Pulse is

The Civica Pulse fills the gap between quarterly Civica Index updates. A coup in March shouldn't wait until the next V-Dem dataset release eighteen months later to register. A peaceful transfer of power shouldn't be invisible until the next quarterly composite. The Pulse classifies governance-relevant events worldwide and publishes their impact as **per-dimension deltas** — not as a single merged score that competes with the CI.

On every country page you see five rows — one per dimension — each showing the cumulative decayed impact of recent events mapped to that dimension. Below them are the 1–2 events driving the largest contribution. The dimensional format prevents single-number misreading and makes each impact explainable.

---

<a id="what-pulse-is-not"></a>
## What the Pulse is not

- Not a co-equal score alongside the CI. There is no single "Pulse number" that competes with the CI composite.
- Not a citable standard at launch. Treat values as experimental indicators, not ground truth.
- Not an attempt to outperform specialised sources. ACLED is still the authority on conflict events; V-Dem is still the authority on democratic trajectory. The Pulse aggregates and scores; it does not claim original empirical authority.
- Not fully automated. High-severity events require human review before they affect published scores.

---

<a id="sources"></a>
## Sources — specialist feeds first, news second

The first version of the Pulse relied on general news ingestion (GDELT + Google News). This produced the **media asymmetry problem**: closed regimes produce few detectable events because journalists are restricted, while free-press democracies produce many. The naive aggregation ended up rewarding censorship. Fatal if unaddressed.

Pulse Beta uses **stacked source integration**: specialised structured feeds are the primary signal; general news augments but does not dominate.

### Primary (specialist)

- **ACLED** — Armed Conflict Location & Event Data Project. Real-time structured records of conflict, protest, political violence, and riots.
- **CIVICUS Monitor** — civic-space alerts: restrictions on assembly, expression, association.
- **RSF** — Reporters Without Borders press-freedom alerts: journalist arrests, media shutdowns, attacks on press.
- **V-Dem early warning** — democratic backsliding signals.
- **HRW + Amnesty International** — human rights violations, mass detentions.
- **IPU Parline** — legislative actions, constitutional events, cabinet changes.

### Secondary (news, corroboration only)

- **GDELT** — global structured event records from news.
- **Reuters and AP wire** — authoritative breaking news.
- **Google News** — broad aggregation.

An event detected only in news without specialist corroboration is held at lower confidence. In countries where the press freedom score is low, news-only signals do not trigger classification on their own — see the press-freedom rule below.

---

<a id="daily-pipeline"></a>
## Daily pipeline

1. **Ingest.** Pull the trailing 24 hours of records from every primary and secondary feed. Resolve country names to jurisdiction ids. Write to a staging table.
2. **Cluster.** Embed each record with a sentence transformer (all-MiniLM-L6-v2, 384-dim). Group records by country and ±48-hour window using cosine similarity ≥ 0.75. Each cluster represents one real-world event regardless of how many sources covered it.
3. **Classify.** For each cluster, run an LLM classifier **three times** at temperatures 0.0, 0.4, and 0.8. Compare the resulting (category, severity tier) tuples for agreement.
4. **Corroborate.** Count distinct specialist sources, distinct news sources, and source diversity. Apply the asymmetric and press-freedom rules below to compute a corroboration confidence in [0, 1].
5. **Human review.** Severe and catastrophic severity events, plus events where the classifier didn't reach consensus, route to a review queue and do not affect published scores until reviewed.
6. **Score.** Multiply each event's severity by its corroboration confidence and decay it by event-type-specific half-life. Sum per (country, dimension), clamp to [−15, +10], and write to the dimensional-deltas table.

---

<a id="event-categories"></a>
## Event categories — the v2 taxonomy

The Pulse classifies every event into exactly one category drawn from a fixed taxonomy. v2.0 ships **61 categories** across the five dimensions, derived from a top-down completeness review against five established political-science frameworks (V-Dem, ACLED, the Comparative Constitutions Project, the Polity Project, and Freedom House). Full derivation lives in [the gap-analysis document](https://github.com/civicaatlas/civica/blob/main/docs/taxonomy-v2-gap-analysis.md).

### Democratic Quality (12 categories)

- `fair_election` — free and fair election (V-Dem Electoral Democracy Index, FH A-1).
- `flawed_election` — irregularity-laden election (V-Dem v2elirreg).
- `disputed_election` — close, contested, challenged-in-court election (V-Dem v2elirreg, FH A-2).
- `election_cancellation` — postponement or cancellation of a scheduled election.
- `gerrymandering` — pre-election boundary manipulation (V-Dem v2elaccept, FH A-3).
- `candidate_disqualification` — opposition candidate barred from competing (V-Dem v2psbars, FH B-1).
- `electoral_access_change` — voter ID, registration, polling-station rules (bidirectional — V-Dem v2xeg_eqaccess, FH A).
- `mass_disenfranchisement` — annulment of electoral mandate or large-scale disqualification of voters.
- `peaceful_transfer` — successful transfer of power between governments through normal democratic channels.
- `negotiated_transition` — pacted democratic transition out of authoritarianism (Polity transition codings; Spain 1976, South Africa 1990–94).
- `term_extension` — constitutional term extension or self-coup that prolongs a leader's mandate.
- `constitutional_override_electoral` — constitutional override of a specific electoral mandate.

### Rule of Law (13 categories)

- `judicial_purge` — mass dismissal or replacement of judges (V-Dem v2juhcind).
- `judicial_independence_rollback` — institutional erosion of judicial independence.
- `judicial_independence_expansion` — institutional strengthening of judicial independence.
- `prosecutorial_independence` — independent prosecutors fired or strengthened (V-Dem v2juncind, FH F-1).
- `executive_constitutional_override` — executive overriding the constitution itself.
- `executive_court_defiance` — executive refusing to comply with binding court rulings (V-Dem v2jucomp, FH F-1).
- `opposition_prosecution` — politically motivated prosecution of named opposition figures (V-Dem v2juhcind, politically motivated prosecutions).
- `oversight_body_dismantling` — auditor-general, ombudsman, or non-anti-corruption oversight body weakened.
- `police_accountability` — civilian oversight of police expanded or restricted (V-Dem v2clrspct, FH F-3).
- `detention_conditions` — pretrial detention, solitary, torture-allegation regime changes (V-Dem v2cltort, FH F-3).
- `martial_law` — military-jurisdiction declaration over civilians.
- `emergency_declaration` — civilian state of emergency without military jurisdiction (FH F).
- `anticorruption_conviction` — high-profile anti-corruption conviction in independent court (also scored on Corruption Control).

### Rights & Freedoms (19 categories)

- `journalist_arrest`, `media_shutdown` — press-freedom incidents (RSF, V-Dem v2mecenefm).
- `protest_crackdown` — state response to a specific protest event with casualties.
- `assembly_rights_restriction` / `assembly_rights_expansion` — de jure assembly law (FH E-1).
- `internet_shutdown` — full internet shutdown.
- `internet_content_restriction` — content blocking, throttling, content laws (V-Dem v2smgovsm).
- `mass_detention` — mass political detentions (cross-cutting freedom_rights signal).
- `systematic_crackdown` — cross-cutting repression pattern without a single named target.
- `religious_freedom_change` — restrictions or expansions of religious practice (V-Dem v2clrelig, FH D-2).
- `minority_rights_change` — de jure changes affecting ethnic / linguistic / religious minorities (V-Dem v2clpolcl, FH G-4).
- `lgbt_rights_change` — LGBT-specific rights changes (V-Dem v2clrgunev).
- `academic_freedom_change` — university, scholar, curriculum freedom (V-Dem v2cafres).
- `ngo_restriction` — NGO-specific legal regimes (foreign-agent laws, etc. V-Dem v2cseeorgs).
- `surveillance_regime_change` — bulk surveillance authority expanded or restricted (V-Dem v2cldiscm, FH D-4).
- `movement_freedom_change` — travel bans, exit visas, internal-passport requirements (FH G-1).
- `property_rights_change` — expropriation, asset seizures, property protections (V-Dem v2clprptyw, FH G-2).
- `political_assassination` — targeted killing of journalists, activists, opposition figures (ACLED VAC attack sub-event-type).
- `press_freedom_expansion` — press-freedom law expansion (positive).

### Corruption Control (6 categories)

- `corruption_conviction` — high-level corruption conviction.
- `corruption_scandal` — major documented corruption scandal.
- `anticorruption_law` — anti-corruption law enactment.
- `anticorruption_dismantling` — anti-corruption institution weakened.
- `whistleblower_protection_change` — whistleblower-protection regime changes (V-Dem v2juacgr).
- `financial_disclosure_change` — asset-disclosure and beneficial-ownership requirement changes (FH C-3).

### Stability (11 categories)

- `armed_conflict`, `state_collapse` — ACLED battles + Polity codings.
- `coup` — military or unconstitutional seizure of power.
- `foreign_occupation` — foreign occupation / imposition (Polity -66).
- `constitutional_crisis` — institutional deadlock or partial breakdown without coup or armed conflict (Polity interregnum -88; Sri Lanka 2022 example).
- `government_collapse` — coalition breakdown or no-confidence collapse via parliamentary mechanism.
- `secession_or_territorial_dispute` — independence referendum, declaration, or non-violent territorial transfer.
- `electoral_violence` — partisan-group violence below armed-conflict threshold (ACLED riots / VAC).
- `peace_agreement_signed` / `peace_agreement_implemented` — formal peace agreements (positive).
- `negotiated_transition_stability` — stabilising side of pacted regime transitions (positive).

Each category in the taxonomy ships with: an inline theoretical citation, an allowed-severity-tier list, a decay half-life, and a direction (positive / negative / mixed). The classifier picks exactly one category per event; multiple related events on different dimensions form what the methodology calls a *cascade* — see below.

---

<a id="disambiguation"></a>
## Disambiguation — when an event could fit multiple categories

v2.0 expanded the taxonomy from 30 to 61 categories. Several of the new fine-grained categories overlap at the prompt level with v1 categories — an event could plausibly fit either. The classifier prompt enforces a single rule for these cases:

**The more dimension-specific category wins over the more generic procedural one.**

Concrete precedence:

- `emergency_declaration` loses to `term_extension`, `mass_disenfranchisement`, `election_cancellation`, `constitutional_override_electoral`, `judicial_purge`, and `martial_law` when the event has a named institutional target.
- `systematic_crackdown` loses to any category with a named institutional target (e.g. `ngo_restriction`, `media_shutdown`, `academic_freedom_change`).
- `mass_detention` loses to `opposition_prosecution` when the detained are named figures with formal charges.
- `coup` wins over `government_collapse` and `constitutional_crisis` when there is an unconstitutional seizure of power.

The disambiguation rules live in `src/lib/pulse/v2/classifier-prompt.ts` as part of the system prompt sent to Claude. The same prompt drives both production classification and backtesting — they cannot drift apart.

---

<a id="cascade-model"></a>
## How coups are classified — the cascade model

Reviewers occasionally ask why a coup d'état drives the Stability dimension rather than Democratic Quality. The answer is that it drives both — but indirectly, through the cascade.

The Pulse models a coup as the **stability rupture**. The democratic damage that follows is captured through the cascade of post-coup events that the classifier handles independently:

- Parliament dissolution → `constitutional_override_electoral` → Democratic Quality
- Annulment of prior elections → `mass_disenfranchisement` → Democratic Quality
- "Transition plans" or term extensions → `term_extension` → Democratic Quality
- Show trials of opposition figures → `judicial_independence_rollback` → Rule of Law
- Martial law / military tribunals for civilians → `martial_law` → Rule of Law
- Press shutdowns and journalist arrests → `media_shutdown` / `journalist_arrest` → Rights & Freedoms

This mirrors how political scientists model regime breakdown: the coup is the rupture event, the consolidation is what kills democratic institutions over the following weeks and months. Each cascade event is independently classifiable; their dimensional impacts accumulate naturally on the right rows. A reader looking at the country page sees Stability plummet on day one and Democratic Quality, Rule of Law, and Rights & Freedoms degrade over the following months as the new regime consolidates power.

---

<a id="multi-run-classifier"></a>
## Multi-run classifier — agreement is the confidence signal

LLM self-reported confidence is not calibrated. The Pulse ignores it. Instead, each cluster is classified three times with different temperature settings, and **agreement across runs** drives the confidence signal:

- All three runs agree on category and tier → confidence boost +0.2.
- Two of three agree → neutral.
- No agreement → confidence penalty −0.3 and the event routes to human review.

The full per-run output (category, tier, severity, rationale) is stored on every event row for audit. Disputes can reference the exact classifier outputs that produced the published value.

---

<a id="asymmetric-scoring"></a>
## Asymmetric scoring — anti-gaming

Authoritarian regimes can manufacture positive-seeming events (sham elections, symbolic anti-corruption prosecutions, announced reforms without implementation) more easily than they can manufacture negative ones. Symmetric scoring invites gaming.

### For positive events:

- Require independent corroboration from at least one non-state source (international observer, opposition media, international NGO, foreign government).
- Distinguish announcement vs. implementation. Announcement alone receives 30% of the severity value; full severity unlocks only after evidence of implementation 30–90 days post-announcement.
- In low-press-freedom environments, require ≥2 non-state corroborating sources.
- Discount severity by 50% if the only sources are state media.

### For negative events:

- Standard corroboration: one specialist source plus one news source, or two independent news sources.
- No announcement vs. implementation distinction.
- No discount based on source type.

---

<a id="press-freedom-rule"></a>
## Press-freedom rule

A country's current RSF Press Freedom score modulates how much weight news-only signals carry:

- **Score ≥ 70 (free press).** News-only signals trigger classification with full confidence.
- **Score 50–69 (partially free).** News-only signals trigger classification with 20% reduced confidence; specialist corroboration preferred.
- **Score < 50 (restricted press).** News-only signals do not trigger classification on their own. They are held in pending review state until a specialist source corroborates.

This addresses the media asymmetry problem directly. In closed regimes the primary signal comes from specialist feeds (ACLED, CIVICUS, RSF, HRW) that actively work to document events despite media restrictions. In free-press environments, news coverage itself is a reliable signal.

---

<a id="decay"></a>
## Decay — different events fade at different rates

A coup d'état has structural impact for years. A journalist-arrest event is incident-level and fades faster. Pulse Beta uses event-type-specific half-lives instead of a single uniform decay constant.

| Category | Half-life (days) |
|---|---|
| Coup d'état | 365 |
| State collapse | 730 |
| Constitutional override / self-coup | 365 |
| Judicial purge | 365 |
| Free and fair election | 90 |
| Flawed election | 180 |
| Journalist arrest (individual) | 60 |
| Media shutdown | 180 |
| Protest crackdown (discrete) | 90 |
| Systematic crackdown (pattern) | 180 |
| Anti-corruption conviction | 120 |
| Peace agreement (signed) | 90 |
| Peace agreement (implemented) | 365 |
| Armed conflict (active) | 180 |

Decay is exponential: `impact = severity × confidence × exp(−ln2 × days / half_life)`.

---

<a id="bounds"></a>
## Bounds and double-counting prevention

Each dimensional delta is clamped to **[−15, +10]** against the CI baseline for that dimension. Asymmetric bounds acknowledge that governance can deteriorate faster than it can improve. The cap also prevents a single catastrophic event from completely overriding years of structural data.

When the quarterly CI absorbs an event via updated source data (e.g. a coup from last quarter is now reflected in V-Dem's new release), the corresponding Pulse delta is zeroed so the event isn't counted twice. The audit trail in the event row records when this happens.

---

<a id="coverage-limitations"></a>
## Coverage limitations — closed regimes

The Pulse depends on observable, reportable events. For countries with severely restricted press freedom (RSF Press Freedom score below 30) or where international monitoring organisations have limited access — North Korea, Eritrea, Turkmenistan, parts of contemporary Afghanistan — the Pulse will systematically **under-detect** events and may show artificially stable dimensional deltas.

This is a known limitation of any real-time governance monitor that depends on documented evidence. For these countries, the structural [Civica Index](https://civicaatlas.org/civica-index) remains the primary signal — it draws on expert assessments aggregated annually (V-Dem, Freedom House, etc.) and does not depend on observable real-time events.

Country pages where the country's RSF score falls below 30 surface this caveat directly on the Pulse panel.

---

<a id="known-limitations"></a>
## Known limitations

- Coverage is uneven. Countries with rich specialist feed coverage (Sub-Saharan Africa via ACLED, etc.) will have richer Pulse signals than countries with sparse coverage. Sparse-coverage countries may show more stable deltas, which can understate real events.
- LLM classification is imperfect. Every classification decision is logged with the per-run outputs and is subject to correction via the disputes process below.
- Positive events require stronger corroboration than negative events. This is intentional anti-gaming. In free-press environments it has minimal effect; in closed regimes it means state-originated positive claims are discounted unless independently verified.
- Dimensional deltas are bounded. A single event cannot produce more than −15 or +10 points of movement on any single dimension. This prevents extremes from distorting comparisons but may understate truly catastrophic situations.
- The Pulse is not yet peer-reviewed and should not be cited as authoritative.

---

<a id="corrections"></a>
## Corrections and disputes

File a Pulse dispute via the [corrections form](https://civicaatlas.org/civica-index/corrections). Pulse-specific dispute categories include event misclassification, severity miscalibration, false positives, missing events, and duplicate events. Each dispute is logged publicly with its disposition and outcome. Resolution target: 7 days initial response, 30 days full disposition.

---

*Related pages: [Civica Index methodology](https://civicaatlas.org/civica-index/methodology) · [Backtest report](https://civicaatlas.org/civica-index/methodology/pulse/backtest) · [Pulse changelog](https://civicaatlas.org/civica-index/pulse-changelog) · [Corrections form](https://civicaatlas.org/civica-index/corrections)*
