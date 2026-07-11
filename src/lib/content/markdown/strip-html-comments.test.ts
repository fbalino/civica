import assert from "node:assert/strict";
import test from "node:test";

import { stripHtmlComments } from "./strip-html-comments";

test("authoring and claim comments never become reader prose", () => {
  const markdown = `<!-- authoring\nnote -->\n# Heading\n\n<!-- PUBLIC_CLAIM: example -->\nVisible.`;
  assert.equal(stripHtmlComments(markdown), "\n# Heading\n\n\nVisible.");
});

test("ordinary markdown remains byte-for-byte unchanged", () => {
  const markdown = "## Heading\n\nVisible **prose**.";
  assert.equal(stripHtmlComments(markdown), markdown);
});
