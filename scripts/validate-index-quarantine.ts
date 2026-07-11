import { readFileSync } from "node:fs";
import { API_ROUTES } from "../src/lib/api/contract/registry";
import { PUBLIC_CLAIMS } from "../src/lib/claims/public-claims";
import { INDEX_QUARANTINE_VERSION, indexQuarantineErrors } from "../src/lib/ci/quarantine-contract";

const read = (path: string) => readFileSync(path, "utf8");
const errors = indexQuarantineErrors({
  desktopNavigation: read("src/components/NavLinks.tsx"), mobileNavigation: read("src/components/MobileNav.tsx"),
  indexLanding: read("src/app/(reader)/civica-index/page.tsx"), home: read("src/components/home/HomeGrid.tsx"),
  countryData: read("src/app/(reader)/country/[slug]/civica-data/page.tsx"), compare: read("src/app/compare/page.tsx"),
  rankings: read("src/app/rankings/RankingsMatrix.tsx"), embed: read("src/app/embed/[slug]/route.ts"),
  generalCountryApi: read("src/app/api/v1/countries/[code]/route.ts"), apiDeprecation: read("src/lib/api/deprecation.ts"),
  apiSummaries: API_ROUTES, atlasLoader: read("src/lib/atlas/load-atlas-data.ts"), atlasLayers: read("src/lib/atlas/map-layers.ts"),
  atlasRelease: read("src/lib/exports/atlas-release.ts"), sitemap: read("src/app/sitemap.ts"),
  rightsManifest: read("src/lib/rights/manifest.ts"), publicClaims: PUBLIC_CLAIMS,
});
console.log(`=== IDX-027 ${INDEX_QUARANTINE_VERSION} ===`);
if (errors.length) { for (const error of errors) console.error(`ERROR: ${error}`); process.exit(1); }
console.log("PASS — public UI, APIs, embeds, Atlas, metadata, releases, rights, and claims apply the source-native Index disposition.");
