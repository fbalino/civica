import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { CURRENT_CI_METHODOLOGY_VERSION } from "../src/lib/ci/current-release";
import { CURRENT_CI_RANK_POLICY } from "../src/lib/ci/rank-policy";

const calculator = readFileSync("src/lib/ci/calculate-v2.ts", "utf8");
const reproduction = readFileSync("src/lib/ci/reproduce-current-release.ts", "utf8");
const methodology = readFileSync("content/methodology-civica-index.md", "utf8");
const api = readFileSync("src/lib/api/helpers.ts", "utf8");
const statusPage = readFileSync("src/app/(reader)/civica-index/page.tsx", "utf8");
const publicRankings = readFileSync("src/app/rankings/RankingsMatrix.tsx", "utf8");

assert.equal(CURRENT_CI_RANK_POLICY.methodologyVersion, CURRENT_CI_METHODOLOGY_VERSION);
assert.equal(CURRENT_CI_RANK_POLICY.tieMethod, "competition");
assert.match(calculator, /competitionRankPublishedScores/);
assert.match(reproduction, /competitionRankPublishedScores/);
assert.match(methodology, /competition ranking/);
assert.match(methodology, /does not publish rank intervals/);
assert.match(api, /rank_uncertainty/);
assert.match(statusPage, /not a recommended country ranking/);
assert.doesNotMatch(statusPage, /Tied rank|getCIRankings/);
assert.doesNotMatch(publicRankings, /civica_index|Civica Index/);

async function validateLive(): Promise<void> {
  config({ path: ".env.local" });
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for --live");
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`
    SELECT score, rank, count(*)::int AS tie_count
    FROM ci_composite_scores
    WHERE methodology_version = ${CURRENT_CI_METHODOLOGY_VERSION}
    GROUP BY score, rank
    ORDER BY score DESC
  `;
  const total = rows.reduce((sum, row) => sum + Number(row.tie_count), 0);
  assert.equal(total, 190);
  let occupiedBefore = 0;
  let tiedGroups = 0;
  for (const row of rows) {
    assert.equal(Number(row.rank), occupiedBefore + 1, `score ${row.score} has wrong competition rank`);
    const count = Number(row.tie_count);
    if (count > 1) tiedGroups += 1;
    occupiedBefore += count;
  }
  console.log(`PASS — ${total} live ${CURRENT_CI_METHODOLOGY_VERSION} scores use competition rank across ${tiedGroups} tied score groups.`);
}

if (process.argv.includes("--live")) {
  validateLive().catch((error) => { console.error(error); process.exit(1); });
} else {
  console.log(`PASS — ${CURRENT_CI_RANK_POLICY.id} agrees across preserved calculation, reproduction, methodology, and API records; public UI does not expose the composite ranking.`);
}
