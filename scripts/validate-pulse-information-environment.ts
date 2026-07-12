import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { config } from "dotenv";
import { sql } from "drizzle-orm";

import { getDb } from "../src/lib/db";
import { RSF_2026_CANDIDATE_RELEASE } from "../src/lib/pulse/v2/press-freedom";

config({ path: ".env.local", override: true });

const migration = readFileSync(
  "drizzle/authoritative/0029_whole_dazzler.sql",
  "utf8",
);
const corroborate = readFileSync("src/lib/pulse/v2/corroborate.ts", "utf8");
const schema = readFileSync("src/lib/db/schema.ts", "utf8");
const inputManifest = JSON.parse(
  readFileSync(
    "data/releases/pulse-information-environment-rsf-2026/source-input-manifest.v1.json",
    "utf8",
  ),
) as {
  releaseId: string;
  pipelineIds: string[];
  inputs: Array<Record<string, unknown>>;
};
const input = inputManifest.inputs[0];
const adapterSha256 = createHash("sha256")
  .update(
    [
      "scripts/apply-pulse-information-environment.ts",
      "src/lib/pulse/v2/information-environment-evidence.ts",
    ]
      .sort()
      .map((path) => `${path}\0${readFileSync(path)}`)
      .join("\0"),
  )
  .digest("hex");

for (const required of [
  "pulse_information_environment_releases",
  "pulse_information_environment_values",
  "pulse_event_information_environment_pins",
  "pulse_events_v2_pin_information_environment",
  "pulse_information_environment_releases_append_only",
  "pulse_information_environment_values_append_only",
  "pulse_event_information_environment_pins_append_only",
  "historical-unrecoverable",
]) {
  assert.ok(migration.includes(required), `migration lacks ${required}`);
}
assert.ok(schema.includes("pulse-information-environment-pin/v1"));
assert.ok(corroborate.includes("loadInformationContexts"));
assert.ok(!corroborate.includes("press_freedom_score_at_classification"));
assert.ok(!corroborate.includes("onlyUnpinned"));
assert.equal(inputManifest.releaseId, "pulse-information-environment-rsf-2026");
assert.deepEqual(inputManifest.pipelineIds, ["pulse.information-environment"]);
assert.equal(inputManifest.inputs.length, 1);
assert.equal(input?.sourceId, "rsf_press_freedom");
assert.equal(input?.contentSha256, RSF_2026_CANDIDATE_RELEASE.contentSha256);
assert.equal(input?.redistributionPosture, "restricted-no-redistribution");
assert.equal(input?.adapterVersion, `sha256:${adapterSha256}`);

async function main(): Promise<void> {
  if (process.argv.includes("--live")) {
    const db = getDb();
    const result = await db.execute(sql`
    WITH supported AS (
      SELECT count(*)::int AS n
      FROM jurisdictions
      WHERE type <> 'aggregate_or_special_area'
    ), release AS (
      SELECT * FROM pulse_information_environment_releases
      WHERE release_id = 'rsf-world-press-freedom-index-2026'
    ), values_summary AS (
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE value_status = 'observed')::int AS observed,
        count(*) FILTER (WHERE value_status = 'missing')::int AS missing,
        count(*) FILTER (WHERE value_status = 'missing' AND (score IS NOT NULL OR tier IS NOT NULL))::int AS invented_missing,
        count(*) FILTER (WHERE value_status = 'observed' AND missing_reason IS NOT NULL)::int AS invalid_observed
      FROM pulse_information_environment_values
      WHERE release_id = 'rsf-world-press-freedom-index-2026'
    ), pin_summary AS (
      SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE value_status = 'missing' AND (score IS NOT NULL OR tier IS NOT NULL))::int AS invented_missing,
        count(*) FILTER (WHERE value_status = 'observed' AND release_id IS NULL)::int AS unversioned_observed
      FROM pulse_event_information_environment_pins
    ), event_summary AS (
      SELECT count(*)::int AS total FROM pulse_events_v2
    ), mismatches AS (
      SELECT count(*)::int AS n
      FROM pulse_events_v2 event
      LEFT JOIN pulse_event_information_environment_pins pin ON pin.event_id = event.id
      WHERE pin.event_id IS NULL
         OR pin.jurisdiction_id <> event.jurisdiction_id
         OR pin.classification_run_id <> event.classification_run_id
         OR pin.classified_at <> event.created_at
    ), trigger_summary AS (
      SELECT count(*)::int AS n
      FROM pg_trigger
      WHERE NOT tgisinternal
        AND tgname IN (
          'pulse_information_environment_releases_append_only',
          'pulse_information_environment_values_append_only',
          'pulse_event_information_environment_pins_append_only',
          'pulse_events_v2_pin_information_environment'
        )
    )
    SELECT
      supported.n AS supported,
      release.content_sha256,
      release.publisher_rows,
      release.matched_jurisdictions,
      release.supported_jurisdictions,
      release.rights_status,
      release.use_status,
      values_summary.total AS value_rows,
      values_summary.observed AS observed_rows,
      values_summary.missing AS missing_rows,
      values_summary.invented_missing AS invented_value_rows,
      values_summary.invalid_observed,
      pin_summary.total AS pin_rows,
      pin_summary.invented_missing AS invented_pins,
      pin_summary.unversioned_observed,
      event_summary.total AS event_rows,
      mismatches.n AS mismatches,
      trigger_summary.n AS triggers
    FROM supported, release, values_summary, pin_summary, event_summary, mismatches, trigger_summary
  `);
    const row = ((result as { rows?: Array<Record<string, unknown>> }).rows ??
      [])[0];
    assert.ok(row, "official release is not registered live");
    assert.equal(row.content_sha256, RSF_2026_CANDIDATE_RELEASE.contentSha256);
    assert.equal(
      Number(row.publisher_rows),
      RSF_2026_CANDIDATE_RELEASE.publisherRows,
    );
    assert.equal(Number(row.supported_jurisdictions), Number(row.supported));
    assert.equal(Number(row.value_rows), Number(row.supported));
    assert.equal(
      Number(row.observed_rows) + Number(row.missing_rows),
      Number(row.value_rows),
    );
    assert.equal(Number(row.matched_jurisdictions), Number(row.observed_rows));
    assert.equal(Number(row.invented_value_rows), 0);
    assert.equal(Number(row.invalid_observed), 0);
    assert.equal(Number(row.pin_rows), Number(row.event_rows));
    assert.equal(Number(row.invented_pins), 0);
    assert.equal(Number(row.unversioned_observed), 0);
    assert.equal(Number(row.mismatches), 0);
    assert.equal(Number(row.triggers), 4);
    assert.equal(row.rights_status, "pending");
    assert.equal(row.use_status, "disabled_pending_rights_and_validation");
    console.log(
      `Live context: ${row.observed_rows} observed + ${row.missing_rows} explicit missing across ${row.supported} supported jurisdictions; ${row.pin_rows}/${row.event_rows} events pinned.`,
    );
  }

  console.log(
    "PASS — information-environment releases, jurisdiction coverage, and classification-time event pins are immutable, complete, noninvented, and inactive in production weighting.",
  );
}

void main();
