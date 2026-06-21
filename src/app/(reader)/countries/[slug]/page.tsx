import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getJurisdictionBySlug,
  getFactbookSections,
  getFactbookSection,
  getCountryFacts,
  getGovernmentStructure,
  getCountryRankings,
  getRelatedCountries,
  getLegislatureComposition,
  getDemocracyScores,
  getRegionalDemocracyComparison,
  getConstitution,
  getLeaderTimeline,
  getCICountryDetail,
  getSource,
} from "@/lib/db/queries";
import {
  CIPulseScoreDisplay,
  type CIScoreData,
  type PulseScoreData,
} from "@/components/ci/CIPulseScoreDisplay";
import { PulseDimensionalDeltas } from "@/components/pulse/PulseDimensionalDeltas";
import { getPulseV2ForCountry } from "@/lib/db/queries-pulse-v2";
import { withOg, OG_DEFAULT_IMAGE } from "@/lib/og";
import { SourceDot } from "@/components/SourceDot";
import { FactbookSectionTabs } from "@/components/FactbookSectionNav";
import { FactbookSection } from "@/components/FactbookSection";
import { jsonbToFields } from "@/lib/data/factbook-fields";
import { sectionDataHasNormalizableGeographicName } from "@/lib/data/geographic-name-normalization";
import { Banner } from "@/components/editorial/Banner";
import { CountryTabs } from "./tabs";
import { CountryFlag } from "@/components/CountryFlag";
import { GovernmentTaxonomyBlock } from "@/components/GovernmentTaxonomyBlock";
import { GovStructureDiagram } from "@/components/GovStructureDiagram";
import { FactbookLegislatureChart } from "@/components/factbook/FactbookLegislatureChart";
import { classifyGovernment } from "@/lib/data/government-category";
import { resolvePartyColor } from "@/lib/data/party-colors";
import { stripHtml, firstSentences, formatGovernmentType } from "@/lib/text/clean";
import { fetchParliamentBills, getParliamentSource, type Bill } from "@/lib/data/parliament-feeds";
import { CountryOutcomeBars } from "@/components/outcomes/CountryOutcomeBars";
import { CivicaConditionsPanel } from "@/components/conditions/CivicaConditionsPanel";
import { FactValueDot } from "@/components/factbook/FactValueDot";
import { getCanonicalFactsForJurisdiction } from "@/lib/factbook/reconcile/api";
import type { ResolverOutput } from "@/lib/factbook/reconcile/types";

export const revalidate = 3600;

function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

function formatArea(n: number): string {
  return `${n.toLocaleString()} km\u00B2`;
}

function StatRow({
  label,
  val,
  source,
  date,
  factKey,
  resolverFact,
}: {
  label: string;
  val: string;
  source?: string;
  date?: string;
  /**
   * Phase F.4 — when this row is backed by the Phase F resolver and
   * has a canonical row, the SourceDot is replaced with a clickable
   * `<FactValueDot>` that opens the alternates panel. The row falls
   * back to the legacy SourceDot when `resolverFact?.canonical` is null.
   */
  factKey?: string;
  resolverFact?: ResolverOutput | null;
}) {
  const hasCanonical = resolverFact?.canonical != null;
  return (
    <div className="stat-row">
      <span className="stat-row__label">{label}</span>
      <span className="stat-row__value">
        {val}
        {hasCanonical && resolverFact && factKey ? (
          <FactValueDot
            factKey={factKey}
            factLabel={label}
            resolverOutput={resolverFact}
            canonicalSourceId={resolverFact.canonical?.sourceId ?? null}
            ariaLabel={`${label} ${val}, see sources`}
          />
        ) : (
          <SourceDot source={source ?? "cia_factbook"} retrievedAt={date ?? "2026-01-23"} />
        )}
      </span>
    </div>
  );
}

