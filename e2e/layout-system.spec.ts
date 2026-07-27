/** Browser contract for the canonical page-width and country-directory system. */
import {
  test,
  expect,
  measureHorizontalOverflow,
  setTheme,
  type Theme,
} from "./harness/fixtures";

for (const viewport of [
  { name: "desktop", width: 1440, height: 900, columns: 4 },
  { name: "mobile", width: 390, height: 844, columns: 1 },
] as const) {
  for (const theme of ["light", "dark"] as const satisfies Theme[]) {
    test(`/country is centered and sequential — ${viewport.name}/${theme}`, async ({
      page,
      errors,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto("/country", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("load", { timeout: 20_000 }).catch(() => {});
      await setTheme(page, theme);

      const hero = page.locator(".factbook-landing-hero--centered");
      const title = hero.locator("h1");
      const search = hero.locator(".factbook-hero-search");
      await expect(hero).toBeVisible();
      await expect(title).toBeVisible();
      await expect(search).toBeVisible();

      const chipGroup = hero.getByRole("group", {
        name: "Filter by region",
      });
      await expect(chipGroup).toBeVisible();
      const chipSpacing = await chipGroup.evaluate((element) => {
        const chips = [
          ...element.querySelectorAll<HTMLElement>(
            ":scope > .factbook-region-chip",
          ),
        ];
        const first = chips[0].getBoundingClientRect();
        const second = chips[1].getBoundingClientRect();
        return {
          count: chips.length,
          cssGap: Number.parseFloat(getComputedStyle(element).columnGap),
          renderedGap: second.left - first.right,
          sameRow: Math.abs(second.top - first.top) < 1,
        };
      });
      expect(chipSpacing.count).toBe(6);
      expect(chipSpacing.cssGap).toBeGreaterThan(0);
      expect(chipSpacing.sameRow).toBe(true);
      expect(chipSpacing.renderedGap).toBeGreaterThanOrEqual(
        chipSpacing.cssGap - 0.5,
      );

      const centered = await page.evaluate(() => {
        const center = (selector: string) => {
          const rect = document.querySelector(selector)!.getBoundingClientRect();
          return rect.left + rect.width / 2;
        };
        const inner = document
          .querySelector(".factbook-landing-hero--centered .factbook-hero-inner")!
          .getBoundingClientRect();
        const expected = inner.left + inner.width / 2;
        return {
          expected,
          title: center(".factbook-landing-hero--centered h1"),
          search: center(
            ".factbook-landing-hero--centered .factbook-hero-search",
          ),
        };
      });
      expect(Math.abs(centered.title - centered.expected)).toBeLessThan(1);
      expect(Math.abs(centered.search - centered.expected)).toBeLessThan(1);

      const directory = await page.evaluate(() => {
        const groups = [
          ...document.querySelectorAll<HTMLElement>(
            ".country-directory__group",
          ),
        ];
        const columns = getComputedStyle(
          document.querySelector(".country-directory__entries")!,
        ).gridTemplateColumns.split(" ").length;
        const first = document.querySelector(
          ".country-directory__item",
        ) as HTMLElement;
        return {
          ids: groups.slice(0, 5).map((group) => group.id),
          tops: groups.slice(0, 5).map((group) => group.offsetTop),
          columns,
          firstText: first.innerText,
          separator: first.querySelector(
            ".country-directory__status-separator",
          )?.textContent,
        };
      });
      expect(directory.ids).toEqual([
        "country-letter-A",
        "country-letter-B",
        "country-letter-C",
        "country-letter-D",
        "country-letter-E",
      ]);
      expect(directory.tops).toEqual([...directory.tops].sort((a, b) => a - b));
      expect(directory.columns).toBe(viewport.columns);
      expect(directory.separator).toBe("·");
      expect(directory.firstText).toContain("Afghanistan");
      expect(directory.firstText).toContain("UN member state");

      const overflow = await measureHorizontalOverflow(page);
      expect(overflow.overflow).toBeLessThanOrEqual(1);
      expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual(
        [],
      );
    });
  }
}

test("named width roles resolve on their real routes", async ({
  page,
  errors,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto("/methodology", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".methodology-layout")).toBeVisible();
  expect(
    await page
      .locator(".methodology-layout")
      .evaluate((element) => getComputedStyle(element).gridTemplateColumns),
  ).toMatch(/^220px /);
  expect(
    await page
      .locator(".methodology-content")
      .evaluate((element) => getComputedStyle(element).maxWidth),
  ).toBe("800px");

  await page.goto("/country/andorra", { waitUntil: "domcontentloaded" });
  expect(
    await page
      .locator(".factbook-body")
      .evaluate((element) => getComputedStyle(element).gridTemplateColumns),
  ).toMatch(/^240px .* 280px$/);

  await page.goto("/country/andorra/constitution", {
    waitUntil: "domcontentloaded",
  });
  expect(
    await page
      .locator(".civica-data-body")
      .evaluate((element) => getComputedStyle(element).gridTemplateColumns),
  ).toMatch(/^240px /);

  await page.goto("/constitution?c=united-states", {
    waitUntil: "domcontentloaded",
  });
  const constitutionExplorer = page.locator(
    ".constitution-explorer:has(.constitution-reader-layout)",
  );
  await expect(constitutionExplorer).toBeVisible();
  expect(
    await constitutionExplorer.evaluate(
      (element) => getComputedStyle(element).gridTemplateColumns,
    ),
  ).toMatch(/ 360px$/);
  expect(
    await constitutionExplorer
      .locator(".constitution-reader-layout")
      .evaluate((element) => getComputedStyle(element).gridTemplateColumns),
  ).toMatch(/^180px /);

  await page.goto("/blog/anatomy-of-a-modern-coup", {
    waitUntil: "domcontentloaded",
  });
  expect(
    await page
      .locator(".post-body-grid")
      .evaluate((element) => getComputedStyle(element).gridTemplateColumns),
  ).toBe("200px 680px 200px");

  expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual([]);
});

test("country reference shells use the compact rail at tablet width", async ({
  page,
  errors,
}) => {
  await page.setViewportSize({ width: 900, height: 900 });

  await page.goto("/country/andorra", { waitUntil: "domcontentloaded" });
  const factbookBody = page.locator(".factbook-body");
  await expect(factbookBody).toBeVisible();
  expect(
    await factbookBody.evaluate(
      (element) => getComputedStyle(element).gridTemplateColumns,
    ),
  ).toMatch(/^200px /);

  await page.goto("/country/andorra/constitution", {
    waitUntil: "domcontentloaded",
  });
  const civicaDataBody = page.locator(".civica-data-body");
  await expect(civicaDataBody).toBeVisible();
  expect(
    await civicaDataBody.evaluate(
      (element) => getComputedStyle(element).gridTemplateColumns,
    ),
  ).toMatch(/^200px /);
  expect(
    await page.locator("html").evaluate((element) =>
      getComputedStyle(element)
        .getPropertyValue("--width-rail-compact")
        .trim(),
    ),
  ).toBe("200px");

  const overflow = await measureHorizontalOverflow(page);
  expect(overflow.overflow).toBeLessThanOrEqual(1);
  expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual([]);
});
