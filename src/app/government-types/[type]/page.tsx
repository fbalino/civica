import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getJurisdictionsByGovernmentTypePattern } from "@/lib/db/queries";
import {
  GOVERNMENT_TYPES,
  getGovernmentTypeBySlug,
} from "@/lib/data/government-types";
import { CountryFlag } from "@/components/CountryFlag";

const SITE_URL = "https://civicaatlas.org";

function formatPopulation(pop: number | null): string {
  if (!pop) return "";
  if (pop >= 1_000_000_000) return `${(pop / 1_000_000_000).toFixed(2)}B`;
  if (pop >= 1_000_000) return `${(pop / 1_000_000).toFixed(1)}M`;
  if (pop >= 1_000) return `${(pop / 1_000).toFixed(0)}K`;
  return pop.toLocaleString();
}

function formatLargeNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  return n.toLocaleString();
}

export async function generateStaticParams() {
  return GOVERNMENT_TYPES.map((gt) => ({ type: gt.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ type: string }>;
}): Promise<Metadata> {
  const { type } = await params;
  const gt = getGovernmentTypeBySlug(type);
  if (!gt) return { title: "Government Type Not Found" };

  let count = 0;
  try {
    const countries = await getJurisdictionsByGovernmentTypePattern(
      gt.dbPatterns
    );
    count = countries.length;
  } catch {
    // DB unavailable
  }

  const title = `${gt.name} — Countries, Definition & Examples`;
  const description = `Learn about ${gt.name.toLowerCase()} systems. Explore all ${count} countries with ${gt.name.toLowerCase()} governments. Interactive visualizations and comparisons.`;
  const url = `${SITE_URL}/government-types/${type}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: `${title} | Civica`,
      description,
      url,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Civica`,
      description,
    },
  };
}

