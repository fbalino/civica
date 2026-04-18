import type { Metadata } from "next";
import { getAllJurisdictions } from "@/lib/db/queries";
import {
  GOVERNMENT_TYPES,
  matchGovernmentType,
} from "@/lib/data/government-types";

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

export default async function GovernmentTypesPage() {
  let countries: Awaited<ReturnType<typeof getAllJurisdictions>> = [];
  try {
    countries = await getAllJurisdictions();
  } catch {
    // DB not available
  }

  const typeCounts = new Map<string, number>();
  for (const c of countries) {
    const gt = matchGovernmentType(
      c.governmentTypeDetail ?? c.governmentType
    );
    if (gt) {
      typeCounts.set(gt.slug, (typeCounts.get(gt.slug) ?? 0) + 1);
    }
  }

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
        padding: "48px var(--spacing-page-x)",
      }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <a href="/countries" className="breadcrumb">
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
        All countries
      </a>

      <h1 className="page-heading">Government Types</h1>
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontWeight: "var(--font-weight-mono)",
          fontSize: "var(--text-12)",
          color: "var(--color-text-30)",
          marginBottom: 40,
        }}
      >
        {GOVERNMENT_TYPES.length} systems of government &middot;{" "}
        {countries.length} countries classified
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 1,
          background: "var(--color-grid-bg)",
          borderRadius: "var(--radius-sm)",
          overflow: "hidden",
        }}
      >
        {GOVERNMENT_TYPES.map((gt) => {
          const count = typeCounts.get(gt.slug) ?? 0;
          return (
            <a
              key={gt.slug}
              href={`/government-types/${gt.slug}`}
              className="country-grid-cell"
              style={{
                textDecoration: "none",
                color: "inherit",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div
                className="gov-color-bar"
                style={{ background: gt.color }}
              />
              <span
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "var(--text-20)",
                  color: "var(--color-text-primary)",
                }}
              >
                {gt.name}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontWeight: "var(--font-weight-mono)",
                  fontSize: "var(--text-11)",
                  color: "var(--color-text-30)",
                  lineHeight: "var(--leading-relaxed)",
                }}
              >
                {gt.description[0].split(". ").slice(0, 1).join(". ")}
                .
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontWeight: "var(--font-weight-mono)",
                  fontSize: "var(--text-10)",
                  color: gt.color,
                  marginTop: "auto",
                }}
              >
                {count} {count === 1 ? "country" : "countries"}
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
