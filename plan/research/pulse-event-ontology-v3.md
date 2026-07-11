# Civica Pulse event ontology v3

**Resolution:** `pulse-event-ontology/v3.0`

**Adopted:** 2026-07-11

**Status:** Adopted research codebook; production migration pending

**Canonical citation:** [Pulse methodology — Event ontology](https://civicaatlas.org/civica-index/methodology/pulse#event-categories)

## Resolution

Civica adopts a versioned multi-label event ontology for Pulse annotation and evaluation. One real-world event may carry several category assertions when each assertion identifies a distinct facet and retains its own evidence and rationale. The ontology carries forward all 61 concepts in production taxonomy v2.0 across Democratic Quality, Rule of Law, Rights & Freedoms, Corruption Control, and Stability.

The scheduled classifier remains on the single-label v2.0 runtime until a later task migrates the row schema, prompts, review tools, API contract, stored data, and evaluation release. Existing records keep their original taxonomy version.

## Annotation contract

An annotation records a disposition, assigned labels, candidate labels, and an ambiguity reason where needed. Each assigned label names its category, facet, evidence references, construct-specific effect direction, severity descriptor, and rationale. The category determines the dimension. A qualifying event needs at least one assigned label; a non-qualifying record has no assigned or candidate labels; an insufficient-evidence record has candidates but no assigned labels.

Effect direction is `expansive`, `restrictive`, `mixed`, `unclear`, or `not_assessed`. It applies to the named construct and is not a verdict on a country, government, policy, or event as a whole.

## Severity descriptors

- `not_assessed`: occurrence supported; scope or intensity not assessed.
- `limited`: localized, brief, narrowly targeted, or readily reversible.
- `material`: substantial within an institution, jurisdiction, or affected population without threatening the institutional order as a whole.
- `major`: national, prolonged, difficult to reverse, or consequential for a core institution.
- `critical`: disrupts the institutional order, affects a very large population, or creates severe and difficult-to-reverse consequences.

Severity is descriptive. It is not a probability, numeric delta, moral judgment, or country-quality band.

## Compatibility and ambiguity

Different dimensions may coexist on one event when their facets and evidence are distinct. The same category cannot be asserted twice on one facet. Mutually exclusive outcomes cannot both be assigned on one facet. A generic label and its more specific counterpart cannot both describe the same facet, though separate independently evidenced facets may use both.

Plausible but unresolved labels remain candidates with an ambiguity reason. Lawful or legitimate acts may be recorded descriptively without an overall positive or negative judgment. Consequences are not inferred: evidence of a coup does not establish martial law, media closure, electoral annulment, or detention.

## Examples and counterexamples

- A documented seizure of power, dissolution of an elected legislature, and media closure may receive `coup`, `constitutional_override_electoral`, and `media_shutdown` when each facet has retained evidence.
- A fair certified result and separate partisan violence may receive `fair_election` and `electoral_violence`.
- An opposition corruption conviction with unresolved evidence about prosecutorial independence keeps `corruption_conviction` and `opposition_prosecution` as candidates and assigns neither.
- A lawful disaster emergency with no documented governance effect is non-qualifying.
- A decree extending a mandate receives the specific `term_extension` label for that facet rather than both `emergency_declaration` and `term_extension`.
- A coup report without evidence of military jurisdiction cannot support `martial_law`.

These cases are executable fixtures in `src/lib/pulse/v2/event-ontology.ts`.

## Change policy

A new category requires a definition, dimension, source-framework rationale, example, counterexample, compatibility review, and a new ontology release. A change to category identity, dimension, compatibility, severity, or annotation state requires a new major version and migration map. Old annotations retain their recorded version. Production may claim migration only when every classifier prompt, schema, review tool, API, stored-row migration, and evaluation release names the same ontology version.
