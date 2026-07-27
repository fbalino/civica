import { DEFAULT_GOVERNMENT_TAXONOMY_VERSION } from "@/lib/government-taxonomy";
import type { CiReleaseContract } from "@/lib/ci/release-selection";

export type CiLiveContextUse = "live_current" | "not_used";

/**
 * Declares which parts of a public Index response are immutable release data
 * and which are current descriptive context. Archived scores never imply that
 * today's country names, taxonomy, or peer-filter facts were frozen with them.
 */
export function publicCiPublicationComponents(
  release: CiReleaseContract,
  context: {
    jurisdiction?: CiLiveContextUse;
    taxonomy?: CiLiveContextUse;
    peerFilters?: CiLiveContextUse;
  } = {},
) {
  const jurisdiction = context.jurisdiction ?? "not_used";
  const taxonomy = context.taxonomy ?? "not_used";
  const peerFilters = context.peerFilters ?? "not_used";
  return Object.freeze({
    scoreData: Object.freeze({
      freshness: "frozen_release" as const,
      releaseId: release.releaseId,
      methodologyVersion: release.methodologyVersion,
    }),
    methodologyDefinition: Object.freeze({
      freshness: "frozen_release" as const,
      sha256: release.methodologyContentSha256,
    }),
    jurisdictionContext: Object.freeze({ freshness: jurisdiction }),
    taxonomyContext: Object.freeze({
      freshness: taxonomy,
      taxonomyVersion:
        taxonomy === "live_current"
          ? DEFAULT_GOVERNMENT_TAXONOMY_VERSION
          : null,
    }),
    peerFilterContext: Object.freeze({ freshness: peerFilters }),
  });
}
