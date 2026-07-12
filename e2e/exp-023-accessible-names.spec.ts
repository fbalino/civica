/**
 * EXP-023 — alternative-text policy accessibility snapshots.
 *
 * Proves the DESIGN.md "Alternative text" contract on three representative
 * pages (a country page, rankings, a constitution page): decorative flags
 * and portraits are NOT exposed as separate accessible images announcing a
 * name that's already visible as text next to them (no duplicate
 * visual/caption or flag/name announcements), and a genuinely meaningful
 * image on the same pages keeps its real accessible name.
 *
 * `aria-hidden="true"` removes an element (and `alt=""` on an <img> makes it
 * presentational) from the accessibility tree entirely, so a correctly
 * decorative flag/portrait must NOT match `getByRole("img")` at all — by
 * name or otherwise. That absence is the assertion.
 */
import { test, expect } from "./harness/fixtures";

const COUNTRY_SLUG = "switzerland"; // verified rich-data slug (e2e/harness/routes.ts)
const COUNTRY_NAME = "Switzerland";

test.describe("country page (/country/switzerland)", () => {
  test("the country name is a real heading, not just an image alt", async ({
    page,
  }) => {
    await page.goto(`/country/${COUNTRY_SLUG}`);
    await expect(
      page.getByRole("heading", { level: 1, name: COUNTRY_NAME }),
    ).toBeVisible();
  });

  test("the masthead flag is not announced as a redundant image", async ({
    page,
  }) => {
    await page.goto(`/country/${COUNTRY_SLUG}`);
    // No accessible "img" role anywhere on the page starts with "Flag" — if
    // the masthead flag were still exposed with alt="Flag of Switzerland"
    // next to an <h1>Switzerland</h1>, a screen reader would announce the
    // country name twice back to back.
    await expect(page.getByRole("img", { name: /^Flag/i })).toHaveCount(0);

    // Direct DOM proof on the flag element itself: alt="" + aria-hidden.
    const flagImg = page.locator('img[src*="flagcdn.com"]').first();
    await expect(flagImg).toHaveAttribute("alt", "");
    await expect(flagImg).toHaveAttribute("aria-hidden", "true");
  });

  test("the country locator map keeps a real, distinct accessible name (a genuinely meaningful image is not silenced)", async ({
    page,
  }) => {
    await page.goto(`/country/${COUNTRY_SLUG}`);
    // CountryMap.tsx renders the masthead locator preview with
    // role="img" aria-label="Map of Switzerland" — maps are the MEANINGFUL
    // class in DESIGN.md's policy (they carry information the adjacent
    // heading text does not), so unlike the flag/portrait it must keep a
    // real, describing accessible name rather than being hidden.
    await expect(
      page.getByRole("img", { name: `Map of ${COUNTRY_NAME}` }),
    ).toBeVisible();
  });

  test("the photo/map cover tiles are decorative, but their controls keep a meaningful accessible name", async ({
    page,
  }) => {
    await page.goto(`/country/${COUNTRY_SLUG}`);
    // The cover <img> inside each tile is decorative (caption/label is
    // elsewhere), but the surrounding <button> still exposes a real,
    // meaningful accessible name via aria-label — proving the policy trades
    // a redundant image announcement for one clean control name, not silence.
    const photosButton = page.getByRole("button", {
      name: /Open \d+ photos?/i,
    });
    await expect(photosButton).toBeVisible();
    const coverImg = photosButton.locator("img").first();
    if (await coverImg.count()) {
      // Decorative: alt="" exposes no redundant name. The extra aria-hidden is
      // a baselined Index-change-control deferral — FactbookHeaderStrip is a
      // protected presentation file, so its two cover tiles are recorded in
      // scripts/alt-text-policy-baseline.json rather than edited here. The
      // control's meaningful name (asserted above) carries the semantics.
      await expect(coverImg).toHaveAttribute("alt", "");
    }
  });

  test("a genuinely meaningful image on the shared shell keeps its real accessible name", async ({
    page,
  }) => {
    await page.goto(`/country/${COUNTRY_SLUG}`);
    // The footer's source-trust logo strip (SiteFooter) is the one image on
    // this page class that is MEANINGFUL per DESIGN.md — no adjacent text
    // names the five publishers, so it keeps a real descriptive alt.
    const trustLogo = page
      .getByRole("img", { name: /World Bank/i })
      .first();
    await expect(trustLogo).toBeVisible();
  });
});

test.describe("rankings (/rankings)", () => {
  test("country flags in the table are not announced as redundant images", async ({
    page,
  }) => {
    await page.goto("/rankings");
    await expect(page.getByRole("cell").filter({ hasText: "India" }).first()).toBeVisible();
    // The rankings table renders one flag per row next to the visible
    // country name; none should surface as a separately-named image.
    await expect(page.getByRole("img", { name: /^Flag/i })).toHaveCount(0);

    const flagImg = page.locator('img[src*="flagcdn.com"]').first();
    await expect(flagImg).toHaveAttribute("alt", "");
    await expect(flagImg).toHaveAttribute("aria-hidden", "true");
  });

  test("the shared footer trust-logo image keeps a meaningful accessible name", async ({
    page,
  }) => {
    await page.goto("/rankings");
    await expect(
      page.getByRole("img", { name: /World Bank/i }).first(),
    ).toBeVisible();
  });
});

test.describe("constitution explorer (/constitution)", () => {
  test("landing-card country flags are not announced as redundant images", async ({
    page,
  }) => {
    await page.goto("/constitution");
    await expect(
      page.getByText("Brazil", { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByRole("img", { name: /^Flag/i })).toHaveCount(0);

    const flagImg = page.locator('img[src*="flagcdn.com"]').first();
    await expect(flagImg).toHaveAttribute("alt", "");
    await expect(flagImg).toHaveAttribute("aria-hidden", "true");
  });

  test("the shared footer trust-logo image keeps a meaningful accessible name", async ({
    page,
  }) => {
    await page.goto("/constitution");
    await expect(
      page.getByRole("img", { name: /World Bank/i }).first(),
    ).toBeVisible();
  });
});
