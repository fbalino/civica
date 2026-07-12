import type { PublicClaimTierId } from "./claim-tiers";
import { PROVENANCE_COVERAGE_SUMMARY } from "./provenance-coverage";

export const PUBLIC_CLAIM_SURFACES = [
  "home",
  "country",
  "index",
  "pulse",
  "methodology",
  "about",
  "licensing",
  "advisory-board",
  "api-docs",
  "readme",
  "citation",
  "metadata",
  "exports",
  "embeds",
] as const;

export type PublicClaimSurface = (typeof PUBLIC_CLAIM_SURFACES)[number];

export const PUBLIC_CLAIM_GATES = ["G1", "G2", "G3", "G5"] as const;
export type PublicClaimGate = (typeof PUBLIC_CLAIM_GATES)[number];

export interface PublicClaimSource {
  /** Repository-relative file containing the public claim. */
  path: string;
  /** Exact source fragment proving the registry still points at live copy. */
  fragment: string;
  /** Generated or duplicated artifacts that must retain the same marker. */
  mirrors?: readonly string[];
}

export interface PublicClaim {
  id: string;
  surface: PublicClaimSurface;
  /** Public route, machine endpoint, or repository artifact. */
  routeOrArtifact: string;
  /** Exact public sentence or dynamic template, with placeholders in braces. */
  exactClaim: string;
  tier: PublicClaimTierId;
  /** Code, data, policy, or upstream material that can prove or falsify it. */
  evidenceSources: readonly string[];
  implementationOwner: string;
  methodologyVersion: string;
  /** Earliest master-plan gate at which the claim may be treated as satisfied. */
  gate: PublicClaimGate;
  source: PublicClaimSource;
}

/** Marker syntax placed beside every registered headline claim. */
export function publicClaimMarker(id: string): string {
  return `PUBLIC_CLAIM: ${id}`;
}

/**
 * The registry records current public copy, including copy that later CLM
 * tasks are expected to qualify or remove. Registration is inventory, not
 * endorsement. A claim's gate says what must be true before it can receive
 * stronger standing.
 */
