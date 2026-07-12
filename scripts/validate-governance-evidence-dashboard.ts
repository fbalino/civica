import assert from "node:assert/strict";
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { buildGovernanceEvidenceExport, GOVERNANCE_EVIDENCE_INDICATORS, GOVERNANCE_EVIDENCE_RELEASE_ID } from "../src/lib/ci/governance-evidence";
import { getGovernanceEvidence } from "../src/lib/db/queries-governance-evidence";

config({ path: ".env.local" });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
const sql = neon(process.env.DATABASE_URL);

async function main() {
  const manifest = JSON.parse(readFileSync(`data/releases/${GOVERNANCE_EVIDENCE_RELEASE_ID}/manifest.v1.json`, "utf8"));
  assert.equal(manifest.scope.expected, 970);
  assert.equal(manifest.rowSha256, "58bac490cd025f12adbe175065275bc0c3498d6474725a64eb57585a6d8cf961");
  const [coverage] = await sql`SELECT count(*)::int rows,count(DISTINCT jurisdiction_id)::int countries,count(DISTINCT(source_id||':'||indicator_id))::int indicators FROM ci_research_panel_rows WHERE release_id=${GOVERNANCE_EVIDENCE_RELEASE_ID}`;
  assert.deepEqual({ rows: Number(coverage.rows), countries: Number(coverage.countries), indicators: Number(coverage.indicators) }, { rows: 970, countries: 194, indicators: 5 });
  const japan = await getGovernanceEvidence("japan");
  assert.ok(japan);
  assert.deepEqual(japan.rows.map((row) => `${row.sourceId}:${row.indicatorId}`), GOVERNANCE_EVIDENCE_INDICATORS.map((row) => row.identity));
  assert.deepEqual(japan.rows.map((row) => row.value), [0.734, 1.1161265, 1.5115753, 2, 71]);
  assert.match(japan.rows[3].direction, /Lower combined ratings/);
  const exported = buildGovernanceEvidenceExport(japan);
  assert.deepEqual(exported.rows.map((row) => row.value), [null, 1.1161265, 1.5115753, null, null]);
  assert.equal(exported.rows.filter((row) => row.valueStatus === "withheld").length, 3);
  const page = readFileSync("src/app/governance-evidence/page.tsx", "utf8");
  assert.doesNotMatch(page, /ScorePosition|letter grade|country-quality score[^<]*[0-9]/i);
  assert.match(page, /does not\s+average them, grade\s+(?:the country|countries)/);
  console.log(`PASS — dashboard preserves all ${coverage.rows} native release cells; Japan fixture is exact and restricted exports fail closed.`);
}
main().catch((error) => { console.error(error); process.exit(1); });
