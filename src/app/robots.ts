import type { MetadataRoute } from "next";

// Crawler-trap protection. The public data-disputes log at
// /factbook/methodology/reconciliation/disputes exposes 6 filter
// dimensions × pagination, so naive crawlers walk a near-infinite
// permutation space. Disallow it outright (canonical content lives
// on the parent reconciliation methodology page).
//
// AI training/scraper bots are blocked entirely. Search-engine bots
// keep full access to canonical pages.
const DISALLOWED_PATHS = [
  "/factbook/methodology/reconciliation/disputes",
  "/factbook/methodology/reconciliation/disputes/*",
  "/admin",
  "/admin/*",
  "/api/admin",
  "/api/admin/*",
  "/api/cron",
  "/api/cron/*",
];

const BLOCKED_AI_BOTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "CCBot",
  "Google-Extended",
  "PerplexityBot",
  "Bytespider",
  "ByteDance",
  "Amazonbot",
  "Applebot-Extended",
  "FacebookBot",
  "Diffbot",
  "ImagesiftBot",
  "Omgilibot",
  "DataForSeoBot",
  "AhrefsBot",
  "SemrushBot",
  "MJ12bot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: DISALLOWED_PATHS,
      },
      ...BLOCKED_AI_BOTS.map((userAgent) => ({
        userAgent,
        disallow: "/",
      })),
    ],
    sitemap: "https://civicaatlas.org/sitemap.xml",
  };
}
