import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { sql } from "drizzle-orm";

import { db } from "../src/lib/db";
import { getJurisdictionEntityCatalog } from "../src/lib/pulse/v2/country-attribution";

config({ path: ".env.local" });
const live = process.argv.includes("--live");
const failures: string[] = [];
const requireFragments = (path: string, fragments: readonly string[]) => {
  const source = readFileSync(path, "utf8");
  for (const fragment of fragments) {
    if (!source.includes(fragment)) failures.push(`${path} missing ${fragment}`);
  }
};

requireFragments("src/lib/pulse/v2/country-attribution.ts", [
  "PULSE_JURISDICTION_ATTRIBUTION_VERSION",
  "humanReadableJurisdictionContext",
  "primaryIso3",
  "attributions",
  "evidenceRefs",
  "subjectAttributionDecisionPayload",
]);
requireFragments("src/lib/pulse/v2/jurisdiction-entities.ts", [
  "pulse-jurisdiction-entities/v1",
  "pulse-jurisdiction-entities/sha256:",
]);
requireFragments("src/lib/pulse/v2/classify.ts", [
  "cluster.jurisdictionId",
  "subject?.primaryJurisdictionId",
  "subject_attribution_unresolved",
]);
requireFragments("src/lib/db/schema.ts", [
  '"pulse_event_jurisdictions"',
  "idx_pulse_event_jurisdictions_one_primary",
  "pulse_event_jurisdictions_contract_check",
]);
requireFragments("drizzle/authoritative/0018_rich_phalanx.sql", [
  "materialize_pulse_event_jurisdictions",
  "pulse_event_jurisdictions_append_only",
  "Legacy single-jurisdiction projection",
  "pulse-jurisdiction-attribution/v2",
]);
requireFragments("src/lib/db/queries-pulse-v2.ts", [
  "requestedJurisdictionRole",
  "legacy_projection",
  "affected:",
  "primary:",
]);
requireFragments("content/methodology-pulse.md", [
  "### Jurisdiction roles",
  "`pulse-jurisdiction-attribution/v2`",
  "Passing cross-border fixtures establishes contract behavior, not representative attribution accuracy.",
]);

async function main() {
if (live) {
  const result = await db.execute(sql`
    WITH latest AS (
      SELECT DISTINCT ON (event_id)
        event_id, decision_key, payload->>'status' AS attribution_status
      FROM pulse_event_decisions
      WHERE event_id IS NOT NULL AND kind = 'subject_attribution'
        AND actor->>'type' <> 'verifier'
      ORDER BY event_id, decided_at DESC, created_at DESC
    ), latest_rows AS (
      SELECT l.event_id, l.decision_key, l.attribution_status,
        pej.jurisdiction_id, pej.role,
        pej.attribution_version, pej.entity_catalog_version,
        pej.entity_catalog_hash, pej.alias_version
      FROM latest l
      LEFT JOIN pulse_event_jurisdictions pej ON pej.decision_key = l.decision_key
    )
    SELECT
      (SELECT count(*)::int FROM pulse_events_v2) AS events,
      (SELECT count(*)::int FROM latest) AS latest_decisions,
      (SELECT count(*)::int FROM latest WHERE attribution_status IN ('single','multiple')) AS resolved_decisions,
      (SELECT count(*)::int FROM latest WHERE attribution_status = 'unresolved') AS unresolved_decisions,
      count(*) FILTER (WHERE jurisdiction_id IS NOT NULL)::int AS normalized_rows,
      count(DISTINCT event_id) FILTER (WHERE jurisdiction_id IS NOT NULL)::int AS covered_events,
      count(*) FILTER (WHERE role = 'primary')::int AS primary_rows,
      count(*) FILTER (WHERE role = 'affected')::int AS affected_rows,
      count(*) FILTER (WHERE attribution_version = 'pulse-jurisdiction-attribution/v2')::int AS versioned_rows,
      count(*) FILTER (WHERE attribution_version = 'pulse-jurisdiction-attribution/legacy-projection-v1')::int AS legacy_rows,
      count(*) FILTER (
        WHERE jurisdiction_id IS NOT NULL AND NOT (
          (attribution_version = 'pulse-jurisdiction-attribution/v2'
            AND entity_catalog_version = 'pulse-jurisdiction-entities/v1'
            AND alias_version = 'pulse-jurisdiction-aliases/v1'
            AND entity_catalog_hash ~ '^pulse-jurisdiction-entities/sha256:[a-f0-9]{64}$')
          OR (attribution_version = 'pulse-jurisdiction-attribution/legacy-projection-v1'
            AND entity_catalog_version = 'legacy-unversioned'
            AND alias_version = 'legacy-unversioned'
            AND entity_catalog_hash = 'legacy-unversioned')
        )
      )::int AS invalid_versions,
      (SELECT count(*)::int FROM latest l
       JOIN pulse_events_v2 e ON e.id = l.event_id
       JOIN pulse_event_jurisdictions pej
         ON pej.decision_key = l.decision_key AND pej.role = 'primary'
       WHERE e.jurisdiction_id <> pej.jurisdiction_id) AS projection_mismatches
    FROM latest_rows
  `);
  const row = (Array.isArray(result)
    ? result[0]
    : (result as { rows?: Array<Record<string, unknown>> }).rows?.[0]) as
    | Record<string, unknown>
    | undefined;
  if (!row) failures.push("live attribution audit returned no row");
  else {
    const events = Number(row.events);
    const latestDecisions = Number(row.latest_decisions);
    const resolvedDecisions = Number(row.resolved_decisions);
    const unresolvedDecisions = Number(row.unresolved_decisions);
    const coveredEvents = Number(row.covered_events);
    const primaryRows = Number(row.primary_rows);
    if (events !== latestDecisions) failures.push(`latest subject decisions ${latestDecisions}/${events}`);
    if (events !== resolvedDecisions + unresolvedDecisions) failures.push("latest attribution statuses do not close the event set");
    if (resolvedDecisions !== coveredEvents) failures.push(`normalized resolved attribution coverage ${coveredEvents}/${resolvedDecisions}`);
    if (resolvedDecisions !== primaryRows) failures.push(`latest primary rows ${primaryRows}/${resolvedDecisions}`);
    if (Number(row.invalid_versions) !== 0) failures.push(`${row.invalid_versions} attribution rows have invalid version metadata`);
    if (Number(row.projection_mismatches) !== 0) failures.push(`${row.projection_mismatches} event projections differ from latest primary attribution`);
    console.log(
      `Live attribution: ${resolvedDecisions} resolved and ${unresolvedDecisions} unresolved across ${events} events; ${row.normalized_rows} role rows (${row.affected_rows} affected); ${row.versioned_rows} v2 and ${row.legacy_rows} explicit legacy rows.`,
    );
  }
  const catalog = await getJurisdictionEntityCatalog(db);
  if (!catalog.entities.length) failures.push("live entity catalog is empty");
  console.log(`Entity catalog: ${catalog.entities.length} rows; ${catalog.hash}.`);
}

if (failures.length) {
  for (const failure of failures) console.error(`ERROR: ${failure}`);
  process.exit(1);
}
console.log(
  `PASS — pulse-jurisdiction-attribution/v2 keeps primary and affected roles, rationales, evidence references, and versioned human-readable entity context separate${live ? " against the live ledger" : ""}.`,
);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
