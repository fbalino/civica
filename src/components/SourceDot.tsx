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
};

const FROZEN_SOURCES = new Set(["cia_factbook"]);

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
      aria-label={`Source: ${label}, ${date}`}
    />
  );
}
