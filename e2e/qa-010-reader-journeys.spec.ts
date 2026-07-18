/**
 * QA-010 — critical reader journeys, part 1: core navigation flows.
 *
 * home → search → country tabs, source/provenance, atlas, compare, indicator
 * history, and constitution/search. Real user flows (navigate + interact +
 * assert meaningful content), not just 200 checks. Runs under the QA-009
 * harness: `npm run test:e2e -- qa-010-reader-journeys`.
 *
 * Read-only throughout: no form submissions, no mutations, no paid model
 * calls. See `e2e/qa-010-reader-journeys-content.spec.ts` and
 * `e2e/qa-010-reader-journeys-access.spec.ts` for the remaining journeys.
 */
import { test, expect, setTheme, VIEWPORTS } from "./harness/fixtures";
import { SAMPLE_COUNTRY_SLUG } from "./harness/routes";

const COUNTRY_NAME = "Switzerland"; // matches SAMPLE_COUNTRY_SLUG
const DESKTOP = VIEWPORTS.find((v) => v.name === "desktop")!;
const MOBILE = VIEWPORTS.find((v) => v.name === "small-mobile")!;

test.describe("home → search → country tabs (QA-010)", () => {
  for (const vp of [DESKTOP, MOBILE]) {
    test(`search finds ${COUNTRY_NAME} and all three tabs render their content @ ${vp.name}`, async ({
      page,
      errors,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/");

      // Real search interaction, not a direct URL jump.
      const search = page.getByRole("combobox", {
        name: "Search countries and areas",
      });
      await search.click();
      await search.fill(COUNTRY_NAME);
      await page
        .getByRole("option", { name: new RegExp(`^${COUNTRY_NAME}`) })
        .first()
        .click();
      await expect(page).toHaveURL(new RegExp(`/country/${SAMPLE_COUNTRY_SLUG}$`));

      // Tab 1: Factbook — the masthead H1 is the country name.
      await expect(
        page.getByRole("heading", { level: 1, name: COUNTRY_NAME }),
      ).toBeVisible();

      const tabs = page.getByRole("navigation", { name: "Country sections" });

      // Tab 2: Civica Data — Evidence Coverage is always the first section.
      await tabs.getByRole("link", { name: "Civica Data" }).click();
      await expect(page).toHaveURL(
        new RegExp(`/country/${SAMPLE_COUNTRY_SLUG}/civica-data$`),
      );
      await expect(
        page.locator("#evidence-coverage").getByRole("heading", {
          level: 2,
          name: "Evidence Coverage",
        }),
      ).toBeVisible();

      // Tab 3: Constitution — Switzerland is indexed with full text.
      await tabs.getByRole("link", { name: "Constitution" }).click();
      await expect(page).toHaveURL(
        new RegExp(`/country/${SAMPLE_COUNTRY_SLUG}/constitution$`),
      );
      await expect(page.locator("#constitution-heading")).toContainText(
        "Full constitutional text",
      );

      expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual([]);
    });
  }

  test("dark theme spot-check: search → country tabs still render", async ({
    page,
    errors,
  }) => {
    await page.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height });
    await page.goto("/");
    await setTheme(page, "dark");

    const search = page.getByRole("combobox", {
      name: "Search countries and areas",
    });
    await search.click();
    await search.fill(COUNTRY_NAME);
    await page
      .getByRole("option", { name: new RegExp(`^${COUNTRY_NAME}`) })
      .first()
      .click();
    await expect(page).toHaveURL(new RegExp(`/country/${SAMPLE_COUNTRY_SLUG}$`));
    await expect(
      page.getByRole("heading", { level: 1, name: COUNTRY_NAME }),
    ).toBeVisible();

    await page
      .getByRole("navigation", { name: "Country sections" })
      .getByRole("link", { name: "Civica Data" })
      .click();
    await setTheme(page, "dark"); // re-assert after client navigation
    await expect(page.locator("#evidence-coverage h2")).toContainText(
      "Evidence Coverage",
    );

    expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual([]);
  });
});

test.describe("source/provenance (QA-010)", () => {
  test("Factbook tab carries provenance SourceDots on facts", async ({
    page,
    errors,
  }) => {
    await page.goto(`/country/${SAMPLE_COUNTRY_SLUG}`);
    // SourceDot renders role="img" aria-label="Source: <label>, <date>".
    const dots = page.getByRole("img", { name: /^Source:/ });
    await expect(dots.first()).toBeVisible();
    expect(await dots.count()).toBeGreaterThan(0);

    expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual([]);
  });

  test("Civica Data tab carries provenance SourceDots too", async ({
    page,
    errors,
  }) => {
    await page.goto(`/country/${SAMPLE_COUNTRY_SLUG}/civica-data`);
    const dots = page.getByRole("img", { name: /^Source:/ });
    await expect(dots.first()).toBeVisible();
    expect(await dots.count()).toBeGreaterThan(0);

    expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual([]);
  });
});

