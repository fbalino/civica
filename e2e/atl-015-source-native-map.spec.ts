/** ATL-015 — Source-native map layer and table-alternative contract. */
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
    test(`source-native map layers and table alternative work on ${viewport.name}/${theme}`, async ({
      page,
      errors,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto("/atlas?layer=income", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("load", { timeout: 20_000 }).catch(() => {});
      await setTheme(page, theme);

      const layerSwitcher = page.getByRole("tablist", {
        name: "Map data layer",
      });
      await expect(layerSwitcher).toBeVisible();
      const income = layerSwitcher.getByRole("tab", {
        name: "Income (World Bank)",
      });
      await waitForReactHydration(income);
      await expect(income).toHaveAttribute("aria-selected", "true");
      const map = page.getByRole("img", {
        name: "World map colored by Income group (World Bank)",
      });
      await expect(map).toBeVisible();
      await expect
        .poll(() => map.locator("path[data-id]").count(), { timeout: 20_000 })
        .toBeGreaterThan(0);
      await expect(page.getByText("Source and vintage", { exact: true })).toBeVisible();
      await expect(
        page
          .getByRole("region", {
            name: "Income group (World Bank) map data disclosure",
          })
          .getByText(
            /No data means no active World Bank income-group observation/,
          )
      ).toBeVisible();
      if (process.env.ATL015_CAPTURE_DIR) {
        await page.screenshot({
          path: path.join(
            process.env.ATL015_CAPTURE_DIR,
            `atlas-income-${viewport.name}-${theme}.png`,
          ),
        });
      }

      const tableHeading = page.getByRole("heading", {
        name: "Map layer table alternative",
      });
      await tableHeading.scrollIntoViewIfNeeded();
      await expect(tableHeading).toBeVisible();
      const tableDisclosure = page.getByText(
        "Show every map-eligible country and its active layer value",
      );
      await tableDisclosure.focus();
      await page.keyboard.press("Enter");
      await expect(
        page.getByRole("table", {
          name: "Income group (World Bank) table alternative",
        }),
      ).toBeVisible();
      if (process.env.ATL015_CAPTURE_DIR) {
        await page.screenshot({
          path: path.join(
            process.env.ATL015_CAPTURE_DIR,
            `atlas-income-table-${viewport.name}-${theme}.png`,
          ),
        });
      }

      expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual(
        [],
      );
    });
  }
}
