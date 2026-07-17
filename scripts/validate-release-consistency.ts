import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import {
  ciReproductionManifestErrors,
  type CiReproductionManifest,
} from "../src/lib/ci/release-publication";
import {
  CI_RELEASE_CONTRACTS,
  ciReleaseContractErrors,
} from "../src/lib/ci/release-selection";
import { releaseFamilyPolicyErrors } from "../src/lib/platform/release-consistency";
import { AUTHORITATIVE_MIGRATIONS } from "../src/lib/db/authoritative-migration-manifest";
import { MIGRATION_ARTIFACTS } from "../src/lib/db/migration-registry";

export const RELEASE_MIGRATION_ID = "0036_moaning_toad_men" as const;
export const RELEASE_MIGRATION_PATH =
  `drizzle/authoritative/${RELEASE_MIGRATION_ID}.sql` as const;

export function releaseMigrationSourceErrors(source: string): string[] {
  const errors: string[] = [];
  const required = [
    'CREATE TABLE "ci_index_releases"',
    'CREATE TABLE "ci_index_release_pointers"',
    'ALTER TABLE "ci_dimension_scores" ADD COLUMN "release_id"',
    'ALTER TABLE "ci_composite_scores" ADD COLUMN "release_id"',
    '"methodology_content_sha256" text NOT NULL',
    '"supersession_kind" text NOT NULL',
    '"uncertainty_policy" jsonb NOT NULL',
    '"dimension_rules" jsonb NOT NULL',
    "legacy_unregistered_vintage",
    "ci-composite/fixed-bounds-monte-carlo-v2",
    "ci-composite/fixed-bounds-weighted-v3",
    "UNIQUE NULLS NOT DISTINCT",
    "ci_index_releases_identity_shape",
    "ci_index_releases_source_artifacts_shape",
    "ci_index_releases_supersession_shape",
    "ci_index_releases_uncertainty_shape",
    "ci_index_releases_dimension_rules_shape",
    "civica_ci_methodology_content_sha256",
    "civica_ci_source_basket_version",
    "civica_ci_expected_derivation_envelope",
    "civica_ci_expected_derivation_version_key",
    "civica_validate_ci_release_score_row",
    "civica_guard_published_ci_score_mutation",
    "civica_guard_ci_release_header_mutation",
    "must be inserted as staging",
    "BEFORE INSERT OR UPDATE OR DELETE ON ci_index_releases",
    "civica_guard_published_ci_methodology",
    "civica_ci_dimension_storage_sha256",
    "civica_ci_composite_storage_sha256",
    "civica_validate_ci_release_pointer",
    "civica_guard_ci_release_pointer_delete",
    "verified_input_manifest_sha256 text",
    "verified_dimension_row_set_sha256 text",
    "verified_composite_row_set_sha256 text",
    "observed_dimension_storage_sha256 text",
    "observed_composite_storage_sha256 text",
    "LOCK TABLE ci_dimension_scores IN SHARE MODE",
    "LOCK TABLE ci_composite_scores IN SHARE MODE",
    "changed after semantic verification",
    "Index pointer must flip through civica_publish_ci_release()",
    "Index publication pointer cannot be deleted",
    "actual_methodology_content_sha256",
    "actual_source_artifacts",
    "jsonb_array_elements(release_row.dimension_rules)",
    "rule->>'upstreamRelease'=score.upstream_release",
    "rule->>'substitutionReason' IS NOT DISTINCT FROM score.substitution_reason",
    "score.supersedes_vintage_label IS DISTINCT FROM release_row.supersedes_vintage_label",
    "count(*)=count(DISTINCT history.jurisdiction_id)*5",
    "history_count<>jurisdiction_count*5",
    "civica_guard_published_pulse_history",
    "civica_guard_published_pulse_run",
    "civica_guard_pulse_publication_pointer_delete",
    "LOCK TABLE pulse_dimensional_delta_history IN SHARE MODE",
    "Deliberately no automatic publication here",
    "civica-affected-relations:",
  ];
  for (const token of required)
    if (!source.includes(token)) errors.push(`migration lacks ${token}`);
  if (
    /DO\s+\$\$[\s\S]*?PERFORM\s+civica_publish_ci_release\s*\(/i.test(
      source,
    )
  )
    errors.push("migration auto-publishes without the checked semantic gate");
  if (
    /civica_publish_ci_release\s*\(\s*target_release_id\s+text\s*\)/i.test(
      source,
    )
  )
    errors.push("publication function still accepts a release ID alone");
  if (/idx_ci_index_releases_coordinate/.test(source))
    errors.push("release headers still forbid corrected same-coordinate releases");
  if (
    /ON\s+"ci_dimension_scores"\s*\([^)]*"indicator_id"\s*\)/i.test(source) ||
    /ON\s+"ci_composite_scores"\s*\([^)]*"methodology_version"\s*\)/i.test(source)
  )
    errors.push("score uniqueness is not release-aware");
  const pulseHistoryGuard =
    source.match(
      /CREATE OR REPLACE FUNCTION civica_guard_published_pulse_history\(\)[\s\S]*?END \$\$;/,
    )?.[0] ?? "";
  for (const token of [
    "FROM pulse_pipeline_runs run",
    "(run.id=old_run_id OR run.id=new_run_id)",
    "run.stage='score'",
    "run.status='completed'",
  ]) {
    if (!pulseHistoryGuard.includes(token)) {
      errors.push(
        `Pulse history guard lacks terminal score-run closure (${token})`,
      );
    }
  }
  if (pulseHistoryGuard.includes("pulse_score_publication_pointers")) {
    errors.push(
      "Pulse history guard must not lose protection when the current publication pointer moves",
    );
  }
  return errors;
}

