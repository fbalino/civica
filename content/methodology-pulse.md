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

The current generated runtime contract is **{{ctx.methodologyVersion}}**. New rows point to content-addressed stage runs that record the method, production ontology, prompt where applicable, provider and model set, source basket, algorithm, pipeline version, and upstream runs. Older rows point to fixed `legacy_unversioned` stage records; Civica does not retroactively assign the current method to them.

Numeric deltas are available only through the versioned country-dimensions API. Active reader pages show the event ledger and do not render the dormant delta panel. A missing event is not converted into evidence of stability: the API returns an explicit non-observation rather than a scalar zero when no published event supports a dimension.

<!-- PUBLIC_CLAIM: methodology.pulse-ledger-charter -->

## Research charter {#research-charter}

**Charter version: pulse-ledger-charter/v1.** Pulse is being developed first as a versioned ledger of **documented governance-relevant event records**. One record asserts that an identifiable occurrence affecting a jurisdiction&rsquo;s domestic governing institutions took place at a stated event date, with retained source evidence and an explicit publication state. An article, source count, model vote, country-day, and numeric delta are not ledger units.

The intended users are researchers, journalists, civic educators, reviewers, and data users who preserve event-level evidence and uncertainty. The ledger is not approved for automated eligibility, sanctions, lending, migration, employment, or security decisions; country grades, rankings, or risk scores; or as a substitute for specialist datasets.

An event is in scope only when it concerns a domestic institutional occurrence covered by the versioned ontology, has a bounded event date, retains at least one source identity, carries explicit subject evidence, and can be separated from commentary, prediction, source failure, and duplication. Lawful or normatively ambiguous events can be recorded descriptively. Their inclusion does not declare them beneficial or harmful.

Opinion, rhetoric, forecasts, polling movement, general conditions without an institutional occurrence, foreign-policy acts without a separately evidenced domestic event, unsupported rumors, and duplicate or republished accounts are excluded as ledger events. No qualifying event observed and low observation are different states.

Eligible evidence classes are specialist monitors, attributable official institutional documents, and established news reporting subject to source-family and republication controls. The current operating basket is the generated runtime contract; connector code alone does not make a feed active. Geographic coverage is limited to Civica jurisdictions with recorded subject-attribution evidence. At charter adoption, the retained provisional history began on 2026-04-13, but that is only the earliest stored event in the adoption snapshot, not the beginning of complete observation. Language and temporal coverage are release properties.

The ledger is not complete, exhaustive, real-time, continuously observed, a country-quality measure, or a causal estimate. Publication does not establish full human review, independent corroboration, calibrated confidence, or academic validation. Media restrictions, connectivity, feed outages, query design, paywalls, language support, publisher cadence, and source concentration all constrain observability.

Success requires complete evidence and version history; representative preregistered evaluation of retrieval, clustering, attribution, labels, severity, abstention, and publication; subgroup and source-bias gates; qualified-reader evidence tracing; and retained prospective and adverse results. Publication is suspended when rights, evidence identity, attribution, correction history, or the distinction between low observation and no qualifying event cannot be maintained. The ledger is retired or redesigned when preregistered safety or performance gates fail without a bounded repair that passes a new evaluation. Numeric effects can be retired independently. No-value is a valid result.

