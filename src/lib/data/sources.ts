/**
 * Canonical provenance-source metadata, shared across every surface that
 * renders a `<SourceDot>` (or the clickable `<FactValueDot>` variant).
 *
 * Previously `SourceDot.tsx` and `factbook/FactValueDot.tsx` each carried
 * their own copies — a fuller map/frozen-set in `SourceDot` and a smaller,
 * disagreeing frozen-set in `FactValueDot`. They are unified here so the
 * green ("live") vs amber ("frozen archive") dot reads identically wherever
 * a source is shown.
 *
 * The /about + data-approach legend defines green = "live or regularly
 * updated" and amber = "frozen archive", so every academic reference
 * vintage and the quarterly Civica Index composite itself must read amber —
 * not just the CIA Factbook. Genuinely live/cron-synced feeds (wikidata,
 * parliament/bills, World Bank WDI, Pulse news wires) stay green by omission.
 */

/** Human-readable display name for a source id. */
export const SOURCE_NAMES: Record<string, string> = {
  wikidata: "Wikidata",
  cia_factbook: "CIA World Factbook",
  ipu_parline: "IPU Parline",
  international_idea: "International IDEA",
  constitute_project: "Constitute Project",
  parlgov: "ParlGov",
  congress_gov: "Congress.gov",
  uk_parliament: "UK Parliament",
  eu_parliament: "European Parliament",
  legisinfo_ca: "Parliament of Canada",
  camara_br: "Câmara dos Deputados",
  senado_br: "Senado Federal",
  bundestag_dip: "Bundestag DIP",
  data_assemblee_fr: "Assemblée Nationale",
  senat_fr: "Sénat",
  bjornskov_rode: "Bjornskov-Rode / CGV",
  vdem: "V-Dem",
  worldbank_wgi: "World Bank WGI",
  world_bank: "World Bank",
  freedom_house: "Freedom House",
  transparency_intl: "Transparency International",
  undp_hdi: "UNDP HDI",
  global_peace_index: "Global Peace Index",
  fragile_states_index: "Fragile States Index",
  rsf_press_freedom: "RSF Press Freedom",
  world_happiness: "World Happiness Report",
  unodc: "UNODC",
  civica_curated: "Civica curated data",
  // Phase 5.5 — Pulse Beta sources
  acled: "ACLED",
  civicus_monitor: "CIVICUS Monitor",
  rsf_alerts: "RSF Press Freedom Alerts",
  vdem_pulse: "V-Dem Pulse",
  hrw: "Human Rights Watch",
  amnesty: "Amnesty International",
  gdelt: "GDELT Project",
  reuters_wire: "Reuters",
  ap_wire: "Associated Press",
  google_news: "Google News",
};

/**
 * Sources whose data is a frozen annual/quarterly vintage (not a live feed).
 * Canonical set — the fuller 17-source list (the union of every frozen
 * academic / quarterly vintage), so a frozen dot renders amber consistently.
 */
export const FROZEN_SOURCES = new Set<string>([
  "cia_factbook",
  "vdem",
  "vdem_pulse",
  "worldbank_wgi",
  "worldbank_wgi_corruption",
  "undp_hdi",
  "freedom_house",
  "transparency_intl",
  "global_peace_index",
  "fragile_states_index",
  "rsf_press_freedom",
  "rsf_alerts",
  "world_happiness",
  "bjornskov_rode",
  "constitute_project",
  "unodc",
  "civica_curated",
  // International IDEA turnout is a periodically-updated bulk vintage (a sync
  // run of a downloadable dataset, not a live feed) → amber, per the elections
  // resolution's SourceDot posture (plan/elections-data-sourcing-resolution-v1.md §3).
  "international_idea",
]);

/** Human-readable display name for a source id (falls back to the id). */
export function sourceLabel(id: string): string {
  return SOURCE_NAMES[id] ?? id;
}

/** Whether a source is a frozen vintage (amber dot) vs a live feed (green dot). */
export function isFrozenSource(id: string): boolean {
  return FROZEN_SOURCES.has(id);
}
