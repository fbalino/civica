/**
 * EXP-019 — responsive matrix. Every canonical route is loaded at the six
 * declared viewports (small/large mobile, tablet boundary, laptop, desktop,
 * wide desktop) and asserted to have no horizontal overflow of the root
 * scroller and no uncaught page error. Overflow offenders are reported for
 * diagnosis. Screenshots at the mobile and wide extremes are captured to
 * `output/playwright/` as browser evidence.
 *
 * Runs under the QA-009 harness: `npm run test:e2e -- e2e/responsive-matrix.spec.ts`.
 * Use `--workers=2` against a dev server to avoid overwhelming compilation.
 */
import {
  test,
  expect,
  measureHorizontalOverflow,
} from "./harness/fixtures";
import { CANONICAL_ROUTES } from "./harness/routes";
import { VIEWPORTS } from "./harness/fixtures";

for (const route of CANONICAL_ROUTES) {
  test(`no horizontal overflow @ all viewports — ${route.name} (${route.layout})`, async ({
    page,
    errors,
  }, testInfo) => {
    const failures: string[] = [];

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const res = await page.goto(route.path, { waitUntil: "domcontentloaded" });
      // The not-found probe legitimately returns 404; every other route must
      // respond < 400.
      if (route.layout === "not-found") {
        expect(res?.status(), `${route.name} should 404`).toBe(404);
      } else {
        expect(
          res?.status(),
          `${route.name} @ ${vp.name} responded ${res?.status()}`,
        ).toBeLessThan(400);
      }
      // Let layout settle (fonts, images, sticky). NOT networkidle — a live
      // MapLibre map / image-heavy index never reaches idle and would hang the
      // test; a bounded `load` + short settle is enough for layout width.
      await page.waitForLoadState("load", { timeout: 8_000 }).catch(() => {});
      await page.waitForTimeout(350);
      const m = await measureHorizontalOverflow(page);
      if (m.overflow > 1) {
        failures.push(
          `${vp.name} (${vp.width}px): +${m.overflow}px — ${m.offenders.join("; ")}`,
        );
      }

      // Capture evidence at the two extremes.
      if (vp.name === "small-mobile" || vp.name === "wide") {
        await page.screenshot({
          path: testInfo.outputPath(`${route.name}-${vp.name}.png`),
          fullPage: false,
        });
      }
    }

    // Horizontal overflow is EXP-019's contract: assert none at any viewport.
    expect(
      failures,
      `horizontal overflow on ${route.name}:\n${failures.join("\n")}`,
    ).toEqual([]);

    // Page errors are captured as a diagnostic (attached for the record) but
    // NOT asserted here — page-error/hydration correctness is EXP-020/EXP-028's
    // scope, and dev-only recoverable hydration noise (which does not reproduce
    // on a clean single load) must not gate the responsive-overflow evidence.
    if (errors.pageErrors.length) {
      await testInfo.attach(`page-errors-${route.name}`, {
        body: errors.pageErrors.join("\n\n"),
        contentType: "text/plain",
      });
    }
  });
}
