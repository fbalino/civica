import type { Metadata } from "next";
import { getAllJurisdictions } from "@/lib/db/queries";
import {
  GOVERNMENT_TYPES,
  matchGovernmentType,
} from "@/lib/data/government-types";
import { CountryFlag } from "@/components/CountryFlag";

const SITE_URL = "https://civicaatlas.org";

export const metadata: Metadata = {
  title: "Government Types — Systems of Government Worldwide",
  description:
    "Explore every type of government system in the world. Presidential republics, constitutional monarchies, parliamentary democracies, and more. Interactive country lists and comparisons.",
  alternates: { canonical: `${SITE_URL}/government-types` },
  openGraph: {
    title:
      "Government Types — Systems of Government Worldwide | Civica",
    description:
      "Explore every type of government system in the world. Presidential republics, constitutional monarchies, parliamentary democracies, and more.",
    url: `${SITE_URL}/government-types`,
  },
};

function formatPopulation(pop: number): string {
  if (pop >= 1_000_000_000) return `${(pop / 1_000_000_000).toFixed(2)}B`;
  if (pop >= 1_000_000) return `${(pop / 1_000_000).toFixed(1)}M`;
  if (pop >= 1_000) return `${(pop / 1_000).toFixed(0)}K`;
  return pop.toLocaleString();
}

export default async function GovernmentTypesPage() {
  let countries: Awaited<ReturnType<typeof getAllJurisdictions>> = [];
  try {
    countries = await getAllJurisdictions();
  } catch {
    // DB not available
  }

  const typeCounts = new Map<string, number>();
  const typePopulations = new Map<string, number>();
  const typeExamples = new Map<string, typeof countries>();
  for (const c of countries) {
    const gt = matchGovernmentType(
      c.governmentTypeDetail ?? c.governmentType
    );
    if (gt) {
      typeCounts.set(gt.slug, (typeCounts.get(gt.slug) ?? 0) + 1);
      typePopulations.set(
        gt.slug,
        (typePopulations.get(gt.slug) ?? 0) + (c.population ?? 0)
      );
      const examples = typeExamples.get(gt.slug) ?? [];
      if (examples.length < 4) examples.push(c);
      typeExamples.set(gt.slug, examples);
    }
  }

  const classifiedCount = Array.from(typeCounts.values()).reduce(
    (s, n) => s + n,
    0
  );

  const sortedTypes = [...GOVERNMENT_TYPES].sort((a, b) => {
    const ca = typeCounts.get(a.slug) ?? 0;
    const cb = typeCounts.get(b.slug) ?? 0;
    return cb - ca;
  });

  const maxCount = Math.max(
    ...GOVERNMENT_TYPES.map((gt) => typeCounts.get(gt.slug) ?? 0),
    1
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Government Types",
    description:
      "Comprehensive guide to systems of government worldwide.",
    url: `${SITE_URL}/government-types`,
    isPartOf: {
      "@type": "WebSite",
      name: "Civica",
      url: SITE_URL,
    },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: GOVERNMENT_TYPES.map((gt, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: gt.name,
        url: `${SITE_URL}/government-types/${gt.slug}`,
      })),
    },
  };

  return (
    <div
      style={{
        maxWidth: "var(--max-w-content)",
        margin: "0 auto",
        padding: "0 var(--spacing-page-x)",
      }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero */}
      <header className="index-hero">
        <h1 className="hero-heading" style={{ marginBottom: 12 }}>
          Government Types
        </h1>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-18)",
            lineHeight: "var(--leading-relaxed)",
            color: "var(--color-text-40)",
            maxWidth: 640,
            margin: "0 0 32px",
          }}
        >
          A taxonomy of political systems — how power is structured,
          distributed, and transferred across sovereign states.
        </p>

        {countries.length > 0 && (
          <div className="index-stats-row">
            <div className="index-stat">
              <span className="index-stat__value">
                {GOVERNMENT_TYPES.length}
              </span>
              <span className="index-stat__label">Systems</span>
            </div>
            <div className="index-stat-divider" />
            <div className="index-stat">
              <span className="index-stat__value">{classifiedCount}</span>
              <span className="index-stat__label">Countries classified</span>
            </div>
            <div className="index-stat-divider" />
            <div className="index-stat">
              <span className="index-stat__value">
                {countries.length}
              </span>
              <span className="index-stat__label">Total in database</span>
            </div>
          </div>
        )}
      </header>

      {/* Distribution bar */}
      {countries.length > 0 && (
        <div className="govtypes-distribution">
          <div className="govtypes-distribution__bar">
            {sortedTypes.map((gt) => {
              const count = typeCounts.get(gt.slug) ?? 0;
              if (count === 0) return null;
              const pct = (count / classifiedCount) * 100;
              return (
                <a
                  key={gt.slug}
                  href={`/government-types/${gt.slug}`}
                  className="govtypes-distribution__segment"
                  style={{
                    width: `${Math.max(pct, 2)}%`,
                    background: gt.color,
                  }}
                  title={`${gt.name}: ${count} countries (${pct.toFixed(0)}%)`}
                />
              );
            })}
          </div>
          <div className="govtypes-distribution__legend">
            {sortedTypes.map((gt) => {
              const count = typeCounts.get(gt.slug) ?? 0;
              if (count === 0) return null;
              return (
                <a
                  key={gt.slug}
                  href={`/government-types/${gt.slug}`}
                  className="govtypes-legend-item"
                >
                  <span
                    className="govtypes-legend-dot"
                    style={{ background: gt.color }}
                  />
                  <span className="govtypes-legend-label">{gt.name}</span>
                  <span className="govtypes-legend-count">{count}</span>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Government type cards */}
      <div className="govtypes-grid">
        {sortedTypes.map((gt) => {
          const count = typeCounts.get(gt.slug) ?? 0;
          const pop = typePopulations.get(gt.slug) ?? 0;
          const examples = typeExamples.get(gt.slug) ?? [];
          const barWidth = Math.max(
            (count / maxCount) * 100,
            4
          );

          return (
            <a
              key={gt.slug}
              href={`/government-types/${gt.slug}`}
              className="govtype-card cv-card cv-card--interactive"
            >
              <div className="govtype-card__header">
                <div
                  className="gov-color-bar"
                  style={{ background: gt.color, marginBottom: 0 }}
                />
                <h2 className="govtype-card__name">{gt.name}</h2>
                <p className="govtype-card__excerpt">
                  {gt.description[0].split(". ").slice(0, 2).join(". ")}.
                </p>
              </div>

              <div className="govtype-card__footer">
                <div className="govtype-card__bar-row">
                  <div className="govtype-card__bar-track">
                    <div
                      className="govtype-card__bar-fill"
                      style={{
                        width: `${barWidth}%`,
                        background: gt.color,
                      }}
                    />
                  </div>
                  <span
                    className="govtype-card__count"
                    style={{ color: gt.color }}
                  >
                    {count}
                  </span>
                </div>

                {pop > 0 && (
                  <span className="govtype-card__pop">
                    {formatPopulation(pop)} people
                  </span>
                )}

                {examples.length > 0 && (
                  <div className="govtype-card__examples">
                    {examples.map((c) => (
                      <CountryFlag key={c.slug} iso2={c.iso2} size={18} />
                    ))}
                    {count > examples.length && (
                      <span className="govtype-card__more">
                        +{count - examples.length}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
