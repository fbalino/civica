export const QUERY_BUDGET_CONTRACT_VERSION = "civica-query-budget/v1";

export type QueryBudgetDomain =
  | "country"
  | "constitution"
  | "indicator"
  | "index"
  | "pulse";

export interface QueryBudget {
  id: string;
  domain: QueryBudgetDomain;
  reader: string;
  sourceFiles: readonly string[];
  fixture: {
    label: string;
    countrySlug?: string;
    query?: string;
  };
  requiredIndexes: readonly string[];
  maxReturnedRows: number;
  executionP95BudgetMs: number;
  boundedReadShape: string;
}

/**
 * Representative, production-sized database read profiles. The live runner
 * executes only the matching SELECT under EXPLAIN ANALYZE; this contract keeps
 * the reader route, index ownership, maximum result set, and p95 budget
 * reviewable without requiring database credentials in CI.
 */
export const QUERY_BUDGETS: readonly QueryBudget[] = [
  {
    id: "country-facts-high-cardinality",
    domain: "country",
    reader: "/country/[slug] factbook and country export",
    sourceFiles: [
      "src/lib/db/queries.ts",
      "src/lib/factbook/reconcile/api.ts",
    ],
    fixture: { label: "largest current fact set", countrySlug: "spain" },
    requiredIndexes: ["idx_country_facts_jurisdiction"],
    maxReturnedRows: 250,
    executionP95BudgetMs: 50,
    boundedReadShape:
      "A jurisdiction-keyed set read returns facts in one query; fact rows never trigger per-row source or statement queries.",
  },
  {
    id: "constitution-search-corpus",
    domain: "constitution",
    reader: "/api/constitution/search",
    sourceFiles: ["src/lib/db/queries-constitution-search.ts"],
    fixture: { label: "full passage corpus phrase search", query: "freedom of expression" },
    requiredIndexes: ["idx_constitution_passages_search"],
    maxReturnedRows: 21,
    executionP95BudgetMs: 100,
    boundedReadShape:
      "One GIN-backed passage search limits each response to 20 results plus one cursor sentinel; full corpus text is not selected.",
  },
  {
    id: "indicator-history-high-cardinality",
    domain: "indicator",
    reader: "/api/countries/[slug]/indicator-history",
    sourceFiles: ["src/lib/db/queries.ts"],
    fixture: { label: "largest country history", countrySlug: "afghanistan" },
    requiredIndexes: ["idx_indicator_history_jur_dim"],
    maxReturnedRows: 500,
    executionP95BudgetMs: 50,
    boundedReadShape:
      "One jurisdiction lookup and one jurisdiction-keyed history scan feed all series; in-memory grouping is bounded by the 500-row response ceiling.",
  },
  {
    id: "index-release-rankings",
    domain: "index",
    reader: "/api/v1/index/rankings",
    sourceFiles: [
      "src/app/api/v1/index/rankings/route.ts",
      "src/lib/ci/release-store.ts",
    ],
    fixture: { label: "current complete Index release" },
    requiredIndexes: ["idx_ci_composite_quarter_rank"],
    maxReturnedRows: 250,
    executionP95BudgetMs: 50,
    boundedReadShape:
      "The post-migration reader selects one release by pointer; its live pre-migration counterpart is set-wise, rank-ordered, and capped by the public 250-row limit rather than filtered in memory.",
  },
  {
    id: "pulse-publication-panel",
    domain: "pulse",
    reader: "/api/v1/pulse/[country_slug]/dimensions",
    sourceFiles: ["src/lib/db/queries-pulse-v2.ts"],
    fixture: { label: "current five-dimension Pulse score panel" },
    requiredIndexes: ["idx_pulse_dim_history_run_jurisdiction_dimension"],
    maxReturnedRows: 1500,
    executionP95BudgetMs: 100,
    boundedReadShape:
      "The post-migration reader validates one pointer-selected run as a complete fixed five-dimension panel; the pre-migration audit selects one newest immutable run and never scans history across runs or queries once per panel row.",
  },
  {
    id: "pulse-country-events-high-cardinality",
    domain: "pulse",
    reader: "country Pulse event context and changelog filters",
    sourceFiles: ["src/lib/db/queries-pulse-v2.ts"],
    fixture: { label: "largest current country event set", countrySlug: "turkey" },
    requiredIndexes: ["idx_pulse_v2_jurisdiction_date"],
    maxReturnedRows: 251,
    executionP95BudgetMs: 100,
    boundedReadShape:
      "Current events are jurisdiction-keyed, date-ordered, and request-capped; source attribution is fetched as one set for the selected event IDs.",
  },
] as const;

const REQUIRED_DOMAINS: readonly QueryBudgetDomain[] = [
  "country",
  "constitution",
  "indicator",
  "index",
  "pulse",
];

export function queryBudgetContractErrors(
  budgets: readonly QueryBudget[] = QUERY_BUDGETS,
): string[] {
  const errors: string[] = [];
  const seenIds = new Set<string>();
  const seenDomains = new Set<QueryBudgetDomain>();

  for (const budget of budgets) {
    if (!/^[a-z0-9-]+$/.test(budget.id))
      errors.push(`${budget.id}: id must be kebab case`);
    if (seenIds.has(budget.id)) errors.push(`${budget.id}: duplicate id`);
    seenIds.add(budget.id);
    seenDomains.add(budget.domain);
    if (!budget.reader.trim()) errors.push(`${budget.id}: reader is required`);
    if (budget.sourceFiles.length === 0)
      errors.push(`${budget.id}: source files are required`);
    if (!budget.fixture.label.trim())
      errors.push(`${budget.id}: fixture label is required`);
    if (budget.requiredIndexes.length === 0)
      errors.push(`${budget.id}: at least one required index is required`);
    if (!Number.isInteger(budget.maxReturnedRows) || budget.maxReturnedRows <= 0)
      errors.push(`${budget.id}: maximum returned rows must be a positive integer`);
    if (
      !Number.isFinite(budget.executionP95BudgetMs) ||
      budget.executionP95BudgetMs <= 0
    )
      errors.push(`${budget.id}: p95 budget must be positive`);
    if (!budget.boundedReadShape.trim())
      errors.push(`${budget.id}: bounded read shape is required`);
  }

  for (const domain of REQUIRED_DOMAINS) {
    if (!seenDomains.has(domain)) errors.push(`missing ${domain} budget`);
  }
  return errors;
}
