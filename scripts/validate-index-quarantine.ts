import { readFileSync } from "node:fs";
import { API_ROUTES } from "../src/lib/api/contract/registry";
import { PUBLIC_CLAIMS } from "../src/lib/claims/public-claims";
import { INDEX_QUARANTINE_VERSION, indexQuarantineErrors } from "../src/lib/ci/quarantine-contract";

const read = (path: string) => readFileSync(path, "utf8");
const errors = indexQuarantineErrors({
  desktopNavigation: read("src/components/NavLinks.tsx"), mobileNavigation: read("src/components/MobileNav.tsx"),
  indexLanding: read("src/app/(reader)/civica-index/page.tsx"), apiHelpers: read("src/lib/api/helpers.ts"),
  apiSummaries: API_ROUTES, atlasLoader: read("src/lib/atlas/load-atlas-data.ts"), atlasRelease: read("src/lib/exports/atlas-release.ts"),
  rightsManifest: read("src/lib/rights/manifest.ts"), publicClaims: PUBLIC_CLAIMS,
});
console.log(`=== IDX-001 ${INDEX_QUARANTINE_VERSION} ===`);
if (errors.length) { for (const error of errors) console.error(`ERROR: ${error}`); process.exit(1); }
console.log("PASS — UI, navigation, API metadata, release posture, claims, and Atlas independence retain the Index research-beta boundary.");
