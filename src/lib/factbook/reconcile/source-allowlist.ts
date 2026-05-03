/**
 * Phase F — source allowlist.
 *
 * Single source of truth for which Wikidata claim references a Civica
 * sync is allowed to accept (methodology §2.1) and which references
 * are explicitly rejected (§2.2). The Wikidata sync script reads this
 * file directly; the resolver's "Guard 2 — reference-quality floor"
 * (§3.3) reads it; the public methodology page renders it.
 *
 * Scope (§2.4): the allowlist file IS the change log. A version bump
 * (v0.1 → v0.2) is required before any non-additive change to the
 * tier structure.
 *
 * Tier model (§2.1):
 *   Tier 1 — multilateral statistical agencies (World Bank, IMF, UN,
 *            UNDP, WHO, UNESCO-UIS, OECD, FAO, IEA, ILO, Eurostat,
 *            WTO).
 *   Tier 2 — curated national statistical offices, ~30–40 per §13.3.
 *   Tier 3 — CIA World Factbook (frozen Jan 2026).
 *   Tier 4 — Wikidata as a pipe (only valid when the underlying
 *            references are Tier 1 or Tier 2).
 *
 * Rejected (§2.2): P143 imported-from-Wikipedia markers, Wikipedia
 * itself, news aggregators (Worldometers, Statista free tier), blogs,
 * podcasts, social media, advocacy NGO self-claims for population/GDP,
 * and government press releases when an NSO exists for the same fact.
 *
 * The Wikidata Q-IDs below were verified against Wikidata (live as of
 * 2026-05-02) where confidently identifiable. NSO Q-IDs that we do
 * NOT yet have authoritative confirmation for are listed with `qid`
 * undefined and matched on domain only — Wikidata claims that cite an
 * unverified-Q-ID NSO will fall through the QID branch but pass via
 * the URL branch as long as the Wikidata reference URL is on the
 * domain list. This is intentional: domain matching is the safer
 * fallback; the Q-ID is a convenience.
 */

export type AllowlistTier = 1 | 2 | 3 | 4;

export interface AllowlistEntry {
  /** Wikidata Q-ID of the source entity (e.g. "Q1199363" for World
   *  Bank Open Data). Optional — when missing, only domain matching
   *  applies. */
  qid?: string;
  /** Domain names (suffix-matched, case-insensitive). Multiple are
   *  allowed for portals that publish under more than one host. */
  domains: string[];
  /** Display name for UI. */
  name: string;
  tier: AllowlistTier;
  /** ISO-3166 alpha-2 of the country an NSO covers, when applicable.
   *  Tier-1 multilateral entries leave this undefined. */
  countryIso2?: string;
  /** sources.id when the allowlist source is also a row in the
   *  Civica `sources` table (CIA, Wikidata, World Bank). */
  civicaSourceId?: string;
  /** Optional commentary — usually why this NSO is or isn't in. */
  notes?: string;
}

// ─────────────────────────────────────────────────────────────────────
// TIER 1 — multilateral statistical agencies (methodology §2.1).
// These are the core publishers Wikidata itself cites for most
// quantitative facts, and are the resolver's preferred references.
// ─────────────────────────────────────────────────────────────────────

const TIER_1: AllowlistEntry[] = [
  {
    qid: "Q1199363",
    domains: ["data.worldbank.org", "databank.worldbank.org", "worldbank.org"],
    name: "World Bank Open Data",
    tier: 1,
    civicaSourceId: "world_bank",
  },
  {
    qid: "Q7150",
    domains: ["imf.org", "data.imf.org"],
    name: "International Monetary Fund (WEO / IFS)",
    tier: 1,
  },
  {
    qid: "Q220563",
    domains: ["unstats.un.org", "data.un.org"],
    name: "UN Statistics Division",
    tier: 1,
  },
  {
    qid: "Q41716",
    domains: ["hdr.undp.org", "undp.org"],
    name: "UNDP Human Development Reports",
    tier: 1,
  },
  {
    qid: "Q7817",
    domains: ["who.int"],
    name: "WHO Global Health Observatory",
    tier: 1,
  },
  {
    qid: "Q7649",
    domains: ["uis.unesco.org", "unesco.org"],
    name: "UNESCO Institute for Statistics",
    tier: 1,
  },
  {
    qid: "Q7822",
    domains: ["stats.oecd.org", "oecd.org"],
    name: "OECD.Stat",
    tier: 1,
  },
  {
    qid: "Q82151",
    domains: ["fao.org", "faostat.fao.org"],
    name: "FAO FAOSTAT",
    tier: 1,
  },
  {
    qid: "Q35872",
    domains: ["iea.org"],
    name: "International Energy Agency",
    tier: 1,
  },
  {
    qid: "Q7795",
    domains: ["ilostat.ilo.org", "ilo.org"],
    name: "ILO ILOSTAT",
    tier: 1,
  },
  {
    qid: "Q58373",
    domains: ["ec.europa.eu/eurostat", "eurostat.ec.europa.eu"],
    name: "Eurostat",
    tier: 1,
  },
  {
    qid: "Q210913",
    domains: ["stats.wto.org", "wto.org"],
    name: "WTO Stats",
    tier: 1,
  },
];

