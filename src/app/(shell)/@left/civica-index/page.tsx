import Link from "next/link";
import {
  getStructuralFamilyDistribution,
} from "@/lib/db/queries";
import { loadAtlasData } from "@/lib/atlas/load-atlas-data";
import {
  STRUCTURAL_FAMILY_META,
  type StructuralFamilyKey,
} from "@/lib/government-taxonomy";
import { ShellCountryRail } from "@/components/shell/ShellCountryRail";

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

  const continentHref = (c: string | null) => {
    const qs = new URLSearchParams();
    if (c) qs.set("continent", c);
    if (structuralFamily) qs.set("family", structuralFamily);
    const q = qs.toString();
    return q ? `/civica-index?${q}` : "/civica-index";
  };
  const familyHref = (f: string | null) => {
    const qs = new URLSearchParams();
    if (continent) qs.set("continent", continent);
    if (f) qs.set("family", f);
    const q = qs.toString();
    return q ? `/civica-index?${q}` : "/civica-index";
  };

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
          <div className="left-filter-group">
            <div className="left-filter-label">Region</div>
            <div className="chips">
              <Link
                href={
                  structuralFamily
                    ? `/civica-index?family=${encodeURIComponent(structuralFamily)}`
                    : "/civica-index"
                }
                className={`chip ${!continent ? "active" : ""}`}
                scroll={false}
              >
                All
              </Link>
              {CONTINENTS.map((c) => (
                <Link
                  key={c}
                  href={continentHref(c)}
                  className={`chip ${continent === c ? "active" : ""}`}
                  scroll={false}
                >
                  {c}
                </Link>
              ))}
            </div>
          </div>

          {familyOptionsSorted.length > 0 && (
            <div className="left-filter-group">
              <div className="left-filter-label">Government type</div>
              <div className="chips">
                <Link
                  href={
                    continent
                      ? `/civica-index?continent=${encodeURIComponent(continent)}`
                      : "/civica-index"
                  }
                  className={`chip ${!structuralFamily ? "active" : ""}`}
                  scroll={false}
                >
                  All
                </Link>
                {familyOptionsSorted.map((f) => {
                  const meta =
                    STRUCTURAL_FAMILY_META[f.key as StructuralFamilyKey];
                  const label = meta?.label ?? f.key;
                  return (
                    <Link
                      key={f.key}
                      href={familyHref(f.key)}
                      className={`chip ${structuralFamily === f.key ? "active" : ""}`}
                      scroll={false}
                      title={`${f.totalCount} countries · ${f.scoredCount} scored`}
                    >
                      {label}
                      <span className="chip-count">
                        {" "}
                        {f.scoredCount}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      }
    />
  );
}
