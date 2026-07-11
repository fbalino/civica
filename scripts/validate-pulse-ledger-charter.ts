import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { config as dotenvConfig } from "dotenv";
import { neon } from "@neondatabase/serverless";

import {
  PULSE_LEDGER_RESEARCH_CHARTER,
  validatePulseLedgerResearchCharter,
} from "../src/lib/pulse/v2/research-charter";

const ROOT = process.cwd();
const live = process.argv.slice(2).includes("--live");
const unknown = process.argv
  .slice(2)
  .filter((argument) => argument !== "--live");
if (unknown.length > 0) throw new Error(`Unknown argument: ${unknown.join(", ")}`);

function read(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

function requireFragments(
  relativePath: string,
  fragments: readonly string[],
): void {
  const source = read(relativePath);
  for (const fragment of fragments) {
    assert.ok(
      source.includes(fragment),
      `${relativePath} is missing charter fragment: ${fragment}`,
    );
  }
}

async function main(): Promise<void> {
  assert.deepEqual(
    validatePulseLedgerResearchCharter(PULSE_LEDGER_RESEARCH_CHARTER),
    [],
  );

const charter = PULSE_LEDGER_RESEARCH_CHARTER;
assert.equal(charter.id, "pulse-ledger-charter/v1");
assert.equal(charter.status, "active_research_charter");
assert.match(charter.unit.definition, /identifiable occurrence/);
assert.match(charter.scope.temporal, /adoption snapshot/);
assert.match(charter.versioningRule, /new charter version/);

requireFragments("content/methodology-pulse.md", [
  "## Research charter {#research-charter}",
  "**Charter version: pulse-ledger-charter/v1.**",
  "documented governance-relevant event records",
  "An article, source count, model vote, country-day, and numeric delta are not ledger units",
  "No qualifying event observed and low observation are different states",
  "not complete, exhaustive, real-time, continuously observed",
  "No-value is a valid result",
  "pulse-ledger-research-charter-v1.md",
]);

requireFragments("plan/research/pulse-ledger-research-charter-v1.md", [
  "**Resolution:** `pulse-ledger-charter/v1`",
  "## Admission boundary",
  "## Sources and scope",
  "## Non-claims and observability",
  "## Success, suspension, and retirement",
  "No-value is a valid result",
]);

requireFragments(
  "src/app/(reader)/civica-index/methodology/pulse/page.tsx",
  ['{ id: "research-charter", label: "Research charter" }'],
);

const serialized = JSON.stringify(charter);
for (const required of [
  "targetUsers",
  "prohibitedUses",
  "inclusionRules",
  "exclusionRules",
  "nonClaims",
  "sourceUniverse",
  "observabilityLimitations",
  "successCriteria",
  "suspensionOrRetirementCriteria",
]) {
  assert.ok(serialized.includes(`"${required}"`), `charter omits ${required}`);
}

if (live) {
  dotenvConfig({ path: path.join(ROOT, ".env.local") });
  const databaseUrl = process.env.DATABASE_URL;
  assert.ok(databaseUrl, "DATABASE_URL is required for --live");
  const sql = neon(databaseUrl);
  const rows = (await sql`
    SELECT
      MIN(event_date)::text AS earliest_event,
      COUNT(*)::int AS events,
      COUNT(DISTINCT jurisdiction_id)::int AS jurisdictions
    FROM pulse_events_v2
  `) as Array<{
    earliest_event: string | null;
    events: number;
    jurisdictions: number;
  }>;
  const row = rows[0];
  assert.ok(row && row.events > 0, "live Pulse ledger is empty");
  assert.equal(row.earliest_event, "2026-04-13");
  assert.ok(row.jurisdictions > 0, "live Pulse ledger has no jurisdiction coverage");
  console.log(
    `Live adoption-snapshot check passed (${row.events} retained events; ${row.jurisdictions} jurisdictions; earliest ${row.earliest_event}).`,
  );
}

  console.log(
    `PASS — ${charter.id} closes the event unit, users, admission boundary, non-claims, source universe, scope, observability, and success/retirement rules${live ? " with its live adoption snapshot" : ""}.`,
  );
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
