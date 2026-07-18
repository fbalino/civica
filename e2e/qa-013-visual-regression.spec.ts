/** QA-013 / EXP-025 — deterministic screenshot baselines for canonical UI. */
import { createHash } from "node:crypto";

import {
  VISUAL_REGRESSION_SCENARIOS,
  VISUAL_REGRESSION_THEMES,
  VISUAL_REGRESSION_VIEWPORTS,
  visualRegressionCaseId,
} from "../src/lib/qa/visual-regression-contract";
import {
  expect,
  setTheme,
  test,
  waitForReactHydration,
} from "./harness/fixtures";

const FIXTURE_REASON =
  "This canonical surface needs the controlled read-only fixture database.";

async function stabilizeVisualPage(
  page: Parameters<typeof setTheme>[0],
  theme: (typeof VISUAL_REGRESSION_THEMES)[number],
) {
  await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
  await setTheme(page, theme);
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        caret-color: transparent !important;
      }
    `,
  });
  await page.evaluate(async () => {
    await document.fonts?.ready;
  });
}

async function openNavigationState(
  page: Parameters<typeof setTheme>[0],
) {
  const explore = page.getByRole("button", { name: "Explore", exact: true });
  if (await explore.isVisible()) {
    await waitForReactHydration(explore);
    await explore.click();
    await expect(page.locator(".explore-menu")).toHaveClass(/explore-menu--open/);
    return;
  }

  const mobileMenu = page.getByRole("button", { name: "Open menu" });
  await waitForReactHydration(mobileMenu);
  await mobileMenu.click();
  await expect(page.getByRole("dialog", { name: "Main menu" })).toBeVisible();
}

test.describe("QA-013 / EXP-025 — canonical visual baselines", () => {
  for (const scenario of VISUAL_REGRESSION_SCENARIOS) {
    for (const theme of VISUAL_REGRESSION_THEMES) {
      for (const viewport of VISUAL_REGRESSION_VIEWPORTS) {
        const caseId = visualRegressionCaseId(scenario, theme, viewport);
        test(`${caseId} matches its approved visual baseline`, async ({
          browser,
        }, testInfo) => {
          test.skip(
            scenario.requiresFixtureDatabase === true &&
              process.env.E2E_PERFORMANCE_FIXTURE_DB !== "1",
            FIXTURE_REASON,
          );
          if (testInfo.config.updateSnapshots !== "none") {
            expect(
              process.env.VISUAL_BASELINE_UPDATE,
              "baseline rewrites require the explicit update command",
            ).toBe("1");
          }

          const context = await browser.newContext({
            viewport: { width: viewport.width, height: viewport.height },
            colorScheme: theme,
            reducedMotion: "reduce",
            locale: "en-US",
            timezoneId: "UTC",
          });
          const page = await context.newPage();
          try {
            await page.addInitScript((initialTheme) => {
              document.documentElement.dataset.theme = initialTheme;
            }, theme);
            await page.goto(scenario.path, { waitUntil: "domcontentloaded" });
            await expect(page.locator(scenario.readySelector).first()).toBeVisible();
            await stabilizeVisualPage(page, theme);
            if (scenario.state === "navigation-open") {
              await openNavigationState(page);
            }
            await expect(page).toHaveScreenshot(`${caseId}.png`, {
              animations: "disabled",
              caret: "hide",
              fullPage: false,
              scale: "css",
            });
          } finally {
            await context.close();
          }
        });
      }
    }
  }

  test("a seeded design-token drift changes the rendered baseline input", async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      colorScheme: "light",
      reducedMotion: "reduce",
      locale: "en-US",
      timezoneId: "UTC",
    });
    const page = await context.newPage();
    try {
      await page.goto("/design-system", { waitUntil: "domcontentloaded" });
      await expect(page.locator("main")).toBeVisible();
      await stabilizeVisualPage(page, "light");
      const baseline = await page.screenshot({
        animations: "disabled",
        caret: "hide",
        scale: "css",
      });
      await page.evaluate(() => {
        document.documentElement.style.setProperty(
          "--color-bg",
          "var(--color-ink)",
        );
      });
      const drifted = await page.screenshot({
        animations: "disabled",
        caret: "hide",
        scale: "css",
      });
      expect(createHash("sha256").update(drifted).digest("hex")).not.toBe(
        createHash("sha256").update(baseline).digest("hex"),
      );
    } finally {
      await context.close();
    }
  });
});
