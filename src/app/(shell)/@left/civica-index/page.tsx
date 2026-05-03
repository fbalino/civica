import {
  getWorldBankRegionDistribution,
  getWorldBankIncomeGroupDistribution,
  getVDemRowDistribution,
  getCgvRegimeDistribution,
} from "@/lib/db/queries-peer-grouping";
import { loadAtlasData } from "@/lib/atlas/load-atlas-data";
import {
  WORLD_BANK_REGION_META,
  WORLD_BANK_INCOME_GROUP_META,
  VDEM_ROW_META,
  CGV_REGIME_TYPE_META,
  type WorldBankRegionKey,
  type WorldBankIncomeGroupKey,
  type VDemRowKey,
  type CGVRegimeTypeKey,
} from "@/lib/peer-grouping/lens-metadata";
import { ShellCountryRail } from "@/components/shell/ShellCountryRail";
import { CivicaIndexFilterSelects } from "@/components/civica-index/CivicaIndexFilterSelects";

const CONTINENTS = [
  "Africa",
  "North America",
  "South America",
  "Asia",
  "Europe",
  "Oceania",
];

interface RawDistRow {
  key: string;
  totalCount: number;
  scoredCount: number;
}

function decorateOptions<K extends string>(
  raw: RawDistRow[],
  meta: Record<K, { label: string; order: number }>,
): Array<{ key: string; label: string; totalCount: number; scoredCount: number }> {
  return [...raw]
    .sort((a, b) => {
      const orderA = meta[a.key as K]?.order ?? 999;
      const orderB = meta[b.key as K]?.order ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return b.totalCount - a.totalCount;
    })
    .map((r) => ({
      key: r.key,
      label: meta[r.key as K]?.label ?? r.key,
      totalCount: r.totalCount,
      scoredCount: r.scoredCount,
    }));
}

export default async function CivicaIndexLeftSlot({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const continent =
    typeof sp?.continent === "string" ? sp.continent : undefined;
  const vdem = typeof sp?.vdem === "string" ? sp.vdem : undefined;
  const region = typeof sp?.region === "string" ? sp.region : undefined;
  const income = typeof sp?.income === "string" ? sp.income : undefined;
  const cgv = typeof sp?.cgv === "string" ? sp.cgv : undefined;

  let vdemRaw: RawDistRow[] = [];
  let regionRaw: RawDistRow[] = [];
  let incomeRaw: RawDistRow[] = [];
  let cgvRaw: RawDistRow[] = [];
  try {
    [vdemRaw, regionRaw, incomeRaw, cgvRaw] = await Promise.all([
      getVDemRowDistribution(),
      getWorldBankRegionDistribution(),
      getWorldBankIncomeGroupDistribution(),
      getCgvRegimeDistribution(),
    ]);
  } catch {
    // DB not seeded
  }

  const vdemOptions = decorateOptions<VDemRowKey>(vdemRaw, VDEM_ROW_META);
  const worldBankRegionOptions = decorateOptions<WorldBankRegionKey>(
    regionRaw,
    WORLD_BANK_REGION_META,
  );
  const worldBankIncomeOptions = decorateOptions<WorldBankIncomeGroupKey>(
    incomeRaw,
    WORLD_BANK_INCOME_GROUP_META,
  );
  const cgvOptions = decorateOptions<CGVRegimeTypeKey>(
    cgvRaw,
    CGV_REGIME_TYPE_META,
  );

  const { countries } = await loadAtlasData();

  return (
    <ShellCountryRail
      countries={countries}
      selectedId={null}
      hrefMode={{ type: "civica-index" }}
      header={
        <>
          <div className="kicker">Civica Index</div>
          <div className="title">Pick a country</div>
        </>
      }
      filters={
        <div className="left-filter-block">
          <CivicaIndexFilterSelects
            continents={CONTINENTS}
            vdemOptions={vdemOptions}
            worldBankRegionOptions={worldBankRegionOptions}
            worldBankIncomeOptions={worldBankIncomeOptions}
            cgvOptions={cgvOptions}
            activeContinent={continent}
            activeVdem={vdem}
            activeWorldBankRegion={region}
            activeWorldBankIncome={income}
            activeCgv={cgv}
          />
        </div>
      }
    />
  );
}
