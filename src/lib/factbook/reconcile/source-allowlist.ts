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
 * 2026-05-04) where confidently identifiable. NSO Q-IDs that we do
 * NOT yet have authoritative confirmation for are listed with `qid`
 * undefined and matched on domain only — Wikidata claims that cite an
 * unverified-Q-ID NSO will fall through the QID branch but pass via
 * the URL branch as long as the Wikidata reference URL is on the
 * domain list. This is intentional: domain matching is the safer
 * fallback; the Q-ID is a convenience.
 */

export type AllowlistTier = 1 | 2 | 3 | 4;

export interface AllowlistEntry {
  /** Wikidata Q-ID of the source entity (e.g. "Q21540096" for World
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
    // R.0 / 2026-05-03: corrected to Q21540096 (World Bank Open
    // Data, the data portal). The previous value Q1199363 maps
    // to "Taika — Wikimedia disambiguation page" on live
    // Wikidata, so the QID branch of the allowlist never matched
    // a real WB reference; the URL-domain branch was carrying
    // 100% of the load. The bug was latent until the same R.0
    // patch broadened reference extraction to include `pr:P123`
    // (publisher), where references arrive QID-only without a
    // URL. See `~/civica/plan/wikidata-sort-resolution-v1.md`
    // §3 item 3.
    qid: "Q21540096",
    domains: ["data.worldbank.org", "databank.worldbank.org", "worldbank.org"],
    name: "World Bank Open Data",
    tier: 1,
    civicaSourceId: "world_bank",
  },
  {
    // R.2 / 2026-05-03: corrected to Q7804 (International Monetary
    // Fund). The previous value Q7150 maps to "ecology" on live
    // Wikidata, so the QID branch of the allowlist never matched
    // a real IMF reference; the URL-domain branch was carrying
    // 100% of the load. The bug was latent (no IMF-cited Wikidata
    // claims in Civica's pipe yet) but becomes load-bearing as
    // R.3 / R.10 / etc. introduce IMF cross-references. See
    // `~/civica/plan/imf-weo-resolution-v1.md` §6 Q4. Same
    // bug-class as R.0's WB QID correction.
    qid: "Q7804",
    domains: ["imf.org", "data.imf.org"],
    name: "International Monetary Fund (WEO / IFS)",
    tier: 1,
    civicaSourceId: "imf_weo",
  },
  {
    // R.3 / 2026-05-03: added `population.un.org` to cover the UN
    // Population Division (WPP 2024 Revision) sync. The Population
    // Division is administratively part of UN DESA but publishes
    // through the UN Statistics umbrella; per
    // `~/civica/plan/un-data-resolution-v1.md` §2e the single
    // `un_data` source slug covers both PopDiv and UN Stats data.
    // The domain is added here so reference URLs starting with
    // `https://population.un.org/wpp/` pass `isAllowedReference()`.
    // Also stamped with `civicaSourceId: "un_data"` matching the
    // existing `sources` row.
    //
    // R.3 audit / 2026-05-04: corrected QID to Q2265585 (United
    // Nations Statistics Division). The previous value Q220563 maps
    // to "United Nations Secretariat" — the administrative organ of
    // the UN, not the Statistics Division (a separate DESA entity).
    // Same bug-class as R.0/R.2.
    qid: "Q2265585",
    domains: [
      "unstats.un.org",
      "data.un.org",
      "population.un.org",
    ],
    name: "UN Statistics Division",
    civicaSourceId: "un_data",
    tier: 1,
  },
  {
    // R.3 audit / 2026-05-04: corrected to Q161718 (United Nations
    // Development Programme). The previous value Q41716 maps to
    // "boiling" (a physical phenomenon) on live Wikidata — entirely
    // unrelated to UNDP. Same bug-class as R.0/R.2.
    //
    // R.6 / 2026-05-04: added `civicaSourceId: "undp_hdi"` so the
    // Wikidata reference-tier promotion logic recognises UNDP HDR
    // references as Tier 1 and so the UNDP sync's per-row references
    // payload can resolve to the matching `sources` row. The QID
    // and domains are unchanged. See
    // `~/civica/plan/undp-hdi-resolution-v1.md` §3.
    qid: "Q161718",
    domains: ["hdr.undp.org", "undp.org"],
    name: "UNDP Human Development Reports",
    tier: 1,
    civicaSourceId: "undp_hdi",
  },
  {
    // R.4 / 2026-05-03: added `civicaSourceId: "who_gho"` so the
    // Wikidata reference-tier promotion logic recognises WHO GHO
    // references as Tier 1 and so the WHO sync's per-row references
    // payload can resolve to the matching `sources` row. The QID
    // and domain are unchanged. See
    // `~/civica/plan/who-gho-resolution-v1.md` §3.
    qid: "Q7817",
    domains: ["who.int"],
    name: "WHO Global Health Observatory",
    tier: 1,
    civicaSourceId: "who_gho",
  },
  {
    // R.3 audit / 2026-05-04: corrected to Q3152127 (UNESCO Institute
    // for Statistics). The previous value Q7649 maps to "1761" (a
    // calendar year) on live Wikidata — entirely unrelated to
    // UNESCO-UIS. Same bug-class as R.0/R.2.
    //
    // R.5 / 2026-05-04: added explicit `api.uis.unesco.org` and
    // `databrowser.uis.unesco.org` domain entries (per resolution
    // §6 Q7) for methodology-page transparency. Both already match
    // via the `unesco.org` suffix matcher, so the entries are
    // belt-and-braces. Also stamped `civicaSourceId: "unesco_uis"`
    // matching the existing `sources` row, so the Wikidata
    // reference-tier promotion logic recognises UIS references and
    // the R.5 sync's references payload resolves to the matching
    // sources row.
    qid: "Q3152127",
    domains: [
      "uis.unesco.org",
      "unesco.org",
      "api.uis.unesco.org",
      "databrowser.uis.unesco.org",
    ],
    name: "UNESCO Institute for Statistics",
    civicaSourceId: "unesco_uis",
    tier: 1,
  },
  {
    // R.3 audit / 2026-05-04: corrected to Q41550 (Organisation for
    // Economic Co-operation and Development). The previous value Q7822
    // maps to "1886" (a calendar year) on live Wikidata — entirely
    // unrelated to the OECD. Same bug-class as R.0/R.2.
    //
    // R.7 / 2026-05-03: added `sdmx.oecd.org` and
    // `data-explorer.oecd.org` to cover the new OECD Data Explorer
    // SDMX endpoint that replaced the legacy `stats.oecd.org/SDMX-JSON/`
    // surface. Also stamped `civicaSourceId: "oecd_stat"` matching
    // the existing `sources` row, so the Wikidata reference-tier
    // promotion logic recognises OECD references and the R.7 sync's
    // references payload resolves to the matching sources row.
    qid: "Q41550",
    domains: [
      "stats.oecd.org",
      "oecd.org",
      "sdmx.oecd.org",
      "data-explorer.oecd.org",
    ],
    name: "OECD.Stat",
    civicaSourceId: "oecd_stat",
    tier: 1,
  },
  {
    // R.3 audit / 2026-05-04: Q82151 verified correct ("Food and
    // Agriculture Organization") — no QID change needed.
    //
    // R.8 / 2026-05-04: added `civicaSourceId: "fao_faostat"` so the
    // Wikidata reference-tier promotion logic recognises FAOSTAT
    // references as Tier 1 and so the R.8 sync's per-row references
    // payload can resolve to the matching `sources` row. The QID
    // and existing domains are unchanged. Bulk-download CDN hosts
    // (`bulks-faostat.fao.org`, `fenixservices.fao.org`) match via
    // the `fao.org` suffix matcher.
    // Per `~/civica/plan/fao-faostat-resolution-v1.md` §3a item 8.
    qid: "Q82151",
    domains: ["fao.org", "faostat.fao.org"],
    name: "FAO FAOSTAT",
    tier: 1,
    civicaSourceId: "fao_faostat",
  },
  {
    // R.3 audit / 2026-05-04: corrected to Q826700 (International
    // Energy Agency). The previous value Q35872 maps to "boat" (a
    // watercraft) on live Wikidata — entirely unrelated to the IEA.
    // Same bug-class as R.0/R.2.
    qid: "Q826700",
    domains: ["iea.org"],
    name: "International Energy Agency",
    tier: 1,
  },
  {
    // R.3 audit / 2026-05-04: corrected to Q54129 (International
    // Labour Organization). The previous value Q7795 maps to
    // "Organization of the Petroleum Exporting Countries" (OPEC) on
    // live Wikidata — a different intergovernmental body entirely.
    // Same bug-class as R.0/R.2.
    //
    // R.10 / 2026-05-04: added `rplumber.ilo.org` to cover the ILOSTAT
    // public plumber API endpoint (the keyless data interface used by
    // R.10's sync orchestrator), and stamped `civicaSourceId:
    // "ilo_ilostat"` matching the existing `sources` row so the
    // Wikidata reference-tier promotion logic recognises ILO
    // references as Tier 1 and the R.10 sync's references payload
    // resolves to the matching `sources` row. See
    // `~/civica/plan/ilo-ilostat-resolution-v1.md` §3 step 8 + §6 Q4.
    qid: "Q54129",
    domains: ["ilostat.ilo.org", "rplumber.ilo.org", "ilo.org"],
    name: "ILO ILOSTAT",
    civicaSourceId: "ilo_ilostat",
    tier: 1,
  },
  {
    // R.3 audit / 2026-05-04: corrected to Q217659 (Eurostat). The
    // previous value Q58373 maps to "Amun" (an ancient Egyptian deity)
    // on live Wikidata — entirely unrelated to the EU statistical
    // office. Same bug-class as R.0/R.2.
    //
    // R.11 / 2026-05-04: stamped `civicaSourceId: "eurostat"` matching
    // the existing `sources` row so the Wikidata reference-tier
    // promotion logic recognises Eurostat references as Tier 1 and
    // the R.11 sync's references payload resolves to the matching
    // `sources` row. See `~/civica/plan/eurostat-resolution-v1.md` §3
    // step 11 + §6 Q7.
    qid: "Q217659",
    domains: ["ec.europa.eu/eurostat", "eurostat.ec.europa.eu"],
    name: "Eurostat",
    civicaSourceId: "eurostat",
    tier: 1,
  },
  {
    // R.3 audit / 2026-05-04: corrected to Q7825 (World Trade
    // Organization). The previous value Q210913 returned a 404 on
    // live Wikidata — the QID did not resolve to any entity.
    // Same bug-class as R.0/R.2.
    //
    // R.12 / 2026-05-04: added `data.wto.org` to cover the WTO Data
    // Portal CKAN endpoint (used for vintage probes during sync
    // startup) and `api.wto.org` for the keyed REST API surface
    // (R.12's sync uses the keyless bulk path under stats.wto.org,
    // but a Wikidata reference may cite the API host). Stamped
    // `civicaSourceId: "wto_stats"` matching the existing `sources`
    // row, so the Wikidata reference-tier promotion logic recognises
    // WTO references as Tier 1 and the R.12 sync's references payload
    // resolves to the matching `sources` row. See
    // `~/civica/plan/wto-stats-resolution-v1.md` §3 step 8 + §6 Q8.
    qid: "Q7825",
    domains: ["stats.wto.org", "data.wto.org", "api.wto.org", "wto.org"],
    name: "WTO Stats",
    civicaSourceId: "wto_stats",
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
    // R.3 audit / 2026-05-04: corrected to Q637413 (United States
    // Census Bureau). The previous value Q668509 maps to
    // "Oberheimbach" (a German municipality) on live Wikidata.
    //
    // R.13 / 2026-05-05: stamped `civicaSourceId: "us_census"` matching
    // the new `sources` row added by R.13 (NSO Wave 1, first phase).
    // The QID, domain, and tier are unchanged. Per
    // `~/civica/plan/us-census-resolution-v1.md` §3 step 2 + §6 Q8.
    qid: "Q637413",
    domains: ["census.gov"],
    name: "US Census Bureau",
    tier: 2,
    countryIso2: "US",
    civicaSourceId: "us_census",
  },
  {
    // R.3 audit / 2026-05-04: corrected to Q1155740 (Statistics
    // Canada). The previous value Q801253 maps to "New Cross railway
    // station" (a London rail station) on live Wikidata.
    //
    // R.17 / 2026-05-04: stamped `civicaSourceId: "statcan_ca"` matching
    // the new `sources` row added by R.17 (NSO Wave 2). The QID,
    // domain, and tier are unchanged. Per
    // `~/civica/plan/statcan-resolution-v1.md` §3 step 2 + §6 Q8.
    qid: "Q1155740",
    domains: ["statcan.gc.ca"],
    name: "Statistics Canada",
    tier: 2,
    countryIso2: "CA",
    civicaSourceId: "statcan_ca",
  },
  {
    // R.3 audit / 2026-05-04: corrected to Q268072 (Instituto
    // Brasileiro de Geografia e Estatística — IBGE). The previous
    // value Q579149 maps to "Honkajoki" (a former Finnish
    // municipality) on live Wikidata.
    //
    // R.18 / 2026-05-05: stamped `civicaSourceId: "ibge_br"` matching
    // the new `sources` row added by R.18 (NSO Wave 2). Added
    // SIDRA + servicodados subdomains so per-row references that
    // cite `apisidra.ibge.gov.br/...` URLs resolve to this Tier-2
    // entry via the same allowlist matcher used by every other
    // sync. Per `~/civica/plan/ibge-br-resolution-v1.md` §3 step 2.
    qid: "Q268072",
    domains: [
      "ibge.gov.br",
      "sidra.ibge.gov.br",
      "apisidra.ibge.gov.br",
      "servicodados.ibge.gov.br",
    ],
    name: "IBGE (Brazil)",
    tier: 2,
    countryIso2: "BR",
    civicaSourceId: "ibge_br",
  },
  {
    // R.3 audit / 2026-05-04: corrected to Q795074 (National
    // Institute of Statistics and Geography — INEGI Mexico). The
    // previous value Q1820228 maps to "snow coach" (a vehicle type)
    // on live Wikidata.
    qid: "Q795074",
    domains: ["inegi.org.mx"],
    name: "INEGI (Mexico)",
    tier: 2,
    countryIso2: "MX",
  },
  {
    // R.3 audit / 2026-05-04: corrected to Q1665219 (National
    // Institute of Statistics and Censuses — INDEC Argentina). The
    // previous value Q1430351 maps to "Hadžiabdić" (a surname) on
    // live Wikidata.
    qid: "Q1665219",
    domains: ["indec.gob.ar"],
    name: "INDEC (Argentina)",
    tier: 2,
    countryIso2: "AR",
  },
  {
    // R.3 audit / 2026-05-04: corrected to Q1190181 (Departamento
    // Administrativo Nacional de Estadística — DANE Colombia). The
    // previous value Q5198789 maps to "Cyclone Erica" (a 2003
    // weather event) on live Wikidata.
    qid: "Q1190181",
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
    // R.3 audit / 2026-05-04: corrected to Q1334971 (Office for
    // National Statistics — ONS UK). The previous value Q1334420
    // maps to "Elya Baskin" (a Russian actor) on live Wikidata.
    //
    // R.14 / 2026-05-05: stamped `civicaSourceId: "ons_uk"` matching
    // the new `sources` row added by R.14 (NSO Wave 1, ONS-UK). The
    // QID, domain, and tier are unchanged. Per
    // `~/civica/plan/ons-uk-resolution-v1.md` §3 step 7 + §6 Q6.
    qid: "Q1334971",
    domains: ["ons.gov.uk"],
    name: "ONS (UK)",
    tier: 2,
    countryIso2: "GB",
    civicaSourceId: "ons_uk",
  },
  {
    // R.3 audit / 2026-05-04: corrected to Q156616 (National
    // Institute of Statistics and Economic Studies — INSEE France).
    // The previous value Q156521 maps to "Andrea Doria" (a
    // 16th-century Genoese admiral) on live Wikidata.
    //
    // R.15 / 2026-05-05: stamped `civicaSourceId: "insee_fr"` matching
    // the new `sources` row, so the Wikidata reference-tier
    // promotion logic recognises INSEE references as Tier 2 and the
    // R.15 sync's references payload resolves to the matching
    // `sources` row. Added `bdm.insee.fr` domain explicitly for the
    // open SDMX endpoint used by R.15 (matches via the `insee.fr`
    // suffix matcher anyway, but belt-and-braces). See
    // `~/civica/plan/insee-fr-resolution-v1.md` §3 step 2.
    qid: "Q156616",
    domains: ["insee.fr", "bdm.insee.fr"],
    name: "INSEE (France)",
    tier: 2,
    countryIso2: "FR",
    civicaSourceId: "insee_fr",
  },
  {
    // R.3 audit / 2026-05-04: corrected to Q764739 (Federal
    // Statistical Office of Germany — Destatis). The previous value
    // Q160547 maps to "Scheckwitz/Šekecy" (a German village) on
    // live Wikidata.
    qid: "Q764739",
    domains: ["destatis.de"],
    name: "Destatis (Germany)",
    tier: 2,
    countryIso2: "DE",
  },
  {
    // R.3 audit / 2026-05-04: corrected to Q214195 (Italian National
    // Institute of Statistics — ISTAT). The previous value Q605493
    // maps to "Aderus robustus" (a species of insect) on live
    // Wikidata.
    qid: "Q214195",
    domains: ["istat.it"],
    name: "ISTAT (Italy)",
    tier: 2,
    countryIso2: "IT",
  },
  {
    // R.3 audit / 2026-05-04: corrected to Q845937 (National
    // Statistics Institute — INE Spain). The previous value Q1278125
    // maps to "Lüttmoorsiel-Nordstrandischmoor island railway" (a
    // German narrow-gauge railway) on live Wikidata.
    qid: "Q845937",
    domains: ["ine.es"],
    name: "INE (Spain)",
    tier: 2,
    countryIso2: "ES",
  },
  {
    // R.3 audit / 2026-05-04: corrected to Q167086 (Statistics
    // Netherlands — CBS). The previous value Q1798917 maps to
    // "La Luna" (a 2011 Pixar animated short film) on live Wikidata.
    qid: "Q167086",
    domains: ["cbs.nl"],
    name: "CBS (Netherlands)",
    tier: 2,
    countryIso2: "NL",
  },
  {
    // R.3 audit / 2026-05-04: corrected to Q1472511 (Statistics
    // Sweden — SCB). The previous value Q1377887 maps to "European
    // Culture Prize" (a cultural award) on live Wikidata.
    qid: "Q1472511",
    domains: ["scb.se"],
    name: "Statistics Sweden",
    tier: 2,
    countryIso2: "SE",
  },
  {
    // R.3 audit / 2026-05-04: corrected to Q2367019 (Statistics
    // Norway — SSB). The previous value Q1972749 maps to "Phương 5"
    // (a ward in Ho Chi Minh City, Vietnam) on live Wikidata.
    qid: "Q2367019",
    domains: ["ssb.no"],
    name: "Statistics Norway",
    tier: 2,
    countryIso2: "NO",
  },
  {
    // R.3 audit / 2026-05-04: corrected to Q1164337 (Statistics
    // Denmark). The previous value Q1788313 maps to "Kreuzkapelle"
    // (a Catholic pilgrimage chapel in Germany) on live Wikidata.
    qid: "Q1164337",
    domains: ["dst.dk"],
    name: "Statistics Denmark",
    tier: 2,
    countryIso2: "DK",
  },
  {
    // R.3 audit / 2026-05-04: corrected to Q798557 (Statistics
    // Finland). The previous value Q623076 maps to "aquaphobia"
    // (a fear of water) on live Wikidata.
    qid: "Q798557",
    domains: ["stat.fi"],
    name: "Statistics Finland",
    tier: 2,
    countryIso2: "FI",
  },
  {
    // R.3 audit / 2026-05-04: corrected to Q285453 (Federal
    // Statistical Office — BFS/OFS Switzerland). The previous value
    // Q686566 maps to "1984 Olympics stamps of the German Democratic
    // Republic" (a philatelic collection) on live Wikidata.
    qid: "Q285453",
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
    // R.3 audit / 2026-05-04: corrected to Q7604433 (Statistics
    // South Africa). The previous value Q3500630 maps to "bird egg"
    // (a natural history concept) on live Wikidata.
    qid: "Q7604433",
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
    // R.3 audit / 2026-05-04: corrected to Q11606829 (Statistics
    // Bureau of Japan). The previous value Q1326003 maps to
    // "Psalm 44" (a biblical psalm) on live Wikidata.
    qid: "Q11606829",
    domains: ["stat.go.jp"],
    name: "Statistics Bureau of Japan",
    tier: 2,
    countryIso2: "JP",
  },
  {
    // R.3 audit / 2026-05-04: corrected to Q11233101 (Ministry of
    // Data and Statistics — KOSTAT / Statistics Korea). The previous
    // value Q489388 maps to "Ancistrura" (a genus of insects) on
    // live Wikidata.
    qid: "Q11233101",
    domains: ["kostat.go.kr", "kosis.kr"],
    name: "KOSTAT (South Korea)",
    tier: 2,
    countryIso2: "KR",
  },
  {
    // R.3 audit / 2026-05-04: corrected to Q15715087 (Department
    // of Statistics Singapore — SingStat). The previous value
    // Q1474711 maps to "1950 World Wrestling Championships" (a
    // sporting event) on live Wikidata.
    qid: "Q15715087",
    domains: ["singstat.gov.sg"],
    name: "SingStat (Singapore)",
    tier: 2,
    countryIso2: "SG",
  },
  {
    // R.3 audit / 2026-05-04: corrected to Q123347 (Australian
    // Bureau of Statistics). The previous value Q866120 maps to
    // "Mr. Smith Goes to Washington" (a 1939 Frank Capra film) on
    // live Wikidata.
    qid: "Q123347",
    domains: ["abs.gov.au"],
    name: "Australian Bureau of Statistics",
    tier: 2,
    countryIso2: "AU",
  },
  {
    // R.3 audit / 2026-05-04: corrected to Q1819197 (Statistics
    // New Zealand). The previous value Q1130645 maps to
    // "open-source software" (a software licensing concept) on
    // live Wikidata.
    qid: "Q1819197",
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
