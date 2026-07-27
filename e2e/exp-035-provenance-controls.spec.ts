/** EXP-035 — compact provenance disclosure contract. */
import path from "node:path";
import { expect, setTheme, test, type Theme } from "./harness/fixtures";

function isKnownDesignSystemHydrationArtifact(message: string): boolean {
  return (
    message.includes("Hydration failed because the server rendered HTML") &&
    message.includes("ds-ramp") &&
    message.includes("editorial-tooltip-trigger")
  );
}

for (const theme of ["light", "dark"] as const satisfies Theme[]) {
  test(`SourceDot keeps complete provenance text available in ${theme} mode`, async ({
    page,
    errors,
  }) => {
    await page.goto("/design-system", { waitUntil: "domcontentloaded" });
    await setTheme(page, theme);

    const liveDot = page.locator('[data-source="Wikidata"]').first();
    await expect(liveDot).toBeVisible();
    await expect(liveDot).toHaveAttribute(
      "data-date",
      "June 1, 2026 at 12:34:56 PM UTC",
    );
    await expect(liveDot).toHaveAttribute(
      "data-vintage",
      "Upstream vintage: Wikidata revision at retrieval",
    );
    await expect(liveDot).toHaveAttribute("data-rights", /CC0-1\.0/);
    await expect(liveDot).toHaveAttribute(
      "aria-label",
      /state: Live or regularly updated source/,
    );

    const frozenDot = page.locator('[data-source="CIA World Factbook"]').first();
    await expect(frozenDot).toHaveAttribute(
      "data-date",
      "January 15, 2026 (date only)",
    );
    await expect(frozenDot).toHaveAttribute(
      "data-rights",
      /US-PUBLIC-DOMAIN/,
    );

    const experimentalDot = page.locator(
      '.source-dot--experimental[data-state="Experimental source or method"]',
    );
    await expect(experimentalDot).toBeVisible();
    await expect(experimentalDot).toHaveAttribute(
      "data-date",
      "Unknown timestamp",
    );
    await expect(experimentalDot).toHaveAttribute(
      "data-vintage",
      "Upstream vintage: Not supplied on this surface",
    );

    await experimentalDot.focus();
    await expect(experimentalDot).toBeFocused();

    if (process.env.EXP035_CAPTURE_DIR) {
      await page.screenshot({
        path: path.join(
          process.env.EXP035_CAPTURE_DIR,
          `source-dot-${theme}.png`,
        ),
      });
    }

    const unexpectedFailures = errors
      .hardFailures()
      .filter((failure) => !isKnownDesignSystemHydrationArtifact(failure));
    expect(unexpectedFailures, unexpectedFailures.join("\n")).toEqual([]);
  });
}
