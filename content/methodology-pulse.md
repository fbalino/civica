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
    {{ctx.X}}                   generated Pulse runtime-contract values passed
                                by the TSX shell (providers, feeds, schedule,
                                review tiers, window, and bounds)

  Heading anchors via `## Heading {#anchor}`.

  Validate with: npm run validate:content-templates
-->

## What the Pulse is {#what-pulse-is}

The Civica Pulse is a model-assisted ledger designed to test whether documented events can add timely context between slower-moving source releases. It records governance-relevant event candidates, classifications, sources, publication origin, and review state. It also publishes **experimental per-dimension deltas**. Civica does not publish a merged Pulse score or Pulse ranking.

The current generated runtime contract is **{{ctx.methodologyVersion}}**. It describes new classifications produced by the declared scheduled pipeline; it is not retroactively assigned to older unversioned ledger rows.

Where a country has published events in the scoring window, its Civica Data page shows five named dimension rows and up to two driving events per row. A missing event is not converted into evidence of stability: countries with no detected published event receive an explicit no-observation state rather than a scalar zero.

## What the Pulse is not {#what-pulse-is-not}

- Not a co-equal score alongside the CI. There is no single "Pulse number" that competes with the CI composite.
- Not an established measurement. Treat numeric effects as experimental heuristics, not ground truth.
- Not an attempt to outperform specialised sources. ACLED publishes specialist conflict-event data, while V-Dem publishes long-run democracy measures. The Pulse aggregates and scores; it does not claim original empirical measurement.
- Not a foreign-policy tracker. Inter-state acts — sanctions, embargoes, diplomatic expulsions — are a *sender's* foreign-policy decision, not a change to the *target's* own domestic governance, so they are out of scope (descriptive context at most, never a delta). The Pulse scores a country's own domestic institutions; a sanction's downstream effects inside the target are scored only if they surface as domestic events (a crackdown, unrest). This matches how the established event datasets keep inter-state acts as a directed sender→target relation rather than a property of one country.
- Not fully human-reviewed. Human review is mandatory for {{ctx.reviewTiersProse}}, deadlocks or no quorum, and weak/degraded majorities paired with a verifier objection: low confidence; a revised or rejected verdict; a negative category, severity, subject, or event check; or failed/unavailable verification. Other events may be auto-published. “Published” does not mean “human-reviewed.”

## Sources — specialist feeds first, news second {#sources}

A governance monitor built on general news alone hits the **media-asymmetry problem**: closed regimes produce few detectable stories because journalists are restricted, while free-press democracies produce many. Naive aggregation would end up rewarding censorship. To counter this, the Pulse is designed to stack **specialist structured feeds as the primary signal**, with general news as corroboration rather than the driver.

### Designed specialist connectors

- **CIVICUS Monitor** — civic-space alerts: restrictions on assembly, expression, association.
- **Human Rights Watch & Amnesty International** — human-rights violations, mass detentions, crackdowns.
- **ACLED** — structured records of conflict, protest, and political violence.
- **RSF** — Reporters Without Borders press-freedom alerts: journalist arrests, media shutdowns.
- **IPU Parline** — legislative actions, constitutional events, cabinet changes.
- **V-Dem early warning** — democratic-backsliding signals.

### Designed news connectors

- **GDELT** — global structured event records drawn from news.
- **Reuters and AP wire** — major international wire reporting.

**Current production coverage (runtime snapshot {{ctx.observedThrough}}).** The only feeds with observed Pulse staging rows are {{ctx.activeFeedsProse}}. ACLED is access-gated; RSF and Reuters/AP lack configured production feeds; the IPU connector is sparse and has produced no observed Pulse staging rows in the snapshot; the V-Dem connector is a placeholder. “Present in the orchestrator” does not mean “active.”

