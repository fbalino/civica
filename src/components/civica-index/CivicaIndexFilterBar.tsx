"use client";

/*
 * CivicaIndexFilterBar — horizontal top filter bar for the full-width
 * /civica-index reader page. Replaces the old three-pane left rail
 * (the retired shell country rail + lens selects). Keeps every filter
 * dimension and the same URL params the server page reads:
 *   ?continent= (Region)  ?vdem=  ?region= (World Bank region)
 *   ?income=              ?cgv=
 *
 * Region is a compact <SegmentedControl> (small fixed set of continents);
 * the four larger peer-lens dimensions are token-styled <select>s. A
 * canonical CountrySearchCombobox (rounded rect) sits at the end and
 * deep-links straight to a country's scorecard.
 */

import { useRouter } from "next/navigation";
import { SegmentedControl } from "@/components/editorial/SegmentedControl";
import {
  CountrySearchCombobox,
  type CountrySearchOption,
} from "@/components/CountrySearchCombobox";

interface LensOption {
  key: string;
  label: string;
  totalCount: number;
  scoredCount: number;
}

interface QueryShape {
  continent?: string;
  vdem?: string;
  region?: string;
  income?: string;
  cgv?: string;
}

interface CivicaIndexFilterBarProps {
  continents: string[];
  vdemOptions: LensOption[];
  worldBankRegionOptions: LensOption[];
  worldBankIncomeOptions: LensOption[];
  cgvOptions: LensOption[];
  activeContinent?: string;
  activeVdem?: string;
  activeWorldBankRegion?: string;
  activeWorldBankIncome?: string;
  activeCgv?: string;
  /** Countries for the deep-link search (full atlas set). */
  searchCountries: ReadonlyArray<CountrySearchOption>;
  /** Whether any filter is currently set (drives the "Clear" affordance). */
  hasFilter: boolean;
}

function buildHref(q: QueryShape): string {
  const qs = new URLSearchParams();
  if (q.continent) qs.set("continent", q.continent);
  if (q.vdem) qs.set("vdem", q.vdem);
  if (q.region) qs.set("region", q.region);
  if (q.income) qs.set("income", q.income);
  if (q.cgv) qs.set("cgv", q.cgv);
  const out = qs.toString();
  return out ? `/civica-index?${out}` : "/civica-index";
}

export function CivicaIndexFilterBar({
  continents,
  vdemOptions,
  worldBankRegionOptions,
  worldBankIncomeOptions,
  cgvOptions,
  activeContinent,
  activeVdem,
  activeWorldBankRegion,
  activeWorldBankIncome,
  activeCgv,
  searchCountries,
  hasFilter,
}: CivicaIndexFilterBarProps) {
  const router = useRouter();
  const baseQuery: QueryShape = {
    continent: activeContinent,
    vdem: activeVdem,
    region: activeWorldBankRegion,
    income: activeWorldBankIncome,
    cgv: activeCgv,
  };

  const go = (next: QueryShape) => router.push(buildHref({ ...baseQuery, ...next }));

  const regionOptions = [
    { value: "", label: "All" },
    ...continents.map((c) => ({ value: c, label: c })),
  ];

  return (
    <div className="ci-filter-bar" aria-label="Filter the Civica Index">
      <div className="ci-filter-bar-rows">
        {/* Region — small set → segmented control */}
        <div className="ci-filter-group">
          <span className="ci-filter-label">Region</span>
          <SegmentedControl
            ariaLabel="Filter by region"
            value={activeContinent ?? ""}
            options={regionOptions}
            onChange={(value) => go({ continent: value || undefined })}
            className="ci-filter-segmented"
          />
        </div>

        {/* Peer-lens selects */}
        <div className="ci-filter-group ci-filter-group--selects">
          {vdemOptions.length > 0 && (
            <label className="ci-filter-select-wrap">
              <span className="ci-filter-label">V-Dem regime</span>
              <select
                className="ci-filter-select"
                value={activeVdem ?? ""}
                onChange={(e) => go({ vdem: e.target.value || undefined })}
              >
                <option value="">All regimes</option>
                {vdemOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label} ({opt.scoredCount})
                  </option>
                ))}
              </select>
            </label>
          )}

          {worldBankRegionOptions.length > 0 && (
            <label className="ci-filter-select-wrap">
              <span className="ci-filter-label">World Bank region</span>
              <select
                className="ci-filter-select"
                value={activeWorldBankRegion ?? ""}
                onChange={(e) => go({ region: e.target.value || undefined })}
              >
                <option value="">All WB regions</option>
                {worldBankRegionOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label} ({opt.scoredCount})
                  </option>
                ))}
              </select>
            </label>
          )}

          {worldBankIncomeOptions.length > 0 && (
            <label className="ci-filter-select-wrap">
              <span className="ci-filter-label">Income group</span>
              <select
                className="ci-filter-select"
                value={activeWorldBankIncome ?? ""}
                onChange={(e) => go({ income: e.target.value || undefined })}
              >
                <option value="">All income groups</option>
                {worldBankIncomeOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label} ({opt.scoredCount})
                  </option>
                ))}
              </select>
            </label>
          )}

          {cgvOptions.length > 0 && (
            <label className="ci-filter-select-wrap">
              <span className="ci-filter-label">CGV regime</span>
              <select
                className="ci-filter-select"
                value={activeCgv ?? ""}
                onChange={(e) => go({ cgv: e.target.value || undefined })}
              >
                <option value="">All CGV regimes</option>
                {cgvOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label} ({opt.scoredCount})
                  </option>
                ))}
              </select>
            </label>
          )}

          {hasFilter ? (
            <button
              type="button"
              className="ci-filter-clear"
              onClick={() => router.push("/civica-index")}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </div>

      {/* Jump straight to a country's scorecard */}
      <div className="ci-filter-search">
        <CountrySearchCombobox
          countries={searchCountries}
          countryPathPrefix="/civica-index"
          placeholder="Jump to a country&hellip;"
          ariaLabel="Jump to a country's Civica Index scorecard"
        />
      </div>
    </div>
  );
}
