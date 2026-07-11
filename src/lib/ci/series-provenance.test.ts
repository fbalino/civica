import assert from "node:assert/strict";
import { test } from "node:test";

import { assertCiSeriesProvenance, ciSeriesProvenanceErrors, normalizeCiSeriesType, selectCiSeries, type CiSeriesProvenance } from "./series-provenance";

const published: CiSeriesProvenance = {
  releaseId: "fixture-original-2024",
  seriesType: "as_published_release",
  observationPeriodStart: "2023",
  observationPeriodEnd: "2023",
  originalPublicationCutAt: "2024-02-05T12:00:00.000Z",
  calculatedAt: "2024-02-01T12:00:00.000Z",
  methodVersion: "fixture/v1",
  citationLabel: "Fixture — reference period 2023; published 2024; method fixture/v1",
};

const backcast: CiSeriesProvenance = {
  releaseId: "fixture-backcast-2026",
  seriesType: "harmonized_backcast",
  observationPeriodStart: "2023",
  observationPeriodEnd: "2023",
  originalPublicationCutAt: null,
  calculatedAt: "2026-07-11T12:00:00.000Z",
  methodVersion: "fixture/v2",
  citationLabel: "Fixture — 2023 reference observation; harmonized backcast calculated 2026; method fixture/v2",
};

test("as-published and harmonized rows remain separately queryable", () => {
  const rows = [
    { id: "original", seriesType: published.seriesType },
    { id: "backcast", seriesType: backcast.seriesType },
  ];
  assert.deepEqual(selectCiSeries(rows, "as_published_release").map((row) => row.id), ["original"]);
  assert.deepEqual(selectCiSeries(rows, "harmonized_backcast").map((row) => row.id), ["backcast"]);
});

test("the retained long-form backcast value normalizes without becoming as-published", () => {
  assert.equal(normalizeCiSeriesType("current_harmonized_backcast_not_as_published"), "harmonized_backcast");
  assert.throws(() => normalizeCiSeriesType("2023_as_published"), /Unknown Civica series type/);
});

test("valid original releases and later backcasts retain different citation clocks", () => {
  assert.deepEqual(ciSeriesProvenanceErrors(published), []);
  assert.deepEqual(ciSeriesProvenanceErrors(backcast), []);
});

test("a 2026 calculation over 2023 inputs cannot call itself a 2023 as-published vintage", () => {
  const misleading = {
    ...published,
    calculatedAt: "2026-07-11T12:00:00.000Z",
    originalPublicationCutAt: "2023-12-31T23:59:59.000Z",
    citationLabel: "Fixture — 2023 as-published vintage; published 2023",
  };
  const errors = ciSeriesProvenanceErrors(misleading);
  assert.ok(errors.includes("as-published calculation occurs after its publication cut"));
  assert.ok(errors.includes("observation year is mislabelled as the as-published vintage"));
});

test("a backcast cannot invent a historical publication cut or use as-published language", () => {
  assert.throws(() => assertCiSeriesProvenance({
    ...backcast,
    originalPublicationCutAt: "2023-12-31T23:59:59.000Z",
    citationLabel: "Fixture — as-published 2023",
  }), /cannot invent an original publication cut/);
});
