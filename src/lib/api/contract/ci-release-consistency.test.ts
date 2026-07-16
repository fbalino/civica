import assert from "node:assert/strict";
import test from "node:test";

import { EXAMPLES } from "./examples";
import {
  zIndexByGovernmentTypeResponse,
  zIndexCompareResponse,
  zIndexCountryResponse,
  zIndexHistoryResponse,
  zIndexMethodologyResponse,
  zIndexRankingsResponse,
} from "./schemas";

function rejects(
  schema: { safeParse(value: unknown): { success: boolean } },
  value: unknown,
): void {
  assert.equal(schema.safeParse(value).success, false);
}

test("Index country scores cannot drift from their release identity", () => {
  for (const mutate of [
    (value: typeof EXAMPLES.indexCountry) => {
      value.data.quarter = "2025-Q1";
    },
    (value: typeof EXAMPLES.indexCountry) => {
      value.data.vintageLabel = "another release";
    },
    (value: typeof EXAMPLES.indexCountry) => {
      value.data.methodologyVersion = "beta-r4";
    },
    (value: typeof EXAMPLES.indexCountry) => {
      value.data.totalRanked = 1;
    },
  ]) {
    const value = structuredClone(EXAMPLES.indexCountry);
    mutate(value);
    rejects(zIndexCountryResponse, value);
  }
});

test("series and route-level quarters must name the selected release", () => {
  const history = structuredClone(EXAMPLES.indexHistory);
  history.meta.series.releaseId = "ci-beta-r4-2024-Q4";
  rejects(zIndexHistoryResponse, history);

  const grouped = structuredClone(EXAMPLES.indexByGovernmentType);
  grouped.meta.quarter = "2025-Q1";
  rejects(zIndexByGovernmentTypeResponse, grouped);

  const compared = structuredClone(EXAMPLES.indexCompare);
  compared.meta.quarter = "2025-Q1";
  rejects(zIndexCompareResponse, compared);
});

test("methodology and ranking payloads cannot borrow another release label", () => {
  const methodology = structuredClone(EXAMPLES.indexMethodology);
  methodology.data.id = "beta-r4";
  rejects(zIndexMethodologyResponse, methodology);

  const rankings = structuredClone(EXAMPLES.indexRankings);
  rankings.data[0].vintageLabel = "Civica Index 2024 Q4 (Beta-R4)";
  rejects(zIndexRankingsResponse, rankings);
});