The active basket is dominated by GDELT, and a single-source event can currently affect an experimental delta at reduced heuristic weight. Source diversity is recorded when it exists, but the present method does not impose a two-source publication minimum. Readers should not interpret “corroboration weight” as proof that an event was independently corroborated.

An event seen only in news, without specialist corroboration, is scored at reduced confidence; in low-press-freedom countries that discount is severe — see the press-freedom rule below.

## Scheduled pipeline {#daily-pipeline}

The pipeline is scheduled once per day in UTC: {{ctx.scheduleProse}}. The score stage first recomputes heuristic corroboration weights and then writes dimensional deltas. These are separate cron jobs without a durable parent run ledger, so a schedule is not proof that every stage completed in sequence. Per-country panels expose the latest stored delta-computation time when available. The [Pulse changelog](/civica-index/pulse-changelog) shows the most recent event date in its current result set, not the last successful pipeline-run time.

1. **Ingest.** Pull the trailing window of records from every active feed and write them to a staging table.
2. **Cluster.** Attempt to embed each record with all-MiniLM-L6-v2 and group records within the ingest-assigned country and a ±48-hour window at cosine similarity ≥ 0.75. When the embedding runtime is unavailable, production falls back to lexical Jaccard similarity ≥ 0.5. This fallback is operational, not equivalent validation of the semantic method.
3. **Classify.** The configured cross-vendor voters — {{ctx.classifyVotersProse}} — assign a taxonomy category and severity. A strict majority wins; a category deadlock or no quorum goes to review. Different vendors diversify error sources but do not make their errors statistically independent.
4. **Verify and attribute.** {{ctx.verifierProse}} makes a separate adversarial call against the majority verdict. The same model also participates as one voter, so this is a separate call rather than an independent model family. Subject-country attribution is another pass, currently {{ctx.subjectAttributorProse}}, run after classification; if it fails, the ingest-time attribution remains. That attribution verdict is not yet persisted as a separately versioned audit row.
5. **Weight.** Count distinct specialist and news source IDs, combine that diversity with the stored agreement label, and apply asymmetric and provisional press-context multipliers. The resulting “corroboration weight” is a hand-set heuristic in [0, 1], not a calibrated probability of correctness and not a publication minimum.
6. **Review or publish.** {{ctx.reviewTiersProse}}, deadlocks/no quorum, and weak or degraded majorities paired with a verifier objection route to review. An objection includes low confidence, a revised or rejected verdict, a negative category/severity/subject/event check, or failed/unavailable verification. Other events may be auto-published. Queued and rejected events do not affect public deltas.
7. **Score.** For published events in the trailing {{ctx.scoreWindowDays}}-day window, multiply severity by the heuristic weight, apply category-specific exponential decay, sum by country and dimension, clamp to [{{ctx.deltaLowerBound}}, {{ctx.deltaUpperBound}}], and write public experimental deltas.

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

LLM self-reported confidence is not calibrated, so the Pulse does not treat a model saying it is sure as a probability of correctness. It also does not treat repeated sampling of one prompt as independent evidence. The current decision process combines **cross-vendor voting, an adversarial verification call, and a heuristic source-diversity weight**. None of those substitutes for representative validation.

**The classify pass is a cross-vendor ensemble.** Each cluster is classified in parallel by the configured voters — {{ctx.classifyVotersProse}}. Using different vendors is intended to diversify error sources; it does not establish that errors are independent. Each voter assigns a category, a severity tier and value, and names the runner-up category it considered. The candidate classification is the **majority verdict**:

- **All three agree** → highest-confidence classification.
- **Two of three agree** → the majority category is taken, but the disagreement is recorded and the event faces the verification pass below before it can publish.
- **No majority** (three different answers, or too few models returned a usable answer) → the event is treated as unresolved and routed to human review; it does not publish automatically.

Where the majority agrees on the category but differs on severity, the Pulse takes the majority tier and, on a tie, the **more severe** tier (the conservative reading); the published severity value is the median of the agreeing models. If one model errors or returns an unparseable answer, classification can degrade to the models that did respond. The successful provider runs are stored, but the configured provider set, failed provider, failure reason, and a separate degradation flag are not yet persisted.

