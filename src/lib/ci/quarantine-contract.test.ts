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
    indexLanding: read("src/app/(reader)/civica-index/page.tsx"), apiHelpers: read("src/lib/api/helpers.ts"),
    apiSummaries: API_ROUTES, atlasLoader: read("src/lib/atlas/load-atlas-data.ts"), atlasRelease: read("src/lib/exports/atlas-release.ts"),
    rightsManifest: read("src/lib/rights/manifest.ts"), publicClaims: PUBLIC_CLAIMS,
  };
}

test("every public surface quarantines the current Index as secondary research beta", () => assert.deepEqual(indexQuarantineErrors(realSurfaces()), []));

test("navigation, API standing, atlas coupling, release, and claim regressions fail closed", () => {
  const fixtures: Array<[keyof IndexQuarantineSurfaces, (value: never) => never, RegExp]> = [
    ["desktopNavigation", (value) => String(value).replace("Index · Beta", "Index") as never, /desktop navigation/],
    ["apiHelpers", (value) => String(value).replace('standing: "secondary_research_experiment"', 'standing: "published_index"') as never, /metadata omits/],
    ["atlasLoader", (value) => String(value).replace("for (const jurisdiction of juris) ensure(jurisdiction.iso3!.toLowerCase());", "") as never, /independently/],
    ["atlasRelease", (value) => String(value).replace("Civica Index, Pulse", "Research outputs") as never, /release/],
    ["publicClaims", (value) => (value as unknown as IndexQuarantineSurfaces["publicClaims"]).filter((row) => row.id !== "index.composite-estimate") as never, /public claim/],
  ];
  for (const [key, mutate, expected] of fixtures) {
    const clean = realSurfaces();
    const broken = { ...clean, [key]: mutate(clean[key] as never) } as IndexQuarantineSurfaces;
    assert.match(indexQuarantineErrors(broken).join("\n"), expected);
  }
});
