# Migration and production-data change log

This is the internal release-note index for migration artifacts. It records
historical reality without pretending the incomplete legacy Drizzle journal is
authoritative. The deployable replacement is `drizzle/authoritative/`; this
file remains the archive index only.

Every ID below resolves to the checked forward artifact and policy metadata in
`src/lib/db/migration-registry.ts`.

## Schema and mixed migrations

0000_smooth_kylun · 0001_contact_submissions · 0002_pulse_events ·
0002_purple_rachel_grey · 0003_international_organizations ·
0003_soft_shinko_yamashiro · 0004_gray_mojo · 0005_wet_longshot ·
0006_gigantic_quasimodo · 0007_stiff_hobgoblin · 0008_violet_robin_chapel ·
0009_colossal_zaladane · 0010_careless_dakota_north · 0011_tidy_mordo ·
0012_bug1_value_type · 0013_electoral_systems · 0014_advisory_applications ·
0015_contact_messages_status · 0016_indicator_history · 0017_party_positions ·
0018_data_vintage_year · 0019_growth_methodology ·
0020_jurisdiction_status_taxonomy · 0021_derivation_version_envelopes ·
0022_pulse_event_idempotency · 0023_data_value_states ·
0024_research_evidence_retention · 0025_immutable_frozen_vintages ·
0026_temporal_metadata

Authoritative follow-up: `0010_early_hawkeye` adds private immutable Civica
Index research-panel release and row tables for IDX-006. Exact source values
remain outside public repository artifacts; checked manifests expose hashes,
coverage, exclusions, and temporal-break metadata only.

`0011_freeze_ci_research_panel` adds database triggers that reject writes to
completed research-panel releases and their rows.

`0012_fix_panel_release_staging_delete` preserves deletion of an incomplete
staging release while keeping completed releases immutable.

`0013_real_bromley` adds immutable Pulse pipeline-run identities and binds
ingest, cluster, classification, corroboration, review/publication, and score
rows to their exact stage runs. Existing rows point to explicit fixed legacy
runs; no historical method, prompt, model, ontology, or source basket is
inferred. `0014_boring_tana_nile` adds the database check that binds each run's
stored stage and schema to its content-addressed version key.

`0015_steep_cyclops` seals each Pulse raw item as an immutable private
evidence snapshot with exact URL and retrieval time, content and identity
hashes, explicit language state, publisher/source-family identity,
ingest-time jurisdiction attribution, and a captured source-rights posture.
Every event-source row must retain its raw-evidence link; public payload
redistribution remains blocked independently of site access.

`0023_wide_gorilla_man` adds stable Pulse incident identities, append-only
report-assignment and collision-resolution evidence, one-current-projection
enforcement, blank-headline quarantine, and the historical linkage needed for
the controlled PUL-031 duplicate repair.

`0024_dark_maginty` adds version-keyed Pulse cluster-classification state,
append-only attempt evidence, atomic leases, new-before-retry ordering,
deterministic bounded backoff, terminal exhaustion, sanitized errors, and
queue age/depth reporting. The backfill covers only directly provable event,
non-event, and invalid outcomes; historic call counts and per-provider failure
details remain unknown. Recovery uses an isolated pre-change backup or a
reviewed forward compensation, never in-place evidence reversal.

`0025_careful_the_professor` adds `pulse-review-sla/v1`: one retained
obligation per queued event, severity-based deadlines, append-only escalation
and bounded-exception evidence, a scheduled fail-closed monitor, and database
queue-entry enforcement. The pre-contract pending backlog is retained
unpublished as `legacy_quarantined`; the migration does not claim human review,
approval, or rejection for those items.

`0026_magenta_xavin` retires the empty `pulse_daily_scores` and
`pulse_changelog` relations after PUL-034 removed every scalar Pulse v1 reader
and writer. The migration fails closed if either relation contains a row and
does not alter the retained legacy `pulse_events` evidence table.

`0027_smart_tempest` adds the append-only
`pulse-dimensional-delta-history/v1` output ledger and explicit inclusive
365-day lookback metadata to the current Pulse dimensional projection. Existing
current rows receive deterministic dates from `last_computed_at` and are copied
once into history; later history rows reject updates and deletions.

`0028_complex_carlie_cooper` adds the append-only
`pulse-event-absorption/v1` evidence ledger. An absorption decision binds one
explicit event link to two sequential fixed-scale Index releases, exact
dimension scores, method, as-of date, rationale, and evidence references.
Corroboration confidence remains unchanged; scoring reads the latest retained
decision separately.

`0029_whole_dazzler` replaces the mutable legacy press-context scalar with
immutable release metadata, complete observed-or-explicit-missing coverage for
every supported jurisdiction, and one classification-time context pin per
Pulse event. Existing events are retained as historically unrecoverable rather
than backfilled from a later release. New event inserts pin the then-adopted
release automatically; release, value, and pin rows reject updates/deletes.
The registered RSF 2026 context remains disabled for production weighting and
observability while rights and validation are pending.

`0030_cute_namora` adds the normalized, version-bound
`constitution_passages` relation, partial GIN indexes for English lexical text
and topic filtering, current-section uniqueness, exact source/language/hash
metadata, and canonical passage-id history retention. The migration creates no
passage rows by itself: after applying it, run
`npm run backfill:constitution-passages -- --dry-run`, then the write command,
and verify exactly 96,126 current non-empty passages with
`npm run validate:constitution-search:live`. Superseded passage versions remain
resolvable. Recovery uses the isolated pre-change backup or a reviewed forward
compensation; do not drop retained passage/history rows as an ordinary rollback.

`0031_hot_saracen` replaces destructive legislature-party reseating with a
stable, source-keyed identity model. It adds `political_parties`, immutable
`party_composition_runs`, and append-only `party_identity_events`; backfills
one explicitly provisional identity per legacy chamber row; preserves every
existing `legislature_parties.id` and `party_positions` foreign key; and adds
current/retired state so later syncs update or soft-retire rows instead of
deleting them. Split, merge, and succession edges require a named source,
license, retrieval time, and explicit predecessor/successor IDs. The adoption
does not infer cross-chamber continuity from party names. Recovery uses the
isolated pre-change backup or a reviewed forward compensation; do not delete
the new append-only evidence ledgers as an ordinary rollback.

## Operational data changes

data-backfill-cia-vintage · data-backfill-election-results ·
data-backfill-growth-methodology · data-backfill-methodology-version ·
data-backfill-territory-iso2 · data-backfill-upstream-vintage-labels ·
data-bridge-cia-legacy-to-canonical · data-cleanup-bad-offices ·
data-create-rate-limits-table · data-repair-pulse-agreement · data-reseed-bug3-corrupted ·
data-restore-overdemoted-disputes

`data-repair-pulse-agreement` recomputes the current agreement projection from
stored provider-distinct, prompt-versioned classify runs. Unsupported labels
become `none`; automatic rows without that evidence enter legacy quarantine.
Human-reviewed publication remains intact, and the retention trigger records
every prior projection.
