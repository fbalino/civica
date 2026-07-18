import {
  CURRENT_CI_METHODOLOGY_VERSION,
  CURRENT_CI_RELEASE_ID,
} from "./current-release";

/**
 * Edge-safe subset of the frozen Index release registry used only to parse
 * public query parameters. The parity test keeps it exact with the complete
 * Node-only release contract, whose hashing helpers cannot enter Edge routes.
 */
export const CI_RELEASE_QUERY_IDENTITIES = Object.freeze([
  { releaseId: "ci-beta-r3-2024-Q4", methodologyVersion: "beta-r3" },
  { releaseId: "ci-beta-r4-2024-Q4", methodologyVersion: "beta-r4" },
  {
    releaseId: CURRENT_CI_RELEASE_ID,
    methodologyVersion: CURRENT_CI_METHODOLOGY_VERSION,
  },
] as const);
