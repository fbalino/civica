const SOURCE_NAMES: Record<string, string> = {
  wikidata: "Wikidata",
  cia_factbook: "CIA World Factbook",
  ipu_parline: "IPU Parline",
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

// Sources whose data is a frozen annual/quarterly vintage (not a live feed).
// The /about + data-approach legend defines green = "live or regularly updated"
// and amber = "frozen archive", so every academic reference vintage and the
// quarterly Civica Index composite itself must read amber — not just the CIA
// Factbook. Genuinely live/cron-synced feeds (wikidata, parliament/bills,
// World Bank WDI, Pulse news wires) stay green by omission.
const FROZEN_SOURCES = new Set([
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
]);

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not yet synced";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Not yet synced";
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function SourceDot({
  source,
  retrievedAt,
}: {
  source: string;
  retrievedAt: string | null | undefined;
}) {
  const isFrozen = FROZEN_SOURCES.has(source);
  const label = SOURCE_NAMES[source] ?? source;
  const date = formatDate(retrievedAt);

  return (
    <span
      className={`source-dot ${isFrozen ? "source-dot--frozen" : "source-dot--live"}`}
      data-source={label}
      data-date={date}
      role="img"
      tabIndex={0}
      aria-label={`Source: ${label}, ${date}`}
    />
  );
}
