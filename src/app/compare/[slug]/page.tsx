import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getJurisdictionsBySlugs,
  getGovernmentStructure,
} from "@/lib/db/queries";
import { CompareTable } from "../CompareTable";

const SITE_URL = "https://civicaatlas.org";

export const PRIORITY_COMPARISONS = [
  "united-states-vs-united-kingdom",
  "united-states-vs-china",
  "china-vs-india",
  "france-vs-germany",
  "united-states-vs-russia",
  "japan-vs-south-korea",
  "united-kingdom-vs-canada",
  "brazil-vs-argentina",
  "australia-vs-new-zealand",
  "india-vs-pakistan",
];

function parseComparisonSlug(slug: string): [string, string] | null {
  const parts = slug.split("-vs-");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return [parts[0], parts[1]];
}

export async function generateStaticParams() {
  return PRIORITY_COMPARISONS.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const parsed = parseComparisonSlug(slug);
  if (!parsed) return { title: "Comparison Not Found" };

  let countries: Awaited<ReturnType<typeof getJurisdictionsBySlugs>> = [];
  try {
    countries = await getJurisdictionsBySlugs(parsed);
  } catch {}

  if (countries.length < 2) {
    const [a, b] = parsed;
    const nameA = a
      .split("-")
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(" ");
    const nameB = b
      .split("-")
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(" ");
    return {
      title: `${nameA} vs ${nameB} Government Structure — Side-by-Side Comparison`,
    };
  }

  const sortedCountries = parsed.map((s) =>
    countries.find((c) => c.slug === s)
  );
  const nameA = sortedCountries[0]?.name ?? parsed[0];
  const nameB = sortedCountries[1]?.name ?? parsed[1];

  const title = `${nameA} vs ${nameB} Government Structure — Side-by-Side Comparison`;
  const description = `Compare the government structures of ${nameA} and ${nameB}. Side-by-side analysis of executive, legislative, and judicial branches.`;
  const url = `${SITE_URL}/compare/${slug}`;

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

export default async function CompareSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const parsed = parseComparisonSlug(slug);
  if (!parsed) notFound();

  let countries: Awaited<ReturnType<typeof getJurisdictionsBySlugs>> = [];
  try {
    countries = await getJurisdictionsBySlugs(parsed);
  } catch {}

  const selected = parsed
    .map((s) => countries.find((c) => c.slug === s))
    .filter(Boolean) as typeof countries;

  if (selected.length < 2) notFound();

  const govStructures = await Promise.all(
    selected.map((s) => getGovernmentStructure(s.id))
  );

  const nameA = selected[0].name;
  const nameB = selected[1].name;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${nameA} vs ${nameB} Government Structure`,
    description: `Compare the government structures of ${nameA} and ${nameB}. Side-by-side analysis of executive, legislative, and judicial branches.`,
    url: `${SITE_URL}/compare/${slug}`,
    isPartOf: {
      "@type": "WebSite",
      name: "Civica",
      url: SITE_URL,
    },
    about: [
      {
        "@type": "Country",
        name: nameA,
        ...(selected[0].iso2 ? { identifier: selected[0].iso2 } : {}),
      },
      {
        "@type": "Country",
        name: nameB,
        ...(selected[1].iso2 ? { identifier: selected[1].iso2 } : {}),
      },
    ],
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
          name: "Compare",
          item: `${SITE_URL}/compare`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: `${nameA} vs ${nameB}`,
          item: `${SITE_URL}/compare/${slug}`,
        },
      ],
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

      <a href="/compare" className="breadcrumb">
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
        Compare countries
      </a>

      <h1 className="page-heading">
        {nameA} vs {nameB}
      </h1>
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontWeight: "var(--font-weight-mono)",
          fontSize: "var(--text-12)",
          color: "var(--color-text-30)",
          marginBottom: 32,
        }}
      >
        Government structure comparison &middot; Side by side
      </p>

      <CompareTable selected={selected} govStructures={govStructures} />

      <div
        style={{
          display: "flex",
          gap: 12,
          marginTop: 32,
          flexWrap: "wrap",
        }}
      >
        {selected.map((country) => (
          <a
            key={country.slug}
            href={`/countries/${country.slug}`}
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: "var(--font-weight-mono)",
              fontSize: "var(--text-12)",
              color: "var(--color-accent)",
              textDecoration: "none",
              padding: "8px 16px",
              border: "1px solid var(--color-card-border)",
              borderRadius: "var(--radius-sm)",
              transition: "border-color 0.15s ease",
            }}
          >
            View {country.name} →
          </a>
        ))}
      </div>
    </div>
  );
}
