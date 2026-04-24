import Link from "next/link";
import { getStructuralFamilyDistribution } from "@/lib/db/queries";
import {
  STRUCTURAL_FAMILY_META,
  type StructuralFamilyKey,
} from "@/lib/government-taxonomy";

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
    <div className="ci-left-pane">
      <div className="ci-left-group">
        <div className="ci-left-group-label">Region</div>
        <Link
          href={
            structuralFamily
              ? `/civica-index?family=${encodeURIComponent(structuralFamily)}`
              : "/civica-index"
          }
          className={`ci-left-chip ${!continent ? "ci-left-chip--active" : ""}`}
          scroll={false}
        >
          <span>All regions</span>
        </Link>
        {CONTINENTS.map((c) => (
          <Link
            key={c}
            href={continentHref(c)}
            className={`ci-left-chip ${continent === c ? "ci-left-chip--active" : ""}`}
            scroll={false}
          >
            <span>{c}</span>
          </Link>
        ))}
      </div>

      {familyOptionsSorted.length > 0 && (
        <div className="ci-left-group">
          <div className="ci-left-group-label">Government type</div>
          <Link
            href={
              continent
                ? `/civica-index?continent=${encodeURIComponent(continent)}`
                : "/civica-index"
            }
            className={`ci-left-chip ${!structuralFamily ? "ci-left-chip--active" : ""}`}
            scroll={false}
          >
            <span>All types</span>
          </Link>
          {familyOptionsSorted.map((f) => {
            const meta = STRUCTURAL_FAMILY_META[f.key as StructuralFamilyKey];
            const label = meta?.label ?? f.key;
            return (
              <Link
                key={f.key}
                href={familyHref(f.key)}
                className={`ci-left-chip ${structuralFamily === f.key ? "ci-left-chip--active" : ""}`}
                scroll={false}
                title={`${f.totalCount} countries · ${f.scoredCount} with a Civica Index score`}
              >
                <span>{label}</span>
                <span className="ci-left-chip-count">
                  {f.scoredCount}/{f.totalCount}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
