import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { API_ROUTES } from "@/lib/api/contract/registry";
import { PUBLIC_CLAIMS } from "@/lib/claims/public-claims";
import { indexQuarantineErrors, type IndexQuarantineSurfaces } from "./quarantine-contract";

function realSurfaces(): IndexQuarantineSurfaces {
  const read = (path: string) => readFileSync(path, "utf8");
  return {
    desktopNavigation: read("src/components/NavLinks.tsx"), mobileNavigation: read("src/components/MobileNav.tsx"),
    indexLanding: read("src/app/(reader)/civica-index/page.tsx"), home: read("src/components/home/HomeGrid.tsx"),
    countryData: read("src/app/(reader)/country/[slug]/civica-data/page.tsx"), compare: read("src/app/compare/page.tsx"),
    rankings: read("src/app/rankings/RankingsMatrix.tsx"), embed: read("src/app/embed/[slug]/route.ts"),
    generalCountryApi: read("src/app/api/v1/countries/[code]/route.ts"), apiDeprecation: read("src/lib/api/deprecation.ts"),
    apiSummaries: API_ROUTES, atlasLoader: read("src/lib/atlas/load-atlas-data.ts"), atlasLayers: read("src/lib/atlas/map-layers.ts"),
    atlasRelease: read("src/lib/exports/atlas-release.ts"), sitemap: read("src/app/sitemap.ts"),
    rightsManifest: read("src/lib/rights/manifest.ts"), publicClaims: PUBLIC_CLAIMS,
  };
}

test("every public surface applies the selected source-native Index disposition", () => assert.deepEqual(indexQuarantineErrors(realSurfaces()), []));

test("navigation, public renderers, APIs, Atlas, and claims fail closed", () => {
  const fixtures: Array<[keyof IndexQuarantineSurfaces, (value: never) => never, RegExp]> = [
    ["desktopNavigation", (value) => String(value).replaceAll("Governance Evidence", "Index") as never, /desktop navigation/],
    ["home", (value) => `${String(value)}\ngetCIRankings` as never, /homepage/],
    ["countryData", (value) => String(value).replace("GovernanceEvidenceTable", "CivicaIndexPanel") as never, /country data/],
    ["atlasLoader", (value) => `${String(value)}\nciScore` as never, /Atlas loader/],
    ["publicClaims", (value) => (value as unknown as IndexQuarantineSurfaces["publicClaims"]).filter((row) => row.id !== "index.public-disposition") as never, /public claim/],
  ];
  for (const [key, mutate, expected] of fixtures) {
    const clean = realSurfaces();
    const broken = { ...clean, [key]: mutate(clean[key] as never) } as IndexQuarantineSurfaces;
    assert.match(indexQuarantineErrors(broken).join("\n"), expected);
  }
});
