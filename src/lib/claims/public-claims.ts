import type { PublicClaimTierId } from "./claim-tiers";

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
    routeOrArtifact: "/ — Civica Index feature",
    exactClaim:
      "The Civica Index and Pulse are secondary research experiments whose methods and outputs remain beta while validity, sensitivity, and usefulness are tested.",
    tier: "institutional-posture",
    evidenceSources: [
      "src/components/home/HomeGrid.tsx",
      "plan/DECISIONS.md",
      "plan/MASTER-CHECKLIST.md",
    ],
    implementationOwner: "Atlas editorial and research methods",
    methodologyVersion: "atlas-positioning-v1",
    gate: "G1",
    source: {
      path: "src/components/home/HomeGrid.tsx",
      fragment:
        "The Civica Index and Pulse are secondary research experiments.",
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
    id: "index.composite-estimate",
    surface: "index",
    routeOrArtifact: "/civica-index",
    exactClaim:
      "The Civica Index is a research-beta composite across {dimensionCount} governance dimensions, with fixed-bound normalization and Monte Carlo input-variation ranges; it has not completed independent review.",
    tier: "research-beta-estimate",
    evidenceSources: [
      "src/lib/ci/calculate-v2.ts",
      "src/lib/ci/dimensions-v2.ts",
      "src/lib/content/site-state.ts",
      "content/methodology-civica-index.md",
    ],
    implementationOwner: "Civica Index research lane",
    methodologyVersion: "civica-index-v2-beta",
    gate: "G3",
    source: {
      path: "src/app/(reader)/civica-index/page.tsx",
      fragment:
        "A research-beta composite across ${civicaIndex.dimensionCount} governance dimensions, with fixed-bound normalization and Monte Carlo input-variation ranges. Not independently reviewed.",
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
    methodologyVersion: "pulse-v2.1-beta",
    gate: "G3",
    source: {
      path: "src/app/(reader)/civica-index/pulse-changelog/page.tsx",
      fragment:
        "An experimental ledger of published and review-queued governance-event classifications, filterable by country, dimension, and severity, with recorded source links and review state.",
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
      "No replication package is currently published. The components below are individually marked with their build status.",
    tier: "institutional-posture",
    evidenceSources: [
      "src/lib/content/site-state.ts",
      "src/lib/content/replication-surface.ts",
      "plan/00-mission-and-operating-rules.md",
      "plan/MASTER-CHECKLIST.md",
    ],
    implementationOwner: "Civica Index research lane and release packaging (DAT-022)",
    methodologyVersion: "replication-status-v1",
    gate: "G1",
    source: {
      path: "src/app/(reader)/civica-index/replication/page.tsx",
      fragment:
        "No replication package is currently published. The components below are individually marked with their build status.",
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
      "Documentation for the Civica public REST API: sovereign-state government structure, country metadata, Civica Index scores, and political-system classifications.",
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
        "Documentation for the Civica public REST API: sovereign-state government structure, country metadata, Civica Index scores, and political-system classifications.",
    },
  },
  {
    id: "api.pulse-runtime-contract",
    surface: "api-docs",
    routeOrArtifact: "/api/v1/pulse/methodology",
    exactClaim:
      "The Pulse API publishes a generated current-runtime contract; numeric outputs are public experimental per-dimension deltas, no scalar Pulse score or ranking exists, and older ledger rows have mixed unversioned method history.",
    tier: "experimental-heuristic",
    evidenceSources: [
      "src/lib/pulse/v2/runtime-contract.ts",
      "src/lib/pulse/v2/runtime-method.generated.json",
      "src/app/api/v1/pulse/methodology/route.ts",
      "scripts/validate-pulse-runtime-method.ts",
    ],
    implementationOwner: "Pulse event-ledger research lane",
    methodologyVersion: "pulse-v2.1-beta",
    gate: "G3",
    source: {
      path: "src/app/api-docs/page.tsx",
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
    evidenceSources: ["README.template.md", "README.md", "src/app/about/page.tsx"],
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
    routeOrArtifact: "README.md — Civica Index section",
    exactClaim:
      "The Civica Index is a research-beta 0–100 composite whose simulation bounds are input-variation ranges rather than confidence intervals; its construction, weights, and interpretation remain subject to validation.",
    tier: "research-beta-estimate",
    evidenceSources: [
      "README.template.md",
      "src/lib/content/site-state.ts",
      "src/lib/ci/calculate-v2.ts",
      "content/methodology-civica-index.md",
    ],
    implementationOwner: "Civica Index research lane",
    methodologyVersion: "civica-index-v2-beta",
    gate: "G3",
    source: {
      path: "README.template.md",
      fragment:
        "A research-beta 0–100 composite across {{ctx.civicaIndexDimensionCountWord}} governance dimensions",
      mirrors: ["README.md"],
    },
  },
  {
    id: "readme.pulse-signal",
    surface: "readme",
    routeOrArtifact: "README.md — Civica Pulse section",
    exactClaim:
      "The Civica Pulse is an experimental event ledger, not a continuous governance measure; its public numeric outputs are named per-dimension experimental deltas, never a scalar Pulse score or ranking.",
    tier: "experimental-heuristic",
    evidenceSources: [
      "README.template.md",
      "src/lib/content/site-state.ts",
      "src/lib/pulse/v2",
      "src/lib/pulse/v2/runtime-method.generated.json",
      "content/methodology-pulse.md",
    ],
    implementationOwner: "Pulse event-ledger research lane",
    methodologyVersion: "pulse-v2.1-beta",
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
      fragment:
        "Civica does not yet claim universal per-value coverage.",
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
    exactClaim: "The Civica Index is an explicitly experimental research output.",
    tier: "research-beta-estimate",
    evidenceSources: [
      "CITATION.cff",
      "src/lib/ci/calculate-v2.ts",
      "content/methodology-civica-index.md",
    ],
    implementationOwner: "Civica Index research lane",
    methodologyVersion: "civica-index-v2-beta",
    gate: "G3",
    source: {
      path: "CITATION.cff",
      fragment:
        "the explicitly experimental Civica Index and Civica Pulse research outputs.",
    },
  },
  {
    id: "citation.pulse-signal",
    surface: "citation",
    routeOrArtifact: "CITATION.cff — abstract",
    exactClaim: "The Civica Pulse is an explicitly experimental research output.",
    tier: "experimental-heuristic",
    evidenceSources: ["CITATION.cff", "src/lib/pulse/v2", "content/methodology-pulse.md"],
    implementationOwner: "Pulse event-ledger research lane",
    methodologyVersion: "pulse-v2.1-beta",
    gate: "G3",
    source: {
      path: "CITATION.cff",
      fragment:
        "the explicitly experimental Civica Index and Civica Pulse research outputs.",
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
    id: "export.full-provenance",
    surface: "exports",
    routeOrArtifact: "/api/countries/{slug}/export?format=csv|json",
    exactClaim:
      "The JSON country export contains full per-fact provenance; CSV contains reconciliation version, vintage, and methodology metadata.",
    tier: "reconciled-fact",
    evidenceSources: [
      "src/app/api/countries/[slug]/export/route.ts",
      "src/lib/factbook/reconcile/api.ts",
    ],
    implementationOwner: "Atlas exports and reconciliation",
    methodologyVersion: "reconciliation-v0.2-beta",
    gate: "G2",
    source: {
      path: "src/app/api/countries/[slug]/export/route.ts",
      fragment: "# For full per-fact provenance, request format=json.",
    },
  },
  {
    id: "embed.reconciled-attribution",
    surface: "embeds",
    routeOrArtifact: "/embed/{slug}",
    exactClaim:
      "Source: {canonical source list} · Civica Atlas reconciled {reconciliationVersion}.",
    tier: "reconciled-fact",
    evidenceSources: [
      "src/app/embed/[slug]/route.ts",
      "src/lib/factbook/reconcile/api.ts",
    ],
    implementationOwner: "Embeds and atlas reconciliation",
    methodologyVersion: "reconciliation-v0.2-beta",
    gate: "G2",
    source: {
      path: "src/app/embed/[slug]/route.ts",
      fragment:
        "Source: ${esc(attributionLabel)} · Civica Atlas reconciled ${esc(FACTBOOK_RECONCILIATION_META.version)}",
    },
  },
  {
    id: "embed.index-score",
    surface: "embeds",
    routeOrArtifact: "/embed/{slug}",
    exactClaim:
      "Civica Index {countryScore}/100 · research beta · {quarter}; rank may be shown where space permits.",
    tier: "research-beta-estimate",
    evidenceSources: [
      "src/app/embed/[slug]/route.ts",
      "src/lib/ci/calculate-v2.ts",
      "src/lib/ci/dimensions-v2.ts",
    ],
    implementationOwner: "Embeds and Civica Index research lane",
    methodologyVersion: "civica-index-v2-beta",
    gate: "G3",
    source: {
      path: "src/app/embed/[slug]/route.ts",
      fragment: '<div class="brand">Civica Index <span',
    },
  },
] as const satisfies readonly PublicClaim[];
