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
  cia_world_leaders: "CIA World Leaders",
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
  vparty: "V-Dem V-Party",
  worldbank_wgi: "World Bank WGI",
  world_bank: "World Bank",
  freedom_house: "Freedom House",
  transparency_intl: "Transparency International",
  undp_hdi: "UNDP HDI",
  unesco_uis: "UNESCO UIS",
  global_peace_index: "Global Peace Index",
  fragile_states_index: "Fragile States Index",
  rsf_press_freedom: "RSF Press Freedom",
  world_happiness: "World Happiness Report",
  unodc: "UNODC",
  civica_curated: "Civica curated data",
  civica_organization_roster_v1: "Civica organization roster v1",
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
  // V-Party v2 is a fixed Feb-2022 academic release (coverage through 2019),
  // not a live feed → amber. Per plan/party-ideology-sourcing-resolution-v1.md §4.1.
  "vparty",
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
  "civica_organization_roster_v1",
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

/**
 * Client-safe provenance disclosure used by the compact `<SourceDot>`.
 *
 * `rights/manifest.ts` intentionally imports server-only release-input
 * validation code, so a client-rendered dot cannot import it directly. Keep
 * the small set of verified terms that can appear in the compact control
 * here; every other source is explicitly labelled pending rather than having
 * a license guessed from its name. The full machine-readable registry remains
 * authoritative at `/api/rights-manifest` and `/licensing#rights-manifest`.
 */
export type SourceRightsDisclosure = {
  license: string;
  reviewStatus: "verified" | "pending";
  termsUrl: string;
};

const VERIFIED_SOURCE_RIGHTS: Readonly<
  Record<string, SourceRightsDisclosure>
> = {
  cia_factbook: {
    license: "US-PUBLIC-DOMAIN",
    reviewStatus: "verified",
    termsUrl: "https://www.cia.gov/site-policies/",
  },
  cia_world_leaders: {
    license: "US-PUBLIC-DOMAIN",
    reviewStatus: "verified",
    termsUrl: "https://www.cia.gov/site-policies/",
  },
  wikidata: {
    license: "CC0-1.0",
    reviewStatus: "verified",
    termsUrl: "https://www.wikidata.org/wiki/Wikidata:Licensing",
  },
  world_bank: {
    license: "CC-BY-4.0",
    reviewStatus: "verified",
    termsUrl: "https://datacatalog.worldbank.org/public-licenses",
  },
  worldbank_economic: {
    license: "CC-BY-4.0",
    reviewStatus: "verified",
    termsUrl: "https://datacatalog.worldbank.org/public-licenses",
  },
  worldbank_wgi: {
    license: "CC-BY-4.0",
    reviewStatus: "verified",
    termsUrl: "https://datacatalog.worldbank.org/public-licenses",
  },
};

const PENDING_SOURCE_RIGHTS: SourceRightsDisclosure = {
  license: "Publisher terms pending review",
  reviewStatus: "pending",
  termsUrl: "/licensing#rights-manifest",
};

/** Never infer a source license: missing compact metadata is visibly pending. */
export function sourceRightsDisclosure(sourceId: string): SourceRightsDisclosure {
  return VERIFIED_SOURCE_RIGHTS[sourceId] ?? PENDING_SOURCE_RIGHTS;
}

export type SourcePresentationState =
  | "live"
  | "frozen"
  | "experimental"
  | "unknown";

export function sourcePresentationState(
  sourceId: string,
  explicit?: SourcePresentationState,
): SourcePresentationState {
  if (explicit) return explicit;
  return isFrozenSource(sourceId) ? "frozen" : "live";
}

export function sourcePresentationStateLabel(
  state: SourcePresentationState,
): string {
  switch (state) {
    case "live":
      return "Live or regularly updated source";
    case "frozen":
      return "Frozen source vintage";
    case "experimental":
      return "Experimental source or method";
    case "unknown":
      return "Source update state not declared";
  }
}

/**
 * Keep timestamp precision truthful. A date-only string is never converted to
 * a fictitious clock time, while an ISO timestamp retains seconds and UTC.
 */
export function formatSourceTimestamp(
  value: string | Date | null | undefined,
): string {
  if (!value) return "Unknown timestamp";

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) return "Unknown timestamp";
    return `${new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    }).format(date)} (date only)`;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown timestamp";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(date);
}

export type SourceDotDisclosure = {
  label: string;
  state: SourcePresentationState;
  stateLabel: string;
  timestamp: string;
  upstreamVintage: string;
  rights: SourceRightsDisclosure;
  rightsLabel: string;
};

export function buildSourceDotDisclosure(input: {
  source: string;
  retrievedAt: string | Date | null | undefined;
  state?: SourcePresentationState;
  upstreamVintage?: string | null;
  rights?: SourceRightsDisclosure;
}): SourceDotDisclosure {
  const state = sourcePresentationState(input.source, input.state);
  const rights = input.rights ?? sourceRightsDisclosure(input.source);
  return {
    label: sourceLabel(input.source),
    state,
    stateLabel: sourcePresentationStateLabel(state),
    timestamp: formatSourceTimestamp(input.retrievedAt),
    upstreamVintage:
      input.upstreamVintage?.trim() || "Not supplied on this surface",
    rights,
    rightsLabel:
      rights.reviewStatus === "verified"
        ? `${rights.license}; rights review verified`
        : "Publisher terms pending review; public reuse is not implied",
  };
}
