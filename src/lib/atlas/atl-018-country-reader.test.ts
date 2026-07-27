import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("Civica Data keeps every documented module visible", () => {
  const page = read("src/app/(reader)/country/[slug]/civica-data/page.tsx");

  assert.match(page, /const visibleSections = SECTION_PLAN;/);
  assert.doesNotMatch(page, /SECTION_PLAN\.filter\(/);
  assert.match(page, /captureAtlasSurfaceQuery\(/);
  for (const id of [
    "evidence-coverage",
    "governance-evidence",
    "longitudinal",
    "conditions",
    "government",
    "legislature",
    "leaders",
    "bills",
    "organizations",
    "rankings",
  ]) {
    assert.match(page, new RegExp(`id: "${id}"`), id);
  }
});

test("country-reader route modules preserve an outage separately from empty data", () => {
  const home = read("src/components/home/HomeGrid.tsx");
  const factbook = read("src/app/(reader)/country/[slug]/page.tsx");
  const constitution = read(
    "src/app/(reader)/country/[slug]/constitution/page.tsx",
  );
  const leaders = read("src/components/factbook/FactbookLeaders.tsx");
  const bills = read("src/components/factbook/FactbookBills.tsx");
  const organizations = read(
    "src/components/factbook/FactbookOrganizations.tsx",
  );
  const rankings = read("src/components/scores/ScoresAndRankings.tsx");
  const parties = read("src/app/parties/page.tsx");
  const rankingsPage = read("src/app/rankings/page.tsx");
  const atlas = read("src/components/atlas/AtlasStandaloneClient.tsx");
  const compare = read("src/app/compare/page.tsx");

  assert.match(home, /catalogAvailable = false/);
  assert.match(home, /zero-country atlas/);
  assert.match(factbook, /sectionsResult\.status === "unavailable"/);
  assert.match(factbook, /const visibleSections = SECTION_PLAN;/);
  assert.doesNotMatch(factbook, /SECTION_PLAN\.filter\(/);
  assert.match(factbook, /No source-backed \{section\.label\.toLowerCase\(\)\} facts/);
  assert.match(constitution, /throwOnError: true/);
  assert.match(constitution, /Temporarily unavailable/);
  for (const component of [leaders, bills, organizations, rankings]) {
    assert.match(component, /temporarily unavailable/);
    assert.match(component, /Banner variant="warn"/);
  }
  assert.match(parties, /getPartiesForBrowser\(\{ throwOnError: true \}\)/);
  assert.match(parties, /partyBrowserResult\.status === "unavailable"/);
  assert.match(rankingsPage, /rankingsResult\.status === "unavailable"/);
  assert.match(atlas, /No map-eligible country records are currently compiled/);
  assert.match(compare, /countryCatalogResult\.status === "unavailable"/);
  assert.match(compare, /unavailableSections\.length > 0/);
  assert.match(compare, /This does not mean the selected countries have no records/);
});
