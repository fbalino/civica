/**
 * QA-010 — critical reader journeys, part 3: access/utility surfaces.
 *
 * download/export, licensing/contact/advisory, 404/error, and embed. Runs
 * under the QA-009 harness: `npm run test:e2e -- qa-010-reader-journeys`.
 *
 * Download/export and embed are exercised via the `request` API context
 * (HEAD/GET only) rather than `page.goto`, so their non-2xx-by-design status
 * codes (embed is an intentionally retired 410) never pollute the `errors`
 * fixture's network-failure capture on a `page`. Read-only throughout: no
 * form submissions, no mutations, no paid model calls. The contact form is
 * verified to RENDER only — its submit button is never clicked.
 */
import { test, expect } from "./harness/fixtures";
import { CANONICAL_ROUTES, SAMPLE_COUNTRY_SLUG } from "./harness/routes";

test.describe("download / export (QA-010)", () => {
  test("the Atlas bulk-export archive and manifest are reachable, read-only GETs", async ({
    request,
  }) => {
    const archive = await request.get(
      "/downloads/civica-atlas-2026-07-11.json.gz",
    );
    expect(archive.status()).toBe(200);
    expect(archive.headers()["content-type"]).toMatch(/gzip/);

    const manifest = await request.get(
      "/downloads/civica-atlas-2026-07-11.manifest.json",
    );
    expect(manifest.status()).toBe(200);
    expect(manifest.headers()["content-type"]).toMatch(/json/);
  });

  test("the API docs page links to the bulk-data download", async ({
    page,
    errors,
  }) => {
    await page.goto("/api-docs");
    await expect(
      page.getByRole("heading", { level: 2, name: "Bulk Data" }),
    ).toBeVisible();
    await expect(
      page.locator(
        'a[href="/downloads/civica-atlas-2026-07-11.json.gz"]',
      ),
    ).toBeVisible();

    expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual([]);
  });
});

test.describe("licensing / contact / advisory (QA-010)", () => {
  test("licensing page renders", async ({ page, errors }) => {
    await page.goto("/licensing");
    await expect(page.getByRole("heading", { level: 1, name: "Licensing" })).toBeVisible();

    expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual([]);
  });

  test("contact page renders its form fields without submitting", async ({
    page,
    errors,
  }) => {
    await page.goto("/contact");
    await expect(
      page.getByRole("heading", { level: 1, name: "Dispatch desk" }),
    ).toBeVisible();
    await expect(page.getByLabel("Name")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Message")).toBeVisible();
    // The submit control renders but is deliberately never clicked — this
    // journey is read-only and must never send a real message.
    await expect(
      page.getByRole("button", { name: /Send message/i }),
    ).toBeVisible();

    expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual([]);
  });

  test("advisory board charter renders", async ({ page, errors }) => {
    await page.goto("/about/advisory-board");
    await expect(
      page.getByRole("heading", { level: 1, name: "Advisory board charter" }),
    ).toBeVisible();

    expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual([]);
  });
});

test.describe("404 / error (QA-010)", () => {
  test("an unknown route returns the real not-found UI, not a generic error page", async ({
    page,
  }) => {
    const notFound = CANONICAL_ROUTES.find((r) => r.name === "not-found")!;
    const res = await page.goto(notFound.path);
    expect(res?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { level: 1, name: "This page is off the map." }),
    ).toBeVisible();
    // The 404 offers a real recovery path (a working country search), not a
    // dead end. The global SiteFooter also renders a "Find a country"
    // combobox, so scope to the main content region for a single match.
    await expect(
      page.getByRole("main").getByRole("combobox", { name: "Find a country" }),
    ).toBeVisible();
    // NOTE: errors.hardFailures() is intentionally NOT asserted here — the
    // 404 response itself is a >=400 status the harness would (correctly)
    // record as a "bad response," matching the pattern in
    // e2e/responsive-matrix.spec.ts's not-found handling.
  });
});

test.describe("embed (QA-010)", () => {
  test("the embed route serves its documented retirement notice, not a live widget", async ({
    request,
  }) => {
    // The Civica Index embed widget was retired (see /api-docs "Retired
    // Widget Embed" section): every slug returns HTTP 410 with a fixed
    // retirement notice pointing at Governance Evidence. This is correct,
    // intentional current behavior, not a bug — the journey asserts the
    // documented retirement contract rather than a live widget render.
    const res = await request.get(`/embed/${SAMPLE_COUNTRY_SLUG}`);
    expect(res.status()).toBe(410);
    const body = await res.text();
    expect(body).toContain("This Civica Index embed has been retired.");
    expect(body).toContain(
      `/governance-evidence?country=${SAMPLE_COUNTRY_SLUG}`,
    );
  });
});
