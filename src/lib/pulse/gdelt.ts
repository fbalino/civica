const GDELT_DOC_API = "https://api.gdeltproject.org/api/v2/doc/doc";

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
  "corruption",
].join(" OR ");

export interface GdeltArticle {
  url: string;
  title: string;
  seendate: string;
  domain: string;
  sourcecountry: string;
  language: string;
  socialimage?: string;
}

export interface GdeltResponse {
  articles: GdeltArticle[];
}

function formatGdeltDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace("T", "").slice(0, 14);
}

export async function fetchGdeltEvents(hoursBack = 24): Promise<GdeltArticle[]> {
  const now = new Date();
  const start = new Date(now.getTime() - hoursBack * 60 * 60 * 1000);

  const params = new URLSearchParams({
    query: `(${GOVERNANCE_TERMS})`,
    mode: "artlist",
    format: "json",
    maxrecords: "250",
    startdatetime: formatGdeltDate(start),
    enddatetime: formatGdeltDate(now),
  });

  const url = `${GDELT_DOC_API}?${params.toString()}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`GDELT API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as GdeltResponse;
  return data.articles ?? [];
}

export function parseArticleDate(seendate: string): Date {
  // GDELT seendate format: "20240101T123456Z" or "20240101000000"
  const cleaned = seendate.replace(/[TZ]/g, "").padEnd(14, "0");
  const year = parseInt(cleaned.slice(0, 4));
  const month = parseInt(cleaned.slice(4, 6)) - 1;
  const day = parseInt(cleaned.slice(6, 8));
  const hour = parseInt(cleaned.slice(8, 10));
  const min = parseInt(cleaned.slice(10, 12));
  const sec = parseInt(cleaned.slice(12, 14));
  return new Date(Date.UTC(year, month, day, hour, min, sec));
}

export function extractSourceName(domain: string): string {
  return domain.replace(/^www\./, "");
}
