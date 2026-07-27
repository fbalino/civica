import { drizzle } from "drizzle-orm/neon-http";
import { and, eq } from "drizzle-orm";
import { jurisdictions, pulseEvents } from "../db/schema";
import {
  fetchGdeltEvents,
  parseArticleDate,
  extractSourceName,
  type GdeltArticle,
} from "./gdelt";
import { markSourcesSynced } from "../db/source-freshness";
import { createServerlessSql } from "../db";

export function createDb() {
  const sql = createServerlessSql(process.env.DATABASE_URL!);
  return drizzle({ client: sql });
}
export type Db = ReturnType<typeof createDb>;

const EXPIRY_DAYS = 120;

export interface IngestSummary {
  fetched: number;
  inserted: number;
  skippedDuplicate: number;
  unmatchedCountry: number;
  /** Top 5 `sourcecountry` values that failed to match, with hit counts.
   *  Surfaced in the cron-route response so GDELT/jurisdiction drift is
   *  visible without digging into logs. */
  unmatchedSample: Array<{ country: string; count: number }>;
}

async function buildJurisdictionMap(db: Db): Promise<Map<string, string>> {
  const rows = await db
    .select({
      id: jurisdictions.id,
      name: jurisdictions.name,
      iso2: jurisdictions.iso2,
      iso3: jurisdictions.iso3,
    })
    .from(jurisdictions);
  const map = new Map<string, string>();
  for (const row of rows) {
    if (row.iso2) map.set(row.iso2.toUpperCase(), row.id);
    if (row.iso3) map.set(row.iso3.toUpperCase(), row.id);
    // GDELT DOC 2.0 returns full country names in `sourcecountry`
    // (e.g. "United States", "United Kingdom"), not ISO codes — map those too.
    if (row.name) map.set(row.name.toUpperCase(), row.id);
  }
  // A few common GDELT country-name variants that don't match our canonical name.
  const aliases: Record<string, string | null> = {
    "UNITED STATES OF AMERICA": "UNITED STATES",
    "USA": "UNITED STATES",
    "US": "UNITED STATES",
    "UK": "UNITED KINGDOM",
    "BRITAIN": "UNITED KINGDOM",
    "GREAT BRITAIN": "UNITED KINGDOM",
    "RUSSIAN FEDERATION": "RUSSIA",
    "SOUTH KOREA": "KOREA, SOUTH",
    "NORTH KOREA": "KOREA, NORTH",
    "CZECH REPUBLIC": "CZECHIA",
    "MYANMAR (BURMA)": "BURMA",
    "MYANMAR": "BURMA",
    "CONGO (KINSHASA)": "DEMOCRATIC REPUBLIC OF THE CONGO",
    "CONGO (BRAZZAVILLE)": "REPUBLIC OF THE CONGO",
    "IVORY COAST": "COTE D'IVOIRE",
    "CAPE VERDE": "CABO VERDE",
  };
  for (const [alias, canonical] of Object.entries(aliases)) {
    if (!canonical) continue;
    const id = map.get(canonical.toUpperCase());
    if (id && !map.has(alias)) map.set(alias, id);
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
  summary: IngestSummary,
  unmatchedCounts: Map<string, number>
) {
  const rawCountry = article.sourcecountry?.trim();
  if (!rawCountry) {
    summary.unmatchedCountry += 1;
    unmatchedCounts.set("(empty)", (unmatchedCounts.get("(empty)") ?? 0) + 1);
    return;
  }
  const jurisdictionId = jurisdictionMap.get(rawCountry.toUpperCase());
  if (!jurisdictionId) {
    summary.unmatchedCountry += 1;
    unmatchedCounts.set(rawCountry, (unmatchedCounts.get(rawCountry) ?? 0) + 1);
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
    unmatchedSample: [],
  };
  const unmatchedCounts = new Map<string, number>();
  for (const article of articles) {
    await ingestArticle(db, article, jurisdictionMap, summary, unmatchedCounts);
  }
  summary.unmatchedSample = [...unmatchedCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([country, count]) => ({ country, count }));

  // Stamp the gdelt source freshness when rows were actually written.
  // Uses the sanctioned markSourcesSynced path so last_sync_at advances
  // only on a successful, non-empty pull (rowsWritten > 0 gate is inside
  // markSourcesSynced).
  await markSourcesSynced("gdelt", { rowsWritten: summary.inserted });

  return summary;
}
