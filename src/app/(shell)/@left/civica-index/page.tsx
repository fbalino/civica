import {
  getStructuralFamilyDistribution,
} from "@/lib/db/queries";
import { loadAtlasData } from "@/lib/atlas/load-atlas-data";
import {
  STRUCTURAL_FAMILY_META,
  type StructuralFamilyKey,
} from "@/lib/government-taxonomy";
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

export default async function CivicaIndexLeftSlot({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const continent =
    typeof sp?.continent === "string" ? sp.continent : undefined;
  const structuralFamily =
    typeof sp?.family === "string" ? sp.family : undefined;

  let familyOptions: Array<{
    key: string;
    totalCount: number;
    scoredCount: number;
  }> = [];
  try {
    familyOptions = await getStructuralFamilyDistribution();
  } catch {
    // DB not seeded
  }
  const familyOptionsSorted = [...familyOptions].sort((a, b) => {
    const orderA =
      STRUCTURAL_FAMILY_META[a.key as StructuralFamilyKey]?.order ?? 999;
    const orderB =
      STRUCTURAL_FAMILY_META[b.key as StructuralFamilyKey]?.order ?? 999;
    if (orderA !== orderB) return orderA - orderB;
    return b.totalCount - a.totalCount;
  });

  const { countries } = await loadAtlasData();

  const families = familyOptionsSorted.map((f) => {
    const meta = STRUCTURAL_FAMILY_META[f.key as StructuralFamilyKey];
    return {
      key: f.key,
      label: meta?.label ?? f.key,
      totalCount: f.totalCount,
      scoredCount: f.scoredCount,
    };
  });

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
            families={families}
            activeContinent={continent}
            activeFamily={structuralFamily}
          />
        </div>
      }
    />
  );
}