export const PUBLIC_CLAIMS = [
  {
    id: "home.reference-scope",
    surface: "home",
    routeOrArtifact: "/",
    exactClaim:
      "Civica Atlas is a provenance-first comparative reference to how every country is governed, with country profiles covering institutions, constitutions, elections, and source-linked facts.",
    tier: "institutional-posture",
    evidenceSources: [
      "src/app/page.tsx",
      "src/lib/db/queries.ts",
      "src/app/(reader)/country/page.tsx",
    ],
    implementationOwner: "Atlas editorial and data platform",
    methodologyVersion: "atlas-publication-policy-v1",
    gate: "G1",
    source: {
      path: "src/app/page.tsx",
      fragment:
        "Civica Atlas is a provenance-first comparative reference to how every country is governed, with country profiles covering institutions, constitutions, elections, and source-linked facts.",
    },
  },
  {
    id: "home.visible-positioning",
    surface: "home",
    routeOrArtifact: "/ — visible hero",
    exactClaim:
      "Civica Atlas is a provenance-first comparative reference to how every country is governed.",
    tier: "institutional-posture",
    evidenceSources: [
      "src/components/home/HomeGrid.tsx",
      "plan/DECISIONS.md",
      "plan/MASTER-PLAN-OVERVIEW.md",
    ],
    implementationOwner: "Atlas editorial",
    methodologyVersion: "atlas-positioning-v1",
    gate: "G1",
    source: {
      path: "src/components/home/HomeGrid.tsx",
      fragment:
        "A provenance-first comparative reference to how every country is governed.",
      mirrors: ["src/components/SiteFooter.tsx"],
    },
  },
  {
    id: "home.secondary-research",
    surface: "home",
    routeOrArtifact: "/ — Governance Evidence feature",
    exactClaim:
      "The Governance Evidence Dashboard presents source-native observations without averaging them into a Civica country ranking.",
    tier: "institutional-posture",
    evidenceSources: [
      "src/components/home/HomeGrid.tsx",
      "plan/DECISIONS.md",
      "plan/MASTER-CHECKLIST.md",
    ],
    implementationOwner: "Atlas editorial and governance evidence",
    methodologyVersion: "governance-evidence/v1",
    gate: "G5",
    source: {
      path: "src/components/home/HomeGrid.tsx",
      fragment:
        "The dashboard presents governance observations on their original scales",
    },
  },
  {
    id: "country.source-layer",
    surface: "country",
    routeOrArtifact: "/country/{slug}",
    exactClaim:
      "How {country} is governed … sourced from the CIA World Factbook with Civica governance overlays.",
    tier: "reconciled-fact",
    evidenceSources: [
      "src/app/(reader)/country/[slug]/layout.tsx",
      "src/lib/factbook/reconcile/api.ts",
      "src/lib/factbook/reconcile/resolver.ts",
    ],
    implementationOwner: "Atlas reconciliation",
    methodologyVersion: "reconciliation-v0.2-beta",
    gate: "G2",
    source: {
      path: "src/app/(reader)/country/[slug]/layout.tsx",
      fragment:
        "sourced from the CIA World Factbook with Civica governance overlays.",
    },
  },
  {
    id: "index.public-disposition",
    surface: "index",
    routeOrArtifact: "/civica-index",
    exactClaim:
      "Civica's selected public comparison product is the source-native Governance Evidence Dashboard; the composite is preserved as versioned research but is not an original Civica measurement or a recommended country ranking.",
    tier: "institutional-posture",
    evidenceSources: [
      "src/lib/ci/index-disposition.ts",
      "data/releases/index-disposition-2026-07-v1/resolution.v1.json",
      "content/methodology-civica-index.md",
    ],
    implementationOwner: "Civica Index research lane",
    methodologyVersion: "civica-index-disposition-2026-07-v1",
    gate: "G5",
    source: {
      path: "src/lib/ci/index-disposition.ts",
      fragment:
        "Civica's selected public comparison product is the source-native Governance Evidence Dashboard.",
      mirrors: ["src/app/(reader)/civica-index/page.tsx"],
    },
  },
  {
    id: "pulse.event-ledger",
    surface: "pulse",
    routeOrArtifact: "/civica-index/pulse-changelog",
    exactClaim:
      "Civica Pulse is an experimental ledger of published and review-queued governance-event classifications, with source links, review state, and publication origin; published does not necessarily mean human-reviewed.",
    tier: "experimental-heuristic",
    evidenceSources: [
      "src/app/(reader)/civica-index/pulse-changelog/page.tsx",
      "src/lib/db/queries-pulse-v2.ts",
      "src/lib/pulse/v2",
      "src/lib/pulse/v2/runtime-method.generated.json",
      "content/methodology-pulse.md",
    ],
    implementationOwner: "Pulse event-ledger research lane",
    methodologyVersion: "pulse-v2.11-beta",
    gate: "G3",
    source: {
      path: "src/app/(reader)/civica-index/pulse-changelog/page.tsx",
      fragment:
        "An experimental ledger of published and review-queued governance-event classifications, filterable by country, dimension, and severity, with recorded source links and review state.",
    },
  },
  {
    id: "pulse.cluster-coverage-release",
    surface: "pulse",
    routeOrArtifact: "/api/v1/pulse/cluster-coverage",
    exactClaim:
      "A frozen descriptive report publishes stored Pulse cluster-size, source-ID, source-family, language, provisional-jurisdiction, and method-version distributions without treating them as validation evidence.",
    tier: "derived-descriptive-metric",
    evidenceSources: [
      "src/lib/pulse/v2/cluster-coverage.generated.json",
      "src/lib/pulse/v2/cluster-coverage.ts",
      "scripts/generate-pulse-cluster-coverage.ts",
      "scripts/validate-pulse-cluster-coverage.ts",
    ],
    implementationOwner: "Pulse event-ledger research lane",
    methodologyVersion: "pulse-cluster-coverage/v1",
    gate: "G3",
    source: {
      path: "src/app/api/v1/pulse/cluster-coverage/route.ts",
      fragment: "PUBLIC_CLAIM: pulse.cluster-coverage-release",
    },
  },
  {
    id: "pulse.source-coverage-runtime",
    surface: "pulse",
    routeOrArtifact: "/api/v1/pulse/source-coverage",
    exactClaim:
      "Live Pulse source coverage reports operating, degraded, and inactive connector states from retained retrieval telemetry, evidence scope, and rights without claiming retrieval validation.",
    tier: "derived-descriptive-metric",
    evidenceSources: [
      "src/lib/pulse/v2/source-coverage.ts",
      "src/lib/pulse/v2/source-coverage.test.ts",
      "scripts/validate-pulse-source-coverage.ts",
      "content/methodology-pulse.md",
    ],
    implementationOwner: "Pulse event-ledger research lane",
    methodologyVersion: "pulse-source-coverage/v1",
    gate: "G3",
    source: {
      path: "src/app/api/v1/pulse/source-coverage/route.ts",
      fragment: "PUBLIC_CLAIM: pulse.source-coverage-runtime",
    },
  },
  {
    id: "pulse.country-period-observability",
    surface: "pulse",
    routeOrArtifact: "/api/v1/pulse/:country_slug/dimensions",
    exactClaim:
      "Pulse country-period output separates observation sufficiency, low coverage, source outage, restricted information environments, qualifying-event observation, and no-event observation; absence has no numeric effect and cannot imply stability or country quality.",
    tier: "derived-descriptive-metric",
    evidenceSources: [
      "src/lib/pulse/v2/observability.ts",
      "src/lib/pulse/v2/observability.test.ts",
      "src/lib/api/contract/pulse-observability-contract.test.ts",
      "content/methodology-pulse.md",
    ],
    implementationOwner: "Pulse event-ledger research lane",
    methodologyVersion: "pulse-observability/country-period-v1",
    gate: "G3",
    source: {
      path: "src/app/api/v1/pulse/[country_slug]/dimensions/route.ts",
      fragment: "PUBLIC_CLAIM: pulse.country-period-observability",
    },
  },
  {
    id: "methodology.decision-coverage",
    surface: "methodology",
    routeOrArtifact: "/methodology",
    exactClaim:
      "Load-bearing research and reconciliation decisions are documented as versioned records alongside the implementation they describe.",
    tier: "institutional-posture",
    evidenceSources: [
      "src/app/(reader)/methodology/page.tsx",
      "content/",
      "docs/",
      "plan/DECISIONS.md",
    ],
    implementationOwner: "Research methods and editorial",
    methodologyVersion: "documentation-contract-v1",
    gate: "G1",
    source: {
      path: "src/app/(reader)/methodology/page.tsx",
      fragment:
        "Load-bearing research and reconciliation decisions are documented as versioned records alongside the implementation they describe.",
    },
  },
  {
    id: "replication.package-status",
    surface: "methodology",
    routeOrArtifact: "/civica-index/replication",
    exactClaim:
      "The repository contains a reproducible Governance Evidence review packet, with restricted observations withheld where publisher rights do not permit redistribution and external review still pending.",
    tier: "institutional-posture",
    evidenceSources: [
      "src/lib/content/site-state.ts",
      "src/lib/content/replication-surface.ts",
      "data/releases/governance-evidence-review-packet-2026-07-v2/manifest.v1.json",
      "plan/00-mission-and-operating-rules.md",
      "plan/MASTER-CHECKLIST.md",
    ],
    implementationOwner:
      "Civica Index research lane and review packaging (IDX-028)",
    methodologyVersion: "replication-status-v3",
    gate: "G5",
    source: {
      path: "src/app/(reader)/civica-index/replication/page.tsx",
      fragment:
        "The repository contains a reproducible Governance Evidence review packet.",
    },
  },
  {
    id: "policy.corrections",
    surface: "methodology",
    routeOrArtifact: "/policies#corrections",
    exactClaim:
      "A correction changes a published value or statement that was wrong, without withdrawing the artifact it appears in.",
    tier: "institutional-posture",
    evidenceSources: [
      "content/policies.md",
      "src/lib/policy/correction-simulator.ts",
      "src/lib/policy/research-artifacts.ts",
      "src/lib/content/site-state.ts",
    ],
    implementationOwner: "Atlas editorial and research methods (CLM-016)",
    methodologyVersion: "policy-surface-v1",
    gate: "G1",
    source: {
      path: "content/policies.md",
      fragment:
        "A **correction** changes a published value or statement that was wrong, without withdrawing the artifact it appears in.",
    },
  },
  {
    id: "policy.retractions",
    surface: "methodology",
    routeOrArtifact: "/policies#retractions",
    exactClaim:
      "For a frozen, versioned release, Civica's rule is that retraction creates a visible tombstone rather than deletion, while supersession links the old and new versions in both directions.",
    tier: "institutional-posture",
    evidenceSources: [
      "content/policies.md",
      "src/lib/policy/correction-simulator.ts",
      "src/lib/policy/research-artifacts.ts",
    ],
    implementationOwner: "Atlas editorial and research methods (CLM-016)",
    methodologyVersion: "policy-surface-v1",
    gate: "G1",
    source: {
      path: "content/policies.md",
      fragment:
        "For a frozen, versioned release, Civica's rule is that retraction creates a visible tombstone rather than deletion, while supersession links the old and new versions in both directions.",
    },
  },
  {
    id: "policy.versioning",
    surface: "methodology",
    routeOrArtifact: "/policies#versioning",
    exactClaim:
      "For artifacts that expose a methodology version, this policy defines what each increment means without renaming existing fields.",
    tier: "institutional-posture",
    evidenceSources: [
      "content/policies.md",
      "src/lib/content/site-state.ts",
      "src/lib/policy/research-artifacts.ts",
    ],
    implementationOwner: "Atlas editorial and research methods (CLM-016)",
    methodologyVersion: "policy-surface-v1",
    gate: "G1",
    source: {
      path: "content/policies.md",
      fragment:
        "For those that do, this policy defines what each increment means without renaming existing fields:",
    },
  },
  {
    id: "policy.known-limitations",
    surface: "methodology",
    routeOrArtifact: "/policies#known-limitations",
    exactClaim:
      "The policy links the six registered research artifacts to the most specific limitations or methodology disclosure currently available.",
    tier: "institutional-posture",
    evidenceSources: [
      "content/policies.md",
      "src/lib/policy/research-artifacts.ts",
    ],
    implementationOwner: "Atlas editorial and research methods (CLM-016)",
    methodologyVersion: "policy-surface-v1",
    gate: "G1",
    source: {
      path: "content/policies.md",
      fragment:
        "It links the six registered research artifacts to the most specific limitations or methodology disclosure currently available.",
    },
  },
  {
    id: "about.atlas-positioning",
    surface: "about",
    routeOrArtifact: "/about",
    exactClaim:
      "Civica Atlas is a provenance-first comparative reference to how every country is governed.",
    tier: "institutional-posture",
    evidenceSources: ["content/about.md", "src/app/about/page.tsx"],
    implementationOwner: "Atlas editorial",
    methodologyVersion: "atlas-publication-policy-v1",
    gate: "G1",
    source: {
      path: "content/about.md",
      fragment:
        "Civica Atlas is a provenance-first comparative reference to how every country is governed.",
    },
  },
  {
    id: "about.metadata-positioning",
    surface: "about",
    routeOrArtifact: "/about — metadata",
    exactClaim:
      "Civica Atlas is a provenance-first comparative reference to how every country is governed. The atlas is primary; the Civica Index and Pulse are secondary research experiments.",
    tier: "institutional-posture",
    evidenceSources: ["src/app/about/page.tsx", "plan/DECISIONS.md"],
    implementationOwner: "Atlas editorial",
    methodologyVersion: "atlas-positioning-v1",
    gate: "G1",
    source: {
      path: "src/app/about/page.tsx",
      fragment:
        "Civica Atlas is a provenance-first comparative reference to how every country is governed. The atlas is primary; the Civica Index and Pulse are secondary research experiments.",
    },
  },
  {
    id: "about.provenance-coverage",
    surface: "about",
    routeOrArtifact: "/about",
    exactClaim:
      "Civica publishes methods and aims to expose source disagreement without claiming that every value is already reconciled or independently reviewed.",
    tier: "reconciled-fact",
    evidenceSources: [
      "content/about.md",
      "src/lib/factbook/reconcile/api.ts",
      "src/components/factbook/FactValueDot.tsx",
      "src/app/(reader)/country/[slug]/page.tsx",
    ],
    implementationOwner: "Atlas reconciliation and reader platform",
    methodologyVersion: "reconciliation-v0.2-beta",
    gate: "G2",
    source: {
      path: "content/about.md",
      fragment:
        "without claiming that every value is already reconciled or independently reviewed.",
    },
  },
  {
    id: "methodology.provenance-coverage",
    surface: "methodology",
    routeOrArtifact: "/methodology/approach#reader-pages",
    exactClaim: `Across ${PROVENANCE_COVERAGE_SUMMARY.total} registered compact renderer classes on home, Atlas, rankings, and embeds, ${PROVENANCE_COVERAGE_SUMMARY.complete} (${PROVENANCE_COVERAGE_SUMMARY.percent}%) currently expose source, date/vintage, and rights context on the compact surface itself; this is not dataset-wide value coverage.`,
    tier: "institutional-posture",
    evidenceSources: [
      "src/lib/claims/provenance-coverage.ts",
      "content/data-approach.md",
      "scripts/validate-provenance-claims.ts",
    ],
    implementationOwner: "Atlas provenance and reader platform",
    methodologyVersion: "compact-provenance-coverage-v1",
    gate: "G2",
    source: {
      path: "content/data-approach.md",
      fragment: "{{ctx.provenanceCoverageComplete}}",
      mirrors: ["src/app/about/page.tsx"],
    },
  },
  {
    id: "methodology.dataset-provenance-coverage",
    surface: "methodology",
    routeOrArtifact: "/methodology/provenance-coverage",
    exactClaim:
      "A generated audit reports the source depth, linkage, disputes, and operational freshness behind Civica's country fact-key and statement ledgers.",
    tier: "derived-descriptive-metric",
    evidenceSources: [
      "src/lib/provenance/fact-coverage.generated.json",
      "src/lib/provenance/fact-coverage.ts",
      "src/lib/factbook/reconcile/reconciliation-audit.generated.json",
      "src/lib/factbook/reconcile/source-independence.ts",
      "scripts/generate-fact-coverage-report.ts",
      "scripts/generate-reconciliation-audit.ts",
      "scripts/validate-fact-coverage-report.ts",
      "scripts/validate-reconciliation-audit.ts",
    ],
    implementationOwner: "Atlas provenance and reader platform",
    methodologyVersion: "fact-provenance-coverage-v1",
    gate: "G2",
    source: {
      path: "src/app/(reader)/methodology/provenance-coverage/page.tsx",
      fragment:
        "A generated audit of the source depth, linkage, disputes, and operational freshness behind Civica",
      mirrors: [
        "src/app/api/provenance-coverage/route.ts",
        "src/app/api/reconciliation-audit/route.ts",
      ],
    },
  },
  {
    id: "methodology.domain-source-coverage",
    surface: "methodology",
    routeOrArtifact: "/methodology/source-coverage",
    exactClaim:
      "A generated operational report publishes freshness, sovereign-state coverage, field completeness, source families, known gaps, and threshold alerts for nine Atlas domains.",
    tier: "derived-descriptive-metric",
    evidenceSources: [
      "src/lib/provenance/domain-coverage.generated.json",
      "src/lib/provenance/domain-coverage.ts",
      "scripts/generate-domain-coverage.ts",
      "scripts/validate-domain-coverage.ts",
    ],
    implementationOwner: "Atlas provenance and reader platform",
    methodologyVersion: "atlas-domain-coverage-v1",
    gate: "G2",
    source: {
      path: "src/app/(reader)/methodology/source-coverage/page.tsx",
      fragment:
        "A generated operational view of where Civica has records, how complete",
      mirrors: ["src/app/api/source-coverage/route.ts"],
    },
  },
  {
    id: "licensing.mixed-rights",
    surface: "licensing",
    routeOrArtifact: "/licensing",
    exactClaim:
      "Civica is a mixed-source reference atlas. Public-domain and CC0 data can generally be reused freely; publisher-restricted datasets remain governed by their original terms.",
    tier: "institutional-posture",
    evidenceSources: [
      "src/app/licensing/page.tsx",
      "CITATION.cff",
      "src/lib/db/schema.ts",
      "src/lib/db/queries.ts",
    ],
    implementationOwner: "Licensing and data governance",
    methodologyVersion: "mixed-rights-policy-v1",
    gate: "G2",
    source: {
      path: "src/app/licensing/page.tsx",
      fragment:
        "Civica is a mixed-source reference atlas. Public-domain and CC0 data can generally be reused freely; publisher-restricted datasets remain governed by their original terms.",
    },
  },
  {
    id: "licensing.rights-manifest",
    surface: "licensing",
    routeOrArtifact: "/licensing#rights-manifest",
    exactClaim:
      "Civica publishes a machine-readable rights registry for every production source, export product, field class, and checked release artifact. Unverified source terms remain marked pending and are blocked from public bulk export.",
    tier: "institutional-posture",
    evidenceSources: [
      "src/lib/claims/reuse-rights.ts",
      "src/app/licensing/page.tsx",
      "plan/03-data-provenance-and-reproducibility.md",
    ],
    implementationOwner: "Licensing and data governance",
    methodologyVersion: "rights-manifest-v1",
    gate: "G2",
    source: {
      path: "src/lib/claims/reuse-rights.ts",
      fragment:
        "Civica publishes a machine-readable rights registry for every production source, export product, field class, and checked release artifact.",
      mirrors: ["src/app/licensing/page.tsx"],
    },
  },
  {
    id: "licensing.access-vs-reuse",
    surface: "licensing",
    routeOrArtifact: "/licensing#reuse",
    exactClaim:
      "Free, no-account access to a page, download, or embed is not a reuse license. The exact upstream designation attached to each source governs reuse for that source.",
    tier: "institutional-posture",
    evidenceSources: [
      "src/lib/claims/reuse-rights.ts",
      "src/lib/db/schema.ts",
      "scripts/seed-sources.ts",
    ],
    implementationOwner: "Licensing and data governance",
    methodologyVersion: "interim-rights-registry-v1",
    gate: "G2",
    source: {
      path: "src/lib/claims/reuse-rights.ts",
      fragment:
        "Free, no-account access to a page, download, or embed is not a reuse license.",
      mirrors: ["src/app/licensing/page.tsx"],
    },
  },
  {
    id: "licensing.code-status",
    surface: "licensing",
    routeOrArtifact: "/licensing#code",
    exactClaim:
      "The Civica source code is publicly viewable, but no root LICENSE file is published and no open-source reuse license is currently granted.",
    tier: "institutional-posture",
    evidenceSources: [
      "src/lib/claims/reuse-rights.ts",
      "src/app/licensing/page.tsx",
    ],
    implementationOwner: "Licensing and data governance",
    methodologyVersion: "interim-rights-registry-v1",
    gate: "G2",
    source: {
      path: "src/lib/claims/reuse-rights.ts",
      fragment:
        "No root LICENSE file is published, so no open-source reuse license (MIT or otherwise) is currently granted for the code.",
      mirrors: ["src/app/licensing/page.tsx"],
    },
  },
  {
    id: "licensing.imagery-policy",
    surface: "licensing",
    routeOrArtifact: "/licensing#imagery",
    exactClaim:
      "The versioned illustration manifest covers every published engraving with route, subject, caption, pair, file identity, rights note, and QA state. Historical model, prompt, reference-image, and seed records remain incomplete. Automated inventory, pairing, format, file-bound, color-policy, and manifest-drift checks do not replace human landmark review, which is not yet complete or independently audited. Engravings are AI-assisted, non-documentary editorial illustrations and are not source evidence. Civica grants no separate third-party reuse license for them.",
    tier: "institutional-posture",
    evidenceSources: [
      "src/app/licensing/page.tsx",
      "public/engravings/README.md",
      "src/lib/illustrations/illustration-manifest.generated.json",
      "scripts/generate-illustration-manifest.ts",
      "scripts/validate-country-engravings.ts",
      "scripts/validate-territory-engravings.ts",
      "src/lib/data/engraving-captions.ts",
      "src/components/factbook/FactbookHeaderStrip.tsx",
    ],
    implementationOwner: "Licensing and data governance",
    methodologyVersion: "imagery-policy-v1",
    gate: "G2",
    source: {
      path: "src/app/licensing/page.tsx",
      fragment:
        "Historical generation records remain incomplete: the launch\n          sessions did not retain prompt text",
    },
  },
  {
    id: "advisory.independent-review-plan",
    surface: "advisory-board",
    routeOrArtifact: "/about/advisory-board",
    exactClaim:
      "Civica plans to invite an independent advisory board of {min}–{max} scholars; recruitment does not mean a board exists, a review has occurred, or any scholar endorses Civica.",
    tier: "institutional-posture",
    evidenceSources: [
      "src/app/about/advisory-board/page.tsx",
      "src/app/about/advisory-board/apply/page.tsx",
      "src/lib/content/site-state.ts",
      "src/lib/db/schema.ts",
    ],
    implementationOwner: "External review and advisory-board operations",
    methodologyVersion: "advisory-board-plan-v1",
    gate: "G5",
    source: {
      path: "src/app/about/advisory-board/page.tsx",
      fragment:
        "Recruitment does not mean a board exists, a review has occurred, or any scholar endorses Civica.",
    },
  },
  {
    id: "api.coverage-and-products",
    surface: "api-docs",
    routeOrArtifact: "/api-docs",
    exactClaim:
      "Documentation for the Civica public REST API: sovereign-state government structure, country metadata, source provenance, and political-system classifications.",
    tier: "institutional-posture",
    evidenceSources: [
      "src/app/api-docs/page.tsx",
      "src/app/api/v1/countries/route.ts",
      "src/app/api/v1/index/rankings/route.ts",
    ],
    implementationOwner: "Public API platform",
    methodologyVersion: "public-api-v1",
    gate: "G2",
    source: {
      path: "src/app/api-docs/page.tsx",
      fragment:
        "Documentation for the Civica public REST API: sovereign-state government structure, country metadata, source provenance, and political-system classifications.",
    },
  },
  {
    id: "api.pulse-runtime-contract",
    surface: "api-docs",
    routeOrArtifact: "/api/v1/pulse/methodology",
    exactClaim:
      "The Pulse API publishes a generated current-runtime contract; numeric outputs are API-only experimental per-dimension deltas, no reader UI, bulk export, scalar Pulse score, or ranking exists, and older ledger rows have mixed unversioned method history.",
    tier: "experimental-heuristic",
    evidenceSources: [
      "src/lib/pulse/v2/runtime-contract.ts",
      "src/lib/pulse/v2/runtime-method.generated.json",
      "src/app/api/v1/pulse/methodology/route.ts",
      "scripts/validate-pulse-runtime-method.ts",
    ],
    implementationOwner: "Pulse event-ledger research lane",
    methodologyVersion: "pulse-v2.11-beta",
    gate: "G3",
    source: {
      // CLM-012: api-docs/page.tsx renders this route's description from
      // contract/registry.ts's `summary` field (an expression, not
      // literal JSX text) — the claim now pins the actual source of
      // that prose rather than its render site.
      path: "src/lib/api/contract/registry.ts",
      fragment:
        "Returns the generated, machine-readable contract for the Pulse method currently scheduled in production.",
    },
  },
  {
    id: "readme.positioning",
    surface: "readme",
    routeOrArtifact: "README.md",
    exactClaim:
      "Civica Atlas is a provenance-first comparative reference to how every country is governed.",
    tier: "institutional-posture",
    evidenceSources: [
      "README.template.md",
      "README.md",
      "src/app/about/page.tsx",
    ],
    implementationOwner: "Repository editorial",
    methodologyVersion: "atlas-publication-policy-v1",
    gate: "G1",
    source: {
      path: "README.template.md",
      fragment:
        "Civica Atlas is a provenance-first comparative reference to how every country is governed.",
      mirrors: ["README.md"],
    },
  },
  {
    id: "readme.release-status",
    surface: "readme",
    routeOrArtifact: "README.md",
    exactClaim:
      "Status: {launchPhase}. Public launch and external methodology review are planned phases, not shipped yet.",
    tier: "institutional-posture",
    evidenceSources: [
      "README.template.md",
      "src/lib/content/site-state.ts",
      "scripts/regenerate-readme.ts",
    ],
    implementationOwner: "Release and repository editorial",
    methodologyVersion: "release-status-v1",
    gate: "G1",
    source: {
      path: "README.template.md",
      fragment:
        "Public launch + external methodology review are planned phases, not shipped yet.",
      mirrors: ["README.md"],
    },
  },
  {
    id: "readme.index-estimate",
    surface: "readme",
    routeOrArtifact: "README.md — Governance Evidence section",
    exactClaim:
      "Governance Evidence is the selected source-native public comparison product; the former Civica composite and its frozen validation results remain versioned research rather than a recommended ranking.",
    tier: "institutional-posture",
    evidenceSources: [
      "README.template.md",
      "src/lib/content/site-state.ts",
      "src/lib/ci/calculate-v2.ts",
      "content/methodology-civica-index.md",
    ],
    implementationOwner: "Civica Index research lane",
    methodologyVersion: "civica-index-disposition-2026-07-v1",
    gate: "G5",
    source: {
      path: "README.template.md",
      fragment: "The selected public comparison product presents V-Dem",
      mirrors: ["README.md"],
    },
  },
  {
    id: "readme.pulse-signal",
    surface: "readme",
    routeOrArtifact: "README.md — Civica Pulse section",
    exactClaim:
      "The Civica Pulse is an experimental event ledger, not a continuous governance measure; numeric outputs are API-only per-dimension experimental deltas omitted from reader UI and bulk exports, never a scalar Pulse score or ranking.",
    tier: "experimental-heuristic",
    evidenceSources: [
      "README.template.md",
      "src/lib/content/site-state.ts",
      "src/lib/pulse/v2",
      "src/lib/pulse/v2/runtime-method.generated.json",
      "content/methodology-pulse.md",
    ],
    implementationOwner: "Pulse event-ledger research lane",
    methodologyVersion: "pulse-v2.11-beta",
    gate: "G3",
    source: {
      path: "README.template.md",
      fragment:
        "An experimental ledger of governance-relevant events with model-assisted classification, source links, and review state.",
      mirrors: ["README.md"],
    },
  },
  {
    id: "readme.per-value-provenance",
    surface: "readme",
    routeOrArtifact: "README.md — Per-fact provenance section",
    exactClaim:
      "Resolver-backed values can show the selected source, available alternatives, observation dates, and license metadata; Civica does not yet claim universal per-value coverage.",
    tier: "reconciled-fact",
    evidenceSources: [
      "README.template.md",
      "src/components/factbook/FactValueDot.tsx",
      "src/lib/factbook/reconcile/api.ts",
    ],
    implementationOwner: "Atlas reconciliation and reader platform",
    methodologyVersion: "reconciliation-v0.2-beta",
    gate: "G2",
    source: {
      path: "README.template.md",
      fragment: "Civica does not yet claim universal per-value coverage.",
      mirrors: ["README.md"],
    },
  },
  {
    id: "citation.atlas-positioning",
    surface: "citation",
    routeOrArtifact: "CITATION.cff — abstract",
    exactClaim:
      "Civica Atlas is a provenance-first comparative reference to how every country is governed.",
    tier: "institutional-posture",
    evidenceSources: [
      "CITATION.cff",
      "src/components/cite/CiteAccordion.tsx",
      "plan/00-mission-and-operating-rules.md",
    ],
    implementationOwner: "Publication and citation",
    methodologyVersion: "citation-metadata-v1",
    gate: "G1",
    source: {
      path: "CITATION.cff",
      fragment:
        "A provenance-first comparative reference to how every country is governed",
    },
  },
  {
    id: "citation.index-estimate",
    surface: "citation",
    routeOrArtifact: "CITATION.cff — abstract",
    exactClaim:
      "The Civica Index is preserved research rather than a current public comparison product.",
    tier: "institutional-posture",
    evidenceSources: [
      "CITATION.cff",
      "src/lib/ci/calculate-v2.ts",
      "content/methodology-civica-index.md",
    ],
    implementationOwner: "Civica Index research lane",
    methodologyVersion: "civica-index-disposition-2026-07-v1",
    gate: "G5",
    source: {
      path: "CITATION.cff",
      fragment:
        "preserved Civica Index research and the experimental Civica Pulse event ledger.",
    },
  },
  {
    id: "citation.pulse-signal",
    surface: "citation",
    routeOrArtifact: "CITATION.cff — abstract",
    exactClaim:
      "The Civica Pulse is an explicitly experimental research output.",
    tier: "experimental-heuristic",
    evidenceSources: [
      "CITATION.cff",
      "src/lib/pulse/v2",
      "content/methodology-pulse.md",
    ],
    implementationOwner: "Pulse event-ledger research lane",
    methodologyVersion: "pulse-v2.11-beta",
    gate: "G3",
    source: {
      path: "CITATION.cff",
      fragment: "the experimental Civica Pulse event ledger.",
    },
  },
  {
    id: "citation.provenance-coverage",
    surface: "citation",
    routeOrArtifact: "CITATION.cff — abstract",
    exactClaim: "Civica Atlas combines source-linked country profiles.",
    tier: "reconciled-fact",
    evidenceSources: [
      "CITATION.cff",
      "src/lib/factbook/reconcile/api.ts",
      "src/components/factbook/FactValueDot.tsx",
    ],
    implementationOwner: "Atlas reconciliation and publication",
    methodologyVersion: "reconciliation-v0.2-beta",
    gate: "G2",
    source: {
      path: "CITATION.cff",
      fragment: "combining source-linked country profiles",
    },
  },
  {
    id: "metadata.default-atlas-scope",
    surface: "metadata",
    routeOrArtifact: "Root metadata default",
    exactClaim:
      "Civica Atlas is a provenance-first comparative reference to how every country is governed, with source-linked country profiles, institutions, constitutions, and elections.",
    tier: "institutional-posture",
    evidenceSources: ["src/app/layout.tsx", "src/lib/seo/jsonld.ts"],
    implementationOwner: "SEO and atlas editorial",
    methodologyVersion: "metadata-policy-v1",
    gate: "G1",
    source: {
      path: "src/app/layout.tsx",
      fragment:
        "Civica Atlas is a provenance-first comparative reference to how every country is governed, with source-linked country profiles, institutions, constitutions, and elections.",
    },
  },
  {
    id: "metadata.social-card-positioning",
    surface: "metadata",
    routeOrArtifact: "Default Open Graph and social card alt text",
    exactClaim:
      "Civica Atlas is a provenance-first comparative reference to how every country is governed.",
    tier: "institutional-posture",
    evidenceSources: [
      "src/lib/og.ts",
      "public/og-default.png",
      "plan/DECISIONS.md",
    ],
    implementationOwner: "SEO and atlas editorial",
    methodologyVersion: "metadata-policy-v1",
    gate: "G1",
    source: {
      path: "src/lib/og.ts",
      fragment:
        "Civica Atlas — a provenance-first comparative reference to how every country is governed.",
    },
  },
  {
    id: "metadata.index-disposition",
    surface: "metadata",
    routeOrArtifact: "/civica-index — research status metadata",
    exactClaim:
      "The source-native Governance Evidence Dashboard is Civica's selected public comparison product. The composite remains versioned research and is not a recommended country ranking.",
    tier: "institutional-posture",
    evidenceSources: [
      "src/app/(reader)/civica-index/page.tsx",
      "src/lib/ci/index-disposition.ts",
    ],
    implementationOwner: "SEO and Civica Index research lane",
    methodologyVersion: "civica-index-disposition-2026-07-v1",
    gate: "G5",
    source: {
      path: "src/app/(reader)/civica-index/page.tsx",
      fragment:
        "The source-native Governance Evidence Dashboard is Civica's selected public comparison product.",
    },
  },
  {
    id: "metadata.pulse-methodology",
    surface: "metadata",
    routeOrArtifact: "/civica-index/methodology/pulse — page metadata",
    exactClaim:
      "How Civica's experimental, daily-scheduled Pulse ledger ingests, classifies, reviews, and scores governance-relevant events without claiming a live or continuous governance measure.",
    tier: "experimental-heuristic",
    evidenceSources: [
      "src/app/(reader)/civica-index/methodology/pulse/page.tsx",
      "src/lib/content/site-state.ts",
      "src/lib/pulse/v2/runtime-contract.ts",
    ],
    implementationOwner: "SEO and Pulse event-ledger research lane",
    methodologyVersion: "pulse-v2.11-beta",
    gate: "G3",
    source: {
      path: "src/app/(reader)/civica-index/methodology/pulse/page.tsx",
      fragment:
        "How Civica's experimental, daily-scheduled Pulse ledger ingests, classifies, reviews, and scores governance-relevant events without claiming a live or continuous governance measure.",
    },
  },
  {
    id: "methodology.pulse-ledger-charter",
    surface: "methodology",
    routeOrArtifact: "/civica-index/methodology/pulse#research-charter",
    exactClaim:
      "Pulse is being developed first as a versioned ledger of documented governance-relevant event records; it is not a complete, real-time, continuously observed, country-quality, or causal measure, and no-value is an allowed disposition.",
    tier: "experimental-heuristic",
    evidenceSources: [
      "src/lib/pulse/v2/research-charter.ts",
      "plan/research/pulse-ledger-research-charter-v1.md",
      "scripts/validate-pulse-ledger-charter.ts",
    ],
    implementationOwner: "Pulse event-ledger research lane",
    methodologyVersion: "pulse-ledger-charter/v1",
    gate: "G3",
    source: {
      path: "content/methodology-pulse.md",
      fragment:
        "Pulse is being developed first as a versioned ledger of **documented governance-relevant event records**.",
    },
  },
  {
    id: "export.provenance-coverage",
    surface: "exports",
    routeOrArtifact: "/api/countries/{slug}/export?format=csv|json",
    exactClaim:
      "Country JSON and CSV downloads expose one resolver-selected canonical observation per exported fact key, with separately typed rights-cleared alternates, projections, and rejected evidence.",
    tier: "reconciled-fact",
    evidenceSources: [
      "src/app/api/countries/[slug]/export/route.ts",
      "src/lib/rights/manifest.ts",
    ],
    implementationOwner: "Atlas exports and reconciliation",
    methodologyVersion: "reconciliation-v0.2-beta",
    gate: "G2",
    source: {
      path: "src/app/api/countries/[slug]/export/route.ts",
      fragment: "buildCountryResearchExport",
    },
  },
  {
    id: "export.atlas-release",
    surface: "exports",
    routeOrArtifact: "/downloads/civica-atlas-2026-07-11.json.gz",
    exactClaim:
      "The frozen Atlas reference package contains rights-cleared canonical rows from its named immutable snapshot, with stable jurisdiction IDs, row hashes, provenance, rights joins, a codebook, deterministic ordering, and no Index or Pulse outputs.",
    tier: "institutional-posture",
    evidenceSources: [
      "data/releases/atlas-2026-07-11/manifest.v1.json",
      "src/lib/rights/manifest.ts",
      "scripts/validate-atlas-export.ts",
    ],
    implementationOwner: "Atlas exports and data governance",
    methodologyVersion: "civica-atlas-export/v3",
    gate: "G2",
    source: {
      path: "src/app/api-docs/page.tsx",
      fragment: "Download Atlas JSON (gzip)",
    },
  },
  {
    id: "embeds.retired-index",
    surface: "embeds",
    routeOrArtifact: "/embed/{slug}",
    exactClaim:
      "Legacy Civica Index embeds are retired and return no score, rank, or dimension value; Governance Evidence is the successor public product.",
    tier: "institutional-posture",
    evidenceSources: [
      "src/app/embed/[slug]/route.ts",
      "src/lib/ci/index-disposition.ts",
    ],
    implementationOwner: "Governance evidence and API stewardship",
    methodologyVersion: "civica-index-disposition-2026-07-v1",
    gate: "G5",
    source: {
      path: "src/app/embed/[slug]/route.ts",
      fragment: "This Civica Index embed has been retired.",
    },
  },
] as const satisfies readonly PublicClaim[];
