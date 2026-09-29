/**
 * Contract test for the country Rankings table (CLM-020,
 * publisher-attribution/v1): renders `ScoresAndRankingsView` without a
 * database and checks what a reader sees and hears.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { shapeFreedomHouseScoreRow, shapeVdemScoreRow } from "@/lib/ci/publisher-scores";

import { ScoresAndRankingsView } from "./ScoresAndRankings";

function unescape(markup: string): string {
  return markup
    .replaceAll("&#x27;", "'")
    .replaceAll("&#39;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&");
}

function render(rows = [shapeVdemScoreRow(0.769), shapeFreedomHouseScoreRow(2)]): string {
  return unescape(
    renderToStaticMarkup(
      createElement(ScoresAndRankingsView, { rows, countryName: "Uruguay" }),
    ),
  );
}

function cellTexts(markup: string): string[] {
  return [...markup.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((match) =>
    match[1].replace(/<[^>]+>/g, "").trim(),
  );
}

test("the Rankings table has three columns and no Civica rank, trend, rescale, or quarter", () => {
  const markup = render();
  const headers = [...markup.matchAll(/<th scope="col"[^>]*>([\s\S]*?)<\/th>/g)].map(
    (match) => match[1].trim(),
  );
  assert.deepEqual(headers, ["Measure", "Value", "Observation year"]);
  for (const forbidden of ["Global rank", "Trend", "/100", "/ 100", "as of", "Civica calculation"]) {
    assert.equal(markup.includes(forbidden), false, forbidden);
  }
  assert.equal(
    cellTexts(markup).some((text) => text === "2024-Q4"),
    false,
    "a Civica quarter appears as a cell value",
  );
  assert.match(markup, /aria-label="Publisher measures for Uruguay"/);
});

test("V-Dem shows its own figure and Freedom House its status, edition, and rule note", () => {
  const markup = render();
  assert.match(markup, />0\.769</);
  assert.match(markup, /Free · Freedom in the World 2024/);
  assert.match(markup, /aria-label="How this status was determined"/);
  assert.match(
    markup,
    /<span class="sr-only">Freedom in the World 2024 covers calendar year 2023\. Civica's frozen release stored Freedom House's political rights and civil liberties ratings but not its status column/,
  );
  // One rule note, on the Freedom House row only.
  assert.equal(markup.match(/data-value-origin=/g)?.length, 1);
  assert.match(markup, /data-value-origin="publisher_rule_applied"/);
});

test("each SourceDot names the manifest retrieval time and the publisher edition", () => {
  const markup = render();
  assert.match(
    markup,
    /Source: Freedom House; state: [^;]+; source timestamp: July 10, 2026 at 8:56:16 PM UTC; upstream vintage: Freedom in the World 2024, covering calendar year 2023;/,
  );
  assert.match(
    markup,
    /Source: V-Dem; state: [^;]+; source timestamp: July 10, 2026 at 8:56:16 PM UTC; upstream vintage: V-Dem Country-Year Core v15, covering 2024;/,
  );
  assert.equal(markup.includes("Unknown timestamp"), false);
  assert.match(markup, /Civica release · 2024 Q4/);
});

test("an empty result is a named coverage state", () => {
  const markup = render([]);
  assert.match(markup, /class="editorial-empty"/);
  assert.match(
    markup,
    /Civica's frozen release holds no V-Dem or Freedom House row for Uruguay\. This is a coverage state, not a judgment about the country\./,
  );
});