// ─────────────────────────────────────────────────────────────────────
// TIER 2 — curated national statistical offices (~30–40 per §13.3).
//
// Selection criteria (methodology §13.3):
//   - reliable publication record on machine-readable endpoints
//   - English-language landing pages or stable XML/CSV/API dumps
//   - covers at least one in-scope fact-key (population, GDP, etc.)
//
// Where a country's NSO is not on this list we are NOT saying the
// office is unreliable — we are saying its data isn't yet integrated
// into Civica's Tier 2 path. Wikidata claims that cite that NSO are
// rejected at sync time; the same fact for that country will continue
// to render from CIA + Tier 1 (World Bank, IMF, UN typically already
// republish national figures). Adding an NSO to Tier 2 is a
// non-breaking methodology change (§8.2).
// ─────────────────────────────────────────────────────────────────────

const TIER_2: AllowlistEntry[] = [
  // Americas
  {
    qid: "Q668509",
    domains: ["census.gov"],
    name: "US Census Bureau",
    tier: 2,
    countryIso2: "US",
  },
  {
    qid: "Q801253",
    domains: ["statcan.gc.ca"],
    name: "Statistics Canada",
    tier: 2,
    countryIso2: "CA",
  },
  {
    qid: "Q579149",
    domains: ["ibge.gov.br"],
    name: "IBGE (Brazil)",
    tier: 2,
    countryIso2: "BR",
  },
  {
    qid: "Q1820228",
    domains: ["inegi.org.mx"],
    name: "INEGI (Mexico)",
    tier: 2,
    countryIso2: "MX",
  },
  {
    qid: "Q1430351",
    domains: ["indec.gob.ar"],
    name: "INDEC (Argentina)",
    tier: 2,
    countryIso2: "AR",
  },
  {
    qid: "Q5198789",
    domains: ["dane.gov.co"],
    name: "DANE (Colombia)",
    tier: 2,
    countryIso2: "CO",
  },
  {
    domains: ["ine.cl"],
    name: "INE (Chile)",
    tier: 2,
    countryIso2: "CL",
    notes: "Q-ID not yet verified; matched on domain only.",
  },
  {
    domains: ["inei.gob.pe"],
    name: "INEI (Peru)",
    tier: 2,
    countryIso2: "PE",
    notes: "Q-ID not yet verified; matched on domain only.",
  },

  // Europe
  {
    qid: "Q1334420",
    domains: ["ons.gov.uk"],
    name: "ONS (UK)",
    tier: 2,
    countryIso2: "GB",
  },
  {
    qid: "Q156521",
    domains: ["insee.fr"],
    name: "INSEE (France)",
    tier: 2,
    countryIso2: "FR",
  },
  {
    qid: "Q160547",
    domains: ["destatis.de"],
    name: "Destatis (Germany)",
    tier: 2,
    countryIso2: "DE",
  },
  {
    qid: "Q605493",
    domains: ["istat.it"],
    name: "ISTAT (Italy)",
    tier: 2,
    countryIso2: "IT",
  },
  {
    qid: "Q1278125",
    domains: ["ine.es"],
    name: "INE (Spain)",
    tier: 2,
    countryIso2: "ES",
  },
  {
    qid: "Q1798917",
    domains: ["cbs.nl"],
    name: "CBS (Netherlands)",
    tier: 2,
    countryIso2: "NL",
  },
  {
    qid: "Q1377887",
    domains: ["scb.se"],
    name: "Statistics Sweden",
    tier: 2,
    countryIso2: "SE",
  },
  {
    qid: "Q1972749",
    domains: ["ssb.no"],
    name: "Statistics Norway",
    tier: 2,
    countryIso2: "NO",
  },
  {
    qid: "Q1788313",
    domains: ["dst.dk"],
    name: "Statistics Denmark",
    tier: 2,
    countryIso2: "DK",
  },
  {
    qid: "Q623076",
    domains: ["stat.fi"],
    name: "Statistics Finland",
    tier: 2,
    countryIso2: "FI",
  },
  {
    qid: "Q686566",
    domains: ["bfs.admin.ch"],
    name: "Federal Statistical Office (Switzerland)",
    tier: 2,
    countryIso2: "CH",
  },
  {
    domains: ["stat.gov.pl", "gus.gov.pl"],
    name: "Statistics Poland (GUS)",
    tier: 2,
    countryIso2: "PL",
    notes: "Q-ID not yet verified; matched on domain only.",
  },

  // Africa
  {
    qid: "Q3500630",
    domains: ["statssa.gov.za"],
    name: "Statistics South Africa",
    tier: 2,
    countryIso2: "ZA",
  },
  {
    domains: ["nigerianstat.gov.ng"],
    name: "National Bureau of Statistics (Nigeria)",
    tier: 2,
    countryIso2: "NG",
    notes: "Q-ID not yet verified; matched on domain only.",
  },
  {
    domains: ["knbs.or.ke"],
    name: "Kenya National Bureau of Statistics",
    tier: 2,
    countryIso2: "KE",
    notes: "Q-ID not yet verified; matched on domain only.",
  },
  {
    domains: ["capmas.gov.eg"],
    name: "CAPMAS (Egypt)",
    tier: 2,
    countryIso2: "EG",
    notes: "Q-ID not yet verified; matched on domain only.",
  },
  {
    domains: ["hcp.ma"],
    name: "Haut-Commissariat au Plan (Morocco)",
    tier: 2,
    countryIso2: "MA",
    notes: "Q-ID not yet verified; matched on domain only.",
  },

  // Asia + Oceania
  {
    qid: "Q1326003",
    domains: ["stat.go.jp"],
    name: "Statistics Bureau of Japan",
    tier: 2,
    countryIso2: "JP",
  },
  {
    qid: "Q489388",
    domains: ["kostat.go.kr", "kosis.kr"],
    name: "KOSTAT (South Korea)",
    tier: 2,
    countryIso2: "KR",
  },
  {
    qid: "Q1474711",
    domains: ["singstat.gov.sg"],
    name: "SingStat (Singapore)",
    tier: 2,
    countryIso2: "SG",
  },
  {
    qid: "Q866120",
    domains: ["abs.gov.au"],
    name: "Australian Bureau of Statistics",
    tier: 2,
    countryIso2: "AU",
  },
  {
    qid: "Q1130645",
    domains: ["stats.govt.nz"],
    name: "Stats NZ",
    tier: 2,
    countryIso2: "NZ",
  },
  {
    domains: ["psa.gov.ph"],
    name: "Philippine Statistics Authority",
    tier: 2,
    countryIso2: "PH",
    notes: "Q-ID not yet verified; matched on domain only.",
  },
  {
    domains: ["bps.go.id"],
    name: "Statistics Indonesia (BPS)",
    tier: 2,
    countryIso2: "ID",
    notes: "Q-ID not yet verified; matched on domain only.",
  },
  {
    domains: ["gso.gov.vn"],
    name: "General Statistics Office of Vietnam",
    tier: 2,
    countryIso2: "VN",
    notes: "Q-ID not yet verified; matched on domain only.",
  },
  {
    domains: ["censusindia.gov.in", "mospi.gov.in"],
    name: "Ministry of Statistics & PI (India)",
    tier: 2,
    countryIso2: "IN",
    notes: "Q-ID not yet verified; matched on domain only.",
  },
  {
    domains: ["stats.gov.cn"],
    name: "National Bureau of Statistics of China",
    tier: 2,
    countryIso2: "CN",
    notes: "Q-ID not yet verified; matched on domain only.",
  },
  {
    domains: ["dosm.gov.my"],
    name: "Department of Statistics Malaysia",
    tier: 2,
    countryIso2: "MY",
    notes: "Q-ID not yet verified; matched on domain only.",
  },
  {
    domains: ["nso.go.th"],
    name: "National Statistical Office (Thailand)",
    tier: 2,
    countryIso2: "TH",
    notes: "Q-ID not yet verified; matched on domain only.",
  },
];