export default async function GovernmentTypePage({
  params,
}: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;
  const gt = getGovernmentTypeBySlug(type);
  if (!gt) notFound();

  let countries: Awaited<
    ReturnType<typeof getJurisdictionsByGovernmentTypePattern>
  > = [];
  try {
    countries = await getJurisdictionsByGovernmentTypePattern(
      gt.dbPatterns
    );
  } catch {
    // DB unavailable
  }

  const totalPop = countries.reduce((s, c) => s + (c.population ?? 0), 0);
  const largest = countries[0];
  const continentCounts = new Map<string, number>();
  for (const c of countries) {
    const cont = c.continent ?? "Other";
    continentCounts.set(cont, (continentCounts.get(cont) ?? 0) + 1);
  }
  const sortedContinents = [...continentCounts.entries()].sort(
    (a, b) => b[1] - a[1]
  );

  const currentIndex = GOVERNMENT_TYPES.findIndex(
    (g) => g.slug === gt.slug
  );
  const prevType =
    currentIndex > 0 ? GOVERNMENT_TYPES[currentIndex - 1] : null;
  const nextType =
    currentIndex < GOVERNMENT_TYPES.length - 1
      ? GOVERNMENT_TYPES[currentIndex + 1]
      : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${gt.name} — Countries, Definition & Examples`,
    description: gt.description[0],
    url: `${SITE_URL}/government-types/${type}`,
    isPartOf: {
      "@type": "WebSite",
      name: "Civica",
      url: SITE_URL,
    },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: SITE_URL,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Government Types",
          item: `${SITE_URL}/government-types`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: gt.name,
          item: `${SITE_URL}/government-types/${type}`,
        },
      ],
    },
    mainEntity: {
      "@type": "ItemList",
      name: `Countries with ${gt.name} government`,
      numberOfItems: countries.length,
      itemListElement: countries.slice(0, 20).map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: c.name,
        url: `${SITE_URL}/countries/${c.slug}`,
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
        <Link href="/government-types" className="breadcrumb">
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 12L6 8l4-4" />
          </svg>
          All government types
        </Link>

        <div
          className="gov-color-bar"
          style={{
            background: gt.color,
            width: 48,
            height: 4,
            marginBottom: 16,
          }}
        />
        <h1 className="hero-heading" style={{ marginBottom: 12 }}>
          {gt.name}
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
          {gt.description[0].split(". ").slice(0, 2).join(". ")}.
        </p>

        {countries.length > 0 && (
          <div className="index-stats-row">
            <div className="index-stat">
              <span
                className="index-stat__value"
                style={{ color: gt.color }}
              >
                {countries.length}
              </span>
              <span className="index-stat__label">Countries</span>
            </div>
            <div className="index-stat-divider" />
            <div className="index-stat">
              <span className="index-stat__value">
                {formatLargeNumber(totalPop)}
              </span>
              <span className="index-stat__label">Total population</span>
            </div>
            {largest && (
              <>
                <div className="index-stat-divider" />
                <div className="index-stat">
                  <span className="index-stat__value">{largest.name}</span>
                  <span className="index-stat__label">
                    Largest by population
                  </span>
                </div>
              </>
            )}
            <div className="index-stat-divider" />
            <div className="index-stat">
              <span className="index-stat__value">
                {sortedContinents.length}
              </span>
              <span className="index-stat__label">Continents</span>
            </div>
          </div>
        )}
      </header>

      {/* About + Characteristics side-by-side */}
      <div className="govtype-detail-grid">
        <div className="cv-card">
          <h2 className="section-header">Definition</h2>
          {gt.description.map((para, i) => (
            <p
              key={i}
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-16)",
                color: "var(--color-text-60)",
                lineHeight: "var(--leading-relaxed)",
                margin: i === 0 ? 0 : "16px 0 0",
              }}
            >
              {para}
            </p>
          ))}
        </div>

        <div>
          <div className="cv-card" style={{ marginBottom: 16 }}>
            <h2 className="section-header">Key Characteristics</h2>
            <ul className="govtype-char-list">
              {gt.characteristics.map((char, i) => (
                <li key={i} className="govtype-char-item">
                  <span
                    className="govtype-char-dot"
                    style={{ background: gt.color }}
                  />
                  {char}
                </li>
              ))}
            </ul>
          </div>

          {/* Regional distribution */}
          {sortedContinents.length > 0 && (
            <div className="cv-card">
              <h2 className="section-header">Regional Distribution</h2>
              {sortedContinents.map(([continent, count]) => {
                const pct = Math.round(
                  (count / countries.length) * 100
                );
                return (
                  <div key={continent} className="govtype-region-row">
                    <span className="govtype-region-name">
                      {continent}
                    </span>
                    <div className="govtype-region-bar-track">
                      <div
                        className="govtype-region-bar-fill"
                        style={{
                          width: `${pct}%`,
                          background: gt.color,
                        }}
                      />
                    </div>
                    <span className="govtype-region-count">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Countries — card grid matching the countries index */}
      {countries.length > 0 && (
        <section style={{ marginTop: 48 }}>
          <div className="index-continent-header">
            <h2 className="index-continent-title">
              Countries with {gt.name} Government
            </h2>
            <div className="index-continent-meta">
              <span>
                {countries.length}{" "}
                {countries.length === 1 ? "country" : "countries"}
              </span>
              {totalPop > 0 && (
                <>
                  <span className="index-continent-meta-dot">
                    &middot;
                  </span>
                  <span>{formatLargeNumber(totalPop)} people</span>
                </>
              )}
            </div>
          </div>

          <div className="index-card-grid">
            {countries.map((country) => (
              <a
                key={country.slug}
                href={`/countries/${country.slug}`}
                className="index-country-card cv-card cv-card--interactive"
              >
                <div className="index-card-top">
                  <CountryFlag iso2={country.iso2} size={36} />
                  <div className="index-card-name-block">
                    <span className="index-card-name">
                      {country.name}
                    </span>
                    {country.capital && (
                      <span className="index-card-capital">
                        {country.capital}
                      </span>
                    )}
                  </div>
                </div>

                <div className="index-card-bottom">
                  <span className="index-card-datum">
                    {country.continent ?? ""}
                  </span>
                  <div className="index-card-data">
                    {country.population ? (
                      <span className="index-card-datum">
                        {formatPopulation(country.population)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Compare CTA */}
      {countries.length >= 2 && (
        <div
          className="cv-card"
          style={{
            marginTop: 48,
            textAlign: "center",
            padding: "40px 24px",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "var(--text-24)",
              color: "var(--color-text-primary)",
              margin: "0 0 8px",
            }}
          >
            Compare {gt.name.toLowerCase()} countries
          </p>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: "var(--font-weight-mono)",
              fontSize: "var(--text-12)",
              color: "var(--color-text-30)",
              margin: "0 0 24px",
            }}
          >
            See how governance differs across {countries.length} countries
            sharing the same system
          </p>
          <a
            href={
              countries.length >= 2
                ? `/compare?a=${countries[0].slug}&b=${countries[1].slug}`
                : "/compare"
            }
            className="compare-btn"
            style={{ textDecoration: "none", display: "inline-block" }}
          >
            Compare Countries
          </a>
        </div>
      )}

      {/* Prev/Next nav */}
      {(prevType || nextType) && (
        <nav className="govtype-nav">
          {prevType ? (
            <a
              href={`/government-types/${prevType.slug}`}
              className="govtype-nav__link"
            >
              <span className="govtype-nav__dir">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10 12L6 8l4-4" />
                </svg>
                Previous
              </span>
              <span className="govtype-nav__name">{prevType.name}</span>
            </a>
          ) : (
            <span />
          )}
          {nextType ? (
            <a
              href={`/government-types/${nextType.slug}`}
              className="govtype-nav__link govtype-nav__link--next"
            >
              <span className="govtype-nav__dir">
                Next
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 4l4 4-4 4" />
                </svg>
              </span>
              <span className="govtype-nav__name">{nextType.name}</span>
            </a>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
