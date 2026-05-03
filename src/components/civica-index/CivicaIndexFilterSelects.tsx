"use client";

import { useRouter } from "next/navigation";

interface LensOption {
  key: string;
  label: string;
  totalCount: number;
  scoredCount: number;
}

interface CivicaIndexFilterSelectsProps {
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
}

interface QueryShape {
  continent?: string;
  vdem?: string;
  region?: string;
  income?: string;
  cgv?: string;
}

function buildHref(q: QueryShape) {
  const qs = new URLSearchParams();
  if (q.continent) qs.set("continent", q.continent);
  if (q.vdem) qs.set("vdem", q.vdem);
  if (q.region) qs.set("region", q.region);
  if (q.income) qs.set("income", q.income);
  if (q.cgv) qs.set("cgv", q.cgv);
  const out = qs.toString();
  return out ? `/civica-index?${out}` : "/civica-index";
}

export function CivicaIndexFilterSelects({
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
}: CivicaIndexFilterSelectsProps) {
  const router = useRouter();
  const baseQuery: QueryShape = {
    continent: activeContinent,
    vdem: activeVdem,
    region: activeWorldBankRegion,
    income: activeWorldBankIncome,
    cgv: activeCgv,
  };

  return (
    <>
      <label className="civica-filter-select-wrap">
        <span className="left-filter-label">Region</span>
        <select
          className="civica-filter-select"
          value={activeContinent ?? ""}
          onChange={(e) =>
            router.push(
              buildHref({ ...baseQuery, continent: e.target.value || undefined }),
            )
          }
        >
          <option value="">All regions</option>
          {continents.map((continent) => (
            <option key={continent} value={continent}>
              {continent}
            </option>
          ))}
        </select>
      </label>

      {vdemOptions.length > 0 && (
        <label className="civica-filter-select-wrap">
          <span className="left-filter-label">V-Dem regime</span>
          <select
            className="civica-filter-select"
            value={activeVdem ?? ""}
            onChange={(e) =>
              router.push(
                buildHref({ ...baseQuery, vdem: e.target.value || undefined }),
              )
            }
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
        <label className="civica-filter-select-wrap">
          <span className="left-filter-label">World Bank region</span>
          <select
            className="civica-filter-select"
            value={activeWorldBankRegion ?? ""}
            onChange={(e) =>
              router.push(
                buildHref({ ...baseQuery, region: e.target.value || undefined }),
              )
            }
          >
            <option value="">All World Bank regions</option>
            {worldBankRegionOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label} ({opt.scoredCount})
              </option>
            ))}
          </select>
        </label>
      )}

      {worldBankIncomeOptions.length > 0 && (
        <label className="civica-filter-select-wrap">
          <span className="left-filter-label">Income group</span>
          <select
            className="civica-filter-select"
            value={activeWorldBankIncome ?? ""}
            onChange={(e) =>
              router.push(
                buildHref({ ...baseQuery, income: e.target.value || undefined }),
              )
            }
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
        <details className="civica-filter-advanced">
          <summary className="civica-filter-advanced-summary">
            Alternate regime lens (BR/CGV)
          </summary>
          <label className="civica-filter-select-wrap">
            <span className="left-filter-label">CGV regime</span>
            <select
              className="civica-filter-select"
              value={activeCgv ?? ""}
              onChange={(e) =>
                router.push(
                  buildHref({ ...baseQuery, cgv: e.target.value || undefined }),
                )
              }
            >
              <option value="">All CGV regimes</option>
              {cgvOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label} ({opt.scoredCount})
                </option>
              ))}
            </select>
          </label>
        </details>
      )}
    </>
  );
}
