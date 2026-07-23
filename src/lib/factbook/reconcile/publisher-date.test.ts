import assert from "node:assert/strict";
import { test } from "node:test";

import {
  formatPublisherDate,
  parseWikidataPublisherDate,
  storedPublisherDate,
} from "./publisher-date";

test("year and month precision never manufacture an exact calendar day", () => {
  assert.deepEqual(
    parseWikidataPublisherDate("+2025-00-00T00:00:00Z", 9),
    {
      asOf: null,
      factYear: 2025,
      valueJson: {
        publisherDate: {
          precision: "year",
          year: 2025,
          month: null,
          day: null,
        },
      },
    },
  );
  assert.deepEqual(
    parseWikidataPublisherDate("+2025-04-00T00:00:00Z", 10),
    {
      asOf: null,
      factYear: 2025,
      valueJson: {
        publisherDate: {
          precision: "month",
          year: 2025,
          month: 4,
          day: null,
        },
      },
    },
  );
});
test("day precision retains its exact date and structured disclosure", () => {
  const parsed = parseWikidataPublisherDate(
    "+2024-06-30T00:00:00Z",
    11,
  );
  assert.equal(parsed.asOf, "2024-06-30");
  assert.equal(
    formatPublisherDate(parsed.valueJson!.publisherDate),
    "Jun 30, 2024",
  );
});

test("stored publisher dates fail closed on malformed precision", () => {
  assert.equal(
    storedPublisherDate({
      publisherDate: {
        precision: "second",
        year: 2025,
        month: 4,
        day: 1,
      },
    }),
    null,
  );
  assert.equal(
    formatPublisherDate({
      precision: "month",
      year: 2025,
      month: 4,
      day: null,
    }),
    "Apr 2025",
  );
});
