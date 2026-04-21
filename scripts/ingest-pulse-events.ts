import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, and } from "drizzle-orm";
import { jurisdictions, pulseEvents } from "../src/lib/db/schema";
import {
  fetchGdeltEvents,
  parseArticleDate,
  extractSourceName,
  type GdeltArticle,
} from "../src/lib/pulse/gdelt";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: sql });

const EXPIRY_DAYS = 120;

async function buildJurisdictionMap(): Promise<Map<string, string>> {
  const rows = await db
    .select({ id: jurisdictions.id, iso2: jurisdictions.iso2, iso3: jurisdictions.iso3 })
    .from(jurisdictions);

  const map = new Map<string, string>();
  for (const row of rows) {
    if (row.iso2) map.set(row.iso2.toUpperCase(), row.id);
    if (row.iso3) map.set(row.iso3.toUpperCase(), row.id);
  }
  return map;
}

async function isDuplicate(jurisdictionId: string, sourceUrl: string): Promise<boolean> {
  const existing = await db
    .select({ id: pulseEvents.id })
    .from(pulseEvents)
    .where(
      and(
        eq(pulseEvents.jurisdictionId, jurisdictionId),
        eq(pulseEvents.sourceUrl, sourceUrl)
      )
    )
    .limit(1);
  return existing.length > 0;
}

async function ingestArticle(
  article: GdeltArticle,
  jurisdictionMap: Map<string, string>,
  stats: { inserted: number; skipped: number; unmatched: number }
): Promise<void> {
  const countryCode = article.sourcecountry?.toUpperCase();
  if (!countryCode) {
    stats.unmatched++;
    return;
  }

  const jurisdictionId = jurisdictionMap.get(countryCode);
  if (!jurisdictionId) {
    stats.unmatched++;
    return;
  }

  if (await isDuplicate(jurisdictionId, article.url)) {
    stats.skipped++;
    return;
  }

  const eventDate = parseArticleDate(article.seendate);
  const expiresAt = new Date(eventDate.getTime() + EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(pulseEvents).values({
    jurisdictionId,
    eventDate,
    category: "unclassified",
    severity: 0,
    confidence: 0,
    justification: "",
    headline: article.title,
    sourceUrl: article.url,
    sourceName: extractSourceName(article.domain),
    llmModel: "",
    rawEventData: article as unknown as Record<string, unknown>,
    isActive: true,
    expiresAt,
  });

  stats.inserted++;
}

async function main() {
  console.log("=== Civica Pulse: GDELT Event Ingest ===\n");

  console.log("Fetching GDELT articles (last 24h)...");
  const articles = await fetchGdeltEvents(24);
  console.log(`Fetched ${articles.length} articles\n`);

  console.log("Loading jurisdiction map...");
  const jurisdictionMap = await buildJurisdictionMap();
  console.log(`Loaded ${jurisdictionMap.size} jurisdiction codes\n`);

  const stats = { inserted: 0, skipped: 0, unmatched: 0 };

  for (const article of articles) {
    await ingestArticle(article, jurisdictionMap, stats);
  }

  console.log("=== Ingest Complete ===");
  console.log(`Inserted:  ${stats.inserted}`);
  console.log(`Skipped (duplicate): ${stats.skipped}`);
  console.log(`Unmatched (no jurisdiction): ${stats.unmatched}`);
}

main().catch((err) => {
  console.error("Ingest failed:", err);
  process.exit(1);
});
