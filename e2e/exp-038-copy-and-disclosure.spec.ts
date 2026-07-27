import {
  expect,
  measureHorizontalOverflow,
  setTheme,
  test,
  type Theme,
} from "./harness/fixtures";

for (const viewport of [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
] as const) {
  for (const theme of ["light", "dark"] as const satisfies Theme[]) {
    test(`approved home copy and disclosure render — ${viewport.name}/${theme}`, async ({
      page,
      errors,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });

      await page.goto("/", { waitUntil: "domcontentloaded" });
      await setTheme(page, theme);
      await expect(
        page.getByRole("heading", {
          name: "Start with a country. See its institutions, leaders, and source-linked facts.",
        }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", {
          name: "Compare political systems and institutions on one map.",
        }),
      ).toBeVisible();
      await expect(page.getByText("Independent & nonpartisan")).toBeVisible();
      expect((await measureHorizontalOverflow(page)).overflow).toBeLessThanOrEqual(
        1,
      );

      await page.goto("/about#project-disclosure", {
        waitUntil: "domcontentloaded",
      });
      await setTheme(page, theme);
      const disclosure = page.locator("#project-disclosure");
      await expect(disclosure).toBeVisible();
      await expect(
        disclosure.getByRole("heading", {
          name: "Project funding and independence",
        }),
      ).toBeVisible();
      await expect(
        disclosure.getByText(
          "Civica Atlas is personally funded by Fernando Baliño.",
          { exact: false },
        ),
      ).toBeVisible();
      await expect(
        disclosure.getByText("No outside funder or sponsor exists.", {
          exact: false,
        }),
      ).toBeVisible();
      await expect(
        disclosure.getByText("no donated or discounted services", {
          exact: false,
        }),
      ).toBeVisible();
      await expect(
        disclosure.getByText(
          "Fernando has confirmed no relevant outside affiliations or interests.",
          { exact: false },
        ),
      ).toBeVisible();
      await expect(
        disclosure.locator("h3[id^='project-disclosure-']"),
      ).toHaveCount(6);
      await expect(
        disclosure.getByRole("link", { name: "machine-readable disclosure" }),
      ).toHaveAttribute(
        "href",
        "https://github.com/fbalino/civica/blob/main/data/research/project-disclosure-v1.json",
      );
      await expect(
        disclosure.getByRole("link", { name: "report a correction" }),
      ).toHaveAttribute("href", "/contact");
      expect((await measureHorizontalOverflow(page)).overflow).toBeLessThanOrEqual(
        1,
      );
      expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual(
        [],
      );
    });
  }
}

for (const viewport of [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
] as const) {
  test(`approved reader copy renders across affected routes — ${viewport.name}`, async ({
    page,
    errors,
  }) => {
    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });

    await page.goto("/methodology", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByText(
        "New to Civica’s data methods? Start with the plain-English overview.",
        { exact: false },
      ),
    ).toBeVisible();
    await expect(
      page.getByText(
        "How Civica selects among source observations, records disputes, separates forecasts from measurements, and preserves scoped alternatives.",
        { exact: false },
      ),
    ).toBeVisible();

    await page.goto("/governance-evidence?country=andorra", {
      waitUntil: "domcontentloaded",
    });
    await expect(
      page.getByText(
        "not retained. This release was assembled later from harmonized publisher series and is not an as-published 2024 snapshot",
        { exact: false },
      ),
    ).toBeVisible();

    await page.goto("/licensing", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByText(
        "A citation or public page does not by itself grant reuse permission.",
        { exact: false },
      ),
    ).toBeVisible();

    await page.goto("/contact", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("heading", { name: "Contact the editors" }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Fernando Baliño reviews submissions manually.",
        { exact: false },
      ),
    ).toBeVisible();

    await page.goto("/about/advisory-board/apply", {
      waitUntil: "domcontentloaded",
    });
    await expect(
      page.getByText(
        "Submission does not confer membership, a review role, or endorsement.",
        { exact: false },
      ),
    ).toBeVisible();

    await page.goto("/country/andorra/constitution", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("main")).toBeVisible();

    expect((await measureHorizontalOverflow(page)).overflow).toBeLessThanOrEqual(
      1,
    );
    expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual([]);
  });
}
