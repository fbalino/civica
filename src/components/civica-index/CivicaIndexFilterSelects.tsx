"use client";

import { useRouter } from "next/navigation";

interface FamilyOption {
  key: string;
  label: string;
  totalCount: number;
  scoredCount: number;
}

interface CivicaIndexFilterSelectsProps {
  continents: string[];
  families: FamilyOption[];
  activeContinent?: string;
  activeFamily?: string;
}

function buildHref(continent?: string, family?: string) {
  const qs = new URLSearchParams();
  if (continent) qs.set("continent", continent);
  if (family) qs.set("family", family);
  const q = qs.toString();
  return q ? `/civica-index?${q}` : "/civica-index";
}

export function CivicaIndexFilterSelects({
  continents,
  families,
  activeContinent,
  activeFamily,
}: CivicaIndexFilterSelectsProps) {
  const router = useRouter();

  return (
    <>
      <label className="civica-filter-select-wrap">
        <span className="left-filter-label">Region</span>
        <select
          className="civica-filter-select"
          value={activeContinent ?? ""}
          onChange={(event) => {
            router.push(buildHref(event.target.value || undefined, activeFamily));
          }}
        >
          <option value="">All regions</option>
          {continents.map((continent) => (
            <option key={continent} value={continent}>
              {continent}
            </option>
          ))}
        </select>
      </label>

      {families.length > 0 && (
        <label className="civica-filter-select-wrap">
          <span className="left-filter-label">Government type</span>
          <select
            className="civica-filter-select"
            value={activeFamily ?? ""}
            onChange={(event) => {
              router.push(
                buildHref(activeContinent, event.target.value || undefined)
              );
            }}
          >
            <option value="">All types</option>
            {families.map((family) => (
              <option key={family.key} value={family.key}>
                {family.label} ({family.scoredCount})
              </option>
            ))}
          </select>
        </label>
      )}
    </>
  );
}
