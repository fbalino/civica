import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("Compare isolates election availability and discloses date-only semantics", () => {
  const page = read("src/app/compare/page.tsx");
  const component = read("src/components/compare/CompareElections.tsx");

  assert.match(page, /Promise\.allSettled\([\s\S]*getElectionsByJurisdiction/);
  assert.match(page, /status: "temporarily_unavailable"/);
  assert.ok(
    page.indexOf("Promise.allSettled") <
      page.indexOf("ids.map((id) => getElectionsByJurisdiction(id))"),
  );
  assert.match(component, /CompareElectionAvailability/);
  assert.match(
    component,
    /No time of day or source timezone is\s+recorded/,
  );
  assert.match(component, /Election records are temporarily unavailable/);
  assert.match(component, /results are not\s+compiled/);
  assert.doesNotMatch(component, /e\.election\.electoralSystem/);
});

test("country legislature keeps sparse, outage, result and timing states visible", () => {
  const query = read("src/lib/db/queries-legislature.ts");
  const component = read("src/components/factbook/FactbookLegislature.tsx");

  assert.match(query, /nextElectionStatus/);
  assert.match(query, /lastElectionResultsStatus/);
  assert.match(query, /systemStatement \? \(past\?\.electoralSystem/);
  assert.match(query, /predicate, "ipu_last_election"/);
  assert.match(component, /Promise\.allSettled/);
  assert.match(component, /Chamber composition is temporarily unavailable/);
  assert.match(component, /No chamber composition is available/);
  assert.match(component, /No qualified legislative election record/);
  assert.match(component, /no qualified source date or term-length projection/);
  assert.match(component, /Not compiled/);
  assert.match(component, /tentative source date; schedule not independently verified/);
  assert.match(component, /No time of day or source timezone is\s+recorded/);
});
