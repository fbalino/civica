# Pulse independent coding codebook v1

**Protocol:** `pulse-independent-coding/v1`

**Ontology:** `pulse-event-ontology/v3.0`

**Synthetic pilot:** `pulse-coder-pilot/v1`

**Frozen:** 2026-07-11, before blind-pilot answers or evaluation labels were inspected

**Status:** pre-human instruction and tooling pilot

## Purpose and unit

This codebook governs independent review of Pulse evidence. The coding unit is one sampled sovereign-country UTC day. A packet may contain no event, one event, or several distinct events. Articles, search results, model votes, publication decisions, and country-day scores are not events.

The task is descriptive. Coders identify documented institutional occurrences, evidence limits, and Pulse retrieval status. They do not grade the country, decide whether a policy is good, infer public support, or turn event counts into a country comparison.

## What a coder receives

Both coders receive the same packet, this codebook, the category-boundary catalog, and the adopted ontology. Evidence is divided into three channels:

- `pulse_retained`: private evidence available to the frozen Pulse retrieval pipeline;
- `audit_search`: evidence found by the independent country-day audit but absent from the retained Pulse packet;
- `context`: source access, date, language, outage, or sourced information-environment evidence used to judge observability.

The retained/audit distinction is necessary to identify retrieval misses. It says nothing about whether Pulse classified, reviewed, scored, or published an item.

Coders never see production labels or dispositions, publication status, model votes or confidence, numeric effects, owner approvals, another coder's work, an adjudicated answer, or any purported gold label. Coder identities remain pseudonymous until both submissions are locked.

## Coding sequence

Use this order for every packet:

1. Verify the country alias and sampled date. Record a corrupted or invalid country-day as `out_of_scope`; do not use that outcome for ordinary irrelevant stories.
2. Review every evidence item and all three query families. Record inaccessible material, language limits, source dependence, date mismatch, a documented outage, and any sourced restricted-information condition.
3. Identify occurrences on the sampled date. Separate event time from article publication and retrieval time.
4. Collapse wire copies, mirrors, and repeated accounts of the same occurrence. Several articles can support one event; one article can describe several events.
5. Apply the ontology to each supported event. Give each distinct facet its own evidence and rationale.
6. Assign the packet outcome from the rules below. Write the observation rationale before locking the submission.

Do not search outside the supplied packet during the frozen pilot. PUL-017 will enforce the same evidence boundary in the review tool.

## Packet outcomes

| Outcome | Use when | Do not infer |
|---|---|---|
| `qualifying_event` | At least one in-scope event is supported, and every supported event in the packet has matching `pulse_retained` evidence. | That the event was classified correctly, published, independently corroborated, or reviewed by a human. |
| `retrieval_miss` | At least one in-scope event on the sampled date is supported only by `audit_search` evidence. | That every other pipeline stage failed. The missed event is evaluated separately downstream. |
| `true_negative` | No in-scope event is found and the packet meets the sufficient-observation rule. | That no event occurred in reality. This label means no qualifying event found under this frozen audit protocol. |
| `insufficient_observation` | No event can be assigned and evidence access, coverage, language, outage, restriction, or unresolved support prevents sufficient observation. | Stability, event absence, or good governance. |
| `out_of_scope` | The sampled unit itself is not a valid sovereign-country day in the frozen population. | An irrelevant article does not make a valid packet out of scope. Exclude the article and continue. |

When a packet contains both retained and missed qualifying events, use `retrieval_miss` and record every event separately. An observed event remains codable under low coverage, outage, or a restricted information environment.

## Observation rule

`sufficient_observation` requires all three frozen query families to have been reviewed, at least five accessible and date-relevant documents across at least two independent source families, and no known complete source outage or sourced restricted-information condition. Source independence follows `pulse-source-independence/evidence-family-v1`; five copies of one wire report count as one family.

The threshold is an operational disclosure rule inherited from `pulse-observability/country-period-v1`. It is not a validated estimate of recall. A coder may mark `low_coverage`, `source_outage`, `restricted_information_environment`, or `undetermined` when the packet does not support sufficient observation. Restricted-information status requires a sourced context item; a coder cannot infer it from country reputation.

Search silence is not a true negative. A result-free query records what the provider returned at capture time and normally supports `insufficient_observation`.

## Event admission

An assigned event must:

- describe an identifiable domestic institutional occurrence covered by the ontology;
- occur on the sampled date or have a bounded interval that includes it;
- carry at least one retained evidence identity;
- identify the primary jurisdiction from supplied evidence;
- remain distinguishable from commentary, prediction, general conditions, source failure, and duplication.

Record the primary jurisdiction once. `affectedJurisdictions` contains only distinct additional jurisdictions materially affected by the occurrence; never repeat the primary country there.

Exclude opinion, rhetoric, forecasts, polling movement, ordinary crime, routine disaster logistics, macroeconomic news, and foreign-policy acts without a separate domestic institutional occurrence. A lawful act can qualify when it produces the institutional occurrence named by a category. Inclusion does not state that it improved or harmed the country as a whole.

## Applying event labels

The complete 61-category operational catalog is `data/research/pulse-category-coding-boundaries-v1.json`. The annotation tool must show each category's definition, inclusion evidence, nearest exclusion boundary, dimension, and common confusion before a coder can select it.

For every assigned label, record:

