/**
 * QA-014 / EXP-026 — reader-performance budget contract.
 *
 * These are deterministic laboratory regression ceilings, not claims about
 * field Core Web Vitals. Field percentiles remain an operational concern;
 * this contract prevents a route, asset, or interaction regression from
 * silently crossing the checked local/CI envelope first.
 */
export const READER_PERFORMANCE_BUDGET_VERSION =
  "civica-reader-performance-budget/v1" as const;

export type ReaderPerformanceFixtureId =
  | "home"
  | "atlas"
  | "constitution"
  | "record-article";

export type ReaderPerformanceInteraction =
  | "explore-menu"
  | "atlas-controls"
  | "keyboard-navigation";

export interface ReaderPerformanceMetrics {
  htmlBytes: number;
  rscBytes: number;
  javascriptBytes: number;
  cssBytes: number;
  imageBytes: number;
  fontBytes: number;
  requestCount: number;
  serverResponseMs: number;
  lcpMs: number;
  cls: number;
  inpMs: number;
  longestLongTaskMs: number;
  longTaskCount: number;
  mapInitializationMs: number | null;
}

export interface ReaderPerformanceBudget {
  htmlBytes: number;
  rscBytes: number;
  javascriptBytes: number;
  cssBytes: number;
  imageBytes: number;
  fontBytes: number;
  requestCount: number;
  serverResponseMs: number;
  lcpMs: number;
  cls: number;
  inpMs: number;
  longestLongTaskMs: number;
  longTaskCount: number;
  mapInitializationMs?: number;
}

export interface ReaderPerformanceFixture {
  id: ReaderPerformanceFixtureId;
  path: string;
  description: string;
  readySelector: string;
  interaction: ReaderPerformanceInteraction;
  /** Dynamic routes run only against the controlled read-only fixture DB. */
  requiresFixtureDatabase: boolean;
  queryBudgetIds: readonly string[];
  budget: ReaderPerformanceBudget;
}

const SHARED_BUDGET = {
  rscBytes: 500_000,
  fontBytes: 200_000,
  cls: 0.05,
  inpMs: 300,
} as const;

/**
 * Four representative production routes deliberately cover the broad reader
 * surface, asynchronous map initialization, the constitution corpus reader,
 * and an engraving-led Record article. Values are decoded response-byte caps
 * collected in a fresh Chromium context, so compression does not make a
 * transfer regression invisible to the checked test.
 */
export const READER_PERFORMANCE_FIXTURES: readonly ReaderPerformanceFixture[] = [
  {
    id: "home",
    path: "/",
    description: "homepage shell, navigation, font preload, and editorial art",
    readySelector: "main",
    interaction: "explore-menu",
    requiresFixtureDatabase: false,
    queryBudgetIds: [],
    budget: {
      ...SHARED_BUDGET,
      htmlBytes: 1_100_000,
      javascriptBytes: 1_200_000,
      cssBytes: 500_000,
      imageBytes: 1_500_000,
      requestCount: 110,
      serverResponseMs: 4_000,
      lcpMs: 4_000,
      longestLongTaskMs: 150,
      longTaskCount: 4,
    },
  },
  {
    id: "atlas",
    path: "/atlas",
    description: "source-native map geometry, layer controls, and map table",
    readySelector: ".world-map path",
    interaction: "atlas-controls",
    requiresFixtureDatabase: true,
    queryBudgetIds: ["country-facts-high-cardinality"],
    budget: {
      ...SHARED_BUDGET,
      htmlBytes: 1_900_000,
      javascriptBytes: 1_300_000,
      cssBytes: 500_000,
      imageBytes: 2_500_000,
      requestCount: 105,
      serverResponseMs: 10_000,
      lcpMs: 10_000,
      longestLongTaskMs: 350,
      longTaskCount: 6,
      mapInitializationMs: 10_000,
    },
  },
  {
    id: "constitution",
    path: "/country/switzerland/constitution",
    description: "country constitution reader and its high-cardinality corpus path",
    readySelector: "main",
    interaction: "keyboard-navigation",
    requiresFixtureDatabase: true,
    queryBudgetIds: ["country-facts-high-cardinality", "constitution-search-corpus"],
    budget: {
      ...SHARED_BUDGET,
      htmlBytes: 1_700_000,
      javascriptBytes: 3_000_000,
      cssBytes: 650_000,
      imageBytes: 3_800_000,
      requestCount: 125,
      serverResponseMs: 7_000,
      lcpMs: 7_000,
      longestLongTaskMs: 650,
      longTaskCount: 8,
    },
  },
  {
    id: "record-article",
    path: "/blog/governing-the-very-small",
    description: "engraving-led Record article with a long reading surface",
    readySelector: "main",
    interaction: "keyboard-navigation",
    requiresFixtureDatabase: false,
    queryBudgetIds: [],
    budget: {
      ...SHARED_BUDGET,
      htmlBytes: 1_000_000,
      javascriptBytes: 1_200_000,
      cssBytes: 500_000,
      imageBytes: 3_000_000,
      requestCount: 105,
      serverResponseMs: 4_000,
      lcpMs: 4_000,
      longestLongTaskMs: 150,
      longTaskCount: 4,
    },
  },
] as const;