function formatPop(n: number | null): string {
  if (!n) return "";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

// `jurisdictions.democracy_index` is NOT a continuous 0–1 score — it is a
// V-Dem "Regimes of the World" tier (1–4) written by `mapVdemRowToOrdinal`
// in src/lib/factbook/reconcile/cache.ts (Closed Autocracy = 1 …
// Liberal Democracy = 4). Render it as its RoW label / "tier N of 4", never
// as `toFixed(2)` against a fake "/ 1.00" maximum.
const VDEM_ROW_TIER_LABELS: Record<number, string> = {
  1: "Closed Autocracy",
  2: "Electoral Autocracy",
  3: "Electoral Democracy",
  4: "Liberal Democracy",
};
const VDEM_ROW_MAX_TIER = 4;
const VDEM_ROW_SOURCE = "V-Dem (Regimes of the World)";

function vdemRowTier(value: number | null | undefined): number | null {
  if (value == null) return null;
  const tier = Math.round(value);
  return tier >= 1 && tier <= VDEM_ROW_MAX_TIER ? tier : null;
}

function vdemRowLabel(value: number | null | undefined): string | null {
  const tier = vdemRowTier(value);
  return tier == null ? null : VDEM_ROW_TIER_LABELS[tier];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  // Resolve the jurisdiction inside generateMetadata and call notFound()
  // for unknown slugs. generateMetadata runs BEFORE the page's Suspense
  // boundary (loading.tsx) streams its 200, so this is what commits the
  // real 404 status for junk URLs. The page body's notFound() at the
  // bottom would otherwise run after a 200 had already been streamed
  // (the loading.tsx soft-404 bug). `.catch(() => null)` collapses both
  // "no match" and DB-down to a 404, mirroring the factbook route.
  const jurisdiction = await getJurisdictionBySlug(slug).catch(() => null);
  if (!jurisdiction) notFound();
  const govLabel = formatGovernmentType(jurisdiction.governmentTypeDetail ?? jurisdiction.governmentType) || "sovereign state";
  const title = `${jurisdiction.name} Government Structure — Executive, Legislative & Judicial`;
  const popStr = jurisdiction.population ? ` Population: ${formatPop(jurisdiction.population)}.` : "";
  const capStr = jurisdiction.capital ? ` Capital: ${jurisdiction.capital}.` : "";
  const description = `Explore ${jurisdiction.name}'s ${govLabel.toLowerCase()} government structure. Interactive visualization of executive, legislative, and judicial branches.${popStr}${capStr}`;
  const url = `https://civicaatlas.org/countries/${slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    // withOg injects the shared default social image, because Next replaces
    // (not merges) the root layout's openGraph when a page sets its own.
    openGraph: withOg({
      title: `${title} | Civica`,
      description,
      url,
      type: "website",
    }),
    // This page overrides twitter too, so re-declare the shared image here.
    twitter: {
      card: "summary_large_image",
      title: `${title} | Civica`,
      description,
      images: [OG_DEFAULT_IMAGE],
    },
  };
}

export default async function CountryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let jurisdiction;
  try {
    jurisdiction = await getJurisdictionBySlug(slug);
  } catch {
    // DB not connected
  }
  if (!jurisdiction) notFound();

  const [sections, facts, govStructure, introSection, rankings, relatedCountries, legislatureData, parliamentBills, democracyData, constitution, leaderTimeline, ciDetail, pulseV2, reconciledFacts, wikidataSource, constituteSource] = await Promise.all([
    getFactbookSections(jurisdiction.id),
    getCountryFacts(jurisdiction.id),
    getGovernmentStructure(jurisdiction.id),
    getFactbookSection(jurisdiction.id, "introduction"),
    getCountryRankings(jurisdiction.id),
    getRelatedCountries(jurisdiction.id, jurisdiction.continent),
    getLegislatureComposition(jurisdiction.id),
    fetchParliamentBills(jurisdiction.iso2),
    getDemocracyScores(jurisdiction.id),
    getConstitution(jurisdiction.id),
    getLeaderTimeline(jurisdiction.id),
    getCICountryDetail(slug).catch(() => null),
    getPulseV2ForCountry(slug).catch(() => null),
    // Phase F.4 — resolver-direct fetch. Used by both the country
    // profile stats card (capital/pop/gdp/area/languages/currency) and
    // the FactbookSection LeafRow (Languages/Capital/etc that share
    // labels with fact-keys). One batch query covers both.
    getCanonicalFactsForJurisdiction(jurisdiction.id, [
      "population_total",
      "gdp_ppp_usd_billions",
      "area_total_km2",
      "capital",
      "official_languages",
      "currency_code",
    ]).catch(() => ({}) as Record<string, ResolverOutput>),
    // Live source freshness — avoids hardcoding retrieval dates.
    getSource("wikidata").catch(() => null),
    getSource("constitute_project").catch(() => null),
  ]);
  const ciScore: CIScoreData | null = ciDetail?.composite
    ? {
        score: Number(ciDetail.composite.score ?? 0),
        scoreLower:
          ciDetail.composite.scoreLower != null
            ? Number(ciDetail.composite.scoreLower)
            : null,
        scoreUpper:
          ciDetail.composite.scoreUpper != null
            ? Number(ciDetail.composite.scoreUpper)
            : null,
        band: (ciDetail.composite.band as string | null) ?? null,
        completenessFlag:
          (ciDetail.composite.completenessFlag as
            | "full"
            | "partial"
            | "insufficient"
            | null) ?? null,
        rank: ciDetail.composite.rank ?? null,
        totalRanked: ciDetail.composite.totalRanked ?? null,
        quarter: ciDetail.composite.quarter,
        isPartial: Boolean(ciDetail.composite.isPartial),
      }
    : null;
  const pulseScoreData: PulseScoreData | null = ciDetail?.pulse
    ? {
        pulseScore: Number(ciDetail.pulse.pulseScore ?? 0),
        eventImpact: Number(ciDetail.pulse.eventImpact ?? 0),
        activeEvents: Number(ciDetail.pulse.activeEvents ?? 0),
        scoreDate: ciDetail.pulse.scoreDate ? String(ciDetail.pulse.scoreDate) : "",
        isLowConfidence: Boolean(ciDetail.pulse.isLowConfidence),
      }
    : null;

  const regionalComparison = await getRegionalDemocracyComparison(jurisdiction.id, democracyData.continent);

  const factMap = new Map(facts.map((f) => [f.factKey, f]));

  const isQid = (name: string) => /^Q\d+$/.test(name);

  const headOfState = govStructure.currentTerms.find(
    (t) =>
      govStructure.offices.find((o) => o.id === t.term.officeId)
        ?.officeType === "head_of_state" && !isQid(t.person.name)
  );
  const headOfGov = govStructure.currentTerms.find(
    (t) =>
      govStructure.offices.find((o) => o.id === t.term.officeId)
        ?.officeType === "head_of_government" && !isQid(t.person.name)
  );

  const sectionNames = sections.map((s) => s.sectionName);
  const sectionDataMap = new Map(
    sections.map((s) => [s.sectionName, s.sectionData])
  );

  // Phase F.4 — resolver canonical takes precedence over the legacy
  // jurisdictions cache, mirroring the public-API contract at
  // /api/v1/countries/[code]. When the resolver lacks a canonical row
  // the row degrades to the legacy cache value with the legacy
  // SourceDot.
  const popResolver = reconciledFacts["population_total"] ?? null;
  const gdpResolver = reconciledFacts["gdp_ppp_usd_billions"] ?? null;
  const areaResolver = reconciledFacts["area_total_km2"] ?? null;
  const capitalResolver = reconciledFacts["capital"] ?? null;
  const langsResolver = reconciledFacts["official_languages"] ?? null;
  const currencyResolver = reconciledFacts["currency_code"] ?? null;

  const resolvedCapital = capitalResolver?.canonical?.factValue ?? jurisdiction.capital;
  const resolvedPopulation =
    popResolver?.canonical?.factValueNumeric != null
      ? Math.round(popResolver.canonical.factValueNumeric)
      : jurisdiction.population;
  const resolvedGdp = gdpResolver?.canonical?.factValueNumeric ?? jurisdiction.gdpBillions;
  const resolvedArea =
    areaResolver?.canonical?.factValueNumeric != null
      ? Math.round(areaResolver.canonical.factValueNumeric)
      : jurisdiction.areaSqKm;
  const resolvedLangs = langsResolver?.canonical?.factValue ?? jurisdiction.languages;
  const resolvedCurrency = currencyResolver?.canonical?.factValue ?? jurisdiction.currency;

  type ProfileRow = {
    label: string;
    value: string;
    source?: string;
    date?: string;
    factKey?: string;
    resolverFact?: ResolverOutput | null;
  };
  const profileRows: ProfileRow[] = [];
  if (resolvedCapital)
    profileRows.push({
      label: "Capital",
      value: resolvedCapital,
      factKey: "capital",
      resolverFact: capitalResolver,
    });
  if (resolvedPopulation)
    profileRows.push({
      label: "Population",
      value: formatNumber(resolvedPopulation),
      factKey: "population_total",
      resolverFact: popResolver,
    });
  if (resolvedGdp)
    profileRows.push({
      label: "GDP",
      value: `$${resolvedGdp.toFixed(1)}B`,
      factKey: "gdp_ppp_usd_billions",
      resolverFact: gdpResolver,
    });
  if (resolvedArea)
    profileRows.push({
      label: "Area",
      value: formatArea(resolvedArea),
      factKey: "area_total_km2",
      resolverFact: areaResolver,
    });
  if (resolvedLangs)
    profileRows.push({
      label: "Language",
      value: resolvedLangs,
      factKey: "official_languages",
      resolverFact: langsResolver,
    });
  if (resolvedCurrency)
    profileRows.push({
      label: "Currency",
      value: resolvedCurrency,
      factKey: "currency_code",
      resolverFact: currencyResolver,
    });
  const profileDemocracyLabel = vdemRowLabel(jurisdiction.democracyIndex);
  if (profileDemocracyLabel)
    profileRows.push({
      label: "Democracy",
      value: profileDemocracyLabel,
      source: VDEM_ROW_SOURCE,
      date: "2025",
    });

  const govCat = classifyGovernment(jurisdiction.governmentTypeDetail ?? jurisdiction.governmentType);
  const color = govCat.color;
  const govHeaderLabel = formatGovernmentType(jurisdiction.governmentTypeDetail ?? jurisdiction.governmentType) || govCat.label;
  const taxonomy = jurisdiction.governmentClassification ?? null;

  const branchColorMap: Record<string, string> = {
    executive: "var(--color-branch-executive)",
    legislative: "var(--color-branch-legislative)",
    judicial: "var(--color-branch-judicial)",
  };

  // Extract introduction text (strip raw HTML before slicing)
  let introText: string | null = null;
  if (introSection?.sectionData) {
    const data = introSection.sectionData as Record<string, unknown>;
    const bg = data["Background"] as { text?: string } | undefined;
    if (bg?.text) {
      const clean = firstSentences(bg.text, 3);
      introText = clean || null;
    }
  }

  const RANK_LABELS: Record<string, string> = {
    population: "Population",
    gdp_ppp: "GDP (PPP)",
    total_area: "Area",
    life_expectancy: "Life Expectancy",
    gdp_per_capita_ppp: "GDP per Capita",
  };

  function ordinal(n: number): string {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function formatBillDate(iso: string): string {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return iso;
    }
  }

  function BillRow({ bill }: { bill: Bill }) {
    return (
      <a
        href={bill.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "block",
          padding: "14px 0",
          borderBottom: "1px solid var(--color-stat-border)",
          textDecoration: "none",
          color: "inherit",
        }}
      >
        {bill.identifier && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: "var(--font-weight-mono)",
              fontSize: "var(--text-12)",
              color: "var(--color-text-30)",
              letterSpacing: "var(--tracking-wider)",
              textTransform: "uppercase",
              display: "block",
              marginBottom: 4,
            }}
          >
            {bill.identifier}
          </span>
        )}
        <span
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "var(--text-16)",
            color: "var(--color-text-primary)",
            display: "block",
            lineHeight: "var(--leading-snug)",
            marginBottom: bill.summary ? 4 : 6,
          }}
        >
          {bill.title}
        </span>
        {bill.summary && (
          <span
            style={{
              fontFamily: "var(--font-body-sans)",
              fontSize: "var(--text-14)",
              color: "var(--color-text-60)",
              display: "block",
              lineHeight: "var(--leading-relaxed)",
              marginBottom: 6,
            }}
          >
            {bill.summary}
          </span>
        )}
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: "var(--font-weight-mono)",
            fontSize: "var(--text-12)",
            color: "var(--color-text-40)",
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          <span>{bill.status}</span>
          {bill.date && (
            <>
              <span style={{ color: "var(--color-text-20)" }}>&middot;</span>
              <span>{formatBillDate(bill.date)}</span>
            </>
          )}
          <SourceDot source={bill.source} retrievedAt={null} />
        </span>
      </a>
    );
  }

  const parliamentSource = getParliamentSource(jurisdiction.iso2);
  const legislativeBodies = govStructure.bodies.filter((b) => b.branch === "legislative");

  /* ---- Laws in Motion tab ---- */
  const lawsTab = (
    <div>
      {parliamentBills.length > 0 ? (
        <>
          <div className="cv-card" style={{ marginBottom: 16 }}>
            <h3 className="section-header">Recent Legislative Activity</h3>
            {parliamentBills.map((bill, i) => (
              <BillRow key={i} bill={bill} />
            ))}
          </div>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: "var(--font-weight-mono)",
              fontSize: "var(--text-12)",
              color: "var(--color-text-25)",
              margin: 0,
            }}
          >
            Showing recent bills, fetched live from the official parliamentary feed.
          </p>
        </>
      ) : parliamentSource ? (
        <div className="cv-card">
          <h3 className="section-header">Legislative Feed</h3>
          <p
            style={{
              fontFamily: "var(--font-body-sans)",
              fontSize: "var(--text-15)",
              color: "var(--color-text-50)",
              margin: 0,
              lineHeight: "var(--leading-relaxed)",
            }}
          >
            Legislative feed temporarily unavailable. Data is sourced from{" "}
            <SourceDot source={parliamentSource} retrievedAt={null} />
          </p>
        </div>
      ) : (
        <>
          <div className="cv-card" style={{ marginBottom: 16 }}>
            <h3 className="section-header">No live legislative feed</h3>
            <p
              style={{
                fontFamily: "var(--font-body-sans)",
                fontSize: "var(--text-15)",
                color: "var(--color-text-50)",
                margin: 0,
                lineHeight: "var(--leading-relaxed)",
              }}
            >
              No real-time legislative data is currently available for {jurisdiction.name}.
              Live feeds are available for the US Congress, UK Parliament, and European Parliament.
            </p>
          </div>
          {legislativeBodies.length > 0 && (
            <div className="cv-card">
              <h3 className="section-header">Legislative Structure</h3>
              {legislativeBodies.map((body) => (
                <div
                  key={body.id}
                  className="branch-line"
                  style={{
                    borderLeftColor: "color-mix(in srgb, var(--color-branch-legislative) 27%, transparent)",
                  }}
                >
                  {body.name}
                  {body.totalSeats != null && (
                    <span style={{ color: "var(--color-text-40)" }}>
                      {" — "}{body.totalSeats.toLocaleString()} seats
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );

  /* ---- Overview tab: intro + 2-column with Profile + Leadership + Rankings ---- */
  const overviewTab = (
    <div>
      {introText && (
        <div className="cv-card" style={{ marginBottom: 16 }}>
          <p
            style={{
              fontFamily: "var(--font-body-sans)",
              fontSize: "var(--text-16)",
              color: "var(--color-text-85)",
              lineHeight: "var(--leading-relaxed)",
              margin: 0,
            }}
          >
            {introText}
            <SourceDot source="cia_factbook" retrievedAt="2026-01-23" />
          </p>
        </div>
      )}

      <div className="overview-grid">
      {/* Profile card */}
      <div className="cv-card">
        <h3 className="section-header">Profile</h3>
        {profileRows.map((row) => (
          <StatRow
            key={row.label}
            label={row.label}
            val={row.value}
            source={row.source}
            date={row.date}
            factKey={row.factKey}
            resolverFact={row.resolverFact}
          />
        ))}
      </div>

      {/* Right column: Leadership + At a Glance */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {(headOfState || headOfGov) && (
          <div className="cv-card">
            <h3 className="section-header">Leadership</h3>
            {headOfState && (
              <div style={{ marginBottom: headOfGov && headOfGov.person.name !== headOfState.person.name ? 16 : 0 }}>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontWeight: "var(--font-weight-mono)",
                    fontSize: "var(--text-12)",
                    color: "var(--color-text-30)",
                    letterSpacing: "var(--tracking-wider)",
                    textTransform: "uppercase",
                  }}
                >
                  Head of State
                </span>
                <p
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: "var(--text-22)",
                    fontWeight: 400,
                    margin: "4px 0 0",
                    color: "var(--color-text-primary)",
                  }}
                >
                  {headOfState.person.name}
                  <SourceDot source="wikidata" retrievedAt={wikidataSource?.lastSyncAt?.toISOString() ?? null} />
                </p>
                {(headOfState.term.partyName || headOfState.term.startDate) && (
                  <p
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontWeight: "var(--font-weight-mono)",
                      fontSize: "var(--text-12)",
                      color: "var(--color-text-30)",
                      margin: "4px 0 0",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {headOfState.term.partyName && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        {headOfState.term.partyColor && (
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: headOfState.term.partyColor, flexShrink: 0 }} />
                        )}
                        {headOfState.term.partyName}
                      </span>
                    )}
                    {headOfState.term.partyName && headOfState.term.startDate && <span style={{ color: "var(--color-text-20)" }}>&middot;</span>}
                    {headOfState.term.startDate && (
                      <span>Since {new Date(headOfState.term.startDate).getFullYear()}</span>
                    )}
                  </p>
                )}
              </div>
            )}
            {headOfGov && headOfGov.person.name !== headOfState?.person.name && (
              <div>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontWeight: "var(--font-weight-mono)",
                    fontSize: "var(--text-12)",
                    color: "var(--color-text-30)",
                    letterSpacing: "var(--tracking-wider)",
                    textTransform: "uppercase",
                  }}
                >
                  Head of Government
                </span>
                <p
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: "var(--text-22)",
                    fontWeight: 400,
                    margin: "4px 0 0",
                    color: "var(--color-text-primary)",
                  }}
                >
                  {headOfGov.person.name}
                  <SourceDot source="wikidata" retrievedAt={wikidataSource?.lastSyncAt?.toISOString() ?? null} />
                </p>
                {(headOfGov.term.partyName || headOfGov.term.startDate) && (
                  <p
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontWeight: "var(--font-weight-mono)",
                      fontSize: "var(--text-12)",
                      color: "var(--color-text-30)",
                      margin: "4px 0 0",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {headOfGov.term.partyName && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        {headOfGov.term.partyColor && (
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: headOfGov.term.partyColor, flexShrink: 0 }} />
                        )}
                        {headOfGov.term.partyName}
                      </span>
                    )}
                    {headOfGov.term.partyName && headOfGov.term.startDate && <span style={{ color: "var(--color-text-20)" }}>&middot;</span>}
                    {headOfGov.term.startDate && (
                      <span>Since {new Date(headOfGov.term.startDate).getFullYear()}</span>
                    )}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* At a Glance stats */}
        <div className="cv-card">
          <h3 className="section-header">At a Glance</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {factMap.get("population") && (
              <div>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontWeight: "var(--font-weight-mono)",
                    fontSize: "var(--text-12)",
                    color: "var(--color-text-30)",
                    textTransform: "uppercase",
                  }}
                >
                  Population
                </span>
                <p
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: "var(--text-20)",
                    marginTop: 4,
                    color: "var(--color-text-primary)",
                  }}
                >
                  {factMap.get("population")!.factValueNumeric
                    ? formatNumber(factMap.get("population")!.factValueNumeric!)
                    : factMap.get("population")!.factValue}
                </p>
              </div>
            )}
            {factMap.get("gdp_ppp") && (
              <div>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontWeight: "var(--font-weight-mono)",
                    fontSize: "var(--text-12)",
                    color: "var(--color-text-30)",
                    textTransform: "uppercase",
                  }}
                >
                  GDP (PPP)
                </span>
                <p
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: "var(--text-20)",
                    marginTop: 4,
                    color: "var(--color-text-primary)",
                  }}
                >
                  {factMap.get("gdp_ppp")!.factValueNumeric
                    ? `$${(factMap.get("gdp_ppp")!.factValueNumeric! / 1e9).toFixed(0)}B`
                    : factMap.get("gdp_ppp")!.factValue}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>

      {rankings.length > 0 && (
        <div className="cv-card" style={{ marginTop: 16 }}>
          <h3 className="section-header">Global Rankings</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            {rankings.map((r) => (
              <a
                key={r.key}
                href={`/rankings?metric=${r.key}`}
                style={{
                  flex: "1 1 120px",
                  textAlign: "center",
                  padding: "8px 0",
                  textDecoration: "none",
                  color: "inherit",
                  borderRadius: "var(--radius-sm)",
                  transition: "background-color 0.15s ease",
                }}
                className="ranking-chip"
              >
                <span
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: "var(--text-24)",
                    color: "var(--color-accent)",
                    display: "block",
                  }}
                >
                  {ordinal(r.rank)}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontWeight: "var(--font-weight-mono)",
                    fontSize: "var(--text-12)",
                    color: "var(--color-text-30)",
                    letterSpacing: "var(--tracking-wide)",
                    textTransform: "uppercase",
                  }}
                >
                  {RANK_LABELS[r.key] ?? r.key}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontWeight: "var(--font-weight-mono)",
                    fontSize: "var(--text-12)",
                    color: "var(--color-text-25)",
                    display: "block",
                    marginTop: 2,
                  }}
                >
                  of {r.total}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  /* ---- Government tab: SVG diagram + branch text listing ---- */
  const governmentTab = (
    <div>
      {govStructure.bodies.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <GovStructureDiagram
            bodies={govStructure.bodies}
            offices={govStructure.offices}
            currentTerms={govStructure.currentTerms}
            countryName={jurisdiction.name}
            parties={legislatureData.flatMap(({ body, parties }) =>
              parties.map((p) => ({
                bodyId: body.id,
                partyName: p.partyName,
                partyColor: p.partyColor,
                seatCount: p.seatCount,
                isRulingCoalition: p.isRulingCoalition,
              }))
            )}
          />
        </div>
      )}
      <div className="cv-card">
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontWeight: "var(--font-weight-mono)",
          fontSize: "var(--text-14)",
          color: "var(--color-text-50)",
          lineHeight: "var(--leading-relaxed)",
          marginTop: 0,
          marginBottom: 28,
        }}
      >
        {jurisdiction.name} is a {govHeaderLabel.toLowerCase() || "sovereign state"}.
        {headOfState && headOfGov && headOfGov.person.name === headOfState.person.name
          ? ` The ${govStructure.offices.find((o) => o.id === headOfState.term.officeId)?.name?.toLowerCase() ?? "head of state"} serves as both head of state and head of government.`
          : headOfState && headOfGov
            ? ` The head of state is separate from the head of government.`
            : ""}
      </p>
      {govStructure.bodies.map((body) => {
        const bColor = branchColorMap[body.branch ?? ""] ?? "var(--color-gov-other)";
        const bodyOffices = govStructure.offices.filter((o) => o.bodyId === body.id);
        if (bodyOffices.length === 0) return null;
        return (
          <div key={body.id} style={{ marginBottom: 28 }}>
            <h3
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: "var(--font-weight-mono)",
                fontSize: "var(--text-12)",
                letterSpacing: "var(--tracking-caps)",
                textTransform: "uppercase",
                color: bColor,
                margin: "0 0 10px",
              }}
            >
              {body.branch ?? body.name}
            </h3>
            {bodyOffices.map((office) => {
              const currentHolder = govStructure.currentTerms.find((t) => t.term.officeId === office.id);
              return (
                <div
                  key={office.id}
                  className="branch-line"
                  style={{ borderLeftColor: `color-mix(in srgb, ${bColor} 27%, transparent)` }}
                >
                  {office.name}
                  {currentHolder && !isQid(currentHolder.person.name) && (
                    <span style={{ color: "var(--color-text-40)" }}>
                      {" — "}{currentHolder.person.name}
                      {currentHolder.term.partyName && (
                        <span style={{ color: "var(--color-text-25)", fontSize: "var(--text-12)" }}>
                          {" ("}
                          {currentHolder.term.partyColor && (
                            <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: currentHolder.term.partyColor, marginRight: 3, verticalAlign: "middle" }} />
                          )}
                          {currentHolder.term.partyName}{")"}
                        </span>
                      )}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
    </div>
  );

  /* ---- Outcomes tab ---- */
  const outcomesTab = (
    <div>
      <CountryOutcomeBars
        slug={slug}
        countryName={jurisdiction.name}
        year={new Date().getFullYear()}
      />
    </div>
  );

  /* ---- Factbook tab ---- */
  const factbookTab = sections.length > 0 ? (
    <div>
      <FactbookSectionTabs
        sections={sectionNames}
        defaultSection={sectionNames.includes("government") ? "government" : sectionNames[0]}
      >
        {sectionNames.map((sectionName) => {
          const data = sectionDataMap.get(sectionName);
          if (!data) return <div key={sectionName} />;
          const fields = jsonbToFields(data);
          return (
            <div key={sectionName}>
              {/* Geographic-name provenance note — shown only when this
               *  section's raw CIA prose contains a phrase we normalize
               *  for display (today: "Gulf of America" → "Gulf of
               *  Mexico"). Mirrors the /factbook/[slug] note. See
               *  `src/lib/data/geographic-name-normalization.ts`. */}
              {sectionDataHasNormalizableGeographicName(data) && (
                <Banner variant="info">
                  <strong>Naming:</strong>{" "}
                  Civica uses &ldquo;Gulf of Mexico,&rdquo; the name recognized
                  by the International Hydrographic Organization and the United
                  Nations. The source data (CIA World Factbook) adopted
                  &ldquo;Gulf of America&rdquo; following a U.S. executive order
                  in January 2025.
                </Banner>
              )}
              <FactbookSection
                sectionName={sectionName}
                fields={fields}
                source="cia_factbook"
                retrievedAt="2026-01-23"
                resolverFacts={reconciledFacts}
              />
            </div>
          );
        })}
      </FactbookSectionTabs>
    </div>
  ) : null;

  /* ---- Legislature tab: hemicycle charts per chamber ---- */
  const legislatureTab = legislatureData.length > 0 ? (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {legislatureData.map(({ body, parties }) => (
        <FactbookLegislatureChart
          key={body.id}
          chamber={{
            id: body.id,
            slot: body.chamberType === "upper" ? "upper" : "lower",
            name: body.name,
            total:
              body.totalSeats ??
              parties.reduce((s, p) => s + p.seatCount, 0),
            sub: `${
              body.totalSeats ??
              parties.reduce((s, p) => s + p.seatCount, 0)
            } seats`,
            parties: parties.map((p, i) => ({
              id: p.id,
              name: p.partyName,
              seats: p.seatCount,
              color: resolvePartyColor(p.partyColor, p.partyName, i),
            })),
          }}
          houseLabel={
            body.chamberType === "upper"
              ? "Upper house"
              : body.chamberType === "lower"
                ? "Lower house"
                : "Legislature"
          }
          countryName={jurisdiction.name}
        />
      ))}
    </div>
  ) : null;

  /* ---- Democracy tab ---- */
  const democracyTab = (
    <div>
      <div className="cv-card" style={{ marginBottom: 16 }}>
        <h3 className="section-header">Regime Type</h3>
        {vdemRowLabel(democracyData.democracyIndex) != null ? (
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "var(--text-44)",
                lineHeight: 1.1,
                color: "var(--color-text-primary)",
              }}
            >
              {vdemRowLabel(democracyData.democracyIndex)}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 6,
                fontFamily: "var(--font-mono)",
                fontWeight: "var(--font-weight-mono)",
                fontSize: "var(--text-12)",
                color: "var(--color-text-30)",
              }}
            >
              <span>
                Tier {vdemRowTier(democracyData.democracyIndex)} of {VDEM_ROW_MAX_TIER} · V-Dem Regimes of the World
              </span>
              <SourceDot source={VDEM_ROW_SOURCE} retrievedAt="2025" />
            </div>
          </div>
        ) : (
          <p style={{ fontFamily: "var(--font-body-sans)", fontSize: "var(--text-15)", color: "var(--color-text-50)", margin: 0 }}>
            No regime classification available.
          </p>
        )}
      </div>

      {democracyData.freedomHouseFacts.length > 0 && (
        <div className="cv-card" style={{ marginBottom: 16 }}>
          <h3 className="section-header">Freedom House</h3>
          {democracyData.freedomHouseFacts.map((f) => (
            <StatRow
              key={f.factKey}
              label={f.factKey.replace("freedom_house_", "").replace(/_/g, " ")}
              val={f.factValue ?? "—"}
              source="Freedom House"
              date={f.factYear != null ? String(f.factYear) : undefined}
            />
          ))}
        </div>
      )}

      {regionalComparison.length > 0 && (
        <div className="cv-card">
          <h3 className="section-header">Regional Comparison ({jurisdiction.continent})</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {regionalComparison.map((rc, i) => (
              <a
                key={rc.id}
                href={`/countries/${rc.slug}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 0",
                  borderBottom: i < regionalComparison.length - 1 ? "1px solid var(--color-stat-border)" : "none",
                  textDecoration: "none",
                  color: "inherit",
                  fontWeight: rc.id === jurisdiction.id ? 600 : 400,
                  background: rc.id === jurisdiction.id ? "var(--color-surface-hover)" : "transparent",
                  borderRadius: rc.id === jurisdiction.id ? "var(--radius-sm)" : 0,
                  paddingLeft: rc.id === jurisdiction.id ? 8 : 0,
                  paddingRight: rc.id === jurisdiction.id ? 8 : 0,
                }}
              >
                <span style={{ fontFamily: "var(--font-body-sans)", fontSize: "var(--text-15)" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-12)", color: "var(--color-text-25)", marginRight: 8, minWidth: 20, display: "inline-block" }}>
                    {i + 1}.
                  </span>
                  {rc.name}
                </span>
                <span
                  title={vdemRowLabel(rc.democracyIndex) ?? undefined}
                  style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-13)", color: "var(--color-text-40)" }}
                >
                  {vdemRowTier(rc.democracyIndex) != null
                    ? `${vdemRowTier(rc.democracyIndex)}/${VDEM_ROW_MAX_TIER}`
                    : "—"}
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  /* ---- Leaders tab ---- */
  const currentLeaders = leaderTimeline.filter((l) => l.isCurrent);
  const pastLeaders = leaderTimeline.filter((l) => !l.isCurrent);

  const leadersTab = leaderTimeline.length > 0 ? (
    <div>
      {currentLeaders.length > 0 && (
        <div className="cv-card" style={{ marginBottom: 16 }}>
          <h3 className="section-header">Current Leaders</h3>
          {currentLeaders.map((leader, i) => (
            <div
              key={`current-${i}`}
              style={{
                padding: "14px 0",
                borderBottom: i < currentLeaders.length - 1 ? "1px solid var(--color-stat-border)" : "none",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              {leader.photoUrl && (
                <img
                  src={leader.photoUrl}
                  alt={leader.personName}
                  style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                />
              )}
              <div>
                <span style={{ fontFamily: "var(--font-heading)", fontSize: "var(--text-18)", color: "var(--color-text-primary)", display: "block" }}>
                  {leader.personName}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-12)", color: "var(--color-text-40)", display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                  {leader.officeName}
                  {leader.partyName && (
                    <>
                      <span style={{ color: "var(--color-text-20)" }}>&middot;</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                        {leader.partyColor && <span style={{ width: 5, height: 5, borderRadius: "50%", background: leader.partyColor }} />}
                        {leader.partyName}
                      </span>
                    </>
                  )}
                  {leader.startDate && (
                    <>
                      <span style={{ color: "var(--color-text-20)" }}>&middot;</span>
                      <span>Since {new Date(leader.startDate).getFullYear()}</span>
                    </>
                  )}
                  <SourceDot source="wikidata" retrievedAt={wikidataSource?.lastSyncAt?.toISOString() ?? null} />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {pastLeaders.length > 0 && (
        <div className="cv-card">
          <h3 className="section-header">Past Leaders</h3>
          {pastLeaders.slice(0, 20).map((leader, i) => (
            <div
              key={`past-${i}`}
              style={{
                padding: "10px 0",
                borderBottom: i < Math.min(pastLeaders.length, 20) - 1 ? "1px solid var(--color-stat-border)" : "none",
              }}
            >
              <span style={{ fontFamily: "var(--font-body-sans)", fontSize: "var(--text-15)", color: "var(--color-text-primary)" }}>
                {leader.personName}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-12)", color: "var(--color-text-30)", display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                {leader.officeName}
                {leader.startDate && (
                  <>
                    <span style={{ color: "var(--color-text-20)" }}>&middot;</span>
                    <span>
                      {new Date(leader.startDate).getFullYear()}
                      {leader.endDate ? `–${new Date(leader.endDate).getFullYear()}` : ""}
                    </span>
                  </>
                )}
                {leader.partyName && (
                  <>
                    <span style={{ color: "var(--color-text-20)" }}>&middot;</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
                      {leader.partyColor && <span style={{ width: 5, height: 5, borderRadius: "50%", background: leader.partyColor }} />}
                      {leader.partyName}
                    </span>
                  </>
                )}
              </span>
            </div>
          ))}
          {pastLeaders.length > 20 && (
            <p style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-12)", color: "var(--color-text-25)", marginTop: 12 }}>
              Showing 20 of {pastLeaders.length} past leaders.
            </p>
          )}
        </div>
      )}
    </div>
  ) : null;

  /* ---- Constitution tab ---- */
  const constitutionTab = constitution ? (
    <div>
      <div className="cv-card" style={{ marginBottom: 16 }}>
        <h3 className="section-header">Constitution</h3>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 16 }}>
          {constitution.year && (
            <div>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-12)", color: "var(--color-text-30)", textTransform: "uppercase", display: "block" }}>
                Enacted
              </span>
              <span style={{ fontFamily: "var(--font-heading)", fontSize: "var(--text-22)", color: "var(--color-text-primary)" }}>
                {constitution.year}
              </span>
            </div>
          )}
          {constitution.yearUpdated && (
            <div>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-12)", color: "var(--color-text-30)", textTransform: "uppercase", display: "block" }}>
                Last Amended
              </span>
              <span style={{ fontFamily: "var(--font-heading)", fontSize: "var(--text-22)", color: "var(--color-text-primary)" }}>
                {constitution.yearUpdated}
              </span>
            </div>
          )}
        </div>
        {constitution.constituteProjectId && (
          <p style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-12)", color: "var(--color-text-30)", margin: 0 }}>
            Source: Constitute Project
            <SourceDot source="Constitute Project" retrievedAt={constituteSource?.lastSyncAt?.toISOString() ?? null} />
          </p>
        )}
      </div>

      {constitution.fullTextHtml && (
        <div className="cv-card">
          <h3 className="section-header">Full Text</h3>
          <div
            style={{
              fontFamily: "var(--font-body-sans)",
              fontSize: "var(--text-15)",
              lineHeight: "var(--leading-relaxed)",
              color: "var(--color-text-85)",
              maxHeight: 600,
              overflow: "auto",
            }}
            dangerouslySetInnerHTML={{ __html: constitution.fullTextHtml }}
          />
        </div>
      )}
    </div>
  ) : null;

  const constitutionTabContent = constitutionTab ?? (
    <div className="cv-card">
      <h3 className="section-header">Constitution</h3>
      <p style={{ fontFamily: "var(--font-body-sans)", fontSize: "var(--text-15)", color: "var(--color-text-50)", margin: 0, lineHeight: "var(--leading-relaxed)" }}>
        Constitution data for {jurisdiction.name} has not yet been added to Civica.
      </p>
    </div>
  );

  const tabs = [
    { id: "overview", label: "Overview", content: overviewTab },
    { id: "government", label: "Government", content: governmentTab },
    { id: "outcomes", label: "Outcomes", content: outcomesTab },
    ...(legislatureTab ? [{ id: "legislature", label: "Legislature", content: legislatureTab }] : []),
    { id: "laws", label: "Laws in Motion", content: lawsTab },
    { id: "democracy", label: "Democracy", content: democracyTab },
    ...(leadersTab ? [{ id: "leaders", label: "Leaders", content: leadersTab }] : []),
    { id: "constitution", label: "Constitution", content: constitutionTabContent },
    ...(factbookTab ? [{ id: "factbook", label: "Factbook", content: factbookTab }] : []),
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: `${jurisdiction.name} Government Structure`,
    description: `Explore ${jurisdiction.name}'s ${(jurisdiction.governmentTypeDetail ?? jurisdiction.governmentType ?? "sovereign state").toLowerCase()} government structure.`,
    url: `https://civicaatlas.org/countries/${slug}`,
    isPartOf: {
      "@type": "WebSite",
      name: "Civica",
      url: "https://civicaatlas.org",
    },
    about: {
      "@type": "Country",
      name: jurisdiction.name,
      ...(jurisdiction.iso2 ? { identifier: jurisdiction.iso2 } : {}),
    },
    mainEntity: {
      "@type": "GovernmentOrganization",
      name: `Government of ${jurisdiction.name}`,
      areaServed: { "@type": "Country", name: jurisdiction.name },
    },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://civicaatlas.org" },
        { "@type": "ListItem", position: 2, name: "Countries", item: "https://civicaatlas.org/countries" },
        { "@type": "ListItem", position: 3, name: jurisdiction.name, item: `https://civicaatlas.org/countries/${slug}` },
      ],
    },
  };

  return (
    <div
      style={{
        maxWidth: "var(--max-w-content)",
        margin: "0 auto",
        padding: "var(--spacing-content-top) var(--spacing-page-x)",
      }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Breadcrumb */}
      <Link href="/countries" className="breadcrumb">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 12L6 8l4-4"/></svg>
        All countries
      </Link>

      {/* Country header */}
      <div className="country-header">
        <CountryFlag iso2={jurisdiction.iso2} size={56} />
        <div>
          <h1 className="country-title">
            {jurisdiction.name}
          </h1>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: "var(--font-weight-mono)",
              fontSize: "var(--text-13)",
              color,
              margin: "6px 0 0",
            }}
          >
            {govHeaderLabel}
          </p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <a
            href={`/api/countries/${slug}/export?format=json`}
            download
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: "var(--font-weight-mono)",
              fontSize: "var(--text-12)",
              color: "var(--color-text-30)",
              textDecoration: "none",
              padding: "6px 10px",
              border: "1px solid var(--color-stat-border)",
              borderRadius: "var(--radius-sm)",
              letterSpacing: "var(--tracking-wide)",
              textTransform: "uppercase",
            }}
          >
            JSON
          </a>
          <a
            href={`/api/countries/${slug}/export?format=csv`}
            download
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: "var(--font-weight-mono)",
              fontSize: "var(--text-12)",
              color: "var(--color-text-30)",
              textDecoration: "none",
              padding: "6px 10px",
              border: "1px solid var(--color-stat-border)",
              borderRadius: "var(--radius-sm)",
              letterSpacing: "var(--tracking-wide)",
              textTransform: "uppercase",
            }}
          >
            CSV
          </a>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <GovernmentTaxonomyBlock classification={taxonomy} />
      </div>

      {/* Tabs — prototype: gap 2, border-bottom, 28px top margin, 32px bottom margin */}
      {(ciScore || pulseV2) && (
        <div style={{ marginTop: 32 }}>
          <CIPulseScoreDisplay ciScore={ciScore} />
          {pulseV2 ? <PulseDimensionalDeltas data={pulseV2} /> : null}
          <div
            style={{
              marginTop: -8,
              marginBottom: 32,
              fontFamily: "var(--font-mono)",
              fontWeight: "var(--font-weight-mono)",
              fontSize: "var(--text-12)",
              letterSpacing: "var(--tracking-wider)",
              color: "var(--color-text-30)",
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <Link
              href={`/civica-index/${slug}`}
              style={{ color: "var(--color-accent)", textDecoration: "none" }}
            >
              See full Civica Index breakdown →
            </Link>
            <Link
              href={`/civica-index/pulse-changelog?country=${slug}`}
              style={{ color: "var(--color-accent)", textDecoration: "none" }}
            >
              Pulse events
            </Link>
            <Link
              href="/civica-index/methodology"
              style={{ color: "var(--color-accent)", textDecoration: "none" }}
            >
              Methodology
            </Link>
          </div>
        </div>
      )}

      {/* Civica Conditions — material conditions companion layer (spec §2.8) */}
      <div style={{ marginBottom: 32 }}>
        <CivicaConditionsPanel jurisdictionId={jurisdiction.id} />
      </div>

      <CountryTabs tabs={tabs} />

      {relatedCountries.length > 0 && (
        <section style={{ marginTop: 48 }}>
          <h2
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: "var(--font-weight-mono)",
              fontSize: "var(--text-12)",
              letterSpacing: "var(--tracking-caps)",
              textTransform: "uppercase",
              color: "var(--color-text-30)",
              marginBottom: 16,
            }}
          >
            More in {jurisdiction.continent}
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: 1,
              background: "var(--color-grid-bg)",
              borderRadius: "var(--radius-sm)",
              overflow: "hidden",
            }}
          >
            {relatedCountries.map((rc) => (
              <a
                key={rc.slug}
                href={`/countries/${rc.slug}`}
                className="country-grid-cell"
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  padding: "16px 20px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <CountryFlag iso2={rc.iso2} size={24} />
                <div style={{ minWidth: 0 }}>
                  <span
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontSize: "var(--text-16)",
                      color: "var(--color-text-primary)",
                      display: "block",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {rc.name}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontWeight: "var(--font-weight-mono)",
                      fontSize: "var(--text-12)",
                      color: "var(--color-text-25)",
                    }}
                  >
                    {rc.capital}
                  </span>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
