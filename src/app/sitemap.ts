import type { MetadataRoute } from "next";
import { getAllJurisdictions } from "@/lib/db/queries";
import { getAllPosts } from "@/lib/blog";
import { ORGANIZATIONS } from "@/lib/data/international-organizations";

const SITE_URL = "https://civicaatlas.org";
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
  { path: "/atlas/compare", changeFrequency: "monthly", priority: 0.6 },
  { path: "/factbook", changeFrequency: "weekly", priority: 0.9 },
  { path: "/countries", changeFrequency: "weekly", priority: 0.9 },
  { path: "/compare", changeFrequency: "monthly", priority: 0.6 },
  { path: "/civica-index", changeFrequency: "weekly", priority: 0.95 },
  { path: "/civica-index/government-types", changeFrequency: "monthly", priority: 0.7 },
  { path: "/civica-index/methodology", changeFrequency: "monthly", priority: 0.7 },
  { path: "/civica-index/methodology/pca-appendix", changeFrequency: "monthly", priority: 0.5 },
  { path: "/civica-index/methodology/peer-grouping", changeFrequency: "monthly", priority: 0.6 },
  { path: "/civica-index/methodology/peer-grouping/migration", changeFrequency: "monthly", priority: 0.4 },
  { path: "/civica-index/methodology/pulse", changeFrequency: "monthly", priority: 0.6 },
  { path: "/civica-index/methodology/pulse/backtest", changeFrequency: "monthly", priority: 0.5 },
  { path: "/civica-index/pulse-changelog", changeFrequency: "daily", priority: 0.7 },
  { path: "/civica-index/corrections", changeFrequency: "monthly", priority: 0.4 },
  { path: "/civica-index/replication", changeFrequency: "monthly", priority: 0.5 },
  { path: "/civica-index/widget", changeFrequency: "monthly", priority: 0.4 },
  { path: "/methodology", changeFrequency: "monthly", priority: 0.7 },
  { path: "/methodology/approach", changeFrequency: "monthly", priority: 0.6 },
  { path: "/factbook/methodology/reconciliation", changeFrequency: "monthly", priority: 0.6 },
  { path: "/factbook/methodology/reconciliation/disputes", changeFrequency: "weekly", priority: 0.5 },
  { path: "/api-docs", changeFrequency: "monthly", priority: 0.6 },
  { path: "/design-system", changeFrequency: "monthly", priority: 0.5 },
  { path: "/elections", changeFrequency: "weekly", priority: 0.7 },
  { path: "/civica-conditions", changeFrequency: "weekly", priority: 0.7 },
  { path: "/rankings", changeFrequency: "weekly", priority: 0.7 },
  { path: "/blog", changeFrequency: "weekly", priority: 0.7 },
  { path: "/about", changeFrequency: "monthly", priority: 0.4 },
  { path: "/about/advisory-board", changeFrequency: "monthly", priority: 0.4 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.4 },
  { path: "/licensing", changeFrequency: "monthly", priority: 0.4 },
];

function urlForPath(path: string) {
  return path === "/" ? SITE_URL : `${SITE_URL}${path}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let countries: { slug: string }[] = [];
  try {
    countries = await getAllJurisdictions();
  } catch {
    // DB not available during build
  }

  const lastModified = new Date();

  const staticPages: MetadataRoute.Sitemap = PUBLIC_STATIC_ROUTES.map(
    ({ path, changeFrequency, priority }) => ({
      url: urlForPath(path),
      lastModified,
      changeFrequency,
      priority,
    })
  );

  // Both /factbook/[slug] and /countries/[slug] are indexed because both
  // remain live (per the factbook plan §2.2 — /countries stays alongside
  // /factbook). /factbook is the new canonical reader; /countries is the
  // legacy surface that may inform a future revamp.
  const factbookPages: MetadataRoute.Sitemap = countries.map((country) => ({
    url: `${SITE_URL}/factbook/${country.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.9,
  }));

  const countryPages: MetadataRoute.Sitemap = countries.map((country) => ({
    url: `${SITE_URL}/countries/${country.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const atlasCountryPages: MetadataRoute.Sitemap = countries.map((country) => ({
    url: `${SITE_URL}/atlas/${country.slug}/structure`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const civicaIndexCountryPages: MetadataRoute.Sitemap = countries.map((country) => ({
    url: `${SITE_URL}/civica-index/${country.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const organizationPages: MetadataRoute.Sitemap = ORGANIZATIONS.map((org) => ({
    url: `${SITE_URL}/atlas/organizations/${org.slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  const posts = getAllPosts();
  const blogPages: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  const comparisonPages: MetadataRoute.Sitemap = PRIORITY_COMPARISONS.map(
    ([a, b]) => ({
      url: `${SITE_URL}/compare?c=${encodeURIComponent(a)}&c=${encodeURIComponent(b)}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })
  );

  return [
    ...staticPages,
    ...comparisonPages,
    ...factbookPages,
    ...countryPages,
    ...atlasCountryPages,
    ...civicaIndexCountryPages,
    ...organizationPages,
    ...blogPages,
  ];
}
