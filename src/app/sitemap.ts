import type { MetadataRoute } from "next";
import { getAllJurisdictions } from "@/lib/db/queries";
import { getAllPosts } from "@/lib/blog";
import { GOVERNMENT_TYPES } from "@/lib/data/government-types";

const SITE_URL = "https://civicaatlas.org";

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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let countries: { slug: string }[] = [];
  try {
    countries = await getAllJurisdictions();
  } catch {
    // DB not available during build
  }

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/factbook`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/countries`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/compare`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/rankings`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/blog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${SITE_URL}/contact`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
    },
  ];

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

  const posts = getAllPosts();
  const blogPages: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.date),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  const govTypePages: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/government-types`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...GOVERNMENT_TYPES.map((gt) => ({
      url: `${SITE_URL}/government-types/${gt.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];

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
    ...govTypePages,
    ...comparisonPages,
    ...factbookPages,
    ...countryPages,
    ...blogPages,
  ];
}
