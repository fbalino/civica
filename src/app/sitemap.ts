import type { MetadataRoute } from "next";
import { getAllJurisdictions } from "@/lib/db/queries";
import { getAllPosts } from "@/lib/blog";
import { ORGANIZATIONS } from "@/lib/data/international-organizations";
import { absoluteUrl, METADATA_CONTENT_RELEASE_DATE } from "@/lib/site";

type ChangeFrequency = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";

interface StaticRoute {
  path: string;
  changeFrequency: ChangeFrequency;
  priority: number;
}

// High-value country comparisons for sitemap coverage. Canonical URLs use
// query params; legacy /compare/<a>-vs-<b> URLs 308-redirect to these.
const PRIORITY_COMPARISONS: Array<[string, string]> = [
  ["united-states", "united-kingdom"],
  ["united-states", "china"],
  ["china", "india"],
  ["france", "germany"],
  ["united-states", "russia"],
  ["japan", "south-korea"],
  ["united-kingdom", "canada"],
  ["brazil", "argentina"],
  ["australia", "new-zealand"],
  ["india", "pakistan"],
];

const PUBLIC_STATIC_ROUTES: StaticRoute[] = [
  { path: "/", changeFrequency: "weekly", priority: 1.0 },
  { path: "/atlas", changeFrequency: "weekly", priority: 0.95 },
  { path: "/country", changeFrequency: "weekly", priority: 0.9 },
  { path: "/parties", changeFrequency: "weekly", priority: 0.8 },
  { path: "/compare", changeFrequency: "monthly", priority: 0.6 },
  { path: "/civica-index", changeFrequency: "weekly", priority: 0.95 },
  { path: "/civica-index/government-types", changeFrequency: "monthly", priority: 0.7 },
  { path: "/civica-index/methodology", changeFrequency: "monthly", priority: 0.7 },
  { path: "/civica-index/methodology/pca-appendix", changeFrequency: "monthly", priority: 0.5 },
  { path: "/civica-index/methodology/peer-grouping", changeFrequency: "monthly", priority: 0.6 },
  { path: "/civica-index/methodology/pulse", changeFrequency: "monthly", priority: 0.6 },
  { path: "/civica-index/methodology/pulse/backtest", changeFrequency: "monthly", priority: 0.5 },
  { path: "/civica-index/pulse-changelog", changeFrequency: "monthly", priority: 0.7 },
  { path: "/civica-index/corrections", changeFrequency: "monthly", priority: 0.4 },
  { path: "/civica-index/replication", changeFrequency: "monthly", priority: 0.5 },
  { path: "/civica-index/widget", changeFrequency: "monthly", priority: 0.4 },
  { path: "/methodology", changeFrequency: "monthly", priority: 0.7 },
  { path: "/policies", changeFrequency: "monthly", priority: 0.5 },
  { path: "/methodology/approach", changeFrequency: "monthly", priority: 0.6 },
  { path: "/methodology/provenance-coverage", changeFrequency: "weekly", priority: 0.6 },
  { path: "/country/methodology/reconciliation", changeFrequency: "monthly", priority: 0.6 },
  { path: "/country/methodology/reconciliation/disputes", changeFrequency: "weekly", priority: 0.5 },
  { path: "/api-docs", changeFrequency: "monthly", priority: 0.6 },
  { path: "/design-system", changeFrequency: "monthly", priority: 0.5 },
  { path: "/elections", changeFrequency: "weekly", priority: 0.7 },
  { path: "/elections/systems", changeFrequency: "monthly", priority: 0.6 },
  { path: "/civica-conditions", changeFrequency: "weekly", priority: 0.7 },
  { path: "/rankings", changeFrequency: "weekly", priority: 0.7 },
  { path: "/blog", changeFrequency: "weekly", priority: 0.7 },
  { path: "/about", changeFrequency: "monthly", priority: 0.4 },
  { path: "/about/advisory-board", changeFrequency: "monthly", priority: 0.4 },
  { path: "/about/advisory-board/apply", changeFrequency: "monthly", priority: 0.3 },
  { path: "/constitution", changeFrequency: "weekly", priority: 0.7 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.4 },
  { path: "/licensing", changeFrequency: "monthly", priority: 0.4 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
  { path: "/glossary", changeFrequency: "monthly", priority: 0.5 },
];

// Checked-in fallback for every route with no real per-row timestamp
// (static routes, organization pages, and comparison legs missing both
// `updatedAt`/`createdAt`). Never derive this from the request-time clock —
// `scripts/validate-metadata.ts` rejects argument-less `new Date()` here.
const FALLBACK_LAST_MODIFIED = new Date(METADATA_CONTENT_RELEASE_DATE);

type JurisdictionRow = Awaited<ReturnType<typeof getAllJurisdictions>>[number];

/** Most-recent stored timestamp for a jurisdiction row, falling back to the
 *  checked-in content-release date when neither column is populated. */
function jurisdictionLastModified(row: Pick<JurisdictionRow, "updatedAt" | "createdAt">): Date {
  return row.updatedAt ?? row.createdAt ?? FALLBACK_LAST_MODIFIED;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let countries: JurisdictionRow[] = [];
  try {
    countries = await getAllJurisdictions();
  } catch {
    // DB not available during build
  }

  const staticPages: MetadataRoute.Sitemap = PUBLIC_STATIC_ROUTES.map(
    ({ path, changeFrequency, priority }) => ({
      url: absoluteUrl(path),
      lastModified: FALLBACK_LAST_MODIFIED,
      changeFrequency,
      priority,
    })
  );

  // /country/[slug] is the single canonical per-country reader (Factbook ·
  // Civica Data · Constitution tabs). The legacy /factbook/[slug],
  // /countries/[slug], and /civica-index/[slug] surfaces 308-redirect here.
  // Each tab is a distinct indexable URL, so all three emit one entry per
  // country, sharing the same stored jurisdiction timestamp.
  const countryPages: MetadataRoute.Sitemap = countries.flatMap((country) => {
    const lastModified = jurisdictionLastModified(country);
    return [
      {
        url: absoluteUrl(`/country/${country.slug}`),
        lastModified,
        changeFrequency: "weekly" as const,
        priority: 0.9,
      },
      {
        url: absoluteUrl(`/country/${country.slug}/civica-data`),
        lastModified,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      },
      {
        url: absoluteUrl(`/country/${country.slug}/constitution`),
        lastModified,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      },
    ];
  });

  const organizationPages: MetadataRoute.Sitemap = ORGANIZATIONS.map((org) => ({
    url: absoluteUrl(`/organizations/${org.slug}`),
    lastModified: FALLBACK_LAST_MODIFIED,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  const posts = getAllPosts();
  const blogPages: MetadataRoute.Sitemap = posts.map((post) => ({
    url: absoluteUrl(`/blog/${post.slug}`),
    lastModified: new Date(post.date),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  const lastModifiedBySlug = new Map(
    countries.map((country) => [country.slug, jurisdictionLastModified(country)])
  );

  const comparisonPages: MetadataRoute.Sitemap = PRIORITY_COMPARISONS.map(([a, b]) => {
    const dateA = lastModifiedBySlug.get(a);
    const dateB = lastModifiedBySlug.get(b);
    const lastModified =
      dateA && dateB
        ? new Date(Math.max(dateA.getTime(), dateB.getTime()))
        : (dateA ?? dateB ?? FALLBACK_LAST_MODIFIED);
    return {
      url: absoluteUrl(`/compare?c=${encodeURIComponent(a)}&c=${encodeURIComponent(b)}`),
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    };
  });

  return [
    ...staticPages,
    ...comparisonPages,
    ...countryPages,
    ...organizationPages,
    ...blogPages,
  ];
}
