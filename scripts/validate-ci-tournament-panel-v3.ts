import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { CI_TOURNAMENT_PANEL_V3_RELEASE_ID } from "../src/lib/ci/research-panel";
import { buildTournamentPanelV3 } from "./generate-ci-tournament-panel-v3";

config({ path: ".env.local" });
const live = process.argv.includes("--live");
const checked = JSON.parse(readFileSync(`data/releases/${CI_TOURNAMENT_PANEL_V3_RELEASE_ID}/manifest.v3.json`, "utf8"));
const errors: string[] = [];
if (checked.schemaVersion !== "ci-research-panel/v3" || checked.scope?.indicators !== 6) errors.push("wrong v3 panel schema or indicator count");
if (checked.selectionPrecedence?.democratic_quality?.join(",") !== "vdem:v2x_libdem,worldbank_wgi:va.est") errors.push("democratic-quality precedence drifted");
if (checked.captures?.wgi?.contentSha256 !== "25a2f9eabb90b0092973392c0b31571aa58b691cc5786292e504b52f693e1eb8") errors.push("wrong WGI capture");
if (checked.publicBulkValuesIncluded !== false) errors.push("restricted values are public");
for (const field of ["rowSha256", "coverageSha256", "temporalBreaksSha256"]) if (!/^[a-f0-9]{64}$/.test(checked[field])) errors.push(`${field} invalid`);

async function main() {
  if (live) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for --live");
    const rebuilt = await buildTournamentPanelV3();
    if (JSON.stringify(rebuilt.manifest) !== JSON.stringify(checked)) errors.push("hash-verified publisher reproduction differs from checked v3 manifest");
    const sql = neon(process.env.DATABASE_URL);
    const [stored] = await sql`SELECT status,expected_rows AS "expectedRows",row_sha256 AS "rowSha256" FROM ci_research_panel_releases WHERE id=${CI_TOURNAMENT_PANEL_V3_RELEASE_ID}`;
    if (stored?.status !== "complete" || Number(stored?.expectedRows) !== 29100 || stored?.rowSha256 !== checked.rowSha256) errors.push("stored completed v3 metadata differs");
    let mutationRejected = false;
    try { await sql`UPDATE ci_research_panel_rows SET value=value WHERE release_id=${CI_TOURNAMENT_PANEL_V3_RELEASE_ID} AND period_year=2000`; }
    catch (error) { mutationRejected = /immutable/.test(String(error)); }
    if (!mutationRejected) errors.push("completed v3 panel mutation was not rejected");
  }
  if (errors.length) { console.error(errors.map((error) => `FAIL — ${error}`).join("\n")); process.exit(1); }
  console.log(`PASS — ${CI_TOURNAMENT_PANEL_V3_RELEASE_ID} contains exact primary and fallback identities${live ? " and reproduces from hash-verified publisher workbooks" : ""}.`);
}
main().catch((error) => { console.error(error); process.exit(1); });
