import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { CI_TOURNAMENT_PANEL_RELEASE_ID } from "../src/lib/ci/research-panel";
import { buildTournamentPanelV2 } from "./generate-ci-tournament-panel-v2";

config({ path: ".env.local" });
const live = process.argv.includes("--live");
const checked = JSON.parse(readFileSync(`data/releases/${CI_TOURNAMENT_PANEL_RELEASE_ID}/manifest.v2.json`, "utf8"));
const errors: string[] = [];
if (checked.schemaVersion !== "ci-research-panel/v2") errors.push("wrong panel schema");
if (checked.supersedes !== "ci-research-panel-2000-2024-v1") errors.push("v1 supersession missing");
if (checked.freedomHouseCapture?.contentSha256 !== "d6ac861af6e7dcea7e870e39ddbcd2925730a653c1466f8992a7d0005f53be88") errors.push("wrong Freedom House capture");
if (checked.publicBulkValuesIncluded !== false) errors.push("restricted values are public");
for (const field of ["rowSha256", "coverageSha256", "temporalBreaksSha256"]) if (!/^[a-f0-9]{64}$/.test(checked[field])) errors.push(`${field} invalid`);

async function main() {
  if (live) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for --live");
    const rebuilt = await buildTournamentPanelV2();
    if (JSON.stringify(rebuilt.manifest) !== JSON.stringify(checked)) errors.push("publisher-capture reproduction differs from checked v2 manifest");
    const sql = neon(process.env.DATABASE_URL);
    const [stored] = await sql`SELECT status,expected_rows AS "expectedRows",row_sha256 AS "rowSha256" FROM ci_research_panel_releases WHERE id=${CI_TOURNAMENT_PANEL_RELEASE_ID}`;
    if (stored?.status !== "complete" || Number(stored?.expectedRows) !== 24250 || stored?.rowSha256 !== checked.rowSha256) errors.push("stored completed release metadata differs");
    let mutationRejected = false;
    try { await sql`UPDATE ci_research_panel_rows SET value=value WHERE release_id=${CI_TOURNAMENT_PANEL_RELEASE_ID} AND period_year=2000`; }
    catch (error) { mutationRejected = /immutable/.test(String(error)); }
    if (!mutationRejected) errors.push("completed v2 panel mutation was not rejected");
  }
  if (errors.length) { console.error(errors.map((error) => `FAIL — ${error}`).join("\n")); process.exit(1); }
  console.log(`PASS — ${CI_TOURNAMENT_PANEL_RELEASE_ID} preserves the exact PR+CL input${live ? " and reproduces from the hash-verified publisher workbook" : ""}.`);
}

main().catch((error) => { console.error(error); process.exit(1); });
