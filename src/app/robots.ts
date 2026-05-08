import type { MetadataRoute } from "next";

// AI training/scraper bots blocked entirely. Search-engine bots keep
// full access to canonical pages. Admin and cron paths disallowed.
const DISALLOWED_PATHS = [
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
