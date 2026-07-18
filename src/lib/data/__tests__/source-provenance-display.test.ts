import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSourceDotDisclosure,
  formatSourceTimestamp,
  sourceRightsDisclosure,
} from "../sources";

test("SourceDot preserves exact UTC timestamps and does not invent time for date-only values", () => {
  assert.equal(
    formatSourceTimestamp("2026-07-08T05:00:59.961Z"),
    "July 8, 2026 at 5:00:59 AM UTC",
  );
  assert.equal(
    formatSourceTimestamp("2026-07-08"),
    "July 8, 2026 (date only)",
  );
  assert.equal(formatSourceTimestamp("not-a-date"), "Unknown timestamp");
  assert.equal(formatSourceTimestamp(null), "Unknown timestamp");
});

test("SourceDot gives verified rights only to registered sources and names pending rights otherwise", () => {
  assert.deepEqual(sourceRightsDisclosure("wikidata"), {
    license: "CC0-1.0",
    reviewStatus: "verified",
    termsUrl: "https://www.wikidata.org/wiki/Wikidata:Licensing",
  });
  assert.equal(
    sourceRightsDisclosure("ipu_parline").reviewStatus,
    "pending",
  );
});

test("SourceDot disclosure makes missing vintage and experimental state explicit", () => {
  const disclosure = buildSourceDotDisclosure({
    source: "wikidata",
    retrievedAt: "2026-07-08T05:00:59.961Z",
    state: "experimental",
  });

  assert.equal(disclosure.label, "Wikidata");
  assert.equal(disclosure.stateLabel, "Experimental source or method");
  assert.equal(disclosure.upstreamVintage, "Not supplied on this surface");
  assert.match(disclosure.rightsLabel, /CC0-1\.0/);
});
