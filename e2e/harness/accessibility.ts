import type { Page } from "@playwright/test";

/** The conformance tags that block a canonical reader route. The WCAG AA
 * sets include the browser-evaluated colour-contrast rule; no rule is
 * suppressed or waived in this runner. */
export const CIVICA_A11Y_TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22a",
  "wcag22aa",
] as const;

export type A11yViolation = {
  id: string;
  impact: string | null;
  help: string;
  helpUrl: string;
  nodes: Array<{
    html: string;
    target: string;
    failureSummary?: string;
  }>;
};

export type A11yAudit = {
  url: string;
  tags: readonly string[];
  violations: A11yViolation[];
  incomplete: Array<{ id: string; impact: string | null; help: string }>;
};

type AxeBrowserResult = {
  violations: Array<{
    id: string;
    impact: "minor" | "moderate" | "serious" | "critical" | null;
    help: string;
    helpUrl: string;
    nodes: Array<{
      html: string;
      target: unknown;
      failureSummary?: string;
    }>;
  }>;
  incomplete: Array<{
    id: string;
    impact: "minor" | "moderate" | "serious" | "critical" | null;
    help: string;
  }>;
};

/** Run the checked axe browser runtime against rendered DOM and computed
 * styles in the active Playwright page, optionally scoped to one component. */
export async function auditAccessibility(
  page: Page,
  contextSelector = "html",
): Promise<A11yAudit> {
  await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  const results = await page.evaluate(async ({ tags, contextSelector }) => {
    const axe = (window as unknown as {
      axe?: {
        run: (
          context: Document,
          options: { runOnly: { type: "tag"; values: string[] } },
        ) => Promise<AxeBrowserResult>;
      };
    }).axe;
    if (!axe) throw new Error("axe-core did not load into the browser page");
    const context = document.querySelector(contextSelector);
    if (!context) {
      throw new Error(`Accessibility context not found: ${contextSelector}`);
    }
    return axe.run(context as unknown as Document, {
      runOnly: { type: "tag", values: tags },
    });
  }, { tags: [...CIVICA_A11Y_TAGS], contextSelector });

  return {
    url: page.url(),
    tags: CIVICA_A11Y_TAGS,
    violations: results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact ?? null,
      help: violation.help,
      helpUrl: violation.helpUrl,
      nodes: violation.nodes.map((node) => ({
        html: node.html,
        target: JSON.stringify(node.target),
        failureSummary: node.failureSummary,
      })),
    })),
    incomplete: results.incomplete.map((result) => ({
      id: result.id,
      impact: result.impact ?? null,
      help: result.help,
    })),
  };
}

export function formatA11yViolations(
  violations: readonly A11yViolation[],
): string {
  return violations
    .flatMap((violation) => [
      `${violation.id} (${violation.impact ?? "unknown impact"}): ${violation.help}`,
      ...violation.nodes.map(
        (node) =>
          `  ${node.target} — ${node.failureSummary ?? node.html}`,
      ),
    ])
    .join("\n");
}
