/**
 * Phase 5.5 — country name resolver shared by all v2 Pulse connectors.
 *
 * Extracted from `src/lib/pulse/ingest.ts` (the v1 GDELT path) and
 * extended with aliases the new specialist feeds use. Build a single
 * map once per ingest run and pass it into every connector — saves N×
 * round-trips to the jurisdictions table.
 */

import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { jurisdictions } from "@/lib/db/schema";
import type * as schema from "@/lib/db/schema";

type Db = NeonHttpDatabase<typeof schema>;

export type JurisdictionMap = Map<string, string>;

/**
 * Common name-variant aliases mapping non-canonical labels to the
 * jurisdictions.name canonical form. Sourced from GDELT, CIVICUS,
 * HRW, and Amnesty observed labels. Add new variants here as they
 * surface in `raw_events.raw_country_name` diagnostics.
 */
export const PULSE_JURISDICTION_ALIAS_VERSION =
  "pulse-jurisdiction-aliases/v1" as const;

export const COUNTRY_ALIASES: Readonly<Record<string, string>> = {
  // English variants
  "UNITED STATES OF AMERICA": "UNITED STATES",
  USA: "UNITED STATES",
  US: "UNITED STATES",
  AMERICA: "UNITED STATES",
  UK: "UNITED KINGDOM",
  BRITAIN: "UNITED KINGDOM",
  "GREAT BRITAIN": "UNITED KINGDOM",
  ENGLAND: "UNITED KINGDOM",
  "RUSSIAN FEDERATION": "RUSSIA",
  "SOUTH KOREA": "KOREA, SOUTH",
  "REPUBLIC OF KOREA": "KOREA, SOUTH",
  "NORTH KOREA": "KOREA, NORTH",
  "DEMOCRATIC PEOPLE'S REPUBLIC OF KOREA": "KOREA, NORTH",
  DPRK: "KOREA, NORTH",
  "CZECH REPUBLIC": "CZECHIA",
  "MYANMAR (BURMA)": "BURMA",
  MYANMAR: "BURMA",
  "CONGO (KINSHASA)": "DEMOCRATIC REPUBLIC OF THE CONGO",
  DRC: "DEMOCRATIC REPUBLIC OF THE CONGO",
  "DR CONGO": "DEMOCRATIC REPUBLIC OF THE CONGO",
  "CONGO-KINSHASA": "DEMOCRATIC REPUBLIC OF THE CONGO",
  "CONGO (BRAZZAVILLE)": "REPUBLIC OF THE CONGO",
  "CONGO-BRAZZAVILLE": "REPUBLIC OF THE CONGO",
  "IVORY COAST": "COTE D'IVOIRE",
  "CÔTE D'IVOIRE": "COTE D'IVOIRE",
  "CAPE VERDE": "CABO VERDE",
  PALESTINE: "WEST BANK",
  "PALESTINIAN TERRITORIES": "WEST BANK",
  "STATE OF PALESTINE": "WEST BANK",
  "EAST TIMOR": "TIMOR-LESTE",
  ESWATINI: "ESWATINI",
  SWAZILAND: "ESWATINI",
  "MACEDONIA, NORTH": "NORTH MACEDONIA",
  MACEDONIA: "NORTH MACEDONIA",
  HOLLAND: "NETHERLANDS",
  TURKIYE: "TURKEY",
  "TÜRKIYE": "TURKEY",
  VATICAN: "HOLY SEE (VATICAN CITY)",
  "VATICAN CITY": "HOLY SEE (VATICAN CITY)",
};

/**
 * Build a uppercase-keyed map from any of (iso2, iso3, name, alias)
 * to a jurisdiction id.
 */
export async function buildJurisdictionMap(db: Db): Promise<JurisdictionMap> {
  const rows = await db
    .select({
      id: jurisdictions.id,
      name: jurisdictions.name,
      iso2: jurisdictions.iso2,
      iso3: jurisdictions.iso3,
    })
    .from(jurisdictions);

  const map: JurisdictionMap = new Map();
  for (const row of rows) {
    if (row.iso2) map.set(row.iso2.toUpperCase(), row.id);
    if (row.iso3) map.set(row.iso3.toUpperCase(), row.id);
    if (row.name) map.set(row.name.toUpperCase(), row.id);
  }

  for (const [alias, canonical] of Object.entries(COUNTRY_ALIASES)) {
    const id = map.get(canonical.toUpperCase());
    if (id && !map.has(alias)) map.set(alias, id);
  }

  return map;
}

/**
 * Resolve a free-form country name (e.g. from an RSS feed or news
 * article body) to a jurisdiction id. Returns null if the name is
 * ambiguous or unknown — caller should record `rawCountryName` for
 * later diagnostic and human resolution.
 */
export function resolveCountry(
  rawName: string | null | undefined,
  map: JurisdictionMap
): string | null {
  if (!rawName) return null;
  const cleaned = rawName.trim().toUpperCase();
  if (!cleaned) return null;
  return map.get(cleaned) ?? null;
}

/**
 * Best-effort country extraction from a free-text title or body.
 * Looks for the longest jurisdiction name appearing as a whole word.
 *
 * Used as a fallback when an RSS feed embeds the country in the
 * headline rather than a structured field. Returns null if no
 * confident match.
 */
export function extractCountryFromText(
  text: string,
  map: JurisdictionMap
): { jurisdictionId: string; matched: string } | null {
  if (!text) return null;
  const upper = text.toUpperCase();

  // Sort potential names by length descending so "SOUTH SUDAN" matches
  // before "SUDAN".
  const candidates = Array.from(map.keys())
    .filter((k) => k.length > 3) // skip iso2 codes
    .sort((a, b) => b.length - a.length);

  for (const name of candidates) {
    // Require word-boundary match to avoid e.g. "MALI" inside "FORMALIN"
    const re = new RegExp(`\\b${escapeRegex(name)}\\b`, "i");
    if (re.test(upper)) {
      const id = map.get(name);
      if (id) return { jurisdictionId: id, matched: name };
    }
  }
  return null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
