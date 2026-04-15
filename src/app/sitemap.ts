import type { MetadataRoute } from "next";
import { getAllJurisdictions } from "@/lib/db/queries";

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

  return [...staticPages, ...countryPages];
}
