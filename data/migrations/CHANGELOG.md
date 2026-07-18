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

`0032_sparkling_genesis` adds membership interval, precision, status,
dispute, source, rights, retrieval, and upstream-vintage fields to
organization relationships, plus the same source bundle for organization
identities. Existing blanket-seeded rows default to `unverified_legacy` and
remain available to the research-evidence history trigger while public read
boundaries exclude them. The migration does not declare any legacy row
current; after application, the versioned organization-membership sync
activates only the checked release and preserves ECOWAS withdrawals as dated
history. Recovery uses an isolated pre-change backup or reviewed forward
compensation rather than deleting retained rows.

`0033_flat_hardball` adds the append-only, no-truncate PLT-009 owner-admin security
boundary: durable logout tombstones store only domain-separated session-ID
hashes, and a common mutation ledger records bounded request, actor, action,
target, time, and result events without credentials, raw session IDs, request
bodies, IP addresses, or unbounded errors. Existing signed sessions remain
valid until expiry or explicit logout; no historical mutation or revocation
rows are invented. If old application code must be restored, rotate
`ADMIN_SESSION_SECRET` so it cannot ignore retained tombstones and revive a
copied cookie. Recovery otherwise uses an isolated pre-change backup or a
reviewed forward compensation; never delete the security ledger as an
ordinary rollback.

`0034_superb_the_fallen` adds the PLT-010 cron delivery boundary. One durable
execution row deduplicates each scheduled slot or manual Idempotency-Key; one
persistent lease row serializes every invocation of the same job across
instances; and one retained row records every attempt. Database-time leases,
monotonic fences, a three-attempt cap, canonical request hashes, and atomic
acquire/finalize functions make duplicate, overlapping, expired, and retried
deliveries explicit. Terminal rows require complete completion/status/result
evidence. A different delivery blocked by the job lease returns an unqueued
`busy` state without creating an execution or attempt; a duplicate of the same
delivery remains inspectable as in progress. Attempts, executions, and lease
fences reject deletion and truncation. This does not claim exactly-once
behavior for an external side effect separated from database finalization, so
every domain writer remains convergent and retry-safe. Recovery uses an
isolated pre-change backup or a reviewed forward compensation; never reset a
lease fence or delete cron delivery evidence as an ordinary rollback.

`0035_equal_marvex` adds the immutable Pulse classify delivery-to-run binding.
Each authenticated `pulse.v2.classify` execution key points to exactly one
classification pipeline run, while multiple later deliveries may adopt the
same older running run. The insert guard rejects another cron job or another
Pulse stage, and UPDATE, DELETE, and TRUNCATE are rejected. This closes the
case where a later delivery finishes an adopted run but its outer cron
finalization is lost: retrying that delivery resolves the retained binding
before considering new queue work. No historical handoffs are invented.
Recovery uses an isolated pre-change backup or a reviewed forward
compensation; never rewrite a retained binding as an ordinary rollback.

`0036_moaning_toad_men` adds the PLT-014 release-publication boundary. Civica
Index rows bind to one staged immutable header containing the exact method,
methodology-content hash, quarter, source-artifact basket, supersession kind,
release-specific uncertainty policy, transformation versions, row counts, and
checked clean-room row-set hashes. Release-aware NULLS-NOT-DISTINCT score keys
preserve legacy draft uniqueness while allowing a future corrected release at
the same method/period. The retained R3 → unregistered R2 vintage link remains
explicit; no R2 release header is invented. Publication is never inferred from counts:
the publication command first reproduces the checked semantic hashes, captures
database storage fingerprints, and calls one database function that locks
score writes, rechecks those fingerprints, marks the header published, and
flips the single public pointer atomically. Published headers, rows, and bound
methodology records reject mutation. The same migration adds a one-run Pulse
score pointer that requires a successful completed run, one exact score date,
and five retained dimension rows for every represented jurisdiction. Published
Pulse history closes when its score run completes, so replacing the current
pointer cannot reopen a previously published panel for late inserts; terminal
runs and deletion of the current pointer also reject mutation. It also
strengthens the already-triggered complete-candidate Atlas
winner identity check. Existing Index coordinates are attached to staged
headers but are deliberately not made public automatically. Deployers must run
the checked release publication sequence in historical order after migration;
recovery uses an isolated pre-change backup before publication or a reviewed
forward release/pointer correction afterward, never a rewrite of a published
release.

