/**
 * history-adapters — download/parse paths for the long-run indicator
 * history backfill (`scripts/ingest-indicator-history.ts`).
 *
 * Each adapter reuses the SAME public source path the Civica Index uses,
 * but pulls the FULL published series (every year) rather than the single
 * latest vintage the CI dimension pipeline keeps. Values are returned in
 * the source's NATIVE published scale together with the scale bounds +
 * orientation so `indicator_history` stays faithful to the citable source
 * and the chart owns display normalisation.
 *
 * Sources & why these download paths:
 *  - V-Dem, HDI, CPI, Freedom House  → Our World in Data grapher CSVs
 *    (OWID republishes each dataset as a clean, ISO3-coded, multi-year CSV
 *    under a documented license; the CI adapters already name these as the
 *    upstream datasets). CSV columns: entity,code,year,<value>,owid_region.
 *  - WGI Rule of Law                 → World Bank Indicators API v2 (the CI
 *    adapter's own upstream), indicator GOV_WGI_RL.EST, JSON, 1996+.
 *
 * GPI (stability_security) has no free bulk multi-year public feed (IEP /
 * Vision of Humanity licenses it), so it is deliberately NOT backfilled
 * here — the chart soft-fails that series. Documented, not silent.
 */

import type { CIDimension } from "./types";

export interface HistoryObservation {
  iso3: string;
  year: number;
  /** Value in the source's native published scale. */
  value: number;
}

export interface HistoryAdapterResult {
  sourceId: string;
  dimension: CIDimension;
  indicator: string;
  nativeMin: number;
  nativeMax: number;
  /** true when a LOWER native value is BETTER. */
  isInverted: boolean;
  observations: HistoryObservation[];
}

export interface HistoryAdapter {
  /** Human label for logs. */
  label: string;
  sourceId: string;
  dimension: CIDimension;
  indicator: string;
  fetch(): Promise<HistoryAdapterResult>;
}

/** Fetch with retry/backoff — upstream gateways (esp. the World Bank Azure
 *  gateway) intermittently 502 large requests. */
async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  attempts = 8
): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: {
          "user-agent":
            "CivicaAtlas/1.0 (+https://civicaatlas.org; research data ingest)",
          ...(init?.headers ?? {}),
        },
      });
      if (res.ok) return res;
      // 5xx / 429 → transient; retry. 4xx (except 429) → hard fail.
      if (res.status < 500 && res.status !== 429) {
        throw new Error(`HTTP ${res.status} for ${url}`);
      }
      lastErr = new Error(`HTTP ${res.status} for ${url}`);
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 800 * Math.pow(2, i)));
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/**
 * Parse an OWID grapher CSV. Columns: entity,code,year,<valueCol>,owid_region.
 * The value column is the 4th field (index 3). Rows without an ISO3 `code`
 * (OWID aggregate regions like "World", "OWID_*") or without a numeric value
 * are skipped.
 */
function parseOwidCsv(csv: string): HistoryObservation[] {
  const lines = csv.split("\n");
  const out: HistoryObservation[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    // Simple split is safe: OWID grapher CSVs never quote these columns
    // (entity names with commas are the only risk, but code/year/value are
    // positional after the first comma-delimited entity, and the value +
    // year are numeric fields at fixed offsets from the END). Parse from the
    // right to be robust to commas in entity names.
    const parts = line.split(",");
    if (parts.length < 5) continue;
    const region = parts[parts.length - 1];
    // value is second-from-last, year third-from-last, code fourth-from-last.
    const valueStr = parts[parts.length - 2];
    const yearStr = parts[parts.length - 3];
    const code = parts[parts.length - 4];
    void region;
    if (!code || code.length !== 3 || !/^[A-Z]{3}$/.test(code)) continue;
    const year = Number(yearStr);
    const value = Number(valueStr);
    if (!Number.isFinite(year) || !Number.isFinite(value)) continue;
    out.push({ iso3: code.toUpperCase(), year, value });
  }
  return out;
}

async function fetchOwid(
  slug: string,
  useShortNames = true
): Promise<HistoryObservation[]> {
  const url = `https://ourworldindata.org/grapher/${slug}.csv?csvType=full${
    useShortNames ? "&useColumnShortNames=true" : ""
  }`;
  const res = await fetchWithRetry(url, { redirect: "follow" });
  const csv = await res.text();
  return parseOwidCsv(csv);
}

// ── Adapters ────────────────────────────────────────────────────────────

/** V-Dem Liberal Democracy Index (v2x_libdem). Native 0–1, higher better. 1789+. */
export const vdemAdapter: HistoryAdapter = {
  label: "V-Dem Liberal Democracy Index (democratic_quality)",
  sourceId: "vdem",
  dimension: "democratic_quality",
  indicator: "v2x_libdem",
  async fetch() {
    const observations = await fetchOwid("liberal-democracy-index");
    return {
      sourceId: this.sourceId,
      dimension: this.dimension,
      indicator: this.indicator,
      nativeMin: 0,
      nativeMax: 1,
      isInverted: false,
      observations,
    };
  },
};

/** UNDP HDI. Native 0–1, higher better. 1990+. */
export const hdiAdapter: HistoryAdapter = {
  label: "UNDP Human Development Index (human_development)",
  sourceId: "undp_hdi",
  dimension: "human_development",
  indicator: "hdi",
  async fetch() {
    const observations = await fetchOwid("human-development-index");
    return {
      sourceId: this.sourceId,
      dimension: this.dimension,
      indicator: this.indicator,
      nativeMin: 0,
      nativeMax: 1,
      isInverted: false,
      observations,
    };
  },
};

