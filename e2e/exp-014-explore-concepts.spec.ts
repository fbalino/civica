/**
 * EXP-014 — preserve the rejected concept study as historical evidence.
 *
 * The three 2026-07-18 directions are no longer live design-system options:
 * the owner rejected all three on 2026-07-25. Their twelve dated browser
 * captures remain the truthful EXP-014 record, while the live design-system
 * surface now renders only the current EXP-015 replacement candidate.
 */
import { readFileSync, readdirSync } from "node:fs";
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
const HISTORICAL_CAPTURE_DIR = join(
  process.cwd(),
  "plan/evidence/EXP-014/mockups",
);
const CONCEPT_IDS = [
  "typography-first-scholarly-index",
  "emblem-led-compact-menu",
  "editorial-mega-menu",
] as const;
const HISTORICAL_CAPTURE_NAMES = CONCEPT_IDS.flatMap((concept) =>
  [DESKTOP.name, MOBILE.name].flatMap((viewport) =>
    (["light", "dark"] as const).map(
      (theme) => `2026-07-18-${concept}-${viewport}-${theme}.png`,
    ),
  ),
).sort();
const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function isKnownDesignSystemHydrationArtifact(message: string): boolean {
  return (
    message.includes("Hydration failed because the server rendered HTML") &&
    message.includes("ds-ramp") &&
    message.includes("editorial-tooltip-trigger")
  );
}

test("the twelve rejected EXP-014 browser captures remain intact as historical evidence", () => {
  const actualCaptureNames = readdirSync(HISTORICAL_CAPTURE_DIR)
    .filter((name) => name.endsWith(".png"))
    .sort();
  expect(actualCaptureNames).toEqual(HISTORICAL_CAPTURE_NAMES);

  for (const name of HISTORICAL_CAPTURE_NAMES) {
    const bytes = readFileSync(join(HISTORICAL_CAPTURE_DIR, name));
    expect(
      bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE),
      name,
    ).toBe(true);
    expect(bytes.readUInt32BE(16), `${name} width`).toBeGreaterThan(0);
    expect(bytes.readUInt32BE(20), `${name} height`).toBeGreaterThan(0);
  }
});

for (const viewport of [DESKTOP, MOBILE]) {
  for (const theme of ["light", "dark"] as const satisfies Theme[]) {
    test(`the live design system renders only the current EXP-015 candidate in ${viewport.name}/${theme}`, async ({
      page,
      errors,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto("/design-system#explore-concepts", {
        waitUntil: "domcontentloaded",
      });
      await setTheme(page, theme);

      await expect(page.getByTestId("explore-concept-mockups")).toHaveCount(0);
      await expect(page.locator("[data-concept]")).toHaveCount(0);

      const candidate = page.locator(".explore-menu--static");
      await expect(candidate).toHaveCount(1);
      await expect(candidate).toBeVisible();

      const hrefs = await candidate.locator("a").evaluateAll((links) =>
        links.map((link) => new URL((link as HTMLAnchorElement).href).pathname),
      );
      expect(hrefs).toEqual(DESTINATIONS);

      const firstLink = candidate.locator("a").first();
      await firstLink.focus();
      await expect(firstLink).toBeFocused();

      const overflow = await measureHorizontalOverflow(page);
      expect(overflow.overflow, overflow.offenders.join("\n")).toBeLessThanOrEqual(
        1,
      );

      const unexpectedFailures = errors
        .hardFailures()
        .filter((failure) => !isKnownDesignSystemHydrationArtifact(failure));
      expect(unexpectedFailures, unexpectedFailures.join("\n")).toEqual([]);
    });
  }
}
