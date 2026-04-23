import Link from "next/link";
import { loadAtlasData } from "@/lib/atlas/load-atlas-data";
import { slugToCountry } from "@/lib/atlas/ids";

const REGION_ORDER = ["Americas", "Europe", "Africa", "Asia", "Oceania"];

export default async function AtlasCountryLeftSlot({
  params,
}: {
  params: Promise<{ slug: string; tab: string }>;
}) {
  const { slug, tab } = await params;
  const { countries } = await loadAtlasData();
  const active = slugToCountry(slug, countries);
  const activeId = active?.id ?? null;

  return (
    <div className="chamber-left">
      <div className="left-side-head">
        <Link href="/atlas" className="back-btn" style={{ textDecoration: "none" }}>
          ← Atlas map
        </Link>
        <div className="kicker">Atlas</div>
        <div className="title">Pick a country</div>
      </div>
      <div className="left-country-list">
        {REGION_ORDER.map((region) => {
          const items = countries.filter((c) => c.region === region);
          if (!items.length) return null;
          return (
            <div key={region} className="region-group">
              <div className="region-label">{region}</div>
              {items.map((c) => {
                const isActive = c.id === activeId;
                return (
                  <Link
                    key={c.id}
                    href={`/atlas/${c.slug}/${tab}`}
                    className={`country-row${isActive ? " on" : ""}`}
                    style={{ textDecoration: "none", color: "inherit" }}
                  >
                    <span>
                      {c.name}
                      {c.featured ? " ★" : ""}
                    </span>
                    <span className="code">{c.id.toUpperCase()}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
