/**
 * ACLED — Armed Conflict Location & Event Data Project.
 * License: academic non-commercial.
 *
 * STATUS: scaffold gated on env vars. ACLED's API requires both an
 * API key and the registered email address as query parameters:
 *   https://api.acleddata.com/acled/read?key=KEY&email=EMAIL&...
 *
 * Set ACLED_API_KEY and ACLED_API_EMAIL to enable this connector.
 * Without both, the connector gracefully no-ops — the rest of the
 * pipeline doesn't depend on ACLED specifically.
 *
 * ACLED is the highest-value specialist feed for the Pulse — it
 * structurally documents conflict, protest, and political-violence
 * events with lat/lon, fatality counts, and consistent country tags.
 * Resolving licensing for production use is a Phase 5.9 task.
 */

import {
  type JurisdictionMap,
  resolveCountry,
} from "../country-resolver";
import type { RawEventInput } from "../types";

const ACLED_BASE =
  process.env.ACLED_BASE_URL ?? "https://api.acleddata.com/acled/read";
const SOURCE_ID = "acled";

interface AcledRow {
  data_id?: string | number;
  event_date?: string;
  event_type?: string;
  sub_event_type?: string;
  country?: string;
  iso?: string;
  notes?: string;
  fatalities?: number;
  source?: string;
  source_url?: string;
}

export interface AcledFetchResult {
  rows: RawEventInput[];
  unmatchedCountry: number;
  fetched: number;
  /** True when the connector ran (API key present); false when skipped */
  ran: boolean;
}

export async function fetchAcled(
  map: JurisdictionMap,
  opts: { sinceDays?: number; limit?: number } = {}
): Promise<AcledFetchResult> {
  const apiKey = process.env.ACLED_API_KEY;
  const email = process.env.ACLED_API_EMAIL;
  if (!apiKey || !email) {
    console.info(
      "[acled] ACLED_API_KEY or ACLED_API_EMAIL not set — skipping. " +
        "Set both to enable; ACLED requires academic registration."
    );
    return { rows: [], unmatchedCountry: 0, fetched: 0, ran: false };
  }

  const sinceDays = opts.sinceDays ?? 7;
  const limit = opts.limit ?? 500;
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const params = new URLSearchParams({
    key: apiKey,
    email,
    event_date: `${since}|${new Date().toISOString().slice(0, 10)}`,
    event_date_where: "BETWEEN",
    limit: String(limit),
    fields:
      "data_id|event_date|event_type|sub_event_type|country|iso|notes|fatalities|source|source_url",
  });

  let acledRows: AcledRow[] = [];
  try {
    const resp = await fetch(`${ACLED_BASE}?${params.toString()}`, {
      headers: { Accept: "application/json" },
    });
    if (!resp.ok) {
      console.warn(`[acled] returned ${resp.status}`);
      return { rows: [], unmatchedCountry: 0, fetched: 0, ran: true };
    }
    const json = (await resp.json()) as { data?: AcledRow[] };
    acledRows = json.data ?? [];
  } catch (err) {
    console.warn(`[acled] fetch failed: ${(err as Error).message}`);
    return { rows: [], unmatchedCountry: 0, fetched: 0, ran: true };
  }

  const rows: RawEventInput[] = [];
  let unmatchedCountry = 0;

  for (const r of acledRows) {
    if (!r.data_id) continue;
    const jurisdictionId =
      resolveCountry(r.iso ?? null, map) ??
      resolveCountry(r.country ?? null, map);
    if (!jurisdictionId) unmatchedCountry++;

    const subType = r.sub_event_type ?? r.event_type ?? "Event";
    const fatalities =
      r.fatalities && r.fatalities > 0 ? ` (${r.fatalities} killed)` : "";
    const title = `${r.country ?? "Unknown"}: ${subType}${fatalities}`;

    rows.push({
      sourceId: SOURCE_ID,
      externalId: String(r.data_id),
      sourceUrl: r.source_url ?? null,
      sourceType: "specialist",
      jurisdictionId,
      rawCountryName: r.country ?? null,
      eventDate: r.event_date ?? null,
      title,
      body: r.notes ?? null,
      raw: r as unknown as Record<string, unknown>,
    });
  }

  return {
    rows,
    unmatchedCountry,
    fetched: acledRows.length,
    ran: true,
  };
}
