/** QA-012 — keyboard journeys for canonical shared controls. */
import {
  test,
  expect,
  VIEWPORTS,
  waitForReactHydration,
} from "./harness/fixtures";

const DESKTOP = VIEWPORTS.find((viewport) => viewport.name === "desktop")!;
const MOBILE = VIEWPORTS.find((viewport) => viewport.name === "small-mobile")!;

test.describe("QA-012 — keyboard journeys", () => {
  test("desktop Explore disclosure opens with Enter and restores focus on Escape", async ({
    page,
  }) => {
    await page.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height });
    await page.goto("/", { waitUntil: "networkidle" });

    const trigger = page.getByRole("button", { name: "Explore" });
    await waitForReactHydration(trigger);
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
    // The interaction is client-owned. Waiting for network idle lets React
    // hydrate its delegated keyboard handler before we exercise it.
    await page.goto("/", { waitUntil: "networkidle" });

    const trigger = page.getByRole("button", { name: "Open menu" });
    await waitForReactHydration(trigger);
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
    await page.goto("/", { waitUntil: "networkidle" });
    const search = page.getByRole("combobox", {
      name: "Search countries and areas",
    });
    await waitForReactHydration(search);
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
    await page.goto("/atlas", { waitUntil: "networkidle" });
    const tablist = page.getByRole("tablist", { name: "Map data layer" });
    await expect(tablist).toBeVisible();

    const selectedBefore = tablist.getByRole("tab", { selected: true });
    await waitForReactHydration(selectedBefore);
    const selectedName = await selectedBefore.getAttribute("aria-label") ?? await selectedBefore.textContent();
    await selectedBefore.focus();
    await page.keyboard.press("ArrowRight");

    const selectedAfter = tablist.getByRole("tab", { selected: true });
    await expect(selectedAfter).toBeFocused();
    await expect(selectedAfter).not.toHaveText(selectedName ?? "");
  });

  test("shared select menus support arrow navigation, selection, and focus return", async ({
    page,
  }) => {
    await page.goto("/parties", { waitUntil: "networkidle" });

    const trigger = page.getByRole("button", { name: "Select region" });
    await waitForReactHydration(trigger);
    await trigger.focus();
    await page.keyboard.press("Enter");

    const listbox = page.getByRole("listbox", { name: "Select region" });
    await expect(listbox).toBeVisible();
    await expect(listbox.getByRole("option", { selected: true })).toBeFocused();

    await page.keyboard.press("ArrowDown");
    const nextOption = listbox.getByRole("option").nth(1);
    await expect(nextOption).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(listbox).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("map and lightbox dialogs trap focus and restore their launchers", async ({
    page,
  }) => {
    await page.goto("/country/switzerland", { waitUntil: "networkidle" });

    const mapTrigger = page.getByRole("button", {
      name: "Explore the interactive map of Switzerland",
    });
    await waitForReactHydration(mapTrigger);
    await mapTrigger.focus();
    await page.keyboard.press("Enter");
    const mapDialog = page.getByRole("dialog", { name: "Map of Switzerland" });
    await expect(mapDialog).toBeVisible();
    await expect(page.getByRole("button", { name: "Close map" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(mapDialog).toHaveCount(0);
    await expect(mapTrigger).toBeFocused();

    const photoTrigger = page.getByRole("button", { name: /Open \d+ photos/ });
    await waitForReactHydration(photoTrigger);
    await photoTrigger.focus();
    await page.keyboard.press("Enter");
    const photoDialog = page.getByRole("dialog", { name: "Photo gallery" });
    await expect(photoDialog).toBeVisible();
    await expect(page.getByRole("button", { name: "Close" })).toBeFocused();

    // Close is first in the dialog; Shift+Tab must wrap to its final thumbnail.
    await page.keyboard.press("Shift+Tab");
    await expect(
      page.getByRole("button", { name: /Photo \d+/ }).last(),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(photoDialog).toHaveCount(0);
    await expect(photoTrigger).toBeFocused();
  });

  test("citation tabs use arrow-key roving focus", async ({ page }) => {
    await page.goto("/country/switzerland", { waitUntil: "networkidle" });
    await page.locator("summary.cite-accordion-summary").press("Enter");

    const apa = page.getByRole("tab", { name: "APA" });
    await waitForReactHydration(apa);
    await apa.focus();
    await page.keyboard.press("ArrowRight");

    const bibtex = page.getByRole("tab", { name: "BibTeX" });
    await expect(bibtex).toBeFocused();
    await expect(bibtex).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tabpanel")).toHaveAttribute(
      "aria-labelledby",
      await bibtex.getAttribute("id") ?? "",
    );
  });

  test("Atlas has a synchronized keyboard country selector and explicit compare flow", async ({
    page,
  }) => {
    await page.goto("/atlas", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "World Atlas" })).toBeVisible();

    const controls = page.locator(".atlas-country-controls");
    await controls.locator("summary").press("Enter");
    const selector = page.getByRole("combobox", { name: "Select a country" });
    await waitForReactHydration(selector);
    await selector.focus();
    await page.keyboard.press("End");
    await expect(selector).not.toHaveValue("");

    await selector.selectOption("fra");
    await expect(page.getByRole("status")).toHaveText(
      "France selected. Choose an action below.",
    );
    await expect(page.locator('path[data-id="fra"]').first()).toHaveAttribute(
      "data-selected",
      "1",
    );

    // Pointer selection writes back to the same native selector state.
    await page.locator('path[data-id="jpn"]').first().click();
    await expect(selector).toHaveValue("jpn");
    await expect(page.getByRole("status")).toHaveText(
      "Japan selected. Choose an action below.",
    );

    await page.getByRole("button", { name: "Add to comparison" }).click();
    await selector.selectOption("fra");
    await page.getByRole("button", { name: "Add to comparison" }).click();
    await expect(page.getByRole("button", { name: "Open compare" })).toBeEnabled();
  });
});