test.describe("atlas (QA-010)", () => {
  // The map compiles slowly on first hit and never reaches networkidle —
  // use a generous per-test timeout and a bounded `load` wait, matching the
  // pattern in e2e/responsive-matrix.spec.ts.
  test.slow();

  for (const vp of [DESKTOP, MOBILE]) {
    test(`map renders with a selectable layer control @ ${vp.name}`, async ({
      page,
      errors,
    }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/atlas", { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("load", { timeout: 20_000 }).catch(() => {});

      // The choropleth SVG (not canvas/WebGL) defaults to the source-native
      // V-Dem regime layer.
      const map = page.getByRole("img", {
        name: /^World map colored by/,
      });
      await expect(map).toBeVisible({ timeout: 20_000 });
      // Country <path> elements populate asynchronously after the empty SVG
      // shell mounts (world-atlas geometry fetch) — poll rather than a bare
      // synchronous count.
      await expect
        .poll(() => map.locator("path").count(), { timeout: 20_000 })
        .toBeGreaterThan(0);

      // The layer-switcher SegmentedControl is a country-selection-adjacent
      // control: switching layers proves the map is interactive.
      const layerSwitcher = page.getByRole("tablist", { name: "Map data layer" });
      await expect(layerSwitcher).toBeVisible();
      await layerSwitcher.getByRole("tab", { name: "Regime (V-Dem)" }).click();
      await expect(
        page.getByRole("img", { name: "World map colored by Regime type (V-Dem)" }),
      ).toBeVisible();

      expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual([]);
    });
  }

  test("dark theme spot-check: map still renders", async ({ page, errors }) => {
    await page.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height });
    await page.goto("/atlas", { waitUntil: "domcontentloaded" });
    await setTheme(page, "dark");
    await page.waitForLoadState("load", { timeout: 20_000 }).catch(() => {});

    const map = page.getByRole("img", { name: /^World map colored by/ });
    await expect(map).toBeVisible({ timeout: 20_000 });
    await expect
      .poll(() => map.locator("path").count(), { timeout: 20_000 })
      .toBeGreaterThan(0);

    expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual([]);
  });
});

test.describe("compare (QA-010)", () => {
  test("selecting two countries via the real picker renders the comparison", async ({
    page,
    errors,
  }) => {
    await page.setViewportSize({ width: DESKTOP.width, height: DESKTOP.height });
    await page.goto("/compare");

    // Scope to the picker cards (the global SiteFooter also renders a
    // "Find a country" combobox on this page — scoping avoids ambiguity).
    const cards = page.locator(".ci-compare-picker-card");

    await cards.nth(0).getByRole("combobox").click();
    await cards.nth(0).getByRole("combobox").fill("Japan");
    await cards.nth(0).getByRole("option", { name: /Japan/i }).first().click();
    await expect(page).toHaveURL(/[?&]c=japan(&|$)/);

    await cards.nth(1).getByRole("combobox").click();
    await cards.nth(1).getByRole("combobox").fill("France");
    await cards.nth(1).getByRole("option", { name: /France/i }).first().click();
    await expect(page).toHaveURL(/c=japan.*c=france|c=france.*c=japan/);

    // The comparison body renders both column headers, each linking back to
    // the country's own page. Every compare section (overview, chambers,
    // elections, international) repeats the header, so scope to the
    // overview section's — the always-present first section.
    const overviewHeaders = page.locator("#overview .compare-col-header-name");
    await expect(overviewHeaders.filter({ hasText: "Japan" })).toBeVisible();
    await expect(overviewHeaders.filter({ hasText: "France" })).toBeVisible();
    await expect(page.locator("#compare-hero-title")).toContainText(
      "Japan vs. France",
    );

    expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual([]);
  });
});

test.describe("indicator history (QA-010)", () => {
  test("Civica Data tab's Indicator History section renders a series table", async ({
    page,
    errors,
  }) => {
    await page.goto(`/country/${SAMPLE_COUNTRY_SLUG}/civica-data`);
    const table = page.getByRole("table", {
      name: "Indicator history definitions and provenance",
    });
    await table.scrollIntoViewIfNeeded();
    await expect(table).toBeVisible();
    // At least one indicator row beyond the header.
    expect(await table.locator("tbody tr").count()).toBeGreaterThan(0);

    expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual([]);
  });
});

test.describe("constitution search (QA-010)", () => {
  test("searching a common term via the real form returns highlighted passages", async ({
    page,
    errors,
  }) => {
    await page.goto("/constitution/search");
    const form = page.getByRole("search", { name: "Search constitutional text" });
    await form.getByPlaceholder(/Search rights, institutions/).fill("legislature");
    await form.getByRole("button", { name: "Search passages" }).click();

    await expect(page).toHaveURL(/\/constitution\/search\?q=legislature/);
    await expect(page.locator("#constitution-search-results-title")).toContainText(
      /Passages matching/,
    );
    expect(await page.locator(".constitution-search-result mark").count()).toBeGreaterThan(
      0,
    );

    expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual([]);
  });
});
