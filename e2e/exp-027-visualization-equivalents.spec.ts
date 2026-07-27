/** EXP-027 — reader research visuals keep a source, equivalent, and data path. */
import {
  expect,
  test,
  waitForReactHydration,
} from "./harness/fixtures";

test.describe("EXP-027 — research visualization equivalents", () => {
  test("Atlas map has an accessible name, source disclosure, table, and permitted release", async ({
    page,
    errors,
  }) => {
    await page.goto("/atlas?layer=income", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load", { timeout: 20_000 }).catch(() => {});

    await expect(
      page.getByRole("img", {
        name: "World map colored by Income group (World Bank)",
      }),
    ).toBeVisible();
    const disclosure = page.getByRole("region", {
      name: "Income group (World Bank) map data disclosure",
    });
    await disclosure.scrollIntoViewIfNeeded();
    await expect(disclosure.getByText("Source and vintage", { exact: true })).toBeVisible();
    await expect(
      disclosure.getByRole("link", {
        name: "Download the permitted Atlas release (JSON gzip)",
      }),
    ).toHaveAttribute("href", "/downloads/civica-atlas-2026-07-11.json.gz");

    const tableToggle = disclosure.getByText(
      "Show every map-eligible country and its active layer value",
      { exact: true },
    );
    await tableToggle.focus();
    await page.keyboard.press("Enter");
    await expect(
      disclosure.getByRole("table", {
        name: "Income group (World Bank) table alternative",
      }),
    ).toBeVisible();

    expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual([]);
  });

  test("methodology weights pair the bar with a versioned machine-readable record", async ({
    page,
    errors,
  }) => {
    await page.goto("/civica-index/methodology", { waitUntil: "networkidle" });

    const disclosure = page.getByRole("region", {
      name: "Historical Civica Index dimension weights data disclosure",
    });
    await disclosure.scrollIntoViewIfNeeded();
    await expect(disclosure).toContainText("A candidate or unavailable component is not silently assigned a zero weight.");
    await expect(
      disclosure.getByRole("link", {
        name: "Download the methodology weights as JSON",
      }),
    ).toHaveAttribute("href", "/api/v1/index/methodology");

    expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual([]);
  });

  test("organization membership map names its roster equivalent and withheld export", async ({
    page,
    errors,
  }) => {
    await page.goto("/organizations/un", { waitUntil: "networkidle" });

    await expect(
      page.getByRole("img", { name: "UN current membership map" }),
    ).toBeVisible();
    const disclosure = page.getByRole("region", {
      name: "UN membership map data disclosure",
    });
    await disclosure.scrollIntoViewIfNeeded();
    await expect(disclosure).toContainText("The full member list above is the complete nonvisual equivalent.");
    await expect(disclosure).toContainText("not public redistribution of the compiled membership rows");
    await expect(
      disclosure.getByRole("link", { name: "See source-rights policy." }),
    ).toHaveAttribute("href", "/licensing#rights-manifest");

    expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual([]);
  });

  test("party compass exposes its source-backed nonvisual table and rights boundary", async ({
    page,
    errors,
  }) => {
    await page.goto("/parties", { waitUntil: "networkidle" });

    await expect(
      page.getByRole("img", { name: /Party ideology compass/ }),
    ).toBeVisible();
    const disclosure = page.getByRole("region", {
      name: "Party ideology compass data disclosure",
    });
    await disclosure.scrollIntoViewIfNeeded();
    await expect(disclosure).toContainText("Parties without a displayable V-Party position remain in the table");
    await expect(disclosure).toContainText("downloads are unavailable");
    await expect(
      disclosure.getByRole("link", { name: "See source-rights policy." }),
    ).toHaveAttribute("href", "/licensing#rights-manifest");

    expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual([]);
  });

  test("country legislature and tenure views disclose exact rows beside their visuals", async ({
    page,
    errors,
  }) => {
    await page.goto("/country/france/civica-data?section=legislature", {
      waitUntil: "networkidle",
    });

    const legislature = page.getByRole("region", {
      name: "Legislature composition data disclosure",
    });
    await legislature.scrollIntoViewIfNeeded();
    await expect(legislature).toContainText("no empty hemicycle is used to imply zero seats");
    await legislature.getByText("Show legislature composition table", { exact: true }).press("Enter");
    await expect(
      legislature.getByRole("table", {
        name: "France legislature composition data table",
      }),
    ).toBeVisible();

    const tenure = page.getByRole("region", {
      name: "Current-officeholder tenure data disclosure",
    });
    await tenure.scrollIntoViewIfNeeded();
    await expect(
      tenure.getByRole("link", {
        name: "Download current-officeholder rows as JSON",
      }),
    ).toHaveAttribute("href", "/api/countries/france/leaders");
    await tenure.getByText("Show tenure timeline table", { exact: true }).press("Enter");
    await expect(
      tenure.getByRole("table", {
        name: "France current-officeholder tenure data table",
      }),
    ).toBeVisible();

    expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual([]);
  });

  test("compare indicator chart exposes its source-native table and matching country export", async ({
    page,
    errors,
  }) => {
    await page.goto("/compare?c=france&c=japan", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForLoadState("load", { timeout: 20_000 }).catch(() => {});

    const longitudinal = page.locator("#longitudinal");
    const ruleOfLaw = longitudinal.getByRole("button", { name: "Rule of law" });
    await waitForReactHydration(ruleOfLaw);
    await ruleOfLaw.click();

    const disclosure = longitudinal.getByRole("region", {
      name: /comparison data disclosure/,
    });
    await disclosure.scrollIntoViewIfNeeded();
    await expect(disclosure).toContainText("Years without a published observation stay absent");
    await expect(
      disclosure.getByRole("link", { name: "Download France CSV" }),
    ).toHaveAttribute("href", /indicator=rl\.est/);

    const tableToggle = disclosure.getByText("Show source-native observation table", {
      exact: true,
    });
    await tableToggle.focus();
    await page.keyboard.press("Enter");
    await expect(
      disclosure.getByRole("table", { name: /comparison data table/ }),
    ).toBeVisible();

    expect(errors.hardFailures(), errors.hardFailures().join("\n")).toEqual([]);
  });
});
