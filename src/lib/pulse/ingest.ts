import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, eq } from "drizzle-orm";
import { jurisdictions, pulseEvents } from "../db/schema";
import {
  fetchGdeltEvents,
  parseArticleDate,
  extractSourceName,
  type GdeltArticle,
} from "./gdelt";

export function createDb() {
  const sql = neon(process.env.DATABASE_URL!);
  return drizzle({ client: sql });
}
export type Db = ReturnType<typeof createDb>;

const EXPIRY_DAYS = 120;

export interface IngestSummary {
  fetched: number;
  inserted: number;
  skippedDuplicate: number;
  unmatchedCountry: number;
}

async function buildJurisdictionMap(db: Db): Promise<Map<string, string>> {
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

async function isDuplicate(
  db: Db,
  jurisdictionId: string,
  sourceUrl: string
): Promise<boolean> {
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
  db: Db,
  article: GdeltArticle,
  jurisdictionMap: Map<string, string>,
  summary: IngestSummary
) {
  const countryCode = article.sourcecountry?.toUpperCase();
  if (!countryCode) {
    summary.unmatchedCountry += 1;
    return;
  }
  const jurisdictionId = jurisdictionMap.get(countryCode);
  if (!jurisdictionId) {
    summary.unmatchedCountry += 1;
    return;
  }
  if (await isDuplicate(db, jurisdictionId, article.url)) {
    summary.skippedDuplicate += 1;
    return;
  }
  const eventDateObj = parseArticleDate(article.seendate);
  const expiresAtObj = new Date(eventDateObj.getTime() + EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  const eventDate = eventDateObj.toISOString().slice(0, 10);
  const expiresAt = expiresAtObj.toISOString().slice(0, 10);

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

  summary.inserted += 1;
}

export async function ingestPulseEvents(
  db: Db,
  opts: { hoursBack?: number } = {}
): Promise<IngestSummary> {
  const hoursBack = opts.hoursBack ?? 24;
  const articles = await fetchGdeltEvents(hoursBack);
  const jurisdictionMap = await buildJurisdictionMap(db);

  const summary: IngestSummary = {
    fetched: articles.length,
    inserted: 0,
    skippedDuplicate: 0,
    unmatchedCountry: 0,
  };
  for (const article of articles) {
    await ingestArticle(db, article, jurisdictionMap, summary);
  }
  return summary;
}
