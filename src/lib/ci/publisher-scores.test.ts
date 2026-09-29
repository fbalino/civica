/**
 * Golden tests for the country publisher measures (CLM-020,
 * publisher-attribution/v1). DB-free: the pure rule, shapers, clocks, and
 * public API shaping in publisher-scores.ts; the database read in
 * queries-scores.ts is covered by the release-selection validators and the
 * read-only live validator.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { CURRENT_CI_RELEASE_ID } from "@/lib/ci/current-release";
import { CI_RELEASE_DATASET_YEAR } from "@/lib/ci/production-source-adapters";
import { resolveCiRelease } from "@/lib/ci/release-selection";
import {
  legacyFreedomHouseRow,
  scoreRowAttributionErrors,
} from "@/lib/provenance/publisher-attribution-check";
import { PUBLISHER_ATTRIBUTION_SURFACES } from "@/lib/provenance/publisher-attribution-registry";
import {
  FREEDOM_HOUSE_STATUS_RULE,
  RELEASE_PUBLISHER_INPUTS,
  SCORE_ROW_IDS,
  shapeFreedomHouseScoreRow,
  shapePublicCountryScores,
  shapeVdemScoreRow,
  type FreedomHouseStatus,
  type ScoreRow,
  type ScoreRowId,
} from "./publisher-scores";

const INPUT_MANIFEST_PATH = "data/releases/ci-beta-2024-Q4/source-input-manifest.v1.json";

type ManifestInput = {
  sourceId: string;
  retrievedAt: string;
  contentSha256: string;
  upstreamVersion: string;
  upstreamVintage: string;
};

function manifestInput(sourceId: string): ManifestInput {
  const manifest = JSON.parse(readFileSync(INPUT_MANIFEST_PATH, "utf8")) as {
    inputs: ManifestInput[];
  };
  const input = manifest.inputs.find((candidate) => candidate.sourceId === sourceId);
  assert.ok(input, `${sourceId} is missing from the release input manifest`);
  return input;
}

test("Freedom House's published status rule maps every rating sum and rejects anything else", () => {
  const expected: Record<number, FreedomHouseStatus> = {
    2: "Free",
    3: "Free",
    4: "Free",
    5: "Free",
    6: "Partly Free",
    7: "Partly Free",
    8: "Partly Free",
    9: "Partly Free",
    10: "Partly Free",
    11: "Not Free",
    12: "Not Free",
    13: "Not Free",
    14: "Not Free",
  };
  for (const [sum, status] of Object.entries(expected)) {
    assert.equal(FREEDOM_HOUSE_STATUS_RULE.apply(Number(sum)), status, `sum ${sum}`);
  }
  for (const invalid of [1, 15, 2.5, Number.NaN]) {
    assert.throws(() => FREEDOM_HOUSE_STATUS_RULE.apply(invalid), RangeError);
  }
});

test("every Freedom House row shows its status and edition, no number, and passes the attribution check", () => {
  for (let sum = 2; sum <= 14; sum += 1) {
    const row = shapeFreedomHouseScoreRow(sum);
    assert.equal(row.score, null);
    assert.equal(row.scoreFormatted, `${row.category} · Freedom in the World 2024`);
    assert.equal(row.valueOrigin.kind, "publisher_rule_applied");
    assert.ok(
      row.valueOrigin.kind === "publisher_rule_applied" &&
        row.valueOrigin.note.includes("covers calendar year 2023") &&
        row.valueOrigin.note.includes("but not its status column"),
    );
    assert.deepEqual(scoreRowAttributionErrors(row, sum), [], `sum ${sum}`);
  }
});

test("the V-Dem row is V-Dem's own figure at V-Dem's published precision", () => {
  const row = shapeVdemScoreRow(0.769);
  assert.equal(row.scoreFormatted, "0.769");
  assert.equal(row.score, 0.769);
  assert.equal(row.category, null);
  assert.deepEqual(row.valueOrigin, { kind: "publisher_published" });
  assert.deepEqual(scoreRowAttributionErrors(row, 0.769), []);
  // A stored float that prints longer still shows three decimals.
  assert.equal(shapeVdemScoreRow(0.7689999938011169).scoreFormatted, "0.769");
  assert.throws(() => shapeVdemScoreRow(86.95652), RangeError);
});

test('the attribution check fails on the former "Free (100/100)" row, whatever origin it claims', () => {
  const legacy = legacyFreedomHouseRow("Free", 100);
  assert.equal(legacy.scoreFormatted, "Free (100/100)");
  const errors = scoreRowAttributionErrors(legacy, 2).join("\n");
  assert.match(errors, /has no declared origin/);
  assert.match(errors, /shows 100, which is not the publisher's own figure \(2\)/);

  const claims = [
    { kind: "publisher_published" as const },
    {
      kind: "publisher_rule_applied" as const,
      ruleId: FREEDOM_HOUSE_STATUS_RULE.ruleId,
      note: "Freedom in the World 2024 covers calendar year 2023.",
    },
    { kind: "civica_calculation" as const, transformationId: "fh-fixed-bound" },
  ];
  for (const valueOrigin of claims) {
    assert.ok(
      scoreRowAttributionErrors({ ...legacy, valueOrigin }, 2).length > 0,
      `legacy row accepted as ${valueOrigin.kind}`,
    );
  }
});

test("the row clocks equal the release's hash-bound input manifest and dataset year", () => {
  const release = resolveCiRelease(CURRENT_CI_RELEASE_ID);
  const manifestBytes = readFileSync(INPUT_MANIFEST_PATH);
  assert.equal(
    createHash("sha256").update(manifestBytes).digest("hex"),
    release.inputManifestSha256,
  );
  assert.equal(RELEASE_PUBLISHER_INPUTS.releaseId, CURRENT_CI_RELEASE_ID);

  const vdem = manifestInput("vdem");
  assert.equal(RELEASE_PUBLISHER_INPUTS.vdem.retrievedAt, vdem.retrievedAt);
  assert.equal(RELEASE_PUBLISHER_INPUTS.vdem.contentSha256, vdem.contentSha256);
  assert.equal(RELEASE_PUBLISHER_INPUTS.vdem.publisherEdition, vdem.upstreamVersion);
  assert.equal(RELEASE_PUBLISHER_INPUTS.vdem.observationPeriod, String(CI_RELEASE_DATASET_YEAR));

  const freedomHouse = manifestInput("freedom_house");
  assert.equal(RELEASE_PUBLISHER_INPUTS.freedom_house.retrievedAt, freedomHouse.retrievedAt);
  assert.equal(RELEASE_PUBLISHER_INPUTS.freedom_house.contentSha256, freedomHouse.contentSha256);
  assert.equal(freedomHouse.upstreamVintage, `${CI_RELEASE_DATASET_YEAR} edition`);
  assert.ok(
    RELEASE_PUBLISHER_INPUTS.freedom_house.publisherEdition.endsWith(String(CI_RELEASE_DATASET_YEAR)),
  );
  // Each Freedom in the World edition covers the previous calendar year.
  assert.equal(
    RELEASE_PUBLISHER_INPUTS.freedom_house.observationPeriod,
    String(CI_RELEASE_DATASET_YEAR - 1),
  );

  for (const row of [shapeVdemScoreRow(0.5), shapeFreedomHouseScoreRow(8)]) {
    assert.match(row.retrievedAt, /T\d{2}:\d{2}:\d{2}/);
    assert.deepEqual(row.release, {
      releaseId: release.releaseId,
      quarter: release.quarter,
      vintageLabel: release.vintageLabel,
    });
  }
});

test("the registry names exactly the score rows the contract emits", () => {
  const registered = PUBLISHER_ATTRIBUTION_SURFACES.flatMap((surface) =>
    surface.scoreRowId ? [surface.scoreRowId] : [],
  ).sort();
  assert.deepEqual(registered, [...SCORE_ROW_IDS].sort());
  // Exhaustive by type: a new ScoreRowId must be added here and to the registry.
  const nativeCheck: Record<ScoreRowId, (row: ScoreRow) => string[]> = {
    "vdem-libdem": (row) => scoreRowAttributionErrors(row, 0.769),
    "freedom-house": (row) => scoreRowAttributionErrors(row, 2),
  };
  assert.deepEqual(nativeCheck["vdem-libdem"](shapeVdemScoreRow(0.769)), []);
  assert.deepEqual(nativeCheck["freedom-house"](shapeFreedomHouseScoreRow(2)), []);
});

test("the public scores API withholds values without verified export rights", () => {
  const rows = [shapeVdemScoreRow(0.769), shapeFreedomHouseScoreRow(2)];
  const withheld = shapePublicCountryScores("Uruguay", rows, () => ({
    exportPermission: "blocked",
    termsUrl: "/licensing#rights-manifest",
  }));
  assert.equal(withheld.contract, "country-publisher-scores/v2");
  for (const row of withheld.rows) {
    assert.equal(row.valueStatus, "withheld");
    assert.equal(row.score, null);
    assert.equal(row.category, null);
    assert.equal(row.scoreFormatted, null);
    assert.match(row.withheldReason ?? "", /blocked pending or under publisher terms/);
    assert.equal(row.exportPermission, "blocked");
  }
  assert.equal(withheld.rows[1].valueOrigin.kind, "publisher_rule_applied");
  assert.equal(withheld.rows[1].observationPeriod, "2023");

  const allowed = shapePublicCountryScores("Uruguay", rows, () => ({
    exportPermission: "allowed",
    termsUrl: "https://example.test/terms",
  }));
  assert.equal(allowed.rows[0].score, 0.769);
  assert.equal(allowed.rows[0].valueStatus, "observed");
  assert.equal(allowed.rows[1].category, "Free");
  assert.equal(allowed.rows[1].score, null);
  for (const row of allowed.rows) {
    for (const key of ["rank", "totalRanked", "trend", "trendDelta", "asOf"]) {
      assert.equal(key in row, false, key);
    }
  }
});
