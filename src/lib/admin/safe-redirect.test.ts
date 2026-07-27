import assert from "node:assert/strict";
import test from "node:test";
import { safeInternalPath, safeInternalPathOr } from "./safe-redirect";

test("accepts genuine same-origin paths", () => {
  for (const ok of [
    "/admin",
    "/admin/pulse-review",
    "/admin/pulse-review/123?tab=x",
    "/a/b/c#frag",
  ]) {
    assert.equal(safeInternalPath(ok), ok);
  }
});

test("rejects open-redirect vectors", () => {
  for (const bad of [
    "//evil.com",
    "/\\evil.com",
    "\\\\evil.com",
    "https://evil.com",
    "http:/evil.com",
    "javascript:alert(1)",
    "%2F%2Fevil.com", // encoded //
    "/%5Cevil.com", // encoded backslash
    "/\tevil", // control char
    "",
    "   ",
    null,
    undefined,
  ]) {
    assert.equal(safeInternalPath(bad), null, `should reject: ${String(bad)}`);
  }
});

test("safeInternalPathOr falls back to a fixed default", () => {
  assert.equal(safeInternalPathOr("//evil.com", "/admin"), "/admin");
  assert.equal(safeInternalPathOr("/admin/x"), "/admin/x");
  assert.equal(safeInternalPathOr(null), "/admin");
});
