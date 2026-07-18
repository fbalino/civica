/** EXP-021 — contrast and non-colour cues on canonical reader surfaces. */
import {
  test,
  expect,
  setTheme,
  THEMES,
  waitForReactHydration,
} from "./harness/fixtures";
import {
  auditAccessibility,
  formatA11yViolations,
} from "./harness/accessibility";

const SCENARIOS = [
  { name: "design-system-states", path: "/design-system" },
  { name: "atlas-map", path: "/atlas" },
  {
    name: "indicator-chart",
    path: "/country/switzerland/civica-data?section=longitudinal",
  },
] as const;

test.describe("EXP-021 — contrast and non-colour communication", () => {
  for (const scenario of SCENARIOS) {
    for (const theme of THEMES) {
      test(`${scenario.name} has no WCAG A/AA violation in ${theme}`, async ({
        page,
        errors,
      }, testInfo) => {
        await page.goto(scenario.path, { waitUntil: "networkidle" });
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
        expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual([]);
      });
    }
  }

  test("source states and focus cues communicate more than colour", async ({
    page,
    errors,
  }) => {
    await page.goto("/design-system", { waitUntil: "networkidle" });

    const sourceStates = await page.locator(".source-dot").evaluateAll((dots) =>
      dots.map((dot) => ({
        state: dot.getAttribute("data-state"),
        label: dot.getAttribute("aria-label"),
      })),
    );
    expect(sourceStates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          state: expect.stringContaining("Live"),
          label: expect.stringContaining("state: Live"),
        }),
        expect.objectContaining({
          state: expect.stringContaining("Frozen"),
          label: expect.stringContaining("state: Frozen"),
        }),
        expect.objectContaining({
          state: expect.stringContaining("Experimental"),
          label: expect.stringContaining("state: Experimental"),
        }),
      ]),
    );
    for (const sourceState of sourceStates) {
      expect(sourceState.label).toContain("Source:");
      expect(sourceState.label).toContain("source timestamp:");
      expect(sourceState.label).toContain("rights:");
    }

    const primaryButton = page.getByRole("button", { name: "Primary Button" });
    await waitForReactHydration(primaryButton);
    await primaryButton.focus();
    await expect(primaryButton).toHaveCSS("outline-style", "solid");
    await expect(primaryButton).toHaveCSS("outline-width", "2px");
    await expect(page.getByRole("button", { name: "Disabled" })).toBeDisabled();
    await expect(page.getByText("Pulse is experimental — check the last completed computation.")).toBeVisible();
    expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual([]);
  });

  test("a seeded low-contrast semantic token is caught by the browser audit", async ({
    page,
  }) => {
    await page.goto("/design-system", { waitUntil: "networkidle" });
    await page.addStyleTag({
      content: ":root { --color-text-primary: var(--color-bg) !important; }",
    });

    const audit = await auditAccessibility(page);
    expect(audit.violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "color-contrast" }),
      ]),
    );
  });
});
