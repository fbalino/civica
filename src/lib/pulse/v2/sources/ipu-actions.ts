/**
 * IPU Parline — parliamentary actions.
 * License: CC-BY-NC-SA-4.0 (non-commercial only)
 *
 * STATUS: scaffold only. The IPU API at api.data.ipu.org/v1 exposes
 * structural data (chambers, parties, elections) which we already
 * sync via scripts/sync-ipu-parline.ts. There is no public IPU
 * endpoint for daily parliamentary "actions" (cabinet changes,
 * confidence votes, dissolutions, etc.) of the kind the Pulse
 * needs.
 *
 * The connector returns recent elections as Pulse events. The v1 API
 * serves a JSON:API envelope ({ meta, links, data: [{ type, id,
 * attributes }] }) whose per-field values are wrapped as
 * { value, annotation, missing_reason }, and it does not honor a
 * date_from filter — so we request newest-first (sort=-election_date)
 * and window client-side. This gives us *some* signal — peaceful
 * transfers + flawed elections are real Pulse events — but the full
 * vision (live legislative actions) requires a different data path we
 * haven't identified.
 */

import { type JurisdictionMap, resolveCountry } from "../country-resolver";
import type { RawEventInput } from "../types";

const IPU_BASE = process.env.IPU_BASE_URL ?? "https://api.data.ipu.org/v1";
const SOURCE_ID = "ipu_parline";

/** A JSON:API attribute cell: { value, annotation, missing_reason }. */
function cell(attributes: Record<string, unknown>, key: string): unknown {
  const wrapped = attributes[key];
  if (typeof wrapped !== "object" || wrapped === null) return null;
  return (wrapped as { value?: unknown }).value ?? null;
}

function localizedEn(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "en" in value) {
    const en = (value as { en?: unknown }).en;
    return typeof en === "string" && en.trim() ? en : null;
  }
  return null;
}

export interface IpuFetchResult {
  rows: RawEventInput[];
  unmatchedCountry: number;
  fetched: number;
}

export interface IpuFetchOptions {
  sinceDays?: number;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export async function fetchIpuActions(
  map: JurisdictionMap,
  opts: IpuFetchOptions = {},
): Promise<IpuFetchResult> {
  const sinceDays = opts.sinceDays ?? 60;
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const baseUrl = opts.baseUrl ?? IPU_BASE;
  const url = `${baseUrl}/elections?sort=-election_date&page_size=200`;

  let resp: Response;
  try {
    resp = await (opts.fetchImpl ?? fetch)(url, {
      headers: { Accept: "application/json" },
    });
  } catch (err) {
    throw new Error(
      `IPU actions request failed (${url}): ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
  if (!resp.ok) {
    throw new Error(
      `IPU actions request returned HTTP ${resp.status} (${url})`,
    );
  }

  let json: unknown;
  try {
    json = await resp.json();
  } catch (err) {
    throw new Error(
      `IPU actions response parse failed (${url}): ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
  if (
    typeof json !== "object" ||
    json === null ||
    !("data" in json) ||
    !Array.isArray((json as { data: unknown }).data)
  ) {
    throw new Error(
      `IPU actions response parse failed (${url}): expected a JSON:API data array`,
    );
  }
  const records = (json as { data: unknown[] }).data;

  const rows: RawEventInput[] = [];
  let unmatchedCountry = 0;
  let inWindow = 0;

  for (const record of records) {
    if (typeof record !== "object" || record === null) continue;
    const id = (record as { id?: unknown }).id;
    const attributes = (record as { attributes?: unknown }).attributes;
    if (typeof id !== "string" || !id.trim()) continue;
    if (typeof attributes !== "object" || attributes === null) continue;
    const attrs = attributes as Record<string, unknown>;

    const dateValue = cell(attrs, "election_date");
    const from =
      typeof dateValue === "object" && dateValue !== null
        ? (dateValue as { from?: unknown }).from
        : dateValue;
    const eventDate =
      typeof from === "string" && from.length >= 10 ? from.slice(0, 10) : null;
    // Newest-first sort + client-side window: past the window we are done.
    if (!eventDate) continue;
    if (eventDate < since) break;
    inWindow++;

    // Election codes prefix the ISO2 country code (e.g. ZM-LC01-E20260813).
    const iso2 = id.slice(0, 2);
    const jurisdictionId = resolveCountry(iso2, map);
    if (!jurisdictionId) {
      unmatchedCountry++;
    }
    const title =
      localizedEn(cell(attrs, "election_title")) ?? `IPU election ${id}`;
    const seats = cell(attrs, "number_of_seats_at_stake");
    const scope = cell(attrs, "scope_of_elections");
    const scopeTerm =
      typeof scope === "object" && scope !== null
        ? (scope as { term?: unknown }).term
        : null;
    const bodyParts: string[] = [];
    if (typeof seats === "number") bodyParts.push(`${seats} seats at stake`);
    if (typeof scopeTerm === "string") {
      bodyParts.push(`scope: ${scopeTerm.replaceAll("_", " ")}`);
    }
    rows.push({
      sourceId: SOURCE_ID,
      externalId: `election-${id}`,
      sourceUrl: `${baseUrl}/elections/${encodeURIComponent(id)}`,
      sourceType: "specialist",
      jurisdictionId,
      rawCountryName: iso2,
      eventDate,
      title,
      body: bodyParts.length ? bodyParts.join("; ") : null,
      raw: record as Record<string, unknown>,
    });
  }

  return { rows, unmatchedCountry, fetched: inWindow };
}
