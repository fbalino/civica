import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { researchPanelHash } from "../src/lib/ci/research-panel";
import { K3_LEDGER_CONTRACT } from "../src/lib/ci/tournament-candidate-k3";
import { buildK3LedgerManifest } from "./generate-k3-ledger-prototype";
config({ path: ".env.local" });
async function main() { const live = process.argv.includes("--live"); const checked = JSON.parse(readFileSync("data/releases/k3-power-transfer-ledger-prototype-v1/manifest.v1.json", "utf8")); const errors: string[] = [];
  if (checked.contractSha256 !== researchPanelHash(K3_LEDGER_CONTRACT)) errors.push("K3 contract drifted"); if (checked.everyRowHasStatementCitation !== true) errors.push("K3 has uncited prototype rows"); if (checked.transferStatesComputed !== 0 || checked.termLimitStatesComputed !== 0) errors.push("K3 overclaims unsupported derived states"); if (checked.publicCountryRows !== false || checked.publicValuesIncluded !== false) errors.push("K3 unvalidated rows are public"); if (live && JSON.stringify(await buildK3LedgerManifest()) !== JSON.stringify(checked)) errors.push("K3 live reproduction differs");
  if (errors.length) { console.error(errors.map((error) => `FAIL — ${error}`).join("\n")); process.exit(1); } console.log(`PASS — K3 prototype is cited, nonaggregated, and honest about unavailable transfer/term-limit states${live ? "; live reproduction matches" : ""}.`); }
main().catch((error) => { console.error(error); process.exit(1); });
