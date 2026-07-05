<!--
  Phase 5 (content templating, runtime) — 2026-05-06: this file is the
  prose source of truth for /civica-index/methodology/pulse. The TSX
  shell at src/app/(reader)/civica-index/methodology/pulse/page.tsx
  wraps it via <MarkdownContent>.

  TSX shell handles: H1 (with beta tag), subtitle, warning callout,
  cite section (CiteAccordion), footer nav. The markdown body covers
  every other section in document order.

  Substitution markers:
    {{state.X}}                 typed config from site-state.ts
    {{ctx.X}}                   pre-computed helpers from the TSX shell
                                (ctx.graduationPct, ctx.graduationCount)

  Heading anchors via `## Heading {#anchor}`.

  Validate with: npm run validate:content-templates
-->

## What the Pulse is {#what-pulse-is}

The Civica Pulse fills the gap between quarterly Civica Index updates. A coup in March shouldn't wait until the next V-Dem dataset release eighteen months later to register. A peaceful transfer of power shouldn't be invisible until the next quarterly composite. The Pulse classifies governance-relevant events worldwide and publishes their impact as **per-dimension deltas** — not as a single merged score that competes with the CI.

On every country page you see five rows — one per dimension — each showing the cumulative decayed impact of recent events mapped to that dimension. Below them are the 1–2 events driving the largest contribution. The dimensional format prevents single-number misreading and makes each impact explainable.

## What the Pulse is not {#what-pulse-is-not}

- Not a co-equal score alongside the CI. There is no single "Pulse number" that competes with the CI composite.
- Not a citable standard at launch. Treat values as experimental indicators, not ground truth.
- Not an attempt to outperform specialised sources. ACLED is still the authority on conflict events; V-Dem is still the authority on democratic trajectory. The Pulse aggregates and scores; it does not claim original empirical authority.
- Not a foreign-policy tracker. Inter-state acts — sanctions, embargoes, diplomatic expulsions — are a *sender's* foreign-policy decision, not a change to the *target's* own domestic governance, so they are out of scope (descriptive context at most, never a delta). The Pulse scores a country's own domestic institutions; a sanction's downstream effects inside the target are scored only if they surface as domestic events (a crackdown, unrest). This matches how the established event datasets keep inter-state acts as a directed sender→target relation rather than a property of one country.
- Not fully automated. High-severity events and low-confidence classifications require human review before they affect published scores.

## Sources — specialist feeds first, news second {#sources}

A governance monitor built on general news alone hits the **media-asymmetry problem**: closed regimes produce few detectable stories because journalists are restricted, while free-press democracies produce many. Naive aggregation would end up rewarding censorship. To counter this, the Pulse is designed to stack **specialist structured feeds as the primary signal**, with general news as corroboration rather than the driver.

### Primary (specialist)

- **CIVICUS Monitor** — civic-space alerts: restrictions on assembly, expression, association.
- **Human Rights Watch & Amnesty International** — human-rights violations, mass detentions, crackdowns.
- **ACLED** — structured records of conflict, protest, and political violence.
- **RSF** — Reporters Without Borders press-freedom alerts: journalist arrests, media shutdowns.
- **IPU Parline** — legislative actions, constitutional events, cabinet changes.
- **V-Dem early warning** — democratic-backsliding signals.

### Secondary (news, corroboration)

- **GDELT** — global structured event records drawn from news.
- **Reuters and AP wire** — authoritative breaking news.