- category id and distinct facet id;
- evidence identities supporting that facet;
- effect direction relative to the named construct: `expansive`, `restrictive`, `mixed`, `unclear`, or `not_assessed`;
- severity: `limited`, `material`, `major`, `critical`, or `not_assessed`;
- one evidence-grounded rationale.

Several labels may describe one event only when each names a separate supported facet. Never infer a cascade. Evidence of a coup does not establish legislature dissolution, martial law, media closure, detention, or election annulment. A generic and more specific category cannot label the same facet. In particular:

- `emergency_declaration` yields to an evidenced specific effect such as `term_extension`, `election_cancellation`, `judicial_purge`, or `martial_law` on the same facet;
- `systematic_crackdown` yields to a named institutional target such as `ngo_restriction` or `media_shutdown` on the same facet;
- `mass_detention` yields to `opposition_prosecution` or `detention_conditions` when that specific facet is the evidence focus;
- `corruption_conviction` records the high-level judgment; `anticorruption_conviction` additionally requires evidence that the process was institutionally independent and cannot duplicate the judgment facet;
- `negotiated_transition` and `negotiated_transition_stability` require distinct democratic-opening and rupture-reduction facets rather than two descriptions of one rationale.

Effect direction is construct-specific. Severity describes evidenced reach, duration, reversibility, and institutional scope. Neither field is a probability, score, moral verdict, or country-quality band. Use `not_assessed` rather than guessing.

## Ambiguity and abstention

Assign a label only when its evidence rule is met. If two labels remain plausible on the same evidence, assign neither. Record both as candidate labels and state what evidence is missing. An opposition figure's conviction, for example, does not by itself establish either independent anti-corruption enforcement or politically motivated prosecution.

Use an insufficient-evidence ontology annotation when the occurrence appears real but its category cannot be supported. Use the packet outcome `insufficient_observation` when the packet as a whole cannot support either an event or an audit-bounded negative. These are separate judgments.

Unassigned plausible occurrences go in `candidateEvents`, with evidence identities, candidate categories, the missing fact, and an ambiguity rationale. Do not place them in the assigned `events` array or leave them only in free-text notes.

Never settle uncertainty by copying the production label, taking a model majority, asking the project owner what “should” count, or choosing the category with the larger former numeric effect.

## Training and qualification

The six descriptively named synthetic `TRAIN-*` packets in `pulse-coder-pilot/v1` are worked examples. Training identifiers never share a numeric suffix with a blind packet. Their teaching answers demonstrate:

- independent multi-label facets;
- a coup cascade that needs separate evidence;
- a routine disaster notice that remains non-qualifying;
- an unresolved opposition-corruption case;
- a search-only retrieval miss;
- search silence that requires abstention.

Training cases never enter agreement, accuracy, or performance estimates. A prospective coder reviews them before qualification and may discuss them with the trainer.

The twelve synthetic `PILOT-*` packets carry no answer key. Two coders work independently and lock every field before comparison. The pilot spans retained events, search-only events, audit-bounded negatives, absent results, a complete source outage, sourced restriction, republication, date mismatch, foreign-policy exclusion, routine emergency logistics, unresolved prosecution, and a multi-facet coup.

Agent pilot results test whether the instructions and schemas are usable. They remain `dry_run_not_gold` permanently. They cannot satisfy the later human reliability, validity, or external-review gates.

## Comparison and adjudication

After both submissions lock, compare at least these axes separately: packet outcome, observability, event identity, event date, primary and affected jurisdiction, category labels, effect direction, severity, candidate labels, and evidence references. Exact agreement on one axis cannot hide disagreement on another.

Every disagreement enters a separate queue with one or more reason codes:

`evidence_overlooked`, `scope_boundary`, `date_boundary`, `source_independence`, `duplicate_identity`, `category_boundary`, `effect_direction`, `severity`, `observability`, `insufficient_context`, `coder_error`, or `codebook_gap`.

The adjudicator works only after both submissions are locked, cannot be either coder, and cannot see production, owner, or model answers. The adjudicator may select a supported submission, write a new evidence-grounded decision, or leave the item unresolved. Two-coder majority voting is meaningless and prohibited.

Raw submissions remain immutable beside the adjudication record. A `codebook_gap` pauses affected coding, creates a new protocol version, and sends every affected prior item for recoding. Adjudication never edits history.

Only qualified human adjudication may enter a later gold release. The project owner can administer the study but does not define the answer key. Production outputs, model consensus, agent dry runs, and prior owner approvals remain evaluation targets or process evidence, not truth.

## Method sources

- Klie, de Castilho, and Gurevych document the need for iterative pilots, annotator training, representative double annotation, manual inspection, and preservation of raw annotations alongside adjudication: [Computational Linguistics 50(3)](https://aclanthology.org/2024.cl-3.1/).
- Mitamura et al. show how independent first-pass event annotations and adjudication expose span, type, and realis disagreements in event coding: [Event Nugget Annotation](https://aclanthology.org/W15-0809/).
- Cofie, Braund, and Dalgarno emphasize reporting how independent coders agree and disagree rather than treating one coefficient as proof of validity: [Eight ways to get a grip on intercoder reliability](https://pmc.ncbi.nlm.nih.gov/articles/PMC9099179/).

PUL-017 owns the access-controlled double-coding tool. PUL-018 through PUL-020 own end-to-end performance, agreement, uncertainty, and subgroup analysis. This codebook does not claim that Pulse or its labels are valid.