// ─────────────────────────────────────────────────────────────────────
// TIER 3 — CIA World Factbook (frozen Jan 2026, public domain).
// Listed for completeness (§2.1). Identity facts default here for
// Group A regardless of Wikidata (§3.4).
// ─────────────────────────────────────────────────────────────────────

const TIER_3: AllowlistEntry[] = [
  {
    domains: ["cia.gov"],
    name: "CIA World Factbook",
    tier: 3,
    civicaSourceId: "cia_factbook",
  },
];

// ─────────────────────────────────────────────────────────────────────
// TIER 4 — Wikidata as the structured pipe. Per §2.1, a Wikidata
// claim is never "self-citing" — what we trust is the upstream
// Tier 1 / Tier 2 reference it carries. Listed here so that operator
// UIs and methodology pages can render Wikidata as a source row, but
// the resolver consults Tier 1/2 to admit the underlying claim.
// ─────────────────────────────────────────────────────────────────────

const TIER_4: AllowlistEntry[] = [
  {
    qid: "Q2013",
    domains: ["wikidata.org"],
    name: "Wikidata",
    tier: 4,
    civicaSourceId: "wikidata",
  },
];

export const SOURCE_ALLOWLIST: AllowlistEntry[] = Object.freeze([
  ...TIER_1,
  ...TIER_2,
  ...TIER_3,
  ...TIER_4,
]) as AllowlistEntry[];