Changing the unit, admission boundary, source classes, scope, success gates, or retirement rules requires a new charter version and migration note. The adopted resolution is preserved at [`plan/research/pulse-ledger-research-charter-v1.md`](https://github.com/fbalino/civica/blob/main/plan/research/pulse-ledger-research-charter-v1.md).

## What the Pulse is not {#what-pulse-is-not}

- Not a co-equal score alongside the CI. There is no single "Pulse number" that competes with the CI composite.
- Not an established measurement. Treat numeric effects as experimental heuristics, not ground truth.
- Not an attempt to outperform specialised sources. ACLED publishes specialist conflict-event data, while V-Dem publishes long-run democracy measures. The Pulse aggregates and scores; it does not claim original empirical measurement.
- Not a foreign-policy tracker. Inter-state acts — sanctions, embargoes, diplomatic expulsions — are a _sender's_ foreign-policy decision, not a change to the _target's_ own domestic governance, so they are out of scope (descriptive context at most, never a delta). The Pulse scores a country's own domestic institutions; a sanction's downstream effects inside the target are scored only if they surface as domestic events (a crackdown, unrest). This matches how the established event datasets keep inter-state acts as a directed sender→target relation rather than a property of one country.
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

The active basket is dominated by GDELT, and a single-evidence event can currently affect an experimental delta at reduced heuristic weight. The current method collapses likely copies and reports sharing one publisher or declared origin before it counts evidence groups, but it does not impose a two-group publication minimum. Readers should not interpret “corroboration weight” as proof that an event was independently corroborated.

An event seen only in news, without specialist corroboration, is scored at reduced confidence; in low-press-freedom countries that discount is severe — see the press-freedom rule below.

## Scheduled pipeline {#daily-pipeline}

The pipeline is scheduled once per day in UTC: {{ctx.scheduleProse}}. The score stage first recomputes heuristic corroboration weights and then writes dimensional deltas. These are separate cron jobs without a durable parent run ledger, so a schedule is not proof that every stage completed in sequence. Per-country panels expose the latest stored delta-computation time when available. The [Pulse changelog](/civica-index/pulse-changelog) shows the most recent event date in its current result set, not the last successful pipeline-run time.

1. **Ingest.** Pull the trailing window of records from every active feed and write them to a staging table.
2. **Cluster.** Normalize each report under `{{ctx.clusterIdentityVersion}}`, embed it with `{{ctx.clusterEmbeddingModel}}`, and compare it with other candidates inside a ±{{ctx.clusterWindowHours}}-hour window. The ingest-time country guess is diagnostic and does not partition the candidates. A pair must meet the semantic cosine threshold of {{ctx.clusterSemanticThreshold}} or the canonical-token Jaccard threshold of {{ctx.clusterLexicalThreshold}}, with a shared event-identity anchor guarding against generic same-day matches. When the embedding runtime is unavailable, production uses the canonical-token path alone. That fallback has not been shown to perform equivalently.
3. **Classify.** The configured cross-vendor voters — {{ctx.classifyVotersProse}} — assign a taxonomy category and severity. A strict majority wins; a category deadlock or no quorum goes to review. Different vendors diversify error sources but do not make their errors statistically independent.
4. **Verify and attribute.** {{ctx.verifierProse}} makes a separate adversarial call against the majority verdict. The same model also participates as one voter, so this is a separate call rather than an independent model family. Subject-country attribution is another pass, currently {{ctx.subjectAttributorProse}}, run after classification; if it fails, the ingest-time attribution remains. That attribution verdict is not yet persisted as a separately versioned audit row.
5. **Weight.** Collapse likely republications and evidence from one publisher or underlying report, then count the remaining specialist and news evidence groups. Combine that count with the stored agreement label and apply asymmetric and provisional press-context multipliers. The resulting “corroboration weight” is a hand-set heuristic in [0, 1], not a calibrated probability of correctness and not a publication minimum.
6. **Review or publish.** {{ctx.reviewTiersProse}}, deadlocks/no quorum, and weak or degraded majorities paired with a verifier objection route to review. An objection includes low confidence, a revised or rejected verdict, a negative category/severity/subject/event check, or failed/unavailable verification. Other events may be auto-published. Queued and rejected events do not affect public deltas.
7. **Score.** For published events in the trailing {{ctx.scoreWindowDays}}-day window, multiply severity by the heuristic weight, apply category-specific exponential decay, sum by country and dimension, clamp to [{{ctx.deltaLowerBound}}, {{ctx.deltaUpperBound}}], and write API-only experimental deltas.

## Clustering coverage {#clustering-coverage}

The frozen [cluster coverage report](/api/v1/pulse/cluster-coverage) publishes cluster-size, recorded source-ID, source-family, language, provisional-country, and method-version distributions for retained reports. It is a descriptive release rather than an accuracy result. Source-family diversity does not establish editorial independence, and the stored historical clusters should not be read as if the current method had produced all of them. Held-out overmerge and undermerge evaluation remains pending.

## Source independence {#source-independence}

The corroboration stage uses `{{ctx.sourceIndependenceVersion}}` to compare the retained reports attached to one event. Reports are treated as dependent when they share the same evidence snapshot, canonical URL, publisher family, declared underlying origin, or near-verbatim account. Dependencies are joined transitively into evidence groups. A specialist report and a news copy of it form one specialist group rather than two corroborating sources.

Publisher identity is taken from the recorded publisher host for aggregated news and from the connector&rsquo;s known organization for direct specialist or wire feeds. When an aggregated-news publisher cannot be resolved, the method collapses those unresolved reports within the event. This conservative rule can undercount genuinely separate reporting, but it avoids awarding corroboration merely because publisher metadata is missing.

The checked regression fixture was labelled before detector evaluation and must reach pairwise precision of at least {{ctx.sourceIndependencePrecisionPct}}% and recall of at least {{ctx.sourceIndependenceRecallPct}}%. It passes those gates. This small, internally reviewed fixture protects known cases such as wire copies, mirrored NGO releases, and references to one underlying report. It is not representative external validation. Distinct publishers can still rely on the same undisclosed reporting, and paraphrased republication can evade a lexical detector. The later held-out event evaluation must measure those errors on a broader sample.

## Version identity {#version-identity}

Each attempted pipeline stage has an immutable run record. It names the stage, methodology, production ontology, pipeline and algorithm versions, prompt version or a reason no prompt applies, configured provider/model set, source basket, individual source IDs, and upstream run IDs. The run closes as completed, partial, or failed with outcome counts and retained component failures. Its version payload and content-derived key cannot be edited or deleted after insertion.

Raw items point to the ingest run that created them. Cluster and classification links are write-once. Events identify their classification, latest corroboration, and current publication decision runs; a human review has its own append-only audit row. Stored dimensional outputs identify the score run that computed them. A later recomputation may replace a current-state pointer, but the referenced run record remains immutable. Append-only output history is a separate later requirement.

Rows created before this contract point to fixed legacy stage records. Every unknown axis remains `legacy_unversioned`; the migration does not infer a modern method, ontology, prompt, provider, model, source basket, algorithm, or pipeline version. Event and delta APIs return exact row identities plus a version-set summary. A mixed or legacy result has `comparableAsSingleSeries: false` and cannot present as one continuous current-method series.

## Evidence identity {#evidence-identity}

Every raw item is a private, immutable evidence snapshot under `pulse-raw-evidence/v1`. It retains the exact item URL and retrieval time, the fetched source payload and extracted text used by the pipeline, a content hash, a content-addressed identity key, the source-declared language or `und`, the publisher and source family, the country label and jurisdiction resolution used at ingest, and the source-rights record as it stood at capture. Event-source rows must link back to one of these snapshots. The event and changelog APIs expose the evidence identity and its rights metadata, but never the stored publisher payload.

The snapshot protects the audit trail when a link changes or disappears. Its hash identifies the stored evidence; it does not prove that the publisher's statement was accurate. Country attribution is the ingest-time result and may be `unresolved`. A later correction cannot rewrite the snapshot. It must create a separately recorded decision under the applicable attribution and correction contracts.

Public payload redistribution is blocked for every capture. Free access, an RSS item, a GDELT record, or a citation does not grant permission to republish an underlying article. The captured rights record names the terms URL, review status, redistribution posture, and restrictions. A later public data release needs its own verified source-rights decision. Rows retained before this contract keep their actual stored payload and retrieval metadata under explicit legacy hash and attribution methods; the migration does not invent a language, license review, publisher permission, or current resolver result.

## Event ontology — {{ctx.ontologyVersion}} {#event-categories}

The adopted research codebook is **{{ctx.ontologyVersion}}**. It carries forward all **{{ctx.ontologyCategoryCount}} event categories** from the production {{state.pulse.taxonomy.version}} taxonomy and permits several labels on one real-world event when the source record supports distinct facets. Each assigned label retains its own evidence references and rationale. Its dimension is derived from the category rather than chosen separately by a model.

The scheduled classifier still writes one {{state.pulse.taxonomy.version}} category per event. That runtime remains in place until the row schema, prompts, review tools, API contract, migration, and evaluation release all name the new ontology version. Existing rows keep the version under which they were classified; adopting the codebook does not silently relabel them.

The five dimensions remain Democratic Quality, Rule of Law, Rights & Freedoms, Corruption Control, and Stability. The v2 derivation record is preserved in [the gap-analysis document](https://github.com/fbalino/civica/blob/main/docs/taxonomy-v2-gap-analysis.md).

### Severity descriptors

Severity describes the documented reach and reversibility of a particular event facet. It is recorded separately from effect direction and from any experimental numeric delta.

| Descriptor     | Meaning                                                                                                                                   |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `not_assessed` | The occurrence is supported, but its institutional scope or intensity has not been assessed.                                              |
| `limited`      | Localized, short-duration, narrowly targeted, or readily reversible.                                                                      |
| `material`     | Substantial within an institution, jurisdiction, or affected population, without threatening the institutional order as a whole.          |
| `major`        | National, prolonged, difficult to reverse, or consequential for a core institution.                                                       |
| `critical`     | Disrupts the constitutional or institutional order, affects a very large population, or has severe and difficult-to-reverse consequences. |

Effect direction is one of `expansive`, `restrictive`, `mixed`, `unclear`, or `not_assessed`. It refers only to the named construct. It is not an overall verdict on a policy, government, event, or country.

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

The carried-forward production categories retain their theoretical references, decay settings, and prior production directions for historical interpretation. The new annotation contract separates occurrence, direction, and severity so those older settings do not predetermine a research annotation.

## Disambiguation — when an event could fit multiple categories {#disambiguation}

One event may receive labels from several dimensions, but each label must describe a separately evidenced facet. Two rules prevent double coding. The same category cannot be assigned twice to one facet, and a generic label cannot sit beside its more specific counterpart on that same facet. Mutually exclusive outcomes, such as `fair_election` and `election_cancellation`, remain unassigned candidates when the evidence does not resolve them.

A lawful institutional act can qualify as an event without being coded as beneficial or harmful overall. A disaster emergency with no documented governance effect is outside the ontology. When the evidence establishes an occurrence but cannot distinguish, for example, an independent corruption conviction from selective prosecution of an opponent, the record keeps both candidate labels and an ambiguity reason; neither becomes an assigned label.

Additional consequences are never inferred from the first event. Evidence of a coup alone does not establish media closure, martial law, electoral annulment, or detention. Each consequence needs its own source support.

| Case                                                                                                                        | Treatment                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| A seizure of power, a separately documented dissolution of the elected legislature, and a separately documented media order | Assign `coup`, `constitutional_override_electoral`, and `media_shutdown` to three evidenced facets.           |
| A certified fair result accompanied by separately documented partisan violence                                              | Assign `fair_election` and `electoral_violence`; the labels describe different facets.                        |
| An opposition leader is convicted, but available evidence cannot establish prosecutorial independence                       | Keep `corruption_conviction` and `opposition_prosecution` as candidates; assign neither pending adjudication. |
| A lawful disaster emergency has no documented institutional or rights effect                                                | Mark non-qualifying; do not force an `emergency_declaration` label.                                           |
| One decree both declares an emergency and extends a mandate                                                                 | Use the specific `term_extension` label for that facet, not both labels.                                      |
| A coup report contains no evidence of military jurisdiction over civilians                                                  | Assign `coup`; do not infer `martial_law`.                                                                    |

Changes are versioned. A new category needs a definition, dimension, source-framework rationale, example, counterexample, and compatibility review. Changes to category identity, dimension, compatibility, severity, or annotation states require a new major version and a migration map. Old annotations keep their recorded version.

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

Current provider-tagged events store each successful voter result and rationale plus the verification result. The public ledger also contains older classifier generations whose compatibility labels cannot be interpreted literally as three-voter counts. Those rows now carry explicit legacy stage-run identities rather than guessed versions. Event and delta APIs return the exact run identity for each row and a version-set verdict; mixed or legacy results state that they are not comparable as one method series. Every row remains challengeable through the [corrections process](#corrections).

## Asymmetric scoring — anti-gaming {#asymmetric-scoring}

The experimental weighting applies stronger discounts to positive events to reduce sensitivity to symbolic or state-promoted claims. These are hand-set **heuristic multipliers**, not empirically calibrated probabilities or publication gates:

- A positive event with **no independent specialist evidence group** has its corroboration confidence reduced (currently ×0.6), so a state-announced "reform" with no specialist record barely moves the score.
- In **low-press-freedom** countries, a positive event with fewer than two independent evidence groups is discounted further (currently ×0.5). The grouping method detects several common republication relationships but does not establish state ownership or full editorial independence.

(The classifier is instructed to drop un-enacted announcements and symbolic claims, but this behavior has not completed representative evaluation.)

Negative events do not receive the positive-event multipliers. There is currently no minimum such as “one specialist plus one news group” or “two independent news groups”: a one-group event can affect an API-only experimental delta at reduced weight. The source-independence detector changes the heuristic count; it does not create a publication requirement.

## Press-freedom rule {#press-freedom-rule}

The current code uses an incomplete static lookup of approximate 2024 RSF scores, with an unobserved country defaulting to 50. This is a provisional context heuristic, not a complete, versioned RSF dataset. It applies the following multipliers to the corroboration weight:

- **Score ≥ 70 (free press).** News-only signals carry full weight.
- **Score 50–69 (partially free).** All events are discounted (currently ×0.8), including specialist-backed events.
- **Score < 50 (restricted press).** News-only signals are heavily discounted (currently ×0.3) — on their own they barely move the score, so a published event in a closed-press country effectively needs a specialist source to register.

This rule is an unvalidated attempt to reduce media-asymmetry effects. It does not solve non-observation in closed regimes and must not turn “no detected event” into evidence of stability.

## Decay — different events fade at different rates {#decay}

Pulse Beta assigns event-type-specific half-lives instead of a single uniform decay constant. The production scorer nevertheless includes events only in a trailing {{ctx.scoreWindowDays}}-day window, so any longer half-life parameter is truncated when the event leaves that window.

| Category                            | Half-life (days) |
| ----------------------------------- | ---------------: |
| Coup d'état                         |              365 |
| State collapse                      |              730 |
| Constitutional override / self-coup |              365 |
| Judicial purge                      |              365 |
| Free and fair election              |               90 |
| Flawed election                     |              180 |
| Journalist arrest (individual)      |               60 |
| Media shutdown                      |              180 |
| Protest crackdown (discrete)        |               90 |
| Systematic crackdown (pattern)      |              180 |
| Anti-corruption conviction          |              120 |
| Peace agreement (signed)            |               90 |
| Peace agreement (implemented)       |              365 |
| Armed conflict (active)             |              180 |

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
- A one-group event can currently affect an experimental delta. The source-independence detector collapses common same-publisher, wire-copy, mirror, and named-origin relationships, but it has only an internal regression fixture. It can miss paraphrased or undisclosed republication and can conservatively merge separate reports when publisher metadata is unresolved.
- Current clustering compares normalized event identities without a country partition, but most retained historical clusters predate that method. The lexical-only fallback has not been evaluated as equivalent to the multilingual semantic path, and held-out overmerge and undermerge performance remains unknown.
- The classifier is deliberately strict — the large majority of ingested news is commentary, business, or un-enacted announcements rather than discrete governance events, and is dropped. This keeps noise out of the scores, but a genuine event can occasionally be discarded; missing-event disputes are welcomed.
- LLM classification is imperfect. Current provider-tagged runs preserve successful voter and verification outputs, while older classifier generations remain explicitly legacy-versioned. The API prevents the full ledger from presenting as a homogeneous current-method sample.
- Positive events receive stronger heuristic discounts than negative events. This is an anti-gaming design choice under evaluation, not a requirement that they be independently verified before publication.
- “Corroboration weight” is a heuristic, not a calibrated probability. The provisional press-context lookup is incomplete, applies a default to uncovered countries, and has not been validated as a bias correction.
- Dimensional deltas are bounded and limited to a trailing {{ctx.scoreWindowDays}}-day window. Longer configured half-lives are truncated, and structural-overlap handling is not durable.
- The published historical smoke test uses an earlier classifier architecture and does not validate the current production ensemble. Representative evaluation and independent review are incomplete.
- Pulse classifications and numeric effects have not completed independent review and should not be treated as established measurements.

## Corrections and disputes {#corrections}

File a Pulse dispute via the [corrections form](/civica-index/corrections). Pulse-specific dispute categories include event misclassification, severity miscalibration, false positives, missing events, and duplicate events. Public submissions can be followed in the corrections log; privacy-requested submissions are omitted. Best-effort targets are {{state.disputeSla.initialResponseDays}} calendar days for initial review and {{state.disputeSla.fullDispositionDays}} calendar days for full disposition. The governing rules are in the [corrections policy](/policies#corrections).
