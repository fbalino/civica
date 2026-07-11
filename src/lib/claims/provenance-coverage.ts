/**
 * CLM-019 — measured compact-surface provenance coverage.
 *
 * The denominator is deliberately renderer classes, not database rows or
 * facts. Each row represents one distinct empirical-value rendering contract
 * on the four CLM-019 audit surfaces: home, Atlas, rankings, and embeds.
 * A renderer counts as complete only when source, date/vintage, and rights
 * context are available on that compact surface itself. A downstream country
 * link is useful, but it does not count as point-of-use coverage.
 *
 * DAT-005 publishes the separate dataset-wide statement/fact-key coverage
 * report. Do not present this class-level percentage as a percentage of
 * Civica's values.
 */

export const PROVENANCE_SURFACE_IDS = [
  "home",
  "atlas",
  "rankings",
  "embeds",
] as const;

export type ProvenanceSurfaceId = (typeof PROVENANCE_SURFACE_IDS)[number];

export type ProvenanceLinkage =
  | "point-of-use"
  | "machine-readable"
  | "not-applicable"
  | "partial"
  | "downstream-only"
  | "absent";

export interface ProvenanceRendererClass {
  id: string;
  surface: ProvenanceSurfaceId;
  label: string;
  source: ProvenanceLinkage;
  vintage: ProvenanceLinkage;
  rights: ProvenanceLinkage;
  implementationPaths: readonly string[];
  /** Required when the renderer is not complete. Public, plain-language copy. */
  exception: string | null;
}

const COMPLETE_LINKAGE = new Set<ProvenanceLinkage>([
  "point-of-use",
  "machine-readable",
  "not-applicable",
]);

export function hasCompleteCompactProvenance(
  row: ProvenanceRendererClass,
): boolean {
  return (
    COMPLETE_LINKAGE.has(row.source) &&
    COMPLETE_LINKAGE.has(row.vintage) &&
    COMPLETE_LINKAGE.has(row.rights)
  );
}

export const PROVENANCE_RENDERER_CLASSES: readonly ProvenanceRendererClass[] = [
  {
    id: "home.catalog-count",
    surface: "home",
    label: "Homepage jurisdiction count",
    source: "absent",
    vintage: "absent",
    rights: "absent",
    implementationPaths: ["src/components/home/HomeGrid.tsx"],
    exception:
      "the live jurisdiction count has no point-of-use source, date, or rights control",
  },
  {
    id: "home.country-card",
    surface: "home",
    label: "Homepage featured-country cards",
    source: "downstream-only",
    vintage: "downstream-only",
    rights: "downstream-only",
    implementationPaths: [
      "src/components/home/HomeGrid.tsx",
      "src/components/home/CountryCard.tsx",
    ],
    exception:
      "government, population, income, and Index summaries link onward but have no inline source/date/rights mapping",
  },
  {
    id: "atlas.choropleth-layer",
    surface: "atlas",
    label: "Atlas choropleth layers",
    source: "partial",
    vintage: "absent",
    rights: "absent",
    implementationPaths: [
      "src/components/atlas/AtlasWorldMap.tsx",
      "src/lib/atlas/map-layers.ts",
    ],
    exception:
      "some layer labels name their publisher, but layer values have no point-of-use vintage or rights link",
  },
  {
    id: "atlas.hover-card",
    surface: "atlas",
    label: "Atlas country hover card",
    source: "downstream-only",
    vintage: "downstream-only",
    rights: "downstream-only",
    implementationPaths: [
      "src/components/atlas/AtlasWorldMap.tsx",
      "src/components/v2/CountryHoverCard.tsx",
    ],
    exception:
      "active-layer, capital, and population summaries link onward but have no inline per-value source/date/rights mapping",
  },
  {
    id: "rankings.metric-cell",
    surface: "rankings",
    label: "Rankings metric cells",
    source: "point-of-use",
    vintage: "point-of-use",
    rights: "point-of-use",
    implementationPaths: [
      "src/app/rankings/page.tsx",
      "src/app/rankings/RankingsMatrix.tsx",
    ],
    exception: null,
  },
  {
    id: "embeds.retired-index",
    surface: "embeds",
    label: "Retired Index embed notice",
    source: "not-applicable",
    vintage: "not-applicable",
    rights: "point-of-use",
    implementationPaths: ["src/app/embed/[slug]/route.ts"],
    exception: null,
  },
];

