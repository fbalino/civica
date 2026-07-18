/** ATL-018 — canonical reader-state register survives representative viewports/themes. */
import { join } from "node:path";

import {
  expect,
  measureHorizontalOverflow,
  setTheme,
  test,
  VIEWPORTS,
  type Theme,
} from "./harness/fixtures";

const DESKTOP = VIEWPORTS.find((viewport) => viewport.name === "desktop")!;
const MOBILE = VIEWPORTS.find((viewport) => viewport.name === "small-mobile")!;
const CAPTURE_DIR = process.env.ATL018_CAPTURE_DIR;
const STATE_KEYS = [
  "loading",
  "empty",
  "error",
  "partial",
  "stale",
  "disputed",
  "no-source",
] as const;

function isKnownDesignSystemHydrationArtifact(message: string): boolean {
  return (
    message.includes("Hydration failed because the server rendered HTML") &&
    message.includes("ds-ramp") &&
    message.includes("editorial-tooltip-trigger")
  );
}

for (const viewport of [DESKTOP, MOBILE]) {
  for (const theme of ["light", "dark"] as const satisfies Theme[]) {
    test(`Atlas reader states remain explicit in ${viewport.name}/${theme}`, async ({
      page,
      errors,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/design-system#atlas-data-states", {
        waitUntil: "domcontentloaded",
      });
      await setTheme(page, theme);

      const register = page.locator("#atlas-data-states");
      await expect(register).toBeVisible();
      await expect(register).toContainText("reader meaning");

      for (const key of STATE_KEYS) {
        await expect(
          register.locator(`[data-atlas-surface-state="${key}"]`),
        ).toBeVisible();
      }
      await expect(
        register.locator('[data-atlas-surface-state="loading"]'),
      ).toHaveAttribute("aria-busy", "true");

      const overflow = await measureHorizontalOverflow(page);
      expect(overflow.overflow, overflow.offenders.join("\n")).toBeLessThanOrEqual(1);

      if (CAPTURE_DIR) {
        await page.addStyleTag({
          content:
            "#site-header, .ds-top, nextjs-portal { display: none !important; }",
        });
        await register.screenshot({
          path: join(
            CAPTURE_DIR,
            `2026-07-18-atlas-reader-states-${viewport.name}-${theme}.png`,
          ),
        });
      }

      const unexpectedFailures = errors
        .hardFailures()
        .filter((failure) => !isKnownDesignSystemHydrationArtifact(failure));
      expect(unexpectedFailures, unexpectedFailures.join("\n")).toEqual([]);
    });
  }
}
