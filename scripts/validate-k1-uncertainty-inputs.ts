import assert from "node:assert/strict";
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { K1_UNCERTAINTY_INPUT_RELEASE_ID } from "../src/lib/ci/research-panel";
config({ path: ".env.local" });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
const sql = neon(process.env.DATABASE_URL);
async function main() {
  const m = JSON.parse(
    readFileSync(
      `data/releases/${K1_UNCERTAINTY_INPUT_RELEASE_ID}/manifest.v1.json`,
      "utf8",
    ),
  );
  assert.equal(m.scope.expected, 970);
  assert.equal(m.scope.expected, m.scope.observed + m.scope.missing);
  assert.equal(
    m.coverage.find((r: any) => r.identity === "freedom_house:pr_cl_total")
      .bounded,
    0,
  );
  assert.ok(
    m.coverage
      .filter((r: any) => r.identity !== "freedom_house:pr_cl_total")
      .every((r: any) => r.bounded > 0),
  );
  const [r] =
    await sql`SELECT status,row_sha256 AS hash,expected_rows AS expected FROM ci_research_panel_releases WHERE id=${K1_UNCERTAINTY_INPUT_RELEASE_ID}`;
  assert.equal(r.status, "complete");
  assert.equal(r.hash, m.rowSha256);
  assert.equal(Number(r.expected), 970);
  const [x] =
    await sql`SELECT count(*)FILTER(WHERE uncertainty_lower IS NOT NULL)::int bounded,count(*)FILTER(WHERE uncertainty_lower IS NOT NULL AND(value<uncertainty_lower OR value>uncertainty_upper))::int outside FROM ci_research_panel_rows WHERE release_id=${K1_UNCERTAINTY_INPUT_RELEASE_ID}`;
  assert.ok(Number(x.bounded) > 500);
  assert.equal(Number(x.outside), 0);
  const [failedV1] = await sql`SELECT count(*)FILTER(WHERE uncertainty_lower IS NOT NULL AND(value<uncertainty_lower OR value>uncertainty_upper))::int outside FROM ci_research_panel_rows WHERE release_id='ci-k1-uncertainty-inputs-2024-v1'`;
  assert.equal(Number(failedV1.outside), 6);
  let immutable = false;
  try {
    await sql`UPDATE ci_research_panel_rows SET value=value WHERE release_id=${K1_UNCERTAINTY_INPUT_RELEASE_ID}`;
  } catch {
    immutable = true;
  }
  assert.equal(immutable, true);
  console.log(
    `PASS — K1 uncertainty release freezes ${x.bounded} bounded publisher rows, explicit Freedom House absence, and immutable mixed-rights metadata.`,
  );
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
