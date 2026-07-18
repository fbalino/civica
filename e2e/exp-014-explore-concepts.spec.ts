/** EXP-014 — decision mockups use the same eight destinations in every direction. */
import { join } from "node:path";
import {
  test,
  expect,
  measureHorizontalOverflow,
  setTheme,
  VIEWPORTS,
  type Theme,
} from "./harness/fixtures";

const DESTINATIONS = [
  "/country",
  "/atlas",
  "/compare",
  "/constitution",
  "/parties",
  "/elections",
  "/rankings",
  "/organizations",
];

const DESKTOP = VIEWPORTS.find((viewport) => viewport.name === "desktop")!;
const MOBILE = VIEWPORTS.find((viewport) => viewport.name === "small-mobile")!;
const CAPTURE_DIR = process.env.EXP014_CAPTURE_DIR;

for (const viewport of [DESKTOP, MOBILE]) {
  for (const theme of ["light", "dark"] as const satisfies Theme[]) {
    test(`all Explore concepts render and retain destination identity in ${viewport.name}/${theme}`, async ({
      page,
      errors,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/design-system#explore-concepts", { waitUntil: "domcontentloaded" });
      await setTheme(page, theme);

      const mockups = page.getByTestId("explore-concept-mockups");
      await expect(mockups).toBeVisible();

      for (const concept of [
        "typography-first-scholarly-index",
        "emblem-led-compact-menu",
        "editorial-mega-menu",
      ]) {
        const section = mockups.locator(`[data-concept="${concept}"]`);
        await expect(section).toBeVisible();
        const hrefs = await section.locator("a").evaluateAll((links) =>
          links.map((link) => new URL((link as HTMLAnchorElement).href).pathname),
        );
        expect(hrefs.sort(), concept).toEqual([...DESTINATIONS].sort());

        const firstLink = section.locator("a").first();
        await firstLink.focus();
        await expect(firstLink).toBeFocused();
      }

      const overflow = await measureHorizontalOverflow(page);
      expect(overflow.overflow, overflow.offenders.join("\n")).toBeLessThanOrEqual(1);

      if (CAPTURE_DIR) {
        await mockups.screenshot({
          path: join(
            CAPTURE_DIR,
            `2026-07-18-explore-concepts-${viewport.name}-${theme}.png`,
          ),
        });
      }

      expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual([]);
    });
  }
}
