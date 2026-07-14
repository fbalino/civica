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

import { type JurisdictionMap, resolveCountry } from "../country-resolver";
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

export interface AcledFetchOptions {
  sinceDays?: number;
  limit?: number;
  /** Deterministic fixture/configuration seam. Omit to use the environment. */
  apiKey?: string | null;
  /** Deterministic fixture/configuration seam. Omit to use the environment. */
  email?: string | null;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export async function fetchAcled(
  map: JurisdictionMap,
  opts: AcledFetchOptions = {},
): Promise<AcledFetchResult> {
  const apiKey = Object.hasOwn(opts, "apiKey")
    ? opts.apiKey
    : process.env.ACLED_API_KEY;
  const email = Object.hasOwn(opts, "email")
    ? opts.email
    : process.env.ACLED_API_EMAIL;
  if (!apiKey && !email) {
    console.info(
      "[acled] ACLED_API_KEY and ACLED_API_EMAIL not set — skipping. " +
        "Set both to enable; ACLED requires academic registration.",
    );
    return { rows: [], unmatchedCountry: 0, fetched: 0, ran: false };
  }
  if (!apiKey || !email) {
    const missing = !apiKey ? "ACLED_API_KEY" : "ACLED_API_EMAIL";
    throw new Error(
      `ACLED configuration incomplete: ${missing} is required when the other credential is set`,
    );
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

  const baseUrl = opts.baseUrl ?? ACLED_BASE;
  const fetchImpl = opts.fetchImpl ?? fetch;
  let resp: Response;
  try {
    resp = await fetchImpl(`${baseUrl}?${params.toString()}`, {
      headers: { Accept: "application/json" },
    });
  } catch (err) {
    throw new Error(
      `ACLED request failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!resp.ok) {
    throw new Error(`ACLED request returned HTTP ${resp.status}`);
  }

  let json: unknown;
  try {
    json = await resp.json();
  } catch (err) {
    throw new Error(
      `ACLED response parse failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (
    typeof json !== "object" ||
    json === null ||
    !("data" in json) ||
    !Array.isArray(json.data)
  ) {
    throw new Error("ACLED response parse failed: expected a data array");
  }
  const acledRows = json.data as AcledRow[];

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
