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

## Operational data changes

data-backfill-cia-vintage · data-backfill-election-results ·
data-backfill-growth-methodology · data-backfill-methodology-version ·
data-backfill-territory-iso2 · data-backfill-upstream-vintage-labels ·
data-bridge-cia-legacy-to-canonical · data-cleanup-bad-offices ·
data-create-rate-limits-table · data-reseed-bug3-corrupted ·
data-restore-overdemoted-disputes