`0037_minor_sharon_carter` adds the PLT-016 operational route-performance
ledger. Each short-lived observation contains only a canonical route template,
HTTP method, closed metric/surface, bounded numeric duration or status, cache
profile, deployment release identifier, and telemetry-contract version. It
deliberately stores no raw pathname or parameter, query, cookie, IP address,
user agent, request body, account identifier, or error text. The application
prunes observations older than 30 days after non-retired cron requests; a
failed telemetry write or prune is non-fatal. This additive migration creates
an empty table only. PLT-019 owns the staged apply/rehearsal and production
deploy ordering; recovery before use is a reviewed forward migration or
isolated pre-change backup, never a fabricated historical telemetry record.

`0038_heavy_slyde` adds the PLT-017 production-pipeline observability ledger.
Each retained row identifies one registered scheduled or manual pipeline run,
its bounded start/end/status and row counters, declared source version/vintage
handles, freshness result, reliable supplied cost, deployment release, and a
short safe error code. It stores no request content, credentials, raw publisher
material, source URL, or exception text. The migration is additive and creates
no historical run rows. PLT-019 owns the staging/production apply rehearsal and
deployment ordering; recovery is a reviewed forward compensation or isolated
pre-change backup, never fabricated historical job evidence.

`0039_living_clea` adds the PLT-018 privacy-bounded exception-monitoring
ledger. A row is a deterministic fingerprint for a closed server, client, cron,
or production-script surface plus canonical route/job context, safe error code,
release identity, and protected source-map identity. It retains lifecycle state,
occurrence count, and opaque correction/status record links only. The migration
deliberately excludes exception messages, stacks, digests, request content,
headers, cookies, IP addresses, account identifiers, and source payloads. It is
additive and creates no historical error records. PLT-019 owns staged apply and
production deployment ordering; recovery is a reviewed forward compensation or
isolated pre-change backup, never fabricated monitoring evidence.

`0040_closed_young_avengers` adds the ATL-026 Conditions calculation ledger.
Every Conditions calculation now retains its dimension, methodology version,
alignment policy/status, and a complete set of native component observations.
Each component records its value state, reference year, source and indicator
lineage, inclusion decision, and the transformation that makes the calculation
reproducible. A score is written only when every required component is observed
for one shared reference year; mixed-year and missing-input calculations are
persisted as unavailable rather than labelled with the newest component year.
The migration is additive and keeps legacy score rows intact but unqualified for
the new decomposable Conditions read path. Conditions calculation and component
updates/deletes enter the research-evidence history ledger. Recovery is a
reviewed forward correction or isolated pre-change backup; never invent a
component observation or rewrite retained evidence as ordinary rollback.

`0042_grey_sally_floyd` adds ATL-027's immutable Conditions release contract.
Each explicitly named release stores its manifest hash, the exact per-period
eligible population and hash, declared components, missingness counts, and
component direction/normalization parameters. Calculation and score rows retain
their release identity, so a successor release cannot overwrite a cited prior
release. The migration retains history for the release, reference-set, and
parameter relations. Recovery is a forward successor release or isolated
pre-change backup; never change a frozen population or parameter in place.

`0043_pulse_decay_lifecycle` replaces the fixed 365-day score-window checks
with a closed compatibility set of 365 and 730 days while retaining the exact
date-arithmetic invariant. It changes no score value and writes no history:
the existing 365-day outputs remain immutable, and a subsequent score run
creates separately versioned 730-day projections/history. Recovery is an
isolated pre-change backup or reviewed forward compensation; never rewrite the
retained output ledger to make prior runs appear to use the newer window.

`0044_pulse_drift_monitoring` adds PUL-024's append-only baseline,
observation, and alert ledgers. A baseline stores only aggregate, bounded
distribution snapshots for one explicit method/window. Score-run observations
record whether comparison was unavailable, insufficient, within threshold, or
alerting; alert rows name a metric, aggregate shares, bounded affected-row
identifiers, and the remediation runbook path. No source payload, reviewer
notes, prompt, or model response is copied. Recovery is an isolated pre-change
backup or a reviewed forward compensation; never update a baseline or erase a
prior alert to hide a distribution change.

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