const REQUIRED_FIXTURES: readonly ReaderPerformanceFixtureId[] = [
  "home",
  "atlas",
  "constitution",
  "record-article",
];

const REQUIRED_QUERY_BUDGETS = new Set([
  "country-facts-high-cardinality",
  "constitution-search-corpus",
]);

const METRIC_LABELS: Record<Exclude<keyof ReaderPerformanceMetrics, "mapInitializationMs">, string> = {
  htmlBytes: "HTML bytes",
  rscBytes: "RSC bytes",
  javascriptBytes: "JavaScript bytes",
  cssBytes: "CSS bytes",
  imageBytes: "image bytes",
  fontBytes: "font bytes",
  requestCount: "request count",
  serverResponseMs: "server response",
  lcpMs: "LCP",
  cls: "CLS",
  inpMs: "INP",
  longestLongTaskMs: "longest long task",
  longTaskCount: "long-task count",
};

function isNonNegativeFinite(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

export function readerPerformanceBudgetContractErrors(
  fixtures: readonly ReaderPerformanceFixture[] = READER_PERFORMANCE_FIXTURES,
): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const queryBudgetIds = new Set<string>();

  for (const fixture of fixtures) {
    if (ids.has(fixture.id)) errors.push(`${fixture.id}: duplicate fixture id`);
    ids.add(fixture.id);
    if (!fixture.path.startsWith("/"))
      errors.push(`${fixture.id}: route must be an absolute reader path`);
    if (!fixture.description.trim())
      errors.push(`${fixture.id}: description is required`);
    if (!fixture.readySelector.trim())
      errors.push(`${fixture.id}: ready selector is required`);
    for (const queryBudgetId of fixture.queryBudgetIds)
      queryBudgetIds.add(queryBudgetId);

    for (const metric of Object.keys(METRIC_LABELS) as Array<
      Exclude<keyof ReaderPerformanceMetrics, "mapInitializationMs">
    >) {
      if (!isNonNegativeFinite(fixture.budget[metric]))
        errors.push(`${fixture.id}: ${metric} budget must be non-negative`);
    }
    if (
      fixture.id === "atlas" &&
      !isNonNegativeFinite(fixture.budget.mapInitializationMs ?? NaN)
    ) {
      errors.push("atlas: map initialization budget is required");
    } else if (
      fixture.budget.mapInitializationMs !== undefined &&
      fixture.id !== "atlas"
    ) {
      errors.push(`${fixture.id}: only the atlas fixture may set map initialization`);
    }
  }

  for (const id of REQUIRED_FIXTURES) {
    if (!ids.has(id)) errors.push(`missing ${id} performance fixture`);
  }
  for (const queryBudgetId of REQUIRED_QUERY_BUDGETS) {
    if (!queryBudgetIds.has(queryBudgetId))
      errors.push(`missing linked query budget ${queryBudgetId}`);
  }
  return errors;
}

/** Return reader-facing failures for one measured fixture. */
export function readerPerformanceBudgetErrors(
  fixture: ReaderPerformanceFixture,
  metrics: ReaderPerformanceMetrics,
): string[] {
  const errors: string[] = [];
  const values = Object.entries(metrics) as Array<
    [keyof ReaderPerformanceMetrics, number | null]
  >;
  for (const [metric, value] of values) {
    if (value === null) continue;
    if (!isNonNegativeFinite(value))
      errors.push(`${fixture.id}: ${metric} measurement is invalid`);
  }

  for (const metric of Object.keys(METRIC_LABELS) as Array<
    Exclude<keyof ReaderPerformanceMetrics, "mapInitializationMs">
  >) {
    const actual = metrics[metric];
    const maximum = fixture.budget[metric];
    if (actual > maximum)
      errors.push(
        `${fixture.id}: ${METRIC_LABELS[metric]} ${actual} exceeds ${maximum}`,
      );
  }

  const mapMaximum = fixture.budget.mapInitializationMs;
  if (mapMaximum !== undefined) {
    if (metrics.mapInitializationMs === null) {
      errors.push(`${fixture.id}: map initialization was not measured`);
    } else if (metrics.mapInitializationMs > mapMaximum) {
      errors.push(
        `${fixture.id}: map initialization ${metrics.mapInitializationMs} exceeds ${mapMaximum}`,
      );
    }
  } else if (metrics.mapInitializationMs !== null) {
    errors.push(`${fixture.id}: unexpected map initialization measurement`);
  }

  return errors;
}
