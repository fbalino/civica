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
const CONCEPT_IDS = [
  "typography-first-scholarly-index",
  "emblem-led-compact-menu",
  "editorial-mega-menu",
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
    test(`all Explore concepts render and retain destination identity in ${viewport.name}/${theme}`, async ({
      page,
      errors,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/design-system#explore-concepts", { waitUntil: "domcontentloaded" });
      await setTheme(page, theme);

      const mockups = page.getByTestId("explore-concept-mockups");
      await expect(mockups).toBeVisible();

      for (const concept of CONCEPT_IDS) {
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
        // Fixed headers are not part of the decision mockups. Hiding them only
        // for evidence capture prevents a viewport-sticky strip from being
        // stitched through a tall locator screenshot.
        await page.addStyleTag({
          content: "#site-header, .ds-top { display: none !important; }",
        });
        for (const concept of CONCEPT_IDS) {
          const section = mockups.locator(`[data-concept="${concept}"]`);
          await section.screenshot({
            path: join(
              CAPTURE_DIR,
              `2026-07-18-${concept}-${viewport.name}-${theme}.png`,
            ),
          });
        }
      }

      const unexpectedFailures = errors
        .hardFailures()
        .filter((failure) => !isKnownDesignSystemHydrationArtifact(failure));
      expect(unexpectedFailures, unexpectedFailures.join("\n")).toEqual([]);
    });
  }
}
