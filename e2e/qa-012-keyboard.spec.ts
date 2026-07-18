/** QA-012 — keyboard journeys for canonical shared controls. */
import { test, expect, VIEWPORTS } from "./harness/fixtures";

const DESKTOP = VIEWPORTS.find((viewport) => viewport.name === "desktop")!;
const MOBILE = VIEWPORTS.find((viewport) => viewport.name === "small-mobile")!;

test.describe("QA-012 — keyboard journeys", () => {
  test("desktop Explore disclosure opens with Enter and restores focus on Escape", async ({
    page,
  }) => {
    await page.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height });
    await page.goto("/");

    const trigger = page.getByRole("button", { name: "Explore" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).toBeFocused();
  });

  test("mobile navigation traps focus and returns it to its trigger on Escape", async ({
    page,
  }) => {
    await page.setViewportSize({ width: MOBILE.width, height: MOBILE.height });
    await page.goto("/");

    const trigger = page.getByRole("button", { name: "Open menu" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "Main menu" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Close menu" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Main menu" })).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("country search supports option selection entirely from the keyboard", async ({
    page,
  }) => {
    await page.goto("/");
    const search = page.getByRole("combobox", {
      name: "Search countries and areas",
    });
    await search.focus();
    await search.fill("Switzerland");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/country\/switzerland$/);
  });

  test("segmented controls use roving focus and arrow-key selection", async ({
    page,
  }) => {
    await page.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height });
    await page.goto("/atlas", { waitUntil: "domcontentloaded" });
    const tablist = page.getByRole("tablist", { name: "Map data layer" });
    await expect(tablist).toBeVisible();

    const selectedBefore = tablist.getByRole("tab", { selected: true });
    const selectedName = await selectedBefore.getAttribute("aria-label") ?? await selectedBefore.textContent();
    await selectedBefore.focus();
    await page.keyboard.press("ArrowRight");

    const selectedAfter = tablist.getByRole("tab", { selected: true });
    await expect(selectedAfter).toBeFocused();
    await expect(selectedAfter).not.toHaveText(selectedName ?? "");
  });
});