function joinLabels(labels: readonly string[]): string {
  if (labels.length === 0) return "none";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}`;
}

const completeRows = PROVENANCE_RENDERER_CLASSES.filter(
  hasCompleteCompactProvenance,
);
const exceptionRows = PROVENANCE_RENDERER_CLASSES.filter(
  (row) => !hasCompleteCompactProvenance(row),
);

export const PROVENANCE_COVERAGE_SUMMARY = {
  unit: "compact renderer classes" as const,
  total: PROVENANCE_RENDERER_CLASSES.length,
  complete: completeRows.length,
  percent: Math.round(
    (completeRows.length / PROVENANCE_RENDERER_CLASSES.length) * 100,
  ),
  completeLabels: joinLabels(completeRows.map((row) => row.label)),
  exceptionSummary: exceptionRows
    .map((row) => `${row.label}: ${row.exception}`)
    .join("; "),
  isDatasetWide: false as const,
  datasetWideOwner: "DAT-005" as const,
} as const;

export interface ProvenanceMarkerIssue {
  rendererId: string;
  surface: ProvenanceSurfaceId;
  ruleId: "missing-implementation-file" | "missing-marker";
}

/** Pure source-level marker contract shared by the CLI and seeded fixtures. */
export function validateProvenanceRendererSources(
  sources: Readonly<Record<string, string | undefined>>,
): ProvenanceMarkerIssue[] {
  const issues: ProvenanceMarkerIssue[] = [];
  for (const row of PROVENANCE_RENDERER_CLASSES) {
    const available = row.implementationPaths.filter(
      (file) => sources[file] !== undefined,
    );
    if (available.length === 0) {
      issues.push({
        rendererId: row.id,
        surface: row.surface,
        ruleId: "missing-implementation-file",
      });
      continue;
    }
    if (
      !available.some((file) =>
        sources[file]!.includes(`PROVENANCE_COVERAGE: ${row.id}`),
      )
    ) {
      issues.push({
        rendererId: row.id,
        surface: row.surface,
        ruleId: "missing-marker",
      });
    }
  }
  return issues;
}

// ── Pure prohibited-claim scanner ──────────────────────────────────────

export interface UniversalProvenanceFinding {
  ruleId: "universal-provenance-claim";
  match: string;
  index: number;
}

const UNIVERSAL_PROVENANCE_PATTERNS: readonly RegExp[] = [
  /\bevery\s+(?:data point|value|fact|record|column)\b(?!-)[^.!?\n]{0,60}\b(?:carries|shows|retains|traces|links|has|includes|keeps|comes with)\b[^.!?\n]{0,60}\b(?:provenance|source|freshness|license|rights|trace)/i,
  /\beach\s+(?:data point|value|fact|record|column)\b(?!-)[^.!?\n]{0,60}\b(?:carries|shows|retains|traces|links|has|includes|keeps|comes with)\b[^.!?\n]{0,60}\b(?:provenance|source|freshness|license|rights|trace)/i,
  /\ball\s+(?:data points|values|facts|records|columns)\b(?!-)[^.!?\n]{0,60}\b(?:carry|show|retain|trace|link|have|include|keep|come with)\b[^.!?\n]{0,60}\b(?:provenance|source|freshness|license|rights|trace)/i,
  /\bprovenance\s+on\s+every\s+fact\b/i,
  /\bevery\s+fact\s+carries\s+provenance\b/i,
  /\bfull\s+(?:source|per[- ]fact|per[- ]value)\s+provenance\b/i,
];

const NEGATION_OR_SCOPE_RE =
  /\b(?:not|does not|do not|without claiming|cannot claim|no claim of|where implemented|where available|supported)\b[^.!?\n]{0,72}$/i;

function isQualified(text: string, index: number): boolean {
  return NEGATION_OR_SCOPE_RE.test(text.slice(Math.max(0, index - 90), index));
}

export function findUniversalProvenanceClaims(
  text: string,
): UniversalProvenanceFinding[] {
  const findings: UniversalProvenanceFinding[] = [];
  for (const pattern of UNIVERSAL_PROVENANCE_PATTERNS) {
    const re = new RegExp(pattern.source, `${pattern.flags}g`);
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      if (isQualified(text, match.index)) continue;
      findings.push({
        ruleId: "universal-provenance-claim",
        match: match[0],
        index: match.index,
      });
    }
  }
  return findings;
}
