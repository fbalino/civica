/** ATL-014 — source-native Compare evidence contract. */
import path from "node:path";
import {
  test,
  expect,
  VIEWPORTS,
  setTheme,
  waitForReactHydration,
  type Theme,
} from "./harness/fixtures";

const DESKTOP = VIEWPORTS.find((viewport) => viewport.name === "desktop")!;
const MOBILE = VIEWPORTS.find((viewport) => viewport.name === "small-mobile")!;

for (const viewport of [DESKTOP, MOBILE]) {
  for (const theme of ["light", "dark"] as const satisfies Theme[]) {
    test(`Compare keeps source-native evidence on ${viewport.name}/${theme}`, async ({
      page,
      errors,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto("/compare?c=france&c=japan", {
        waitUntil: "domcontentloaded",
      });
      await page.waitForLoadState("load", { timeout: 20_000 }).catch(() => {});
      await setTheme(page, theme);

      await expect(page).toHaveURL(/\/compare\?c=france&c=japan$/);
      const overview = page.locator("#overview");
      await expect(overview).toBeVisible();
      await expect(overview).not.toContainText("Democracy Index");
      await expect(overview).not.toContainText("Civica Index");

      const longitudinal = page.locator("#longitudinal");
      await longitudinal.scrollIntoViewIfNeeded();
      const ruleOfLaw = longitudinal.getByRole("button", {
        name: "Rule of law",
      });
      await waitForReactHydration(ruleOfLaw);
      await ruleOfLaw.click();
      await expect(longitudinal).toContainText("Source: World Bank WGI");
      await expect(longitudinal).toContainText("Publisher vintage");
      await expect(
        longitudinal.locator('a[href*="indicator=rl.est"][href*="source=worldbank_wgi"]'),
      ).toHaveCount(4);

      if (process.env.ATL014_CAPTURE_DIR) {
        await page.screenshot({
          path: path.join(
            process.env.ATL014_CAPTURE_DIR,
            `compare-france-japan-${viewport.name}-${theme}.png`,
          ),
        });
      }

      expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual(
        [],
      );
    });
  }
}