**Then an adversarial verification call.** {{ctx.verifierProse}} re-reads the source and tries to refute the majority classification: is the category right rather than the runner-up, is severity justified, is the country attribution plausible, and is this a discrete governance event at all? This call runs on unanimous and majority classifications. On a non-unanimous result it acts as a signal rather than an absolute veto: a verifier objection routes to review only when the majority is weak. An objection is low confidence, a revised or rejected verdict, any negative category/severity/subject/event check, or failed/unavailable verification. “Weak” means that the maximum self-reported confidence among winning-category voters is below {{ctx.weakConfidenceThreshold}}, or that fewer than all configured voters returned usable answers. It is skipped when the voters already deadlocked because that candidate already requires review.

What this drives:

- **Some candidates require human review.** Deadlocks/no quorum, {{ctx.reviewTiersProse}}, and weak/degraded majorities paired with any verifier objection described above route to the queue and do not affect public deltas until a valid classification is approved. Other candidates can auto-publish; a published row is not necessarily human-reviewed. A reviewer cannot publish an unresolved `category="none"` row as-is.
- **Most raw news is dropped.** The classifier is deliberately strict about what qualifies as an event: opinion columns, partisan commentary, market and business stories, and un-enacted announcements are not governance events and are discarded rather than scored. Multiple configured models flagging the same item as a non-event is itself a strong drop signal.
- **Corroboration is the primary weight on the events that do score** — see the next two sections. Source diversity and press-freedom context determine how heavily a published event moves the dimensional deltas.