**Current coverage (Beta).** Not every connector is active yet. The feeds running today are CIVICUS Monitor, Human Rights Watch, Amnesty International, and GDELT; the ACLED, RSF, wire-service, and V-Dem connectors are built but depend on access (paid APIs or feeds) that is not currently enabled, and IPU coverage is sparse. Until the specialist stack is fully wired, news (GDELT) carries more of the signal than the specialist-first design intends — which makes the corroboration and press-freedom weightings below (they discount news-only signal, heavily so in closed regimes) load-bearing, and the [coverage limitations](#coverage-limitations) correspondingly larger.

An event seen only in news, without specialist corroboration, is scored at reduced confidence; in low-press-freedom countries that discount is severe — see the press-freedom rule below.

## Daily pipeline {#daily-pipeline}

The Pulse runs on a daily cadence (Beta). Because it runs as a scheduled job rather than a live stream, published values always reflect the most recent completed run — the per-country panels and the [Pulse changelog](/civica-index/pulse-changelog) show data as of that last computation.

1. **Ingest.** Pull the trailing window of records from every active feed and write them to a staging table.
2. **Cluster.** Embed each record with a sentence transformer (all-MiniLM-L6-v2, 384-dim). Group records by country and ±48-hour window using cosine similarity ≥ 0.75, so one real-world event covered by many sources collapses to a single cluster.
3. **Classify and verify.** For each cluster, several independent models from different vendors each read the underlying reports and assign one taxonomy category, a severity tier and value, and the **subject country** — the country whose governance the event is actually about, judged from the substance of the event and *not* from the language of the article or the country of the outlet (a Portuguese-outlet story about U.S. politics is a United States event, not a Brazilian one). The published classification is the majority verdict across those models, and an independent **verification pass** then tries to refute it. See [classification confidence](#classification-confidence).
4. **Corroborate.** Count distinct specialist and news sources and compute a source-diversity score, then apply the asymmetric and press-freedom weightings below to produce a corroboration confidence in [0, 1].
5. **Human review.** Severe- and catastrophic-severity events, and any low-confidence classification, route to a review queue and do **not** affect published scores until a human approves them.
6. **Score.** Multiply each published event's severity by its corroboration confidence, decay it by an event-type-specific half-life, sum per (country, dimension), clamp to [−15, +10], and write the dimensional deltas.

## Event categories — the {{state.pulse.taxonomy.version}} taxonomy {#event-categories}

The Pulse classifies every event into exactly one category drawn from a fixed taxonomy. {{state.pulse.taxonomy.version}} ships **{{state.pulse.taxonomy.categoryCount}} categories** across the five dimensions, derived from a top-down completeness review against five established political-science frameworks (V-Dem, ACLED, the Comparative Constitutions Project, the Polity Project, and Freedom House). Full derivation lives in [the gap-analysis document](https://github.com/fbalino/civica/blob/main/docs/taxonomy-v2-gap-analysis.md).

### Democratic Quality ({{state.pulse.taxonomy.categoriesPerDimension.democratic_quality}} categories)

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

### Rule of Law ({{state.pulse.taxonomy.categoriesPerDimension.rule_of_law}} categories)

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

### Rights & Freedoms ({{state.pulse.taxonomy.categoriesPerDimension.freedom_rights}} categories)

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

### Corruption Control ({{state.pulse.taxonomy.categoriesPerDimension.corruption_control}} categories)

- `corruption_conviction` — high-level corruption conviction.
- `corruption_scandal` — major documented corruption scandal.
- `anticorruption_law` — anti-corruption law enactment.
- `anticorruption_dismantling` — anti-corruption institution weakened.
- `whistleblower_protection_change` — whistleblower-protection regime changes (V-Dem v2juacgr).
- `financial_disclosure_change` — asset-disclosure and beneficial-ownership requirement changes (FH C-3).

### Stability ({{state.pulse.taxonomy.categoriesPerDimension.stability}} categories)

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

## Disambiguation — when an event could fit multiple categories {#disambiguation}

Several fine-grained categories overlap — an event could plausibly fit more than one. The classifier applies a single rule:

**The more dimension-specific category wins over the more generic procedural one.**

Concrete precedence:

- `emergency_declaration` loses to `term_extension`, `mass_disenfranchisement`, `election_cancellation`, `constitutional_override_electoral`, `judicial_purge`, and `martial_law` when the event has a named institutional target.
- `systematic_crackdown` loses to any category with a named institutional target (e.g. `ngo_restriction`, `media_shutdown`, `academic_freedom_change`).
- `mass_detention` loses to `opposition_prosecution` when the detained are named figures with formal charges.
- `coup` wins over `government_collapse` and `constitutional_crisis` when there is an unconstitutional seizure of power.

These precedence rules are part of the classifier's instructions, so they are applied consistently to every event.

## How coups are classified — the cascade model {#cascade-model}

Reviewers occasionally ask why a coup d'état drives the Stability dimension rather than Democratic Quality. The answer is that it drives both — but indirectly, through the cascade.

The Pulse models a coup as the **stability rupture**. The democratic damage that follows is captured through the cascade of post-coup events that the classifier handles independently:

- Parliament dissolution → `constitutional_override_electoral` → Democratic Quality
- Annulment of prior elections → `mass_disenfranchisement` → Democratic Quality
- "Transition plans" or term extensions → `term_extension` → Democratic Quality
- Show trials of opposition figures → `judicial_independence_rollback` → Rule of Law
- Martial law / military tribunals for civilians → `martial_law` → Rule of Law
- Press shutdowns and journalist arrests → `media_shutdown` / `journalist_arrest` → Rights & Freedoms

This mirrors how political scientists model regime breakdown: the coup is the rupture event, the consolidation is what kills democratic institutions over the following weeks and months. Each cascade event is independently classifiable; their dimensional impacts accumulate naturally on the right rows. A reader looking at the country page sees Stability plummet on day one and Democratic Quality, Rule of Law, and Rights & Freedoms degrade over the following months as the new regime consolidates power.

## Classification confidence — cross-model consensus, then verify {#classification-confidence}

LLM self-reported confidence is not calibrated, so the Pulse does not trust a model that merely says it is sure. It also does not rely on sampling the same prompt repeatedly: re-running one prompt only measures the randomness of a single model's decoding, not whether the answer is correct — confidently-wrong answers tend to recur. Confidence instead comes from **agreement across several independent models, an adversarial verification pass, and real-world corroboration**.

**The classify pass is an ensemble of independent models.** Each cluster is classified in parallel by three models from **different vendors** — currently DeepSeek (`deepseek-v4-flash`), Zhipu GLM (`glm-4.7`), and Anthropic Claude Haiku 4.5 — so their errors are independent rather than correlated. (The exact set is configurable; a fourth model can be added.) Each model independently assigns a category, a severity tier and value, and names the **runner-up category** it considered. The published classification is the **majority verdict**:

- **All three agree** → highest-confidence classification.
- **Two of three agree** → the majority category is taken, but the disagreement is recorded and the event faces the verification pass below before it can publish.
- **No majority** (three different answers, or too few models returned a usable answer) → the event is treated as unresolved and routed to human review; it does not publish automatically.

Where the majority agrees on the category but differs on severity, the Pulse takes the majority tier and, on a tie, the **more severe** tier (the conservative reading); the published severity value is the median of the agreeing models. If one model errors or returns an unparseable answer, classification degrades to the models that did respond and the degradation is recorded, rather than failing the event.

**Then an adversarial verification pass.** A separate model re-reads the source and actively tries to *refute* the majority classification: is the category right rather than the runner-up? is the severity justified? is the subject country the one the event is about (not the source's language or outlet)? is it even a discrete governance event at all? This pass runs on unanimous classifications as a final adversarial check, and on two-of-three classifications where a refuted verdict downgrades the event to review; it is skipped only when the models already deadlocked (the event is heading to review regardless). It returns **high**, **medium**, or **low** confidence, and is trusted only when the classification survives on all four axes.

What this drives:

- **Unresolved and low-confidence events are not auto-published.** A deadlocked classification, a verification that comes back low-confidence or refuted, and any severe- or catastrophic-severity event all route to the human review queue and do not affect scores until a person approves them. Only events that are confidently classified, survive verification, and fall below the severe-severity threshold publish automatically.
- **Most raw news is dropped.** The classifier is deliberately strict about what qualifies as an event: opinion columns, partisan commentary, market and business stories, and un-enacted announcements are not governance events and are discarded rather than scored. Independent models flagging the same item as a non-event is itself a strong drop signal.
- **Corroboration is the primary weight on the events that do score** — see the next two sections. Source diversity and press-freedom context determine how heavily a published event moves the dimensional deltas.

Every event stores each model's classification and rationale, the runner-up, the agreement level, and the verification result, so any published value traces back to the reasoning that produced it and can be challenged via the [corrections process](#corrections).

## Asymmetric scoring — anti-gaming {#asymmetric-scoring}

Authoritarian regimes can manufacture positive-seeming events — sham elections, symbolic anti-corruption prosecutions, announced-but-unimplemented reforms — more easily than negative ones. Scoring positives and negatives identically would invite gaming, so positive events face a higher corroboration bar, applied as a **confidence discount** rather than a hard block:

- A positive event with **no specialist-source corroboration** has its corroboration confidence reduced (currently ×0.6), so a state-announced "reform" that no independent specialist documents barely moves the score.
- In **low-press-freedom** countries, a positive event with fewer than two independent non-state sources is discounted further (currently ×0.5).

(The strict classify-and-verify step is the other half of this defence: un-enacted announcements and symbolic claims are typically dropped at classification, so they never reach scoring in the first place.)

Negative events use standard corroboration — one specialist plus one news source, or two independent news sources — with no source-type discount. The media-asymmetry problem cuts the other way for negatives: closed regimes suppress *bad* news, so demanding extra corroboration for negatives would compound the censorship advantage.

## Press-freedom rule {#press-freedom-rule}

A country's RSF Press Freedom score modulates how much weight **news-only** signals carry, applied as a multiplier on corroboration confidence:

- **Score ≥ 70 (free press).** News-only signals carry full weight.
- **Score 50–69 (partially free).** News-only signals are discounted (currently ×0.8); specialist corroboration is preferred.
- **Score < 50 (restricted press).** News-only signals are heavily discounted (currently ×0.3) — on their own they barely move the score, so a published event in a closed-press country effectively needs a specialist source to register.

This addresses the media-asymmetry problem directly: in closed regimes the reliable signal comes from specialist feeds (CIVICUS, ACLED, RSF, HRW) that work to document events despite media restrictions; in free-press environments, news coverage is itself a reliable signal.

## Decay — different events fade at different rates {#decay}

A coup d'état has structural impact for years. A journalist-arrest event is incident-level and fades faster. Pulse Beta uses event-type-specific half-lives instead of a single uniform decay constant.

| Category | Half-life (days) |
|---|---:|
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

## Bounds and double-counting prevention {#bounds}

Each dimensional delta is clamped to **[−15, +10]** against the CI baseline for that dimension. Asymmetric bounds acknowledge that governance can deteriorate faster than it can improve. The cap also prevents a single catastrophic event from completely overriding years of structural data.

When the quarterly CI absorbs an event via updated source data (e.g. a coup from last quarter is now reflected in V-Dem's new release), the corresponding Pulse delta is zeroed so the event isn't counted twice. The audit trail in the event row records when this happens.

## Coverage limitations — closed regimes {#coverage-limitations}

The Pulse depends on observable, reportable events. For countries with severely restricted press freedom (RSF Press Freedom score below 30) or where international monitoring organisations have limited access — North Korea, Eritrea, Turkmenistan, parts of contemporary Afghanistan — the Pulse will systematically **under-detect** events and may show artificially stable dimensional deltas.

This is a known limitation of any real-time governance monitor that depends on documented evidence. For these countries, the structural [Civica Index](/civica-index) remains the primary signal — it draws on expert assessments aggregated annually (V-Dem, Freedom House, etc.) and does not depend on observable real-time events.

Country pages where the country's RSF score falls below 30 surface this caveat directly on the Pulse panel.

## Known limitations {#known-limitations}

- Coverage is uneven and currently leans on news plus a few specialist feeds. Until the full specialist stack is active, closed-regime detection is weaker than the design intends, and sparse-coverage countries may show artificially stable deltas that understate real events.
- The classifier is deliberately strict — the large majority of ingested news is commentary, business, or un-enacted announcements rather than discrete governance events, and is dropped. This keeps noise out of the scores, but a genuine event can occasionally be discarded; missing-event disputes are welcomed.
- LLM classification is imperfect. Every classification is logged with each model's answer and rationale, the runner-up, the cross-model agreement level, and the verification result, and is subject to correction via the disputes process below.
- Positive events require stronger corroboration than negative events. This is intentional anti-gaming. In free-press environments it has minimal effect; in closed regimes it means state-originated positive claims are discounted unless independently verified.
- Dimensional deltas are bounded. A single event cannot produce more than −15 or +10 points of movement on any single dimension. This prevents extremes from distorting comparisons but may understate truly catastrophic situations.
- The Pulse is not yet peer-reviewed and should not be cited as authoritative.

## Corrections and disputes {#corrections}

File a Pulse dispute via the [corrections form](/civica-index/corrections). Pulse-specific dispute categories include event misclassification, severity miscalibration, false positives, missing events, and duplicate events. Each dispute is logged publicly with its disposition and outcome. Resolution target: {{state.disputeSla.initialResponseDays}} days initial response, {{state.disputeSla.fullDispositionDays}} days full disposition.
