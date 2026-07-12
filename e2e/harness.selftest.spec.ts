/**
 * QA-009 — harness self-test. Proves the canonical browser harness:
 *   1. drives the real running app,
 *   2. captures console errors, uncaught page errors, and network/asset
 *      failures,
 *   3. would FAIL a spec on a seeded route or asset error (the gate),
 *   4. supports theme + viewport fixtures without crashing.
 *
 * This file IS the QA-009 acceptance evidence: `npm run test:e2e` runs it.
 */
import { test, expect, setTheme, VIEWPORTS, THEMES } from "./harness/fixtures";

test.describe("harness self-test (QA-009)", () => {
  test("drives the real app and renders the home page", async ({ page }) => {
    const res = await page.goto("/");
    expect(res, "navigation returned a response").not.toBeNull();
    expect(res!.status(), "home responds < 400").toBeLessThan(400);
    // Positive control: the real footer brand is present.
    await expect(page.locator("footer").first()).toContainText("Civica");
  });

  test("captures a seeded console error", async ({ page, errors }) => {
    await page.goto("/");
    await page.evaluate(() => console.error("CIVICA_SEEDED_CONSOLE_ERROR"));
    await expect
      .poll(() => errors.consoleErrors.join("\n"))
      .toContain("CIVICA_SEEDED_CONSOLE_ERROR");
  });

  test("captures a seeded uncaught page error", async ({ page, errors }) => {
    await page.goto("/");
    await page.evaluate(() => {
      setTimeout(() => {
        throw new Error("CIVICA_SEEDED_PAGE_ERROR");
      }, 0);
    });
    await expect
      .poll(() => errors.pageErrors.join("\n"))
      .toContain("CIVICA_SEEDED_PAGE_ERROR");
  });

  test("captures a seeded asset 404 — the network gate would fail a spec", async ({
    page,
    errors,
  }) => {
    await page.goto("/");
    await page.evaluate(() =>
      fetch("/__civica_seeded_missing_asset__.png").catch(() => {}),
    );
    await expect
      .poll(() => errors.badResponses.join("\n"), { timeout: 8_000 })
      .toContain("__civica_seeded_missing_asset__");
    const seeded = errors.badResponses.filter((r) =>
      r.includes("__civica_seeded_missing_asset__"),
    );
    expect(seeded.length, "asset 404 captured in badResponses").toBeGreaterThan(0);
    expect(seeded[0]).toMatch(/^404 /);
    // Proof of the gate: hardFailures() is now non-empty, so a normal
    // route spec asserting `errors.hardFailures()` is empty would FAIL.
    expect(errors.hardFailures().length).toBeGreaterThan(0);
  });

  test("captures a seeded route error (404 navigation)", async ({ errors, page }) => {
    const res = await page.goto("/__civica_probe_missing_route__");
    expect(res, "navigation returned a response").not.toBeNull();
    expect(res!.status(), "unmatched route is 404").toBe(404);
    await expect
      .poll(() => errors.badResponses.join("\n"))
      .toContain("__civica_probe_missing_route__");
  });

  test("supports theme + viewport fixtures", async ({ page }) => {
    await page.goto("/");
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      for (const theme of THEMES) {
        await setTheme(page, theme);
        // The root theme attribute reflects the requested theme.
        const applied = await page.evaluate(
          () => document.documentElement.dataset.theme,
        );
        expect(applied).toBe(theme);
      }
    }
  });
});
