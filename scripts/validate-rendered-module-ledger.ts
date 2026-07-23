import { readFileSync } from "node:fs";

import { type RenderedModuleLedger, validateRenderedModuleLedger } from "../src/lib/qa/rendered-module-ledger";
import { buildLedgerFromTrackedSources } from "./rendered-module-ledger-source";

const outputPath = "data/rendered-module-ledger.v1.json";
const ledger = JSON.parse(readFileSync(outputPath, "utf8")) as RenderedModuleLedger;
const errors = validateRenderedModuleLedger(ledger);
if (errors.length) throw new Error(errors.join("\n"));

// Rebuild without writing. This comparison locks the artifact to source
// discovery, so a new page/layout/component cannot silently omit itself.
const rebuilt = buildLedgerFromTrackedSources();
if (JSON.stringify(rebuilt.entries) !== JSON.stringify(ledger.entries)) {
  throw new Error("The checked rendered-module ledger is stale; regenerate it.");
}

console.log(`Validated ${outputPath}: ${ledger.entries.length} route/module entries.`);
