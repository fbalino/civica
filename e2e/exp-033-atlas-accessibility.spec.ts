/** EXP-033 — Atlas selection and comparison accessibility contract. */
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
    test(`Atlas selection and explicit comparison work with keyboard, pointer, and ${viewport.name}/${theme}`, async ({
      page,
      errors,
    }) => {
      test.skip(
        process.env.E2E_PERFORMANCE_FIXTURE_DB !== "1",
        "This representative route needs the controlled read-only fixture database.",
      );
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      // The map's geometry request may remain open after useful content has
      // loaded, so Atlas must not use a network-idle navigation boundary.
      await page.goto("/atlas", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("load", { timeout: 20_000 }).catch(() => {});
      await setTheme(page, theme);

      await expect(page.getByRole("heading", { name: "World Atlas" })).toBeVisible();

      // Pointer selection writes through to the same canonical native control.
      const brazilPath = page.locator('path[data-id="bra"]').first();
      // On the narrow layout the map follows the reader intro, so the target
      // can begin below the viewport. Bring the actual SVG path into view
      // before calculating viewport-relative pointer coordinates.
      await brazilPath.scrollIntoViewIfNeeded();
      const brazilBox = await brazilPath.boundingBox();
      if (!brazilBox) throw new Error("Brazil is missing from the visible Atlas map.");
      await page.mouse.click(
        brazilBox.x + brazilBox.width / 2,
        brazilBox.y + brazilBox.height / 2,
      );

      const controls = page.locator(".atlas-country-controls");
      await controls.locator("summary").press("Enter");
      const selector = page.getByRole("combobox", { name: "Select a country" });
      await waitForReactHydration(selector);
      await expect(selector).toBeVisible();
      await expect(selector).toHaveValue("bra");
      await expect(page.getByRole("status")).toHaveText(
        "Brazil selected. Choose an action below.",
      );

      // The native selector gives keyboard users the platform-standard
      // combobox interaction; this browser action verifies its shared state
      // and the map highlight after the control value changes.
      await selector.selectOption("fra");
      const firstKeyboardSelection = "fra";
      await expect(selector).toHaveValue(firstKeyboardSelection);
      await selector.focus();
      await expect(page.getByRole("status")).toContainText("selected.");
      await expect(
        page.locator(`path[data-id="${firstKeyboardSelection}"]`).first(),
      ).toHaveAttribute("data-selected", "1");

      await page.keyboard.press("Tab");
      await expect(page.getByRole("button", { name: "Open profile" })).toBeFocused();
      await page.keyboard.press("Tab");
      const addToComparison = page.getByRole("button", {
        name: "Add to comparison",
      });
      await expect(addToComparison).toBeFocused();
      await page.keyboard.press("Enter");

      // Pick a different country through the same native control, add it, then
      // activate the only compare route by keyboard. This is the explicit
      // two-country touch-safe flow.
      await selector.selectOption("deu");
      await selector.focus();
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      await expect(addToComparison).toBeFocused();
      await page.keyboard.press("Enter");

      const openCompare = page.getByRole("button", { name: "Open compare" });
      await expect(openCompare).toBeEnabled();
      await openCompare.focus();
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/compare\?c=[^&]+&c=[^&]+/);

      expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual([]);
    });
  }
}
