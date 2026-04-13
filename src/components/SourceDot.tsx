const SOURCE_NAMES: Record<string, string> = {
  wikidata: "Wikidata",
  cia_factbook: "CIA World Factbook",
  ipu_parline: "IPU Parline",
  constitute_project: "Constitute Project",
  parlgov: "ParlGov",
  congress_gov: "Congress.gov",
  uk_parliament: "UK Parliament",
  eu_parliament: "European Parliament",
};

const FROZEN_SOURCES = new Set(["cia_factbook"]);

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function SourceDot({
  source,
  retrievedAt,
}: {
  source: string;
  retrievedAt: string;
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
