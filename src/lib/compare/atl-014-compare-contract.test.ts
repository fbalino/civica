import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { parseQueryContract } from "@/lib/api/request-contract";

const root = process.cwd();

function source(path: string) {
  return readFileSync(`${root}/${path}`, "utf8");
}

test("ATL-014 Compare has no score row or winner-style numeric treatment", () => {
  const page = source("src/app/compare/page.tsx");
  const overview = source("src/components/compare/CompareOverview.tsx");

  assert.doesNotMatch(page, /CompareCivicaIndex/);
  assert.doesNotMatch(overview, /Democracy Index/);
  assert.doesNotMatch(overview, /democracyIndex/);
  assert.doesNotMatch(overview, /maxIdx|numericValues/);
  assert.match(overview, /No source record/);
  assert.match(overview, /No value recorded/);
});

test("ATL-014 history exports select one publisher series explicitly", () => {
  const history = source("src/components/compare/CompareIndicatorHistory.tsx");
  const route = source("src/app/api/countries/[slug]/indicator-history/route.ts");

  assert.match(history, /Publisher vintage/);
  assert.match(history, /source: selected\.sourceId/);
  assert.match(history, /Download JSON/);
  assert.match(history, /Download CSV/);
  assert.match(route, /series\.sourceId === source/);
  assert.match(route, /\(!source \|\| series\.sourceId === source\)/);

  assert.deepEqual(
    parseQueryContract(
      new Request(
        "https://civicaatlas.org/api/countries/france/indicator-history?format=csv&indicator=rl.est&source=worldbank_wgi",
      ),
      "indicator-history-query/v1",
    ),
    {
      ok: true,
      data: {
        format: "csv",
        indicator: "rl.est",
        source: "worldbank_wgi",
      },
    },
  );
});

test("ATL-014 chamber comparison retains composition-run provenance", () => {
  const query = source("src/lib/db/queries.ts");
  const chambers = source("src/components/compare/CompareChambers.tsx");

  assert.match(query, /partyCompositionRuns/);
  assert.match(query, /compositionSources/);
  assert.match(chambers, /source-bound composition release/);
  assert.match(chambers, /SourceDot/);
});
