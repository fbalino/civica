import type { Metadata } from "next";
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
} from "@/lib/db/queries";
import { SourceDot } from "@/components/SourceDot";
import { FactbookSectionTabs } from "@/components/FactbookSectionNav";
import { FactbookSection } from "@/components/FactbookSection";
import { jsonbToFields } from "@/lib/data/factbook-fields";
import { CountryTabs } from "./tabs";
import { CountryFlag } from "@/components/CountryFlag";
import { GovStructureDiagram } from "@/components/GovStructureDiagram";
import { HemicycleChart } from "@/components/HemicycleChart";
import { classifyGovernment } from "@/lib/data/government-category";
import { resolvePartyColor } from "@/lib/data/party-colors";
import { stripHtml, firstSentences, formatGovernmentType } from "@/lib/text/clean";
import { fetchParliamentBills, getParliamentSource, type Bill } from "@/lib/data/parliament-feeds";

function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

function formatArea(n: number): string {
  return `${n.toLocaleString()} km\u00B2`;
}

function StatRow({ label, val, source, date }: { label: string; val: string; source?: string; date?: string }) {
  return (
    <div className="stat-row">
      <span className="stat-row__label">{label}</span>
      <span className="stat-row__value">
        {val}
        <SourceDot source={source ?? "cia_factbook"} retrievedAt={date ?? "2026-01-23"} />
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const jurisdiction = await getJurisdictionBySlug(slug);
  if (!jurisdiction) return { title: "Country Not Found" };
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
    openGraph: {
      title: `${title} | Civica`,
      description,
      url,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Civica`,
      description,
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

  const [sections, facts, govStructure, introSection, rankings, relatedCountries, legislatureData, parliamentBills, democracyData, constitution, leaderTimeline] = await Promise.all([
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
  ]);

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

  const profileRows: { label: string; value: string; source?: string; date?: string }[] = [];
  if (jurisdiction.capital) profileRows.push({ label: "Capital", value: jurisdiction.capital });
  if (jurisdiction.population) profileRows.push({ label: "Population", value: formatNumber(jurisdiction.population) });
  if (jurisdiction.gdpBillions) profileRows.push({ label: "GDP", value: `$${jurisdiction.gdpBillions.toFixed(1)}B` });
  if (jurisdiction.areaSqKm) profileRows.push({ label: "Area", value: formatArea(jurisdiction.areaSqKm) });
  if (jurisdiction.languages) profileRows.push({ label: "Language", value: jurisdiction.languages });
  if (jurisdiction.currency) profileRows.push({ label: "Currency", value: jurisdiction.currency });
  if (jurisdiction.democracyIndex) profileRows.push({ label: "Democracy", value: jurisdiction.democracyIndex.toFixed(2), source: "V-Dem Institute", date: "2025" });

  const govCat = classifyGovernment(jurisdiction.governmentTypeDetail ?? jurisdiction.governmentType);
  const color = govCat.color;
  const govHeaderLabel = formatGovernmentType(jurisdiction.governmentTypeDetail ?? jurisdiction.governmentType) || govCat.label;

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
              fontSize: "var(--text-10)",
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
            marginBottom: 6,
          }}
        >
          {bill.title}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: "var(--font-weight-mono)",
            fontSize: "var(--text-11)",
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
          <SourceDot source={bill.source} retrievedAt={new Date().toISOString().slice(0, 10)} />
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
              fontSize: "var(--text-11)",
              color: "var(--color-text-25)",
              margin: 0,
            }}
          >
            Showing recent bills. Data refreshes hourly.
          </p>
        </>
      ) : parliamentSource ? (
        <div className="cv-card">
          <h3 className="section-header">Legislative Feed</h3>
          <p
            style={{
              fontFamily: "var(--font-body-sans)",
              fontSize: "var(--text-14)",
              color: "var(--color-text-50)",
              margin: 0,
              lineHeight: "var(--leading-relaxed)",
            }}
          >
            Legislative feed temporarily unavailable. Data is sourced from{" "}
            <SourceDot source={parliamentSource} retrievedAt={new Date().toISOString().slice(0, 10)} />
          </p>
        </div>
      ) : (
        <>
          <div className="cv-card" style={{ marginBottom: 16 }}>
            <h3 className="section-header">No live legislative feed</h3>
            <p
              style={{
                fontFamily: "var(--font-body-sans)",
                fontSize: "var(--text-14)",
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
          <StatRow key={row.label} label={row.label} val={row.value} source={row.source} date={row.date} />
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
                    fontSize: "var(--text-10)",
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
                  <SourceDot source="wikidata" retrievedAt="2026-04-13" />
                </p>
                {(headOfState.term.partyName || headOfState.term.startDate) && (
                  <p
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontWeight: "var(--font-weight-mono)",
                      fontSize: "var(--text-11)",
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
                    fontSize: "var(--text-10)",
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
                  <SourceDot source="wikidata" retrievedAt="2026-04-13" />
                </p>
                {(headOfGov.term.partyName || headOfGov.term.startDate) && (
                  <p
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontWeight: "var(--font-weight-mono)",
                      fontSize: "var(--text-11)",
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
                    fontSize: "var(--text-10)",
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
                    fontSize: "var(--text-10)",
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
                    fontSize: "var(--text-10)",
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
                    fontSize: "var(--text-10)",
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
          />
        </div>
      )}
      <div className="cv-card">
      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontWeight: "var(--font-weight-mono)",
          fontSize: "var(--text-13)",
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
                fontSize: "var(--text-10)",
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
                        <span style={{ color: "var(--color-text-25)", fontSize: "var(--text-11)" }}>
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
            <FactbookSection
              key={sectionName}
              sectionName={sectionName}
              fields={fields}
              source="cia_factbook"
              retrievedAt="2026-01-23"
            />
          );
        })}
      </FactbookSectionTabs>
    </div>
  ) : null;

  /* ---- Legislature tab: hemicycle charts per chamber ---- */
  const legislatureTab = legislatureData.length > 0 ? (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {legislatureData.map(({ body, parties }) => (
        <HemicycleChart
          key={body.id}
          chamberName={body.name}
          totalSeats={body.totalSeats ?? parties.reduce((s, p) => s + p.seatCount, 0)}
          parties={parties.map((p, i) => ({
            name: p.partyName,
            seats: p.seatCount,
            color: resolvePartyColor(p.partyColor, p.partyName, i),
          }))}
        />
      ))}
    </div>
  ) : null;

  /* ---- Democracy tab ---- */
  const democracyTab = (
    <div>
      <div className="cv-card" style={{ marginBottom: 16 }}>
        <h3 className="section-header">Democracy Index</h3>
        {democracyData.democracyIndex != null ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 16 }}>
            <span
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "var(--text-36)",
                color: "var(--color-text-primary)",
              }}
            >
              {democracyData.democracyIndex.toFixed(2)}
            </span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: "var(--font-weight-mono)",
                fontSize: "var(--text-11)",
                color: "var(--color-text-30)",
              }}
            >
              / 1.00
              <SourceDot source="V-Dem Institute" retrievedAt="2025" />
            </span>
          </div>
        ) : (
          <p style={{ fontFamily: "var(--font-body-sans)", fontSize: "var(--text-14)", color: "var(--color-text-50)", margin: 0 }}>
            No democracy index data available.
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
                <span style={{ fontFamily: "var(--font-body-sans)", fontSize: "var(--text-14)" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-11)", color: "var(--color-text-25)", marginRight: 8, minWidth: 20, display: "inline-block" }}>
                    {i + 1}.
                  </span>
                  {rc.name}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-12)", color: "var(--color-text-40)" }}>
                  {rc.democracyIndex?.toFixed(2) ?? "—"}
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
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-11)", color: "var(--color-text-40)", display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
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
                  <SourceDot source="wikidata" retrievedAt="2026-04-13" />
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
              <span style={{ fontFamily: "var(--font-body-sans)", fontSize: "var(--text-14)", color: "var(--color-text-primary)" }}>
                {leader.personName}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-11)", color: "var(--color-text-30)", display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
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
            <p style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-11)", color: "var(--color-text-25)", marginTop: 12 }}>
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
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-10)", color: "var(--color-text-30)", textTransform: "uppercase", display: "block" }}>
                Enacted
              </span>
              <span style={{ fontFamily: "var(--font-heading)", fontSize: "var(--text-22)", color: "var(--color-text-primary)" }}>
                {constitution.year}
              </span>
            </div>
          )}
          {constitution.yearUpdated && (
            <div>
              <span style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-10)", color: "var(--color-text-30)", textTransform: "uppercase", display: "block" }}>
                Last Amended
              </span>
              <span style={{ fontFamily: "var(--font-heading)", fontSize: "var(--text-22)", color: "var(--color-text-primary)" }}>
                {constitution.yearUpdated}
              </span>
            </div>
          )}
        </div>
        {constitution.constituteProjectId && (
          <p style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-11)", color: "var(--color-text-30)", margin: 0 }}>
            Source: Constitute Project
            <SourceDot source="Constitute Project" retrievedAt="2026-04-13" />
          </p>
        )}
      </div>

      {constitution.fullTextHtml && (
        <div className="cv-card">
          <h3 className="section-header">Full Text</h3>
          <div
            style={{
              fontFamily: "var(--font-body-sans)",
              fontSize: "var(--text-14)",
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

  const tabs = [
    { id: "overview", label: "Overview", content: overviewTab },
    { id: "government", label: "Government", content: governmentTab },
    ...(legislatureTab ? [{ id: "legislature", label: "Legislature", content: legislatureTab }] : []),
    { id: "laws", label: "Laws in Motion", content: lawsTab },
    { id: "democracy", label: "Democracy", content: democracyTab },
    ...(leadersTab ? [{ id: "leaders", label: "Leaders", content: leadersTab }] : []),
    ...(constitutionTab ? [{ id: "constitution", label: "Constitution", content: constitutionTab }] : []),
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
      <a href="/countries" className="breadcrumb">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 12L6 8l4-4"/></svg>
        All countries
      </a>

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
              fontSize: "var(--text-12)",
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
              fontSize: "var(--text-10)",
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
              fontSize: "var(--text-10)",
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

      {/* Tabs — prototype: gap 2, border-bottom, 28px top margin, 32px bottom margin */}
      <CountryTabs tabs={tabs} />

      {relatedCountries.length > 0 && (
        <section style={{ marginTop: 48 }}>
          <h2
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: "var(--font-weight-mono)",
              fontSize: "var(--text-11)",
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
                      fontSize: "var(--text-10)",
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
