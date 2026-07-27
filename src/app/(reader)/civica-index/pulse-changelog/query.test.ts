import assert from "node:assert/strict";
import test from "node:test";
import {
  PULSE_CHANGELOG_PAGE_SIZE,
  parsePulseChangelogPageQuery,
  pulseChangelogPageOffset,
  pulseChangelogSearch,
  requireBoundedPulseChangelogPage,
} from "./query";

test("Pulse changelog query preserves URL-addressable filters and page offsets", () => {
  const query = parsePulseChangelogPageQuery({
    country: "Uruguay",
    dimension: "rule_of_law",
    severity: "severe_neg",
    review: "1",
    page: "3",
  });

  assert.deepEqual(query, {
    country: "uruguay",
    dimension: "rule_of_law",
    severity: "severe_neg",
    showReview: true,
    page: 3,
  });
  assert.equal(pulseChangelogPageOffset(query), PULSE_CHANGELOG_PAGE_SIZE * 2);
  assert.equal(
    pulseChangelogSearch(query),
    "?country=uruguay&dimension=rule_of_law&severity=severe_neg&review=1&page=3",
  );
});

test("Pulse changelog query fails closed to the first page for malformed input", () => {
  assert.deepEqual(
    parsePulseChangelogPageQuery({
      country: "https://not-a-slug.test",
      dimension: "invented_dimension",
      severity: "invented_severity",
      review: "yes",
      page: "0",
    }),
    { showReview: false, page: 1 },
  );
});

test("a 5,000-row changelog response cannot cross the initial client boundary", () => {
  assert.throws(
    () => requireBoundedPulseChangelogPage(Array.from({ length: 5_000 })),
    /refuse to serialize an oversized response/,
  );
  assert.equal(
    requireBoundedPulseChangelogPage(Array.from({ length: 25 })).length,
    PULSE_CHANGELOG_PAGE_SIZE,
  );
});
