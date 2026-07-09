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
      "An interactive reference for how every country is governed: government structures, constitutions, and elections for 250+ nations.",
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
        "An interactive reference for how every country is governed: government structures, constitutions, and elections for 250+ nations",
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
      "An original governance score for 190+ sovereign states across {dimensionCount} dimensions, with empirically-derived weights, fixed-bound normalization, and 90% confidence intervals.",
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
        "An original governance score for 190+ sovereign states across ${civicaIndex.dimensionCount} dimensions, with empirically-derived weights, fixed-bound normalization, and 90% confidence intervals.",
    },
  },
  {
    id: "pulse.event-ledger",
    surface: "pulse",
    routeOrArtifact: "/civica-index/pulse-changelog",
    exactClaim:
      "Every governance event classified by the Civica Pulse Beta pipeline is filterable by country, dimension, and severity, with full source attribution and human-review status.",
    tier: "experimental-heuristic",
    evidenceSources: [
      "src/app/(reader)/civica-index/pulse-changelog/page.tsx",
      "src/lib/db/queries-pulse-v2.ts",
      "src/lib/pulse/v2",
      "content/methodology-pulse.md",
    ],
    implementationOwner: "Pulse event-ledger research lane",
    methodologyVersion: "pulse-v2.0-beta",
    gate: "G3",
    source: {
      path: "src/app/(reader)/civica-index/pulse-changelog/page.tsx",
      fragment:
        "Every governance event classified by the Civica Pulse Beta pipeline, filterable by country, dimension, and severity, with full source attribution and human-review status.",
    },
  },
  {
    id: "methodology.decision-coverage",
    surface: "methodology",
    routeOrArtifact: "/methodology",
    exactClaim:
      "Every load-bearing methodology decision in Civica is documented as a citable resolution before the corresponding code ships.",
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
        "Every load-bearing methodology decision in Civica is documented as a citable resolution before the corresponding code ships.",
    },
  },
  {
    id: "about.atlas-positioning",
    surface: "about",
    routeOrArtifact: "/about",
    exactClaim:
      "Civica Atlas is an open reference atlas of the world's countries, governments, and governance outcomes.",
    tier: "institutional-posture",
    evidenceSources: ["content/about.md", "src/app/about/page.tsx"],
    implementationOwner: "Atlas editorial",
    methodologyVersion: "atlas-publication-policy-v1",
    gate: "G1",
    source: {
      path: "content/about.md",
      fragment:
        "Civica Atlas is an open reference atlas of the world's countries, governments, and governance outcomes.",
    },
  },
  {
    id: "about.provenance-coverage",
    surface: "about",
    routeOrArtifact: "/about",
    exactClaim:
      "Every fact carries provenance, every methodology decision is documented, and every disagreement between sources is surfaced rather than hidden.",
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
        "Every fact carries provenance, every methodology decision is documented, and every disagreement between sources is surfaced rather than hidden.",
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
      "The Civica Index will be reviewed by an independent academic advisory board of {min}–{max} scholars with relevant expertise.",
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
        "the Civica Index will be reviewed by an independent academic advisory board of",
    },
  },
  {
    id: "api.coverage-and-products",
    surface: "api-docs",
    routeOrArtifact: "/api-docs",
    exactClaim:
      "The Civica public REST API provides government structure, country metadata, Civica Index scores, and political-system classifications for 250+ countries.",
    tier: "derived-descriptive-metric",
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
        "Documentation for the Civica public REST API: government structure, country metadata, Civica Index scores, and political system classifications for 250+ countries.",
    },
  },
  {
    id: "readme.positioning",
    surface: "readme",
    routeOrArtifact: "README.md",
    exactClaim:
      "An open reference atlas of the world's countries, governments, and governance outcomes — built on multi-source reconciliation, statement-level provenance, and published methodology.",
    tier: "institutional-posture",
    evidenceSources: ["README.template.md", "README.md", "src/app/about/page.tsx"],
    implementationOwner: "Repository editorial",
    methodologyVersion: "atlas-publication-policy-v1",
    gate: "G1",
    source: {
      path: "README.template.md",
      fragment:
        "An open reference atlas of the world's countries, governments, and governance outcomes — built on multi-source reconciliation, statement-level provenance, and published methodology.",
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
      "The Civica Index is an original 0–100 composite governance score computed quarterly across {dimensionCount} governance dimensions and is currently beta pending external methodological review.",
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
        "An original composite governance score on a 0–100 scale, computed quarterly across {{ctx.civicaIndexDimensionCountWord}} governance dimensions",
      mirrors: ["README.md"],
    },
  },
  {
    id: "readme.pulse-signal",
    surface: "readme",
    routeOrArtifact: "README.md — Civica Pulse section",
    exactClaim:
      "The Civica Pulse is a daily directional signal layered on top of the Index, produced from governance-relevant events by an LLM classifier and currently in beta.",
    tier: "experimental-heuristic",
    evidenceSources: [
      "README.template.md",
      "src/lib/content/site-state.ts",
      "src/lib/pulse/v2",
      "content/methodology-pulse.md",
    ],
    implementationOwner: "Pulse event-ledger research lane",
    methodologyVersion: "pulse-v2.0-beta",
    gate: "G3",
    source: {
      path: "README.template.md",
      fragment: "A daily directional signal layered on top of the Index.",
      mirrors: ["README.md"],
    },
  },
  {
    id: "readme.per-value-provenance",
    surface: "readme",
    routeOrArtifact: "README.md — Per-fact provenance section",
    exactClaim:
      "Every value on every reader-facing page renders a FactValueDot that reveals the canonical pick, alternate sources, dates, licenses, and freshness winner.",
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
        "Every value on every reader-facing page renders a `<FactValueDot>` chevron.",
      mirrors: ["README.md"],
    },
  },
  {
    id: "citation.academic-standing",
    surface: "citation",
    routeOrArtifact: "CITATION.cff — abstract",
    exactClaim: "Civica Atlas is academically citable.",
    tier: "institutional-posture",
    evidenceSources: [
      "CITATION.cff",
      "src/components/cite/CiteAccordion.tsx",
      "plan/00-mission-and-operating-rules.md",
    ],
    implementationOwner: "Publication and citation",
    methodologyVersion: "citation-metadata-v1",
    gate: "G5",
    source: {
      path: "CITATION.cff",
      fragment: "An academically citable, interactive reference atlas",
    },
  },
  {
    id: "citation.index-estimate",
    surface: "citation",
    routeOrArtifact: "CITATION.cff — abstract",
    exactClaim: "The Civica Index is a 0–100 governance composite.",
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
      fragment: "the Civica Index (a 0–100 governance composite)",
    },
  },
  {
    id: "citation.pulse-signal",
    surface: "citation",
    routeOrArtifact: "CITATION.cff — abstract",
    exactClaim: "The Civica Pulse is an event-sensitive governance signal.",
    tier: "experimental-heuristic",
    evidenceSources: ["CITATION.cff", "src/lib/pulse/v2", "content/methodology-pulse.md"],
    implementationOwner: "Pulse event-ledger research lane",
    methodologyVersion: "pulse-v2.0-beta",
    gate: "G3",
    source: {
      path: "CITATION.cff",
      fragment: "the Civica Pulse (an event-sensitive governance signal)",
    },
  },
  {
    id: "citation.provenance-coverage",
    surface: "citation",
    routeOrArtifact: "CITATION.cff — abstract",
    exactClaim: "Civica Atlas provides statement-level provenance for every data point.",
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
      fragment: "with statement-level provenance for every data point.",
    },
  },
  {
    id: "metadata.default-atlas-scope",
    surface: "metadata",
    routeOrArtifact: "Root metadata default",
    exactClaim:
      "Civica Atlas is an interactive atlas of government structures, constitutions, elections, and governance data for every country.",
    tier: "institutional-posture",
    evidenceSources: ["src/app/layout.tsx", "src/lib/seo/jsonld.ts"],
    implementationOwner: "SEO and atlas editorial",
    methodologyVersion: "metadata-policy-v1",
    gate: "G1",
    source: {
      path: "src/app/layout.tsx",
      fragment:
        "Interactive atlas of government structures, constitutions, elections, and governance data for every country",
    },
  },
  {
    id: "metadata.default-index-score",
    surface: "metadata",
    routeOrArtifact: "Root metadata default",
    exactClaim: "The Civica Index is an original governance score.",
    tier: "research-beta-estimate",
    evidenceSources: [
      "src/app/layout.tsx",
      "src/lib/ci/calculate-v2.ts",
      "content/methodology-civica-index.md",
    ],
    implementationOwner: "SEO and Civica Index research lane",
    methodologyVersion: "civica-index-v2-beta",
    gate: "G3",
    source: {
      path: "src/app/layout.tsx",
      fragment: "with the Civica Index, an original governance score.",
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
    exactClaim: "Civica Index {countryScore} ({rank}, {tier}, {quarter}).",
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
