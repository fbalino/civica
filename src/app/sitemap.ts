import type { MetadataRoute } from "next";
import { getAllJurisdictions } from "@/lib/db/queries";
import { getAllPosts } from "@/lib/blog";
import { GOVERNMENT_TYPES } from "@/lib/data/government-types";

const SITE_URL = "https://civica-kappa.vercel.app";

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
  ];

  const countryPages: MetadataRoute.Sitemap = countries.map((country) => ({
    url: `${SITE_URL}/countries/${country.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
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

  return [...staticPages, ...govTypePages, ...countryPages, ...blogPages];
}
