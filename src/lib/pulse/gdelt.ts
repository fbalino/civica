import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, and, sql as dsql } from "drizzle-orm";
import { jurisdictions, pulseEvents } from "../db/schema";

export function createDb() {
  const sqlClient = neon(process.env.DATABASE_URL!);
  return drizzle({ client: sqlClient });
}

export type Db = ReturnType<typeof createDb>;

const GOVERNANCE_TERMS = [
  "government",
  "parliament",
  "election",
  "coup",
  "protest",
  "reform",
  "constitutional",
  "military",
  "sanctions",
  "rights",
  "corruption",
  "democracy",
  "authoritarian",
  "referendum",
  "judiciary",
];

interface GdeltArticle {
  url: string;
  title: string;
  seendate: string;
  domain: string;
  language: string;
  sourcecountry: string;
}

interface GdeltResponse {
  articles?: GdeltArticle[];
}

export interface IngestionSummary {
  fetched: number;
  ingested: number;
  skippedNoMatch: number;
  skippedDuplicate: number;
}

async function buildIso2Map(db: Db): Promise<Map<string, string>> {
  const rows = await db
    .select({ id: jurisdictions.id, iso2: jurisdictions.iso2 })
    .from(jurisdictions)
    .where(dsql`${jurisdictions.iso2} IS NOT NULL`);
  const map = new Map<string, string>();
  for (const r of rows) {
    if (r.iso2) map.set(r.iso2.toUpperCase(), r.id);
  }
  return map;
}

async function existingSourceUrls(
  db: Db,
  urls: string[]
): Promise<Set<string>> {
  if (urls.length === 0) return new Set();
  const rows = await db
    .select({ sourceUrl: pulseEvents.sourceUrl })
    .from(pulseEvents)
    .where(
      dsql`${pulseEvents.sourceUrl} IN (${dsql.join(
        urls.map((u) => dsql`${u}`),
        dsql`, `
      )})`
    );
  return new Set(rows.map((r) => r.sourceUrl).filter(Boolean) as string[]);
}

function parseGdeltDate(seendate: string): string {
  const cleaned = seendate.replace(/T.*/, "").replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3");
  const d = new Date(cleaned);
  if (isNaN(d.getTime())) return new Date().toISOString().split("T")[0];
  return d.toISOString().split("T")[0];
}

function expiresAt(eventDate: string): string {
  const d = new Date(eventDate);
  d.setDate(d.getDate() + 120);
  return d.toISOString().split("T")[0];
}

export async function fetchGdeltArticles(
  timespan = "24h",
  maxRecords = 250
): Promise<GdeltArticle[]> {
  const query = GOVERNANCE_TERMS.join(" OR ");
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=artlist&maxrecords=${maxRecords}&timespan=${timespan}&format=json&sort=datedesc`;

  console.log(`[gdelt] Fetching up to ${maxRecords} articles (${timespan} window)...`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GDELT API returned ${res.status}: ${await res.text()}`);
  }

  const data: GdeltResponse = await res.json();
  const articles = data.articles ?? [];
  console.log(`[gdelt] Received ${articles.length} articles from GDELT.`);
  return articles;
}

export async function ingestPulseEvents(
  db: Db,
  articles: GdeltArticle[]
): Promise<IngestionSummary> {
  const iso2Map = await buildIso2Map(db);

  const urls = articles.map((a) => a.url).filter(Boolean);
  const existing = await existingSourceUrls(db, urls);

  let ingested = 0;
  let skippedNoMatch = 0;
  let skippedDuplicate = 0;

  for (const article of articles) {
    if (existing.has(article.url)) {
      skippedDuplicate++;
      continue;
    }

    const countryCode = (article.sourcecountry ?? "").toUpperCase().slice(0, 2);
    const jurisdictionId = iso2Map.get(countryCode);
    if (!jurisdictionId) {
      skippedNoMatch++;
      continue;
    }

    const eventDate = parseGdeltDate(article.seendate);

    await db.insert(pulseEvents).values({
      jurisdictionId,
      eventDate,
      category: "unclassified",
      severity: 0,
      confidence: 0,
      justification: "",
      headline: article.title.slice(0, 500),
      sourceUrl: article.url,
      sourceName: article.domain,
      llmModel: "",
      rawEventData: article,
      isActive: true,
      expiresAt: expiresAt(eventDate),
    });

    existing.add(article.url);
    ingested++;
  }

  return {
    fetched: articles.length,
    ingested,
    skippedNoMatch,
    skippedDuplicate,
  };
}
