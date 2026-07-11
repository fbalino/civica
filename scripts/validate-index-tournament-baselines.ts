import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { buildBaselineManifest } from "./generate-index-tournament-baselines";

config({ path: ".env.local" });
async function main() {
  const live = process.argv.includes("--live");
  const checked = JSON.parse(readFileSync("data/releases/ci-index-baselines-v2/manifest.v2.json", "utf8"));
  const errors: string[] = [];
  if (checked.schemaVersion !== "civica-index-baseline-manifest/v2") errors.push("wrong manifest schema");
  if (checked.publicValuesIncluded !== false) errors.push("restricted baseline values are public");
  if (JSON.stringify(Object.keys(checked.baselines).sort()) !== JSON.stringify(["B0", "B1", "B2", "B3"])) errors.push("baseline set is incomplete");
  for (const [id, row] of Object.entries(checked.baselines) as Array<[string, { outputSha256: string; rows: number }]>) {
    if (!/^[a-f0-9]{64}$/.test(row.outputSha256)) errors.push(`${id} output hash is invalid`);
    if (!(row.rows > 0)) errors.push(`${id} has no output rows`);
  }
  if (live) {
    const reproduced = await buildBaselineManifest();
    if (JSON.stringify(reproduced) !== JSON.stringify(checked)) errors.push("live frozen-panel baseline reproduction differs from checked manifest");
  }
  if (errors.length) {
    console.error(errors.map((error) => `FAIL — ${error}`).join("\n"));
    process.exit(1);
  }
  console.log(`PASS — B0-B3 baseline manifest is complete${live ? " and reproduces exactly from the private frozen panel" : ""}.`);
}

main().catch((error) => { console.error(error); process.exit(1); });
