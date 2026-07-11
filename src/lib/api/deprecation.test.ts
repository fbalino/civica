import assert from "node:assert/strict";
import test from "node:test";
import {
  INDEX_COMPOSITE_SUNSET_DATE,
  retiredIndexApiResponse,
} from "./deprecation";

test("Index API remains deprecated but readable through its announced sunset", () => {
  assert.equal(retiredIndexApiResponse(new Date("2026-07-31T23:59:59Z")), null);
});

test("Index API fails closed after sunset without returning research values", async () => {
  const response = retiredIndexApiResponse(new Date("2026-08-01T00:00:00Z"));
  assert.ok(response);
  assert.equal(response.status, 410);
  assert.equal(response.headers.get("Sunset"), INDEX_COMPOSITE_SUNSET_DATE);
  assert.equal(response.headers.get("Deprecation"), "true");
  const body = await response.json();
  assert.equal(body.disposition, "source_native_dashboard_only");
  assert.equal(body.successor, "/governance-evidence");
  assert.equal("score" in body, false);
});
