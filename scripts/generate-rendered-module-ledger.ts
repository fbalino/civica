import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { validateRenderedModuleLedger } from "../src/lib/qa/rendered-module-ledger";
import { buildLedgerFromTrackedSources } from "./rendered-module-ledger-source";

const outputPath = "data/rendered-module-ledger.v1.json";
const ledger = buildLedgerFromTrackedSources();
const errors = validateRenderedModuleLedger(ledger);
if (errors.length) throw new Error(errors.join("\n"));

mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(ledger, null, 2)}\n`);
console.log(`Generated ${outputPath} with ${ledger.entries.length} route/module entries.`);
