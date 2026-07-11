import assert from "node:assert/strict";
import test from "node:test";
import { K4_PRACTICE_INPUT_CONTRACT, K4_PRACTICE_INDICATORS, K4_VDEM_ARCHIVE_SHA256 } from "./k4-practice-inputs";

test("K4 uses a small, practice-specific, uncertainty-retaining set", () => {
  assert.equal(K4_PRACTICE_INDICATORS.length, 3);
  assert.deepEqual(K4_PRACTICE_INDICATORS.map((row) => row.indicatorId), ["v2x_freexp_altinf", "v2juhcind", "v2xel_frefair"]);
  for (const indicator of K4_PRACTICE_INDICATORS) {
    assert.equal(indicator.uncertaintyColumns.length, 2);
    assert.ok(indicator.semanticLimit.length > 40);
  }
  assert.equal(K4_PRACTICE_INDICATORS.some((row) => ["v2x_libdem", "fh_total_score", "rl.est"].includes(row.indicatorId)), false);
});

test("K4 capture is exact, private, and non-imputed", () => {
  assert.match(K4_VDEM_ARCHIVE_SHA256, /^[a-f0-9]{64}$/);
  assert.equal(K4_PRACTICE_INPUT_CONTRACT.missingness.imputation, "none");
  assert.equal(K4_PRACTICE_INPUT_CONTRACT.rights.publicBulkValues, false);
  assert.match(K4_PRACTICE_INPUT_CONTRACT.upstream.retrievedAt, /^\d{4}-\d{2}-\d{2}T/);
});
