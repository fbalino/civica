import {
  PUBLIC_CLAIM_TIERS,
  PUBLIC_CLAIM_TIER_IDS,
  type PublicClaimTierId,
} from "./claim-tiers";
import {
  PUBLIC_CLAIM_GATES,
  PUBLIC_CLAIM_SURFACES,
  type PublicClaim,
} from "./public-claims";

export interface ClaimRegistryValidationResult {
  errors: string[];
  claimCount: number;
  coveredSurfaces: string[];
  usedTiers: PublicClaimTierId[];
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Pure structural validation shared by the CLI and unit tests. Filesystem
 * existence, marker coverage, and exact-copy checks live in the CLI.
 */
export function validatePublicClaimRegistry(
  claims: readonly PublicClaim[],
): ClaimRegistryValidationResult {
  const errors: string[] = [];
  const ids = new Set<string>();
  const coveredSurfaces = new Set<string>();
  const usedTiers = new Set<PublicClaimTierId>();
  const validSurfaces = new Set<string>(PUBLIC_CLAIM_SURFACES);
  const validTiers = new Set<string>(PUBLIC_CLAIM_TIER_IDS);
  const validGates = new Set<string>(PUBLIC_CLAIM_GATES);

  for (const [index, claim] of claims.entries()) {
    const label = hasText(claim.id) ? claim.id : `claim[${index}]`;

    if (!hasText(claim.id)) {
      errors.push(`${label}: id is required`);
    } else if (ids.has(claim.id)) {
      errors.push(`${label}: duplicate id`);
    } else {
      ids.add(claim.id);
    }

    if (!validSurfaces.has(claim.surface)) {
      errors.push(`${label}: unknown surface ${String(claim.surface)}`);
    } else {
      coveredSurfaces.add(claim.surface);
    }

    if (!hasText(claim.routeOrArtifact)) {
      errors.push(`${label}: routeOrArtifact is required`);
    }
    if (!hasText(claim.exactClaim)) {
      errors.push(`${label}: exactClaim is required`);
    }

    const rawTier = (claim as unknown as { tier?: unknown }).tier;
    if (!hasText(rawTier) || !validTiers.has(rawTier)) {
      errors.push(`${label}: tier must be exactly one canonical tier`);
    } else {
      usedTiers.add(rawTier as PublicClaimTierId);
    }

    if (
      !Array.isArray(claim.evidenceSources) ||
      claim.evidenceSources.length === 0 ||
      claim.evidenceSources.some((source) => !hasText(source))
    ) {
      errors.push(`${label}: at least one evidence source is required`);
    }
    if (!hasText(claim.implementationOwner)) {
      errors.push(`${label}: implementationOwner is required`);
    }
    if (!hasText(claim.methodologyVersion)) {
      errors.push(`${label}: methodologyVersion is required`);
    }
    if (!validGates.has(claim.gate)) {
      errors.push(`${label}: unknown gate ${String(claim.gate)}`);
    }
    if (!hasText(claim.source?.path)) {
      errors.push(`${label}: source.path is required`);
    }
    if (!hasText(claim.source?.fragment)) {
      errors.push(`${label}: source.fragment is required`);
    }
  }

  for (const surface of PUBLIC_CLAIM_SURFACES) {
    if (!coveredSurfaces.has(surface)) {
      errors.push(`required surface has no registered claim: ${surface}`);
    }
  }

  const tierDefinitionIds = Object.keys(PUBLIC_CLAIM_TIERS).sort();
  const canonicalTierIds = [...PUBLIC_CLAIM_TIER_IDS].sort();
  if (tierDefinitionIds.join("\n") !== canonicalTierIds.join("\n")) {
    errors.push("claim-tier definitions do not exactly match canonical tier ids");
  }
  for (const tierId of PUBLIC_CLAIM_TIER_IDS) {
    const tier = PUBLIC_CLAIM_TIERS[tierId];
    if (
      tier.id !== tierId ||
      !hasText(tier.label) ||
      !hasText(tier.definition) ||
      tier.allowedLanguage.length === 0 ||
      tier.requiredDisclosure.length === 0 ||
      tier.prohibitedLanguage.length === 0
    ) {
      errors.push(`${tierId}: incomplete tier definition`);
    }
  }

  return {
    errors,
    claimCount: claims.length,
    coveredSurfaces: [...coveredSurfaces].sort(),
    usedTiers: [...usedTiers].sort(),
  };
}