Current provider-tagged events store each successful voter result and rationale plus the verification result. The public ledger also contains older, unversioned classifier generations whose compatibility labels cannot be interpreted literally as three-voter counts. Until row-level method/version fields land, the ledger must not be treated as one homogeneous current-method series. Current dimensional deltas can include published rows from those older generations, so they are mixed-method experimental outputs rather than a current-ensemble validation sample. Every row remains challengeable through the [corrections process](#corrections).

## Asymmetric scoring — anti-gaming {#asymmetric-scoring}

The experimental weighting applies stronger discounts to positive events to reduce sensitivity to symbolic or state-promoted claims. These are hand-set **heuristic multipliers**, not empirically calibrated probabilities or publication gates:

- A positive event with **no specialist source ID** has its corroboration confidence reduced (currently ×0.6), so a state-announced "reform" with no specialist record barely moves the score.
- In **low-press-freedom** countries, a positive event with fewer than two distinct recorded source IDs is discounted further (currently ×0.5). The current data model does not detect state ownership or source-family relationships, so this count must not be read as evidence that the sources are independent or non-state.

(The classifier is instructed to drop un-enacted announcements and symbolic claims, but this behavior has not completed representative evaluation.)

Negative events do not receive the positive-event multipliers. There is currently no minimum such as “one specialist plus one news source” or “two distinct news source IDs”: a single-source event can affect a public experimental delta at reduced weight. Source-family independence and republication detection are not yet implemented.

## Press-freedom rule {#press-freedom-rule}

The current code uses an incomplete static lookup of approximate 2024 RSF scores, with an unobserved country defaulting to 50. This is a provisional context heuristic, not a complete, versioned RSF dataset. It applies the following multipliers to the corroboration weight:

- **Score ≥ 70 (free press).** News-only signals carry full weight.
- **Score 50–69 (partially free).** All events are discounted (currently ×0.8), including specialist-backed events.
- **Score < 50 (restricted press).** News-only signals are heavily discounted (currently ×0.3) — on their own they barely move the score, so a published event in a closed-press country effectively needs a specialist source to register.

This rule is an unvalidated attempt to reduce media-asymmetry effects. It does not solve non-observation in closed regimes and must not turn “no detected event” into evidence of stability.

## Decay — different events fade at different rates {#decay}

Pulse Beta assigns event-type-specific half-lives instead of a single uniform decay constant. The production scorer nevertheless includes events only in a trailing {{ctx.scoreWindowDays}}-day window, so any longer half-life parameter is truncated when the event leaves that window.

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

## Bounds, scoring window, and structural overlap {#bounds}

Each dimensional delta is clamped to **[{{ctx.deltaLowerBound}}, {{ctx.deltaUpperBound}}]**. The asymmetric bounds are a design choice under evaluation; they do not estimate sampling or model uncertainty. Only events in the trailing {{ctx.scoreWindowDays}}-day window are included, even when a category has a longer configured half-life.

The code contains an experimental attempt to reduce overlap when a newer structural Index release reflects the same change, but it is not yet a durable versioned absorption record and the daily weighting pass can restore a zeroed weight. Consequently, the current public deltas may overlap conceptually with structural inputs; reliable double-count prevention is a known limitation, not a current guarantee.

## Coverage limitations — closed regimes {#coverage-limitations}

The Pulse depends on observable, reportable events. Where press freedom or international-monitor access is severely restricted, the Pulse will systematically **under-detect** events. A missing event or empty country window is therefore rendered as non-observation, not as evidence of stability.

This is a known limitation of any event-monitoring system that depends on documented evidence. For these countries, the structural [Civica Index](/civica-index) draws on expert assessments aggregated annually (V-Dem, Freedom House, etc.) and therefore does not depend on observable event reports. The Index remains a separate research beta, not a substitute for missing Pulse evidence.

Country pages flagged by the provisional press-context lookup surface this caveat directly on the Pulse panel. Because that lookup is incomplete and approximate, it is itself a limitation pending replacement with a complete, versioned source.

## Known limitations {#known-limitations}

- Coverage is uneven and currently leans heavily on GDELT plus three specialist feeds. Inactive and placeholder connectors do not contribute evidence. Sparse-coverage countries can have missed events; absence is not stability.
- A single-source event can currently affect an experimental delta, and GDELT is counted as one source ID regardless of the underlying publisher. Source-family independence and republication detection are not implemented.
- Clustering currently partitions on ingest-time country attribution and may use lexical fallback when semantic embeddings are unavailable. This can split reports of the same event, particularly across outlets or languages.
- The classifier is deliberately strict — the large majority of ingested news is commentary, business, or un-enacted announcements rather than discrete governance events, and is dropped. This keeps noise out of the scores, but a genuine event can occasionally be discarded; missing-event disputes are welcomed.
- LLM classification is imperfect. Current provider-tagged runs preserve successful voter and verification outputs, but older rows use mixed, unversioned classifier generations. The full ledger is not a homogeneous current-method sample.
- Positive events receive stronger heuristic discounts than negative events. This is an anti-gaming design choice under evaluation, not a requirement that they be independently verified before publication.
- “Corroboration weight” is a heuristic, not a calibrated probability. The provisional press-context lookup is incomplete, applies a default to uncovered countries, and has not been validated as a bias correction.
- Dimensional deltas are bounded and limited to a trailing {{ctx.scoreWindowDays}}-day window. Longer configured half-lives are truncated, and structural-overlap handling is not durable.
- The published historical smoke test uses an earlier classifier architecture and does not validate the current production ensemble. Representative evaluation and independent review are incomplete.
- Pulse classifications and numeric effects have not completed independent review and should not be treated as established measurements.

## Corrections and disputes {#corrections}

File a Pulse dispute via the [corrections form](/civica-index/corrections). Pulse-specific dispute categories include event misclassification, severity miscalibration, false positives, missing events, and duplicate events. Each dispute is logged publicly with its disposition and outcome. Resolution target: {{state.disputeSla.initialResponseDays}} days initial response, {{state.disputeSla.fullDispositionDays}} days full disposition.
