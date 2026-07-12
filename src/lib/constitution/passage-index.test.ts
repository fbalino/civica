import assert from "node:assert/strict";
import test from "node:test";
import {
  constitutionPassageId,
  constitutionSectionAnchor,
  normalizeConstitutionPlainText,
  prepareConstitutionPassages,
} from "./passage-index";

test("passage preparation is deterministic, normalized, and version bound", () => {
  const articles = [
    {
      sectionId: "section/87",
      headingLabel: " Article 34 ",
      topics: ["express", "express"],
      html: "<p>Freedom&nbsp; of <strong>expression</strong>.</p>",
    },
    { sectionId: "section/empty", headingLabel: null, topics: [], html: " " },
  ];
  const first = prepareConstitutionPassages("Afghanistan_2004", articles);
  const second = prepareConstitutionPassages("Afghanistan_2004", articles);
  assert.deepEqual(first, second);
  assert.equal(first.length, 1);
  assert.equal(first[0].plainText, "Freedom of expression.");
  assert.equal(first[0].anchorId, "sec-section-87");
  assert.deepEqual(first[0].topicKeys, ["express"]);
  assert.match(
    first[0].passageId,
    /^constitution-passage\/sha256:[a-f0-9]{64}$/,
  );
  assert.notEqual(
    first[0].passageId,
    constitutionPassageId({
      sourceDocumentId: "Afghanistan_2025",
      sourceSectionId: "section/87",
      plainText: first[0].plainText,
    }),
  );
});

test("plain-text normalization removes markup and preserves legal text", () => {
  assert.equal(
    normalizeConstitutionPlainText(
      '<script>bad()</script><style>.x{}</style><p onclick="bad()">A &amp; B</p>',
    ),
    "A & B",
  );
  assert.equal(constitutionSectionAnchor("section/8"), "sec-section-8");
});

test("duplicate source section ids fail closed", () => {
  assert.throws(
    () =>
      prepareConstitutionPassages("doc", [
        { sectionId: "s1", headingLabel: null, topics: [], html: "One" },
        { sectionId: "s1", headingLabel: null, topics: [], html: "Two" },
      ]),
    /Duplicate constitution section id/,
  );
});
