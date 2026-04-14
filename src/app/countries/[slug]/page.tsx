import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getJurisdictionBySlug,
  getFactbookSections,
  getFactbookSection,
  getCountryFacts,
  getGovernmentStructure,
  getCountryRankings,
} from "@/lib/db/queries";
import { SourceDot } from "@/components/SourceDot";
import { FactbookSectionTabs } from "@/components/FactbookSectionNav";
import { FactbookSection } from "@/components/FactbookSection";
import { jsonbToFields } from "@/lib/data/factbook-fields";
import { CountryTabs } from "./tabs";
import { CountryFlag } from "@/components/CountryFlag";
import { GovStructureDiagram } from "@/components/GovStructureDiagram";

function govColor(type: string | null): string {
  if (!type) return "var(--color-gov-other)";
  const map: Record<string, string> = {
    Presidential: "var(--color-gov-presidential)",
    Parliamentary: "var(--color-gov-parliamentary)",
    "Semi-presidential": "var(--color-gov-semi-presidential)",
    Theocratic: "var(--color-gov-theocratic)",
    Absolute: "var(--color-gov-absolute)",
    Federal: "var(--color-gov-parliamentary)",
  };
  const entry = Object.entries(map).find(([k]) => type.includes(k));
  return entry?.[1] ?? "var(--color-gov-other)";
}

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const jurisdiction = await getJurisdictionBySlug(slug);
  if (!jurisdiction) return { title: "Country — Civica" };
  const govLabel = jurisdiction.governmentTypeDetail ?? jurisdiction.governmentType ?? "sovereign state";
  return {
    title: `${jurisdiction.name} — Civica`,
    description: `${jurisdiction.name} is a ${govLabel.toLowerCase()}. Government structure, leadership, rankings, and factbook data.`,
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

  const [sections, facts, govStructure, introSection, rankings] = await Promise.all([
    getFactbookSections(jurisdiction.id),
    getCountryFacts(jurisdiction.id),
    getGovernmentStructure(jurisdiction.id),
    getFactbookSection(jurisdiction.id, "introduction"),
    getCountryRankings(jurisdiction.id),
  ]);

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

  const color = govColor(jurisdiction.governmentTypeDetail ?? jurisdiction.governmentType);

  const branchColorMap: Record<string, string> = {
    executive: "var(--color-branch-executive)",
    legislative: "var(--color-branch-legislative)",
    judicial: "var(--color-branch-judicial)",
  };

  // Extract introduction text
  let introText: string | null = null;
  if (introSection?.sectionData) {
    const data = introSection.sectionData as Record<string, unknown>;
    const bg = data["Background"] as { text?: string } | undefined;
    if (bg?.text) {
      const sentences = bg.text.split(/(?<=\.)\s+/);
      introText = sentences.slice(0, 3).join(" ");
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

  /* ---- Overview tab: intro + 2-column with Profile + Leadership + Rankings ---- */
  const overviewTab = (
    <div>
      {introText && (
        <div className="cv-card" style={{ marginBottom: 16 }}>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-14)",
              color: "var(--color-text-60)",
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
                    fontSize: "var(--text-10)",
                    color: "var(--color-text-20)",
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
          fontSize: "var(--text-13)",
          color: "var(--color-text-50)",
          lineHeight: "var(--leading-relaxed)",
          marginTop: 0,
          marginBottom: 28,
        }}
      >
        {jurisdiction.name} is a {(jurisdiction.governmentTypeDetail ?? jurisdiction.governmentType ?? "sovereign state").toLowerCase()}.
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
                    <span style={{ color: "var(--color-text-40)" }}> — {currentHolder.person.name}</span>
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

  const tabs = [
    { id: "overview", label: "Overview", content: overviewTab },
    { id: "government", label: "Government", content: governmentTab },
    ...(factbookTab ? [{ id: "factbook", label: "Factbook", content: factbookTab }] : []),
  ];

  return (
    <div
      style={{
        maxWidth: "var(--max-w-content)",
        margin: "0 auto",
        padding: "32px var(--spacing-page-x)",
      }}
    >
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
              fontSize: "var(--text-12)",
              color,
              margin: "6px 0 0",
            }}
          >
            {jurisdiction.governmentTypeDetail ?? jurisdiction.governmentType}
          </p>
        </div>
      </div>

      {/* Tabs — prototype: gap 2, border-bottom, 28px top margin, 32px bottom margin */}
      <CountryTabs tabs={tabs} />
    </div>
  );
}
