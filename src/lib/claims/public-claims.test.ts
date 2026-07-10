import { test } from "node:test";
import assert from "node:assert/strict";

import {
  PUBLIC_CLAIM_TIERS,
  PUBLIC_CLAIM_TIER_IDS,
} from "./claim-tiers";
import { findUnqualifiedAuthorityLanguage } from "./authority-language";
import {
  findCountryGradeLeaks,
  HISTORICAL_GRADE_ARCHIVE_SENTINEL,
} from "./country-grade-language";
import {
  PUBLIC_CLAIMS,
  PUBLIC_CLAIM_SURFACES,
  type PublicClaim,
} from "./public-claims";
import { validatePublicClaimRegistry } from "./registry-validation";

test("every registered public claim maps to exactly one canonical tier", () => {
  const tierIds = new Set(PUBLIC_CLAIM_TIER_IDS);

  for (const claim of PUBLIC_CLAIMS) {
    assert.equal(typeof claim.tier, "string", `${claim.id} has one scalar tier`);
    assert.ok(tierIds.has(claim.tier), `${claim.id} uses a canonical tier`);
    assert.equal(PUBLIC_CLAIM_TIERS[claim.tier].id, claim.tier);
  }
});

test("registry covers every required public surface with complete ownership metadata", () => {
  const result = validatePublicClaimRegistry(PUBLIC_CLAIMS);

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.coveredSurfaces, [...PUBLIC_CLAIM_SURFACES].sort());
  assert.equal(result.claimCount, PUBLIC_CLAIMS.length);
});

test("registry validation rejects an unclassified fixture", () => {
  const invalid = {
    ...PUBLIC_CLAIMS[0],
    id: "fixture.unclassified",
    tier: ["institutional-posture", "source-reported-fact"],
  } as unknown as PublicClaim;

  const result = validatePublicClaimRegistry([invalid, ...PUBLIC_CLAIMS.slice(1)]);

  assert.ok(
    result.errors.some((error) =>
      error.includes("tier must be exactly one canonical tier"),
    ),
  );
});

test("registry validation rejects a missing required surface", () => {
  const withoutEmbeds = PUBLIC_CLAIMS.filter((claim) => claim.surface !== "embeds");
  const result = validatePublicClaimRegistry(withoutEmbeds);

  assert.ok(
    result.errors.includes("required surface has no registered claim: embeds"),
  );
});

test("authority-language audit catches standing and confidence overclaims", () => {
  const matches = findUnqualifiedAuthorityLanguage(
    "An academically citable governance health score with a 90% confidence interval. Pulse is a daily governance monitor. All data is free to use in the most comprehensive open reference.",
  );

  assert.deepEqual(
    matches.map((match) => match.ruleId).sort(),
    [
      "academic-standing",
      "blanket-reuse-rights",
      "daily-governance-measure",
      "latent-governance-health",
      "unsupported-comprehensiveness",
      "unsupported-confidence-interval",
    ],
  );
});

test("authority-language audit allows explicit limitations", () => {
  const matches = findUnqualifiedAuthorityLanguage(
    "This Monte Carlo input-variation range is not a confidence interval. The experiment has not completed independent review.",
  );

  assert.deepEqual(matches, []);
});

test("country-grade audit catches deprecated helpers, implicit rows, and API fields", () => {
  const matches = findCountryGradeLeaks(
    `
      import { ciTier } from "@/lib/ci/tiers";
      const rows = await db.select().from(ciCompositeScores);
      return { score: composite.score, band: composite.band };
    `,
    { filePath: "src/app/api/v1/index/example/route.ts" },
  );
  const ruleIds = new Set(matches.map((match) => match.ruleId));

  assert.ok(ruleIds.has("deprecated-grade-module"));
  assert.ok(ruleIds.has("deprecated-grade-helper"));
  assert.ok(ruleIds.has("implicit-composite-select"));
  assert.ok(ruleIds.has("legacy-band-read"));
  assert.ok(ruleIds.has("public-grade-response-field"));
});

test("country-grade audit catches public grade copy and reconstructed verdict scales", () => {
  const matches = findCountryGradeLeaks(
    `
      export const metadata = {
        description: "Civica Index previously used A-F country grades."
      };
      const labels = ["Exceptional", "Strong", "Mixed", "Weak", "Failed"];
    `,
    {
      filePath: "src/app/(reader)/civica-index/page.tsx",
      scanStructure: false,
      scanCopy: true,
    },
  );
  const ruleIds = new Set(matches.map((match) => match.ruleId));

  assert.ok(ruleIds.has("public-grade-history"));
  assert.ok(ruleIds.has("public-grade-nomenclature"));
  assert.ok(ruleIds.has("qualitative-country-scale"));
  assert.ok(ruleIds.has("qualitative-country-verdict"));
});

test("country-grade audit preserves regime, severity, source-tier, and limitation language", () => {
  const matches = findCountryGradeLeaks(
    `
      V-Dem describes an authoritarian regime and a Regimes of the World tier.
      Pulse records a severity tier; reconciliation records a Tier 1 source.
      The chart plots a statistical peer band.
      Civica Index publishes a numeric research estimate with no country grade.
    `,
    {
      filePath: "content/methodology-civica-index.md",
      scanStructure: false,
      scanCopy: true,
    },
  );

  assert.deepEqual(matches, []);
});

test("historical grade modules require the private archive sentinel", () => {
  const missing = findCountryGradeLeaks("export const BAND_RANGES = [];", {
    filePath: "src/lib/ci/bands.ts",
  });
  assert.deepEqual(missing.map((match) => match.ruleId), ["archive-sentinel"]);

  const preserved = findCountryGradeLeaks(
    `/** ${HISTORICAL_GRADE_ARCHIVE_SENTINEL} */\nexport const BAND_RANGES = ["Exceptional", "Failed"];`,
    { filePath: "src/lib/ci/bands.ts" },
  );
  assert.deepEqual(preserved, []);
});
