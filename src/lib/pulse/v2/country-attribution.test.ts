import assert from "node:assert/strict";
import { test } from "node:test";

import { parseSubjectVerdict } from "./country-attribution";

const VALID_SINGLE = {
  iso3: "USA",
  country: "United States",
  scope: "single",
  confidence: "high",
  reasoning: "The event concerns United States institutions.",
};

test("subject verdict parser accepts only the declared scope and confidence enums", () => {
  assert.deepEqual(parseSubjectVerdict(JSON.stringify(VALID_SINGLE)), VALID_SINGLE);

  for (const [field, value] of [
    ["scope", "domestic"],
    ["scope", undefined],
    ["confidence", "certain"],
    ["confidence", undefined],
  ] as const) {
    const payload = { ...VALID_SINGLE } as Record<string, unknown>;
    if (value === undefined) delete payload[field];
    else payload[field] = value;
    assert.equal(
      parseSubjectVerdict(JSON.stringify(payload)),
      null,
      `accepted invalid ${field}`,
    );
  }
});

test("subject verdict parser rejects non-object JSON", () => {
  for (const text of ["null", "[]", '"USA"']) {
    assert.equal(parseSubjectVerdict(text), null);
  }
});

test("single-country verdict requires an exact uppercase ISO3 code", () => {
  for (const iso3 of [null, "US", "USAA", "usa", "U1A", undefined]) {
    const payload = { ...VALID_SINGLE } as Record<string, unknown>;
    if (iso3 === undefined) delete payload.iso3;
    else payload.iso3 = iso3;
    assert.equal(
      parseSubjectVerdict(JSON.stringify(payload)),
      null,
      `accepted invalid ISO3 ${String(iso3)}`,
    );
  }
});

test("non-single verdicts require null ISO3 and retain valid confidence", () => {
  const multi = {
    iso3: null,
    country: null,
    scope: "multi",
    confidence: "medium",
    reasoning: "No single country is primary.",
  };
  assert.deepEqual(parseSubjectVerdict(JSON.stringify(multi)), multi);
  assert.equal(
    parseSubjectVerdict(JSON.stringify({ ...multi, iso3: "USA" })),
    null,
  );
});
