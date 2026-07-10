/**
 * Closed registry of public research artifacts that must link to
 * `/policies` (CLM-016 §8.1).
 *
 * This is the independent required-inventory list, mirroring
 * `REQUIRED_REPLICATION_COMPONENT_IDS` in `replication-surface.ts`:
 * `scripts/validate-policy-surface.ts` fails if any registered
 * artifact's page (TSX shell + paired `content/*.md`, when present)
 * does not link every one of its `requiredPolicyAnchors`, and fails
 * if the registry itself drops below the required id set.
 */

export const POLICY_ANCHORS = [
  "corrections",
  "retractions",
  "versioning",
  "known-limitations",
  "data-api-corrections",
  "notification",
] as const;

export type PolicyAnchor = (typeof POLICY_ANCHORS)[number];

/** Version of the publication-policy contract itself. This is distinct from
 * every research artifact's methodology/data version. */
export const PUBLICATION_POLICY_META = {
  version: "v1.0",
  effectiveDate: "2026-07-10",
  status: "active-prelaunch",
} as const;

export interface ResearchArtifact {
  /** Stable kebab-case id. */
  id: string;
  label: string;
  /** Canonical reader route for the artifact. */
  route: string;
  /** Subset of `POLICY_ANCHORS` this artifact's page must link to. */
  requiredPolicyAnchors: readonly PolicyAnchor[];
  /** Dotted `site-state.ts` path documenting where the artifact's
   *  current version/status string comes from, or `null` when the
   *  artifact carries no version field of its own. Informational —
   *  not independently enforced by the validator. */
  versionSource: string | null;
  /** Repo-relative TSX shell that must contain the required links
   *  (directly, or via its paired `contentFile`). */
  pageFile: string;
  /** Paired `content/*.md` prose source, when the page is markdown-
   *  driven. The validator concatenates this file's text with
   *  `pageFile` before checking for required links, since a
   *  markdown-driven page's links commonly live in the prose, not
   *  the TSX shell. */
  contentFile?: string;
}

export const REQUIRED_ARTIFACT_IDS = [
  "civica-index",
  "pulse-ledger",
  "reconciliation",
  "peer-grouping",
  "pca-appendix",
  "civica-conditions",
] as const;

export type RequiredArtifactId = (typeof REQUIRED_ARTIFACT_IDS)[number];

export const RESEARCH_ARTIFACTS: readonly ResearchArtifact[] = [
  {
    id: "civica-index",
    label: "Civica Index",
    route: "/civica-index",
    requiredPolicyAnchors: [
      "corrections",
      "retractions",
      "versioning",
      "known-limitations",
    ],
    versionSource: null,
    pageFile: "src/app/(reader)/civica-index/page.tsx",
  },
  {
    id: "pulse-ledger",
    label: "Pulse ledger",
    route: "/civica-index/pulse-changelog",
    requiredPolicyAnchors: [
      "corrections",
      "retractions",
      "versioning",
      "known-limitations",
    ],
    versionSource: "pulse.taxonomy.version",
    pageFile: "src/app/(reader)/civica-index/pulse-changelog/page.tsx",
  },
  {
    id: "reconciliation",
    label: "Reconciliation",
    route: "/country/methodology/reconciliation",
    requiredPolicyAnchors: [
      "corrections",
      "retractions",
      "versioning",
      "known-limitations",
    ],
    versionSource: "reconciliation.version",
    pageFile: "src/app/(reader)/country/methodology/reconciliation/page.tsx",
  },
  {
    id: "peer-grouping",
    label: "Peer grouping",
    route: "/civica-index/methodology/peer-grouping",
    requiredPolicyAnchors: ["versioning", "known-limitations"],
    versionSource: "peerGrouping.version",
    pageFile: "src/app/(reader)/civica-index/methodology/peer-grouping/page.tsx",
    contentFile: "content/methodology-peer-grouping.md",
  },
  {
    id: "pca-appendix",
    label: "PCA appendix",
    route: "/civica-index/methodology/pca-appendix",
    requiredPolicyAnchors: ["versioning", "known-limitations"],
    versionSource: null,
    pageFile: "src/app/(reader)/civica-index/methodology/pca-appendix/page.tsx",
    contentFile: "content/methodology-pca-appendix.md",
  },
  {
    id: "civica-conditions",
    label: "Civica Conditions",
    route: "/civica-conditions",
    requiredPolicyAnchors: ["known-limitations", "corrections"],
    versionSource: null,
    pageFile: "src/app/civica-conditions/page.tsx",
  },
] as const satisfies readonly ResearchArtifact[];

export function findArtifact(id: string): ResearchArtifact | undefined {
  return RESEARCH_ARTIFACTS.find((a) => a.id === id);
}

export function artifactLabel(id: string): string {
  return findArtifact(id)?.label ?? id;
}