export function releaseSchemaSourceErrors(source: string): string[] {
  const required = [
    '"ci_index_releases"',
    '"ci_index_release_pointers"',
    '"release_id"',
    "methodologyContentSha256",
    "supersessionKind",
    "supersedesReleaseId",
    "uncertainty_policy",
    "dimensionRules",
    "nullsNotDistinct",
    "ci_index_releases_identity_shape",
    "ci_index_releases_source_artifacts_shape",
    "pulse_score_publication_pointers",
  ];
  return required
    .filter((token) => !source.includes(token))
    .map((token) => `schema lacks ${token}`);
}

export function releasePublicationScriptErrors(source: string): string[] {
  const errors: string[] = [];
  for (const token of [
    'type Mode = "stage" | "check" | "publish"',
    "ciReproductionManifestErrors",
    "ciPublicationInventoryErrors",
    "ciStagedReleaseHeader",
    "ciMethodologyContentSha256",
    "CI_TARGET_RELEASE_ID",
    "civica_ci_dimension_storage_sha256",
    "civica_ci_composite_storage_sha256",
    "civica_publish_ci_release",
    "dimensionStorageSha256",
    "compositeStorageSha256",
    "methodology_content_sha256",
    "supersession_kind",
    "uncertainty_policy",
    "dimension_rules",
  ])
    if (!source.includes(token)) errors.push(`publication script lacks ${token}`);
  if (/console\.(?:log|error)\([^\n]*(?:DATABASE_URL|process\.env)/.test(source))
    errors.push("publication script may print environment or database secrets");
  if (!/Choose exactly one mode/.test(source))
    errors.push("publication mode is not explicit and fail-closed");
  return errors;
}

export function releasePackageScriptErrors(
  scripts: Record<string, string | undefined>,
): string[] {
  const expected: Record<string, string> = {
    "stage:ci-release":
      "tsx scripts/publish-ci-release.ts --stage",
    "check:ci-release":
      "tsx scripts/publish-ci-release.ts --check",
    "publish:ci-release":
      "tsx scripts/publish-ci-release.ts --publish",
    "validate:release-consistency":
      "node --import tsx --test src/lib/ci/release-publication.test.ts src/lib/exports/atlas-release.test.ts src/lib/pulse/v2/publication-consistency.test.ts scripts/validate-release-consistency.test.ts && tsx scripts/validate-release-consistency.ts && npm run validate:deployment-rehearsal",
  };
  const errors: string[] = [];
  for (const [name, command] of Object.entries(expected))
    if (scripts[name] !== command)
      errors.push(`package script ${name} must equal ${JSON.stringify(command)}`);
  if (!(scripts["build:core"] ?? "").includes("npm run validate:release-consistency"))
    errors.push("build:core omits validate:release-consistency");
  return errors;
}

export function releaseMigrationRegistrationErrors(
  source: string,
): string[] {
  const errors: string[] = [];
  const hash = createHash("sha256").update(source).digest("hex");
  const authoritative = AUTHORITATIVE_MIGRATIONS.find(
    (row) => row.id === RELEASE_MIGRATION_ID,
  );
  if (!authoritative) errors.push("authoritative manifest omits release migration");
  else if (
    authoritative.path !== RELEASE_MIGRATION_PATH ||
    authoritative.sha256 !== hash ||
    authoritative.baseline
  )
    errors.push("authoritative migration registration or hash drifted");
  const registry = MIGRATION_ARTIFACTS.find(
    (row) => row.id === RELEASE_MIGRATION_ID,
  );
  if (!registry) errors.push("migration registry omits release migration");
  else if (
    registry.path !== RELEASE_MIGRATION_PATH ||
    registry.kind !== "mixed" ||
    registry.historyStatus !== "journaled"
  )
    errors.push("migration registry release entry is incompatible");
  return errors;
}

export function checkedReleaseArtifactErrors(): string[] {
  const errors = ciReleaseContractErrors();
  for (const release of CI_RELEASE_CONTRACTS) {
    const manifest = JSON.parse(
      readFileSync(
        `data/releases/${release.releaseId}/reproduction-manifest.v1.json`,
        "utf8",
      ),
    ) as CiReproductionManifest;
    let inputBytes: Buffer;
    try {
      inputBytes = readFileSync(manifest.inputManifest);
    } catch {
      errors.push(`${release.releaseId}: checked input manifest is missing`);
      continue;
    }
    for (const error of ciReproductionManifestErrors(
      release,
      manifest,
      inputBytes,
    ))
      errors.push(`${release.releaseId}: ${error}`);
  }
  return errors;
}

export function validateReleaseConsistency(): string[] {
  const migration = readFileSync(RELEASE_MIGRATION_PATH, "utf8");
  const schema = readFileSync("src/lib/db/schema.ts", "utf8");
  const publisher = readFileSync("scripts/publish-ci-release.ts", "utf8");
  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
    scripts: Record<string, string>;
  };
  const changelog = readFileSync("data/migrations/CHANGELOG.md", "utf8");
  return [
    ...releaseFamilyPolicyErrors(),
    ...checkedReleaseArtifactErrors(),
    ...releaseMigrationSourceErrors(migration),
    ...releaseSchemaSourceErrors(schema),
    ...releasePublicationScriptErrors(publisher),
    ...releasePackageScriptErrors(packageJson.scripts),
    ...releaseMigrationRegistrationErrors(migration),
    ...(changelog.includes(RELEASE_MIGRATION_ID)
      ? []
      : ["migration changelog omits release migration"]),
  ];
}

function main() {
  const errors = validateReleaseConsistency();
  console.log("=== PLT-014 release consistency ===\n");
  console.log(
    `Closed Index releases: ${CI_RELEASE_CONTRACTS.length}; migration: ${RELEASE_MIGRATION_ID}.`,
  );
  if (errors.length) {
    for (const error of errors) console.error(`ERROR: ${error}`);
    process.exit(1);
  }
  console.log(
    "PASS — checked manifests, staged headers, immutable rows, storage-race fingerprints, and the atomic public pointer are closed.",
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main();
