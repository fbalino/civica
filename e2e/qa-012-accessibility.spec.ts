/**
 * QA-012 — real-browser WCAG audit matrix.
 *
 * Each scenario is rendered in light and dark theme, then checked through
 * axe-core's Playwright integration. Reports are attached to Playwright's
 * retained output so a passing or failing run records the evaluated DOM,
 * rules, and incomplete checks without committing volatile artifacts.
 */
import { test, expect, setTheme, THEMES, VIEWPORTS } from "./harness/fixtures";
import {
  auditAccessibility,
  formatA11yViolations,
} from "./harness/accessibility";

const DESKTOP = VIEWPORTS.find((viewport) => viewport.name === "desktop")!;

const SCENARIOS = [
  { name: "home", path: "/" },
  { name: "country-factbook", path: "/country/switzerland" },
  { name: "country-data", path: "/country/switzerland/civica-data" },
  {
    name: "country-longitudinal-chart",
    path: "/country/switzerland/civica-data?section=longitudinal",
  },
  { name: "atlas", path: "/atlas" },
  { name: "compare-selected", path: "/compare?c=france&c=japan" },
  { name: "rankings", path: "/rankings" },
  { name: "conditions", path: "/civica-conditions" },
  { name: "methodology", path: "/methodology" },
  { name: "api-docs", path: "/api-docs" },
  { name: "contact", path: "/contact" },
  { name: "admin-sign-in-error", path: "/admin/sign-in?error=1" },
  {
    name: "coding-sign-in-error",
    path: "/admin/pulse-coding/sign-in?error=1",
  },
  { name: "not-found", path: "/__civica_probe_missing_route__" },
] as const;

test.describe("QA-012 — WCAG AA audit matrix", () => {
  test.describe.configure({ mode: "parallel" });

  for (const scenario of SCENARIOS) {
    for (const theme of THEMES) {
      test(`${scenario.name} has no WCAG AA violations in ${theme}`, async ({
        page,
        errors,
      }, testInfo) => {
        await page.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height });
        await page.goto(scenario.path, { waitUntil: "domcontentloaded" });
        await setTheme(page, theme);
        await expect(page.locator("main")).toBeVisible();

        const audit = await auditAccessibility(page);
        await testInfo.attach(`axe-${scenario.name}-${theme}.json`, {
          body: JSON.stringify(audit, null, 2),
          contentType: "application/json",
        });

        expect(
          audit.violations,
          formatA11yViolations(audit.violations),
        ).toEqual([]);
        const unexpectedHardFailures = errors.hardFailures().filter(
          (failure) =>
            scenario.name !== "not-found" || !failure.startsWith("404 "),
        );
        expect(
          unexpectedHardFailures,
          unexpectedHardFailures.join("\n"),
        ).toEqual([]);
      });
    }
  }

  for (const theme of THEMES) {
    test(`contact validation state has no WCAG AA violations in ${theme}`, async ({
      page,
      errors,
    }, testInfo) => {
      await page.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height });
      await page.goto("/contact", { waitUntil: "networkidle" });
      await setTheme(page, theme);
      await page.getByRole("button", { name: "Send message" }).click();
      await expect(page.locator(".contact-validation-summary")).toBeVisible();

      const audit = await auditAccessibility(page);
      await testInfo.attach(`axe-contact-validation-${theme}.json`, {
        body: JSON.stringify(audit, null, 2),
        contentType: "application/json",
      });

      expect(
        audit.violations,
        formatA11yViolations(audit.violations),
      ).toEqual([]);
      expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual([]);
    });
  }
});
