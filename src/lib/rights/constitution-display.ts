/** Edge-safe rights contract for the bounded Constitution search display. */
export const CONSTITUTION_DISPLAY_RIGHTS = {
  productId: "constitution-search-display-v1",
  sourceId: "constitute_project",
  route: "/api/constitution/search",
  licenseId: "CC-BY-NC-3.0",
  termsUrl: "https://www.constituteproject.org/content/terms",
  reviewedAt: "2026-07-12",
  publicExport: "non-commercial-only",
  commercialUse: false,
  interactiveDisplay: "allowed-non-commercial",
} as const;

export interface InteractiveDisplayRightsDecision {
  allowed: boolean;
  productId: string;
  sourceId: string;
  reason: string;
}

export function evaluateConstitutionInteractiveDisplay(
  productId: string,
  sourceId: string,
  deployment: { commercial: boolean; feeBearing: boolean },
): InteractiveDisplayRightsDecision {
  if (
    productId !== CONSTITUTION_DISPLAY_RIGHTS.productId ||
    sourceId !== CONSTITUTION_DISPLAY_RIGHTS.sourceId
  ) {
    return {
      allowed: false,
      productId,
      sourceId,
      reason: "Product has no verified interactive-display permission.",
    };
  }
  if (deployment.commercial || deployment.feeBearing) {
    return {
      allowed: false,
      productId,
      sourceId,
      reason:
        "Constitution display is suspended on commercial or fee-bearing deployments.",
    };
  }
  return {
    allowed: true,
    productId,
    sourceId,
    reason: "Verified non-commercial interactive display.",
  };
}