// ─────────────────────────────────────────────────────────────────────
// Rejected references (§2.2).
//
// `REJECTED_REFERENCE_QIDS` — Wikidata items whose appearance as a
// reference disqualifies the claim regardless of any allow-listed
// co-references. The dominant case is `P143` "imported from Wikimedia
// project" stamps; Wikipedia QIDs themselves are also listed.
//
// `REJECTED_DOMAIN_PATTERNS` — case-insensitive regexes matched
// against the raw URL host. Intentionally narrow: the goal is to
// exclude Wikipedia mirrors and aggregator sites that don't add
// authority on top of Tier 1/2 originals.
// ─────────────────────────────────────────────────────────────────────

export const REJECTED_REFERENCE_QIDS: string[] = [
  // Wikipedia — every-language Q-IDs as references.
  "Q52",  // English Wikipedia
  "Q199",  // generic "Wikipedia"
  // Other Wikimedia project umbrella entities sometimes used as
  // P143-style references.
  "Q565",   // Wikimedia Commons
  "Q15156406", // Wikimedia project
];

export const REJECTED_DOMAIN_PATTERNS: RegExp[] = [
  // Wikipedia and mirrors.
  /(^|\.)wikipedia\.org$/i,
  /(^|\.)wikimedia\.org$/i,
  // News / data aggregators called out in §2.2.
  /(^|\.)worldometers\.info$/i,
  /(^|\.)statista\.com$/i,
  // Social media — never a primary source for Phase F facts.
  /(^|\.)twitter\.com$/i,
  /(^|\.)x\.com$/i,
  /(^|\.)facebook\.com$/i,
  /(^|\.)youtube\.com$/i,
  /(^|\.)youtu\.be$/i,
  /(^|\.)tiktok\.com$/i,
  /(^|\.)reddit\.com$/i,
  /(^|\.)medium\.com$/i,
  /(^|\.)substack\.com$/i,
  /(^|\.)wordpress\.com$/i,
  /(^|\.)blogspot\.com$/i,
];

// ─────────────────────────────────────────────────────────────────────
// Reference-checking helpers.
// ─────────────────────────────────────────────────────────────────────

function normalizeHost(rawUrl: string): string | undefined {
  try {
    return new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

function domainMatches(host: string, candidate: string): boolean {
  // Allow allowlist entries to encode either bare hostnames
  // ("data.worldbank.org") or path-prefixed shorthands
  // ("ec.europa.eu/eurostat"). We compare against the host portion
  // only; path-prefix entries match the host before the first slash.
  const candidateHost = candidate.split("/")[0]!.toLowerCase();
  return host === candidateHost || host.endsWith(`.${candidateHost}`);
}

/** Returns the allowlist entry matched by a reference, or undefined. */
export function findAllowlistEntry(ref: {
  qid?: string;
  url?: string;
}): AllowlistEntry | undefined {
  if (ref.qid) {
    const byQid = SOURCE_ALLOWLIST.find((e) => e.qid === ref.qid);
    if (byQid) return byQid;
  }
  if (ref.url) {
    const host = normalizeHost(ref.url);
    if (!host) return undefined;
    return SOURCE_ALLOWLIST.find((e) =>
      e.domains.some((d) => domainMatches(host, d)),
    );
  }
  return undefined;
}

/**
 * Returns true if a reference can corroborate a Wikidata claim per
 * methodology §2.1. Implements the rejection sweeps from §2.2 first;
 * a reference whose URL or QID matches the rejected lists is never
 * accepted, regardless of whether it also matches an allowlist row.
 */
export function isAllowedReference(ref: {
  qid?: string;
  url?: string;
}): boolean {
  // Hard rejections (§2.2).
  if (ref.qid && REJECTED_REFERENCE_QIDS.includes(ref.qid)) return false;
  if (ref.url) {
    const host = normalizeHost(ref.url);
    if (!host) return false;
    if (REJECTED_DOMAIN_PATTERNS.some((p) => p.test(host))) return false;
  }
  // Allowlist hit on QID or URL.
  return Boolean(findAllowlistEntry(ref));
}

/** Convenience for filter UIs. */
export function getAllowlistByTier(tier: AllowlistTier): AllowlistEntry[] {
  return SOURCE_ALLOWLIST.filter((e) => e.tier === tier);
}
