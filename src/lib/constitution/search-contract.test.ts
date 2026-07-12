import assert from "node:assert/strict";
import test from "node:test";
import {
  constitutionDocumentContext,
  constitutionSearchInputSchema,
} from "./search-contract";
import { parseConstitutionSearchHighlight } from "@/lib/db/queries-constitution-search";

test("constitution search input is bounded and closed", () => {
  assert.equal(
    constitutionSearchInputSchema.safeParse({
      query: '"freedom of expression"',
      jurisdictions: ["afghanistan"],
      topics: ["express"],
      language: "en",
      limit: 20,
      cursor: null,
    }).success,
    true,
  );
  assert.equal(
    constitutionSearchInputSchema.safeParse({
      query: "x".repeat(257),
      jurisdictions: [],
      topics: [],
      language: "en",
      limit: 20,
      cursor: null,
    }).success,
    false,
  );
});

test("headlines become text segments, never rendered HTML", () => {
  const segments = parseConstitutionSearchHighlight(
    "<script>alert(1)</script> __CIVICA_HIGHLIGHT_START__freedom__CIVICA_HIGHLIGHT_STOP__",
  );
  assert.deepEqual(segments, [
    { text: "<script>alert(1)</script> ", highlighted: false },
    { text: "freedom", highlighted: true },
  ]);
});

test("the UK publisher collection cannot masquerade as one amended text", () => {
  assert.deepEqual(
    constitutionDocumentContext("United_Kingdom_2013", 1215, 2013),
    {
      documentNature: "publisher-composite-collection",
      dateLabel: "Source collection spans 1215–2013",
    },
  );
});
