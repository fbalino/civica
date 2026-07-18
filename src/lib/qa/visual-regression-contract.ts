/** QA-013 / EXP-025 — canonical visual-regression coverage contract. */

export const VISUAL_REGRESSION_SCHEMA = "civica-visual-regression/v1" as const;

export const VISUAL_REGRESSION_THEMES = ["light", "dark"] as const;
export type VisualRegressionTheme = (typeof VISUAL_REGRESSION_THEMES)[number];

export const VISUAL_REGRESSION_VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "small-mobile", width: 360, height: 740 },
] as const;
export type VisualRegressionViewport =
  (typeof VISUAL_REGRESSION_VIEWPORTS)[number];

export type VisualRegressionState = "default" | "navigation-open";

export type VisualRegressionScenario = {
  id: string;
  label: string;
  path: string;
  readySelector: string;
  state?: VisualRegressionState;
  /** This route is exercised only against the controlled read-only fixture. */
  requiresFixtureDatabase?: boolean;
};

/**
 * The named surfaces mirror EXP-025's completion clause. Every scenario is
 * captured in both declared themes and both major reader viewports below.
 */
export const VISUAL_REGRESSION_SCENARIOS: readonly VisualRegressionScenario[] = [
  {
    id: "design-system",
    label: "Design system",
    path: "/design-system",
    readySelector: "main",
  },
  { id: "home", label: "Home", path: "/", readySelector: "main" },
  {
    id: "home-explore-menu",
    label: "Home Explore menu",
    path: "/",
    readySelector: "main",
    state: "navigation-open",
  },
  {
    id: "error-404",
    label: "Branded error page",
    path: "/__civica_visual_probe_missing_route__",
    readySelector: "main",
  },
  {
    id: "country-factbook",
    label: "Country Factbook",
    path: "/country/switzerland",
    readySelector: "main",
    requiresFixtureDatabase: true,
  },
  {
    id: "country-civica-data",
    label: "Country Civica Data",
    path: "/country/switzerland/civica-data",
    readySelector: "main",
    requiresFixtureDatabase: true,
  },
  {
    id: "atlas",
    label: "Atlas",
    path: "/atlas",
    readySelector: ".world-map path[data-id]",
    requiresFixtureDatabase: true,
  },
  {
    id: "compare",
    label: "Compare",
    path: "/compare?c=france&c=japan",
    readySelector: "main",
    requiresFixtureDatabase: true,
  },
  {
    id: "civica-index",
    label: "Civica Index",
    path: "/civica-index",
    readySelector: "main",
    requiresFixtureDatabase: true,
  },
  {
    id: "pulse-ledger",
    label: "Pulse ledger",
    path: "/civica-index/pulse-changelog",
    readySelector: "main",
    requiresFixtureDatabase: true,
  },
  {
    id: "methodology",
    label: "Methodology",
    path: "/methodology",
    readySelector: "main",
  },
  {
    id: "constitution",
    label: "Constitution explorer",
    path: "/constitution",
    readySelector: "main",
    requiresFixtureDatabase: true,
  },
  {
    id: "elections",
    label: "Elections",
    path: "/elections",
    readySelector: "main",
    requiresFixtureDatabase: true,
  },
  {
    id: "record",
    label: "The Record",
    path: "/blog",
    readySelector: "main",
  },
  {
    id: "api-docs",
    label: "API documentation",
    path: "/api-docs",
    readySelector: "main",
  },
  {
    id: "advisory-board",
    label: "Advisory board",
    path: "/about/advisory-board",
    readySelector: "main",
  },
  {
    id: "embed",
    label: "Country embed",
    path: "/embed/switzerland",
    readySelector: "main",
    requiresFixtureDatabase: true,
  },
] as const;

export function visualRegressionCaseId(
  scenario: VisualRegressionScenario,
  theme: VisualRegressionTheme,
  viewport: VisualRegressionViewport,
): string {
  return `${scenario.id}-${theme}-${viewport.name}`;
}

export function visualRegressionContractErrors(
  scenarios: readonly VisualRegressionScenario[] = VISUAL_REGRESSION_SCENARIOS,
): string[] {
  const errors: string[] = [];
  const ids = scenarios.map((scenario) => scenario.id);
  if (new Set(ids).size !== ids.length) errors.push("scenario ids must be unique");
  for (const scenario of scenarios) {
    if (!/^[a-z0-9-]+$/.test(scenario.id)) {
      errors.push(`${scenario.id}: id must be lowercase kebab-case`);
    }
    if (!scenario.path.startsWith("/")) {
      errors.push(`${scenario.id}: path must be an internal route`);
    }
    if (!scenario.readySelector.trim()) {
      errors.push(`${scenario.id}: ready selector is required`);
    }
  }

  for (const required of [
    "design-system",
    "home",
    "home-explore-menu",
    "country-factbook",
    "country-civica-data",
    "atlas",
    "compare",
    "civica-index",
    "pulse-ledger",
    "methodology",
    "constitution",
    "elections",
    "record",
    "api-docs",
    "advisory-board",
    "error-404",
    "embed",
  ]) {
    if (!ids.includes(required)) errors.push(`missing required surface: ${required}`);
  }
  if (VISUAL_REGRESSION_THEMES.length !== 2) {
    errors.push("the visual matrix requires both light and dark themes");
  }
  if (VISUAL_REGRESSION_VIEWPORTS.length < 2) {
    errors.push("the visual matrix requires desktop and mobile viewports");
  }
  return errors;
}
