import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { researchPanelHash } from "../src/lib/ci/research-panel";
import { K2_CONCORDANCE_CONTRACT } from "../src/lib/ci/tournament-candidate-k2";
import { buildK2ConcordanceManifest } from "./generate-k2-concordance-prototype";

config({ path: ".env.local" });
async function main() {
  const live = process.argv.includes("--live");
  const checked = JSON.parse(readFileSync("data/releases/k2-concordance-prototype-v1/manifest.v1.json", "utf8")); const errors: string[] = [];
  if (checked.contractSha256 !== researchPanelHash(K2_CONCORDANCE_CONTRACT)) errors.push("K2 contract drifted");
  if (checked.confirmatoryHoldoutInspected !== false) errors.push("K2 confirmatory holdout was inspected");
  if (checked.publicValuesIncluded !== false) errors.push("K2 private values are public");
  if (live && JSON.stringify(await buildK2ConcordanceManifest()) !== JSON.stringify(checked)) errors.push("K2 live reproduction differs");
  if (errors.length) { console.error(errors.map((error) => `FAIL — ${error}`).join("\n")); process.exit(1); }
  console.log(`PASS — K2 prototype is complete${live ? " and reproduces exactly" : ""}; winner-selecting holdouts remain sealed.`);
}
main().catch((error) => { console.error(error); process.exit(1); });
