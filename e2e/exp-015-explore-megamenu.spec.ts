/**
 * EXP-015 — real-browser review of the current large Explore candidate.
 *
 * This is review coverage for the candidate's behavior and capture surface.
 * It intentionally does not record owner approval of the rendered result;
 * optional screenshots are review artifacts only.
 */
import { join } from "node:path";
import type { Locator, Page } from "@playwright/test";

import { EXPLORE_NAV_GROUPS } from "../src/components/exploreNavItems";
import {
  expect,
  setTheme,
  test,
  VIEWPORTS,
  waitForReactHydration,
  type Theme,
} from "./harness/fixtures";
import {
  auditAccessibility,
  formatA11yViolations,
} from "./harness/accessibility";

const DESKTOP = VIEWPORTS.find((viewport) => viewport.name === "desktop")!;
const MOBILE = VIEWPORTS.find((viewport) => viewport.name === "small-mobile")!;
const THEMES = ["light", "dark"] as const satisfies readonly Theme[];
const CAPTURE_DIR = process.env.EXP015_CAPTURE_DIR;
const CAPTURE_DATE = "2026-07-26";
const DESTINATIONS = EXPLORE_NAV_GROUPS.flatMap((group) =>
  group.items.map((item) => item.href),
);

async function expectDestinationOrder(links: Locator) {
  await expect(links).toHaveCount(DESTINATIONS.length);
  const hrefs = await links.evaluateAll((items) =>
    items.map((item) => new URL((item as HTMLAnchorElement).href).pathname),
  );
  expect(hrefs).toEqual(DESTINATIONS);
}

async function captureCandidate(
  surface: Locator,
  viewport: "desktop" | "small-mobile",
  theme: Theme,
) {
  if (!CAPTURE_DIR) return;
  await surface.page().evaluate(async () => {
    await document.fonts?.ready;
  });
  await surface.screenshot({
    path: join(
      CAPTURE_DIR,
      `${CAPTURE_DATE}-exp-015-large-explore-candidate-${viewport}-${theme}.png`,
    ),
    animations: "disabled",
  });
}

async function expectFocusInside(page: Page, container: Locator) {
  expect(
    await container.evaluate(
      (element) =>
        document.activeElement !== null &&
        element.contains(document.activeElement),
    ),
  ).toBe(true);
}

test.describe("EXP-015 — large Explore candidate", () => {
  for (const theme of THEMES) {
    test(`desktop disclosure supports ordered Tab traversal, visible Escape dismissal, and open-state accessibility in ${theme}`, async ({
      page,
      errors,
    }, testInfo) => {
      await page.setViewportSize({
        width: DESKTOP.width,
        height: DESKTOP.height,
      });
      await page.emulateMedia({ colorScheme: theme });
      await page.goto("/about", { waitUntil: "networkidle" });
      await setTheme(page, theme);

      const trigger = page.getByRole("button", {
        name: "Explore",
        exact: true,
      });
      await waitForReactHydration(trigger);
      await trigger.focus();
      await page.keyboard.press("Enter");

      const panel = page.locator("#explore-navigation-panel");
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
      await expect(trigger).toHaveAttribute(
        "aria-controls",
        "explore-navigation-panel",
      );
      await expect(panel).toBeVisible();

      const links = panel.locator("a.explore-item");
      await expectDestinationOrder(links);
      await captureCandidate(panel, "desktop", theme);

      const audit = await auditAccessibility(page, "#explore-navigation-panel");
      await testInfo.attach(`axe-exp-015-desktop-open-${theme}.json`, {
        body: JSON.stringify(audit, null, 2),
        contentType: "application/json",
      });
      expect(
        audit.violations,
        formatA11yViolations(audit.violations),
      ).toEqual([]);

      await page.keyboard.press("Tab");
      for (let index = 0; index < DESTINATIONS.length; index += 1) {
        await expect(links.nth(index)).toBeFocused();
        if (index < DESTINATIONS.length - 1) {
          await page.keyboard.press("Tab");
        }
      }

      await page.keyboard.press("Escape");
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
      await expect(panel).toBeHidden();
      await expect(panel).toHaveCount(0);
      await expect(trigger).toBeFocused();
      expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual([]);
    });

    test(`mobile dialog exposes every Explore destination, traps Tab, and passes open-state accessibility in ${theme}`, async ({
      page,
      errors,
    }, testInfo) => {
      await page.setViewportSize({ width: MOBILE.width, height: MOBILE.height });
      await page.emulateMedia({ colorScheme: theme });
      await page.goto("/about", { waitUntil: "networkidle" });
      await setTheme(page, theme);

      const trigger = page.getByRole("button", { name: "Open menu" });
      await waitForReactHydration(trigger);
      await trigger.focus();
      await page.keyboard.press("Enter");

      const dialog = page.getByRole("dialog", { name: "Main menu" });
      const close = page.getByRole("button", { name: "Close menu" });
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
      await expect(dialog).toBeVisible();
      await expect(close).toBeFocused();

      const links = dialog.locator("a.mobile-menu__explore-link");
      await expectDestinationOrder(links);
      await captureCandidate(dialog, "small-mobile", theme);

      const audit = await auditAccessibility(page, "#civica-full-menu");
      await testInfo.attach(`axe-exp-015-mobile-open-${theme}.json`, {
        body: JSON.stringify(audit, null, 2),
        contentType: "application/json",
      });
      expect(
        audit.violations,
        formatA11yViolations(audit.violations),
      ).toEqual([]);

      const focusables = dialog.locator(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      const firstFocusable = focusables.first();
      const lastFocusable = focusables.last();

      await lastFocusable.focus();
      await page.keyboard.press("Tab");
      await expect(firstFocusable).toBeFocused();
      await firstFocusable.focus();
      await page.keyboard.press("Shift+Tab");
      await expect(lastFocusable).toBeFocused();

      await links.first().focus();
      for (let index = 0; index < DESTINATIONS.length; index += 1) {
        await expect(links.nth(index)).toBeFocused();
        await expectFocusInside(page, dialog);
        if (index < DESTINATIONS.length - 1) {
          await page.keyboard.press("Tab");
        }
      }

      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
      await expect(trigger).toBeFocused();
      expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual([]);
    });
  }
});
