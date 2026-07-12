import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCompleteInformationEnvironmentCoverage,
  buildInformationEnvironmentPin,
  parseOfficialInformationEnvironmentCsv,
} from "./information-environment-evidence";

const csv = `ISO;Score 2026;Rank\nFIN;86,22;1\nAFG;17.88;180\n`;

test("the official semicolon file parses decimal commas without inventing rows", () => {
  assert.deepEqual(parseOfficialInformationEnvironmentCsv(csv), [
    { iso3: "FIN", score: 86.22 },
    { iso3: "AFG", score: 17.88 },
  ]);
});

test("coverage has exactly one observed-or-missing row per supported jurisdiction", () => {
  const rows = buildCompleteInformationEnvironmentCoverage({
    supportedJurisdictions: [
      { jurisdictionId: "j-fin", iso3: "FIN" },
      { jurisdictionId: "j-atg", iso3: "ATG" },
      { jurisdictionId: "j-unknown", iso3: null },
    ],
    publisherRows: parseOfficialInformationEnvironmentCsv(csv),
  });
  assert.equal(rows.length, 3);
  assert.equal(rows.find((row) => row.iso3 === "FIN")?.score, 86.22);
  assert.equal(rows.find((row) => row.iso3 === "ATG")?.valueStatus, "missing");
  assert.equal(rows.find((row) => row.iso3 === "ATG")?.score, null);
  assert.match(
    rows.find((row) => row.iso3 === null)?.missingReason ?? "",
    /no ISO3/,
  );
});

test("pin identity is stable and binds the classification-time release", () => {
  const input = {
    eventId: "event-1",
    jurisdictionId: "jurisdiction-1",
    classificationRunId: "run-1",
    classifiedAt: "2026-07-12T00:00:00.000Z",
    releaseId: "rsf-wpfi-2026",
    valueStatus: "observed" as const,
    score: 17.88,
    tier: "restricted" as const,
    sourceId: "rsf_press_freedom",
    sourceUrl: "https://rsf.org/example.csv",
    upstreamRelease: "RSF World Press Freedom Index 2026",
    observationYear: 2025,
    retrievedAt: "2026-07-11T17:17:00.000Z",
    contentSha256: "a".repeat(64),
    rightsStatus: "pending" as const,
    useStatus: "disabled_pending_rights_and_validation" as const,
    missingReason: null,
  };
  assert.equal(
    buildInformationEnvironmentPin(input).pinKey,
    buildInformationEnvironmentPin({ ...input }).pinKey,
  );
});

test("unknown stays null and cannot become an observed midpoint", () => {
  const pin = buildInformationEnvironmentPin({
    eventId: "event-1",
    jurisdictionId: "jurisdiction-1",
    classificationRunId: "run-1",
    classifiedAt: "2026-07-12T00:00:00.000Z",
    releaseId: "rsf-wpfi-2026",
    valueStatus: "missing",
    score: null,
    tier: null,
    sourceId: "rsf_press_freedom",
    sourceUrl: "https://rsf.org/example.csv",
    upstreamRelease: "RSF World Press Freedom Index 2026",
    observationYear: 2025,
    retrievedAt: "2026-07-11T17:17:00.000Z",
    contentSha256: "a".repeat(64),
    rightsStatus: "pending",
    useStatus: "disabled_pending_rights_and_validation",
    missingReason: "No publisher row exists.",
  });
  assert.equal(pin.score, null);
  assert.equal(pin.tier, null);
  assert.throws(
    () => buildInformationEnvironmentPin({ ...pin, score: 50 }),
    /null value/,
  );
});