/** Transparency International CPI. Native 0–100, higher better. 2012+. */
export const cpiAdapter: HistoryAdapter = {
  label: "Transparency International CPI (corruption_control)",
  sourceId: "transparency_intl",
  dimension: "corruption_control",
  indicator: "score",
  async fetch() {
    const observations = await fetchOwid("ti-corruption-perception-index");
    return {
      sourceId: this.sourceId,
      dimension: this.dimension,
      indicator: this.indicator,
      nativeMin: 0,
      nativeMax: 100,
      isInverted: false,
      observations,
    };
  },
};

/**
 * Freedom House "Total Score" = Political Rights (0–40) + Civil Liberties
 * (0–60), 0–100, higher = more free. Assembled from OWID's two component
 * series (political-rights-score-fh + civil-liberties-score-fh, 2003+) and
 * summed per (country, year). This is FH's own published Total Score scale.
 *
 * NB the CI dimension adapter stores the 1–7 Freedom Rating on the 2–14 SUM
 * scale (inverted); the history archive intentionally stores the source's
 * native 0–100 Total Score (non-inverted) — the more citable published form.
 * The two are not the same indicator key, so they never collide.
 */
export const freedomHouseAdapter: HistoryAdapter = {
  label: "Freedom House Total Score (freedom_rights)",
  sourceId: "freedom_house",
  dimension: "freedom_rights",
  indicator: "fh_total_score",
  async fetch() {
    const [pr, cl] = await Promise.all([
      fetchOwid("political-rights-score-fh"),
      fetchOwid("civil-liberties-score-fh"),
    ]);
    // Sum PR + CL per (iso3, year). Require BOTH components present.
    const key = (o: HistoryObservation) => `${o.iso3}|${o.year}`;
    const clMap = new Map(cl.map((o) => [key(o), o.value]));
    const observations: HistoryObservation[] = [];
    for (const p of pr) {
      const c = clMap.get(key(p));
      if (c === undefined) continue;
      observations.push({ iso3: p.iso3, year: p.year, value: p.value + c });
    }
    return {
      sourceId: this.sourceId,
      dimension: this.dimension,
      indicator: this.indicator,
      nativeMin: 0,
      nativeMax: 100,
      isInverted: false,
      observations,
    };
  },
};

/**
 * World Bank WGI — Rule of Law estimate (GOV_WGI_RL.EST). Native -2.5..+2.5,
 * higher better. 1996+. World Bank Indicators API v2, JSON, paginated. This
 * is the CI rule_of_law adapter's own upstream source + scale.
 */
export const wgiAdapter: HistoryAdapter = {
  label: "World Bank WGI Rule of Law (rule_of_law)",
  sourceId: "worldbank_wgi",
  dimension: "rule_of_law",
  indicator: "rl.est",
  async fetch() {
    const observations: HistoryObservation[] = [];
    // Page through in modest chunks. The World Bank Azure gateway 502s big
    // single-shot pulls (per_page=20000), so we request per_page=1000 and walk
    // the `pages` count from the first response's metadata. Each page is
    // retried independently by fetchWithRetry.
    const PER_PAGE = 1000;
    const pageUrl = (page: number) =>
      `https://api.worldbank.org/v2/country/all/indicator/GOV_WGI_RL.EST` +
      `?format=json&per_page=${PER_PAGE}&page=${page}&date=1996:2030`;

    type WbRow = {
      countryiso3code?: string;
      date?: string;
      value?: number | null;
    };
    const ingestPage = (rows: WbRow[]) => {
      for (const row of rows) {
        const iso3 = row.countryiso3code;
        const year = Number(row.date);
        const value = row.value;
        if (!iso3 || iso3.length !== 3 || !/^[A-Z]{3}$/.test(iso3)) continue;
        if (!Number.isFinite(year) || value == null || !Number.isFinite(value))
          continue;
        observations.push({ iso3: iso3.toUpperCase(), year, value });
      }
    };

    const first = await fetchWithRetry(pageUrl(1));
    const firstJson = (await first.json()) as unknown;
    if (
      !Array.isArray(firstJson) ||
      firstJson.length < 2 ||
      !Array.isArray(firstJson[1])
    ) {
      throw new Error("Unexpected World Bank API response shape");
    }
    const meta = firstJson[0] as { pages?: number };
    const totalPages = Math.max(1, Number(meta?.pages ?? 1));
    ingestPage(firstJson[1] as WbRow[]);

    for (let page = 2; page <= totalPages; page++) {
      const res = await fetchWithRetry(pageUrl(page));
      const json = (await res.json()) as unknown;
      if (Array.isArray(json) && Array.isArray(json[1])) {
        ingestPage(json[1] as WbRow[]);
      }
    }

    return {
      sourceId: this.sourceId,
      dimension: this.dimension,
      indicator: this.indicator,
      nativeMin: -2.5,
      nativeMax: 2.5,
      isInverted: false,
      observations,
    };
  },
};

/** All history adapters, keyed by sourceId for `--source` filtering. */
export const HISTORY_ADAPTERS: HistoryAdapter[] = [
  vdemAdapter,
  wgiAdapter,
  hdiAdapter,
  freedomHouseAdapter,
  cpiAdapter,
];

export { parseOwidCsv };
