import { test } from "node:test";
import assert from "node:assert/strict";

import {
  PUBLIC_CLAIM_TIERS,
  PUBLIC_CLAIM_TIER_IDS,
} from "./claim-tiers";
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
