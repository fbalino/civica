# Civica Pulse row-level version lineage v1

**Resolution:** `pulse-stage-version-envelope/v1`

**Adopted:** 2026-07-11

**Status:** Active production-lineage contract

**Canonical citation:** [Pulse methodology — Version identity](https://civicaatlas.org/civica-index/methodology/pulse#version-identity)

## Resolution

Every Pulse ingest, cluster, classification, corroboration, review, and score execution receives a UUID run identity and a content-addressed version envelope. The envelope records the method, production ontology, pipeline, algorithm, prompt or explicit non-applicability, configured provider/model set, source basket, source IDs, and upstream runs. The version payload, stage, key, and start time are immutable. A running record may close once to completed, partial, or failed with counts and component failures.

## Row bindings

- Each raw item names its ingest run. Cluster and classification run links are write-once.
- Each retained event names its classification run, latest corroboration run, and current publication-decision run when published.
- Each human review action names its append-only review run and preserves the before/after state.
- Each current dimensional output names its score run, which in turn names every publication and corroboration run used as input.
- Current-state output pointers may advance on a later computation; the referenced pipeline runs cannot change or disappear. PUL-035 separately owns append-only numeric-output history.

## Legacy boundary

Existing data is assigned only to six fixed legacy stage runs. Their method, ontology, pipeline, algorithm, prompt, and source-basket axes all say `legacy_unversioned`; provider/model and source lists stay empty. No current version is backfilled into an old row.

## Query rule

Public event and dimensional-output responses expose row-level run identities. Each list also derives a closed version-set state: `single_version`, `mixed_version`, `legacy_only`, or `empty`. Only a nonlegacy one-key set is comparable as one series. Mixed and legacy sets return `comparableAsSingleSeries: false`; callers may filter or separate them but cannot present them as a continuous current-method series.

## Change policy

Changing an axis, adding a stage, altering the envelope schema, or changing the version-key canonicalization requires a new envelope or pipeline version. Old runs and row links remain intact. A production ontology migration must name its new ontology version rather than relabel v2 rows under the adopted v3 research codebook.
