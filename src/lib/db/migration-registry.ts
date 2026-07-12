export type MigrationHistoryStatus = "journaled" | "legacy_unjournaled" | "legacy_sequence_collision" | "operational_data_change";
export interface MigrationArtifact {
  id: string;
  path: string;
  kind: "schema" | "data" | "mixed";
  historyStatus: MigrationHistoryStatus;
  forwardArtifact: string;
  rollbackOrCompensation: string;
  dryRunPlan: string;
  invariantPlan: string;
  releaseNote: string;
}

const shared = (id: string, path: string, kind: MigrationArtifact["kind"], historyStatus: MigrationHistoryStatus): MigrationArtifact => ({
  id, path, kind, historyStatus,
  forwardArtifact: path,
  rollbackOrCompensation: `Restore the isolated pre-change backup or ship a reviewed forward compensation named ${id}-compensation; never reverse production DDL/data implicitly.`,
  dryRunPlan: `npm run db:plan -- --id=${id} reports affected relations, statement classes, content hash, and read-only pre-change row counts.`,
  invariantPlan: `npm run db:plan -- --id=${id} --live verifies affected-relation presence and exact row counts without writes; npm run validate:migrations verifies registry/history/policy closure.`,
  releaseNote: "data/migrations/CHANGELOG.md",
});

export const MIGRATION_ARTIFACTS: readonly MigrationArtifact[] = [
  shared("0000_smooth_kylun", "drizzle/migrations/0000_smooth_kylun.sql", "schema", "journaled"),
  shared("0001_contact_submissions", "drizzle/migrations/0001_contact_submissions.sql", "schema", "journaled"),
  shared("0002_pulse_events", "drizzle/migrations/0002_pulse_events.sql", "schema", "journaled"),
  shared("0002_purple_rachel_grey", "drizzle/migrations/0002_purple_rachel_grey.sql", "schema", "legacy_sequence_collision"),
  shared("0003_international_organizations", "drizzle/migrations/0003_international_organizations.sql", "schema", "legacy_sequence_collision"),
  shared("0003_soft_shinko_yamashiro", "drizzle/migrations/0003_soft_shinko_yamashiro.sql", "schema", "journaled"),
  shared("0004_gray_mojo", "drizzle/migrations/0004_gray_mojo.sql", "schema", "journaled"),
  shared("0005_wet_longshot", "drizzle/migrations/0005_wet_longshot.sql", "schema", "journaled"),
  shared("0006_gigantic_quasimodo", "drizzle/migrations/0006_gigantic_quasimodo.sql", "schema", "journaled"),
  shared("0007_stiff_hobgoblin", "drizzle/migrations/0007_stiff_hobgoblin.sql", "schema", "journaled"),
  shared("0008_violet_robin_chapel", "drizzle/migrations/0008_violet_robin_chapel.sql", "schema", "journaled"),
  shared("0009_colossal_zaladane", "drizzle/migrations/0009_colossal_zaladane.sql", "schema", "journaled"),
  shared("0010_careless_dakota_north", "drizzle/migrations/0010_careless_dakota_north.sql", "schema", "journaled"),
  shared("0011_tidy_mordo", "drizzle/migrations/0011_tidy_mordo.sql", "schema", "journaled"),
  shared("0012_bug1_value_type", "drizzle/migrations/0012_bug1_value_type.sql", "mixed", "legacy_unjournaled"),
  shared("0013_electoral_systems", "drizzle/migrations/0013_electoral_systems.sql", "schema", "legacy_unjournaled"),
  shared("0014_advisory_applications", "drizzle/migrations/0014_advisory_applications.sql", "schema", "legacy_unjournaled"),
  shared("0015_contact_messages_status", "drizzle/migrations/0015_contact_messages_status.sql", "schema", "legacy_unjournaled"),
  shared("0016_indicator_history", "drizzle/migrations/0016_indicator_history.sql", "schema", "legacy_unjournaled"),
  shared("0017_party_positions", "drizzle/migrations/0017_party_positions.sql", "schema", "legacy_unjournaled"),
  shared("0018_data_vintage_year", "drizzle/migrations/0018_data_vintage_year.sql", "mixed", "legacy_unjournaled"),
  shared("0019_growth_methodology", "drizzle/migrations/0019_growth_methodology.sql", "mixed", "legacy_unjournaled"),
  shared("0020_jurisdiction_status_taxonomy", "drizzle/migrations/0020_jurisdiction_status_taxonomy.sql", "mixed", "legacy_unjournaled"),
  shared("0021_derivation_version_envelopes", "drizzle/migrations/0021_derivation_version_envelopes.sql", "mixed", "legacy_unjournaled"),
  shared("0022_pulse_event_idempotency", "drizzle/migrations/0022_pulse_event_idempotency.sql", "mixed", "legacy_unjournaled"),
  shared("0023_data_value_states", "drizzle/migrations/0023_data_value_states.sql", "schema", "journaled"),
  shared("0024_research_evidence_retention", "drizzle/migrations/0024_research_evidence_retention.sql", "mixed", "journaled"),
  shared("0025_immutable_frozen_vintages", "drizzle/migrations/0025_immutable_frozen_vintages.sql", "mixed", "journaled"),
  shared("0026_temporal_metadata", "drizzle/migrations/0026_temporal_metadata.sql", "mixed", "journaled"),
  shared("0023_wide_gorilla_man", "drizzle/authoritative/0023_wide_gorilla_man.sql", "mixed", "journaled"),
  shared("0024_dark_maginty", "drizzle/authoritative/0024_dark_maginty.sql", "mixed", "journaled"),
  shared("0025_careful_the_professor", "drizzle/authoritative/0025_careful_the_professor.sql", "mixed", "journaled"),
  ...[
    "backfill-cia-vintage", "backfill-election-results", "backfill-growth-methodology",
    "backfill-methodology-version", "backfill-territory-iso2", "backfill-upstream-vintage-labels",
    "bridge-cia-legacy-to-canonical", "cleanup-bad-offices", "create-rate-limits-table",
    "reseed-bug3-corrupted", "restore-overdemoted-disputes",
  ].map((id) => shared(`data-${id}`, `scripts/${id}.ts`, id === "create-rate-limits-table" ? "mixed" : "data", "operational_data_change")),
] as const;
