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
 * The connector returns recent elections as Pulse events when the
 * IPU /elections endpoint exposes new rows since the last sync. This
 * gives us *some* signal — peaceful transfers + flawed elections
 * are real Pulse events — but the full vision (live legislative
 * actions) requires a different data path we haven't identified.
 */

import { type JurisdictionMap, resolveCountry } from "../country-resolver";
import type { RawEventInput } from "../types";

const IPU_BASE = process.env.IPU_BASE_URL ?? "https://api.data.ipu.org/v1";
const SOURCE_ID = "ipu_parline";

interface IpuElection {
  id: number;
  country?: { code?: string; name?: string };
  type?: string;
  date?: string;
  result?: string;
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
  const url = `${baseUrl}/elections?date_from=${since}&page_size=200`;

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
    !("results" in json) ||
    !Array.isArray(json.results)
  ) {
    throw new Error(
      `IPU actions response parse failed (${url}): expected a results array`,
    );
  }
  const elections = json.results as IpuElection[];

  const rows: RawEventInput[] = [];
  let unmatchedCountry = 0;

  for (const e of elections) {
    if (!e.id || !e.country?.code) continue;
    const jurisdictionId =
      resolveCountry(e.country.code, map) ??
      resolveCountry(e.country.name ?? null, map);
    if (!jurisdictionId) {
      unmatchedCountry++;
    }
    const title = `${e.country.name ?? e.country.code}: ${e.type ?? "Election"} on ${e.date ?? "unknown date"}`;
    rows.push({
      sourceId: SOURCE_ID,
      externalId: `election-${e.id}`,
      sourceUrl: `${baseUrl}/elections/${e.id}`,
      sourceType: "specialist",
      jurisdictionId,
      rawCountryName: e.country.name ?? null,
      eventDate: e.date ?? null,
      title,
      body: e.result ?? null,
      raw: e as unknown as Record<string, unknown>,
    });
  }

  return { rows, unmatchedCountry, fetched: elections.length };
}
