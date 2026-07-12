import assert from "node:assert/strict";
import test from "node:test";
import { contentRelative } from "./MarkdownContent";

/**
 * PLT-003 regression guard. The content read must stay statically scoped to
 * `content/**` (so Turbopack does not trace the whole project) and must reject
 * any path that escapes the directory.
 */
test("strips the content/ prefix to a relative segment", () => {
  assert.equal(contentRelative("content/about.md"), "about.md");
  assert.equal(
    contentRelative("content/methodology-overview.md"),
    "methodology-overview.md",
  );
});

test("accepts a bare relative name", () => {
  assert.equal(contentRelative("policies.md"), "policies.md");
});

test("rejects parent-directory traversal", () => {
  assert.throws(() => contentRelative("content/../.env.local"), /escapes/);
  assert.throws(() => contentRelative("../secrets.md"), /escapes/);
  assert.throws(() => contentRelative("content/a/../../etc/passwd"), /escapes/);
});

test("rejects absolute paths and empty input", () => {
  assert.throws(() => contentRelative("/etc/passwd"), /escapes/);
  assert.throws(() => contentRelative("content/"), /escapes/);
});
