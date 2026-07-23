import assert from "node:assert/strict";
import test from "node:test";

import {
  formatAtlasHistoryField,
  formatAtlasHistoryValue,
} from "./AtlasChangeHistoryDisclosure";

test("history field labels remain readable without changing the stable key", () => {
  assert.equal(formatAtlasHistoryField("upstream_vintage_label"), "Upstream Vintage Label");
  assert.equal(formatAtlasHistoryField("source_id"), "Source Id");
});

test("history values disclose absence explicitly", () => {
  assert.equal(formatAtlasHistoryValue(null), "Not recorded");
  assert.equal(formatAtlasHistoryValue(undefined), "Not recorded");
  assert.equal(formatAtlasHistoryValue(""), "Empty");
  assert.equal(formatAtlasHistoryValue(false), "No");
  assert.equal(formatAtlasHistoryValue({ status: "observed" }), '{"status":"observed"}');
});
