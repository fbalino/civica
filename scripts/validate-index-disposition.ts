import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { INDEX_DISPOSITION, INDEX_DISPOSITION_SHA256, indexDispositionErrors } from "../src/lib/ci/index-disposition";

const checked = JSON.parse(readFileSync("data/releases/index-disposition-2026-07-v1/resolution.v1.json", "utf8"));
assert.deepEqual(indexDispositionErrors(), []);
assert.deepEqual(checked, { ...INDEX_DISPOSITION, resolutionSha256: INDEX_DISPOSITION_SHA256 });
assert.equal(checked.k1Composite.boundedDerivativeUtility, "unresolved_pending_qualified_reader_experiment");
console.log(`PASS — ${checked.releaseId}: ${checked.selectedDisposition}; K1 research preserved, not recommended.`);
