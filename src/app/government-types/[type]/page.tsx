import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getJurisdictionsByGovernmentTypePattern } from "@/lib/db/queries";
import {
  GOVERNMENT_TYPES,
  getGovernmentTypeBySlug,
} from "@/lib/data/government-types";
import { CountryFlag } from "@/components/CountryFlag";

const SITE_URL = "https://civica-kappa.vercel.app";

function formatPopulation(pop: number | null): string {
  if (!pop) return "";
  if (pop >= 1_000_000_000) return `${(pop / 1_000_000_000).toFixed(2)}B`;
  if (pop >= 1_000_000) return `${(pop / 1_000_000).toFixed(1)}M`;
  if (pop >= 1_000) return `${(pop / 1_000).toFixed(0)}K`;
  return pop.toLocaleString();
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
        padding: "var(--spacing-content-top) var(--spacing-page-x)",
      }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <a href="/government-types" className="breadcrumb">
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
      </a>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div
          className="gov-color-bar"
          style={{ background: gt.color, marginBottom: 16 }}
        />
        <h1
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "var(--text-52)",
            fontWeight: 400,
            letterSpacing: "var(--tracking-tighter)",
            margin: 0,
            lineHeight: 1,
            color: "var(--color-text-primary)",
          }}
          className="page-heading"
        >
          {gt.name}
        </h1>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: "var(--font-weight-mono)",
            fontSize: "var(--text-12)",
            color: gt.color,
            marginTop: 8,
          }}
        >
          {countries.length}{" "}
          {countries.length === 1 ? "country" : "countries"} worldwide
        </p>
      </div>

      {/* Definition */}
      <div className="cv-card" style={{ marginBottom: 24 }}>
        {gt.description.map((para, i) => (
          <p
            key={i}
            style={{
              fontFamily: "var(--font-body-sans)",
              fontSize: "var(--text-16)",
              color: "var(--color-text-85)",
              lineHeight: "var(--leading-relaxed)",
              margin: i === 0 ? 0 : "16px 0 0",
            }}
          >
            {para}
          </p>
        ))}
      </div>

      {/* Key Characteristics */}
      <div className="cv-card" style={{ marginBottom: 24 }}>
        <h2 className="section-header">Key Characteristics</h2>
        <ul
          style={{
            margin: 0,
            padding: 0,
            listStyle: "none",
          }}
        >
          {gt.characteristics.map((char, i) => (
            <li
              key={i}
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: "var(--font-weight-mono)",
                fontSize: "var(--text-12)",
                color: "var(--color-text-50)",
                padding: "7px 0",
                borderBottom:
                  i < gt.characteristics.length - 1
                    ? "1px solid var(--color-stat-border)"
                    : "none",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: gt.color,
                  flexShrink: 0,
                }}
              />
              {char}
            </li>
          ))}
        </ul>
      </div>

      {/* Countries List */}
      {countries.length > 0 && (
        <div>
          <h2 className="section-header" style={{ marginBottom: 16 }}>
            Countries with {gt.name} Government
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: 1,
              background: "var(--color-grid-bg)",
              borderRadius: "var(--radius-sm)",
              overflow: "hidden",
            }}
          >
            {/* Column header */}
            <div
              className="hidden md:grid"
              style={{
                background: "var(--color-card-bg)",
                padding: "10px 24px",
                cursor: "default",
                display: "grid",
                gridTemplateColumns: "48px minmax(0, 2fr) minmax(0, 1fr) 120px",
                alignItems: "center",
                gap: 16,
              }}
            >
              <span />
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontWeight: "var(--font-weight-mono)",
                  fontSize: "var(--text-10)",
                  letterSpacing: "var(--tracking-caps)",
                  textTransform: "uppercase",
                  color: "var(--color-text-25)",
                }}
              >
                Country
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontWeight: "var(--font-weight-mono)",
                  fontSize: "var(--text-10)",
                  letterSpacing: "var(--tracking-caps)",
                  textTransform: "uppercase",
                  color: "var(--color-text-25)",
                }}
              >
                Continent
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontWeight: "var(--font-weight-mono)",
                  fontSize: "var(--text-10)",
                  letterSpacing: "var(--tracking-caps)",
                  textTransform: "uppercase",
                  color: "var(--color-text-25)",
                  textAlign: "right",
                }}
              >
                Population
              </span>
            </div>
            {countries.map((country) => (
              <a
                key={country.slug}
                href={`/countries/${country.slug}`}
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  background: "var(--color-bg)",
                  padding: "16px 24px",
                  cursor: "pointer",
                  display: "grid",
                  gridTemplateColumns: "48px minmax(0, 2fr) minmax(0, 1fr) 120px",
                  alignItems: "center",
                  gap: 16,
                  transition: "background-color 0.15s ease",
                }}
                className="gov-type-row"
              >
                <CountryFlag iso2={country.iso2} size={28} />
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 12,
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontSize: "var(--text-18)",
                      fontWeight: 400,
                      color: "var(--color-text-primary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      minWidth: 0,
                    }}
                  >
                    {country.name}
                  </span>
                  <span
                    className="hidden sm:inline"
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontWeight: "var(--font-weight-mono)",
                      fontSize: "var(--text-11)",
                      color: "var(--color-text-25)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      minWidth: 0,
                    }}
                  >
                    {country.capital}
                  </span>
                </div>
                <span
                  className="hidden md:inline"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontWeight: "var(--font-weight-mono)",
                    fontSize: "var(--text-11)",
                    color: "var(--color-text-30)",
                  }}
                >
                  {country.continent ?? ""}
                </span>
                <span
                  className="hidden sm:inline"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontWeight: "var(--font-weight-mono)",
                    fontSize: "var(--text-11)",
                    color: "var(--color-text-40)",
                    textAlign: "right",
                  }}
                >
                  {country.population
                    ? formatPopulation(country.population)
                    : ""}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Compare CTA */}
      {countries.length >= 2 && (
        <div
          className="cv-card"
          style={{
            marginTop: 32,
            textAlign: "center",
            padding: "32px 24px",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "var(--text-22)",
              color: "var(--color-text-primary)",
              margin: "0 0 8px",
            }}
          >
            Compare two {gt.name.toLowerCase()} countries
          </p>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: "var(--font-weight-mono)",
              fontSize: "var(--text-12)",
              color: "var(--color-text-30)",
              margin: "0 0 20px",
            }}
          >
            See how {gt.name.toLowerCase()} governments differ across
            countries
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
    </div>
  );
}
