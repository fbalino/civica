import { notFound } from "next/navigation";
import {
  getJurisdictionBySlug,
  getFactbookSections,
  getCountryFacts,
  getGovernmentStructure,
} from "@/lib/db/queries";
import { SourceDot } from "@/components/SourceDot";
import { FactbookSectionTabs } from "@/components/FactbookSectionNav";
import { FactbookSection } from "@/components/FactbookSection";
import { jsonbToFields } from "@/lib/data/factbook-fields";
import { CountryTabs } from "./tabs";

const GOV_TYPE_COLORS: Record<string, string> = {
  Presidential: "#D4764E",
  Parliamentary: "#4E8BD4",
  "Semi-presidential": "#9B6DC6",
  Theocratic: "#5CAA6E",
  Absolute: "#C4A44E",
  Federal: "#4E8BD4",
};

function govColor(type: string | null): string {
  if (!type) return "#8899AA";
  const entry = Object.entries(GOV_TYPE_COLORS).find(([k]) => type.includes(k));
  return entry?.[1] ?? "#8899AA";
}

function countryFlag(iso2: string | null): string {
  if (!iso2) return "";
  return [...iso2.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
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

  const [sections, facts, govStructure] = await Promise.all([
    getFactbookSections(jurisdiction.id),
    getCountryFacts(jurisdiction.id),
    getGovernmentStructure(jurisdiction.id),
  ]);

  const factMap = new Map(facts.map((f) => [f.factKey, f]));

  const headOfState = govStructure.currentTerms.find(
    (t) =>
      govStructure.offices.find((o) => o.id === t.term.officeId)
        ?.officeType === "head_of_state"
  );
  const headOfGov = govStructure.currentTerms.find(
    (t) =>
      govStructure.offices.find((o) => o.id === t.term.officeId)
        ?.officeType === "head_of_government"
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

  const overviewTab = (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Profile card */}
      <div className="rounded-[var(--radius-sm)] border border-[var(--color-border-muted)] bg-[var(--color-surface-alt)] p-5">
        <h3 className="font-mono text-[10px] tracking-[0.15em] uppercase text-[var(--color-text-tertiary)] mb-4">
          Profile
        </h3>
        {profileRows.map((row) => (
          <div key={row.label} className="flex justify-between items-baseline py-2 border-b border-[var(--color-border-muted)] last:border-b-0">
            <span className="font-mono text-xs text-[var(--color-text-tertiary)] tracking-wide">
              {row.label}
            </span>
            <span className="font-mono text-[13px] text-[var(--color-text-primary)] flex items-center gap-0">
              {row.value}
              <SourceDot source={row.source ?? "cia_factbook"} retrievedAt={row.date ?? "2026-01-23"} />
            </span>
          </div>
        ))}
      </div>

      {/* Leadership + Legislature preview */}
      <div className="flex flex-col gap-3">
        {(headOfState || headOfGov) && (
          <div className="rounded-[var(--radius-sm)] border border-[var(--color-border-muted)] bg-[var(--color-surface-alt)] p-5">
            <h3 className="font-mono text-[10px] tracking-[0.15em] uppercase text-[var(--color-text-tertiary)] mb-4">
              Leadership
            </h3>
            {headOfState && (
              <div className={headOfGov && headOfGov.person.name !== headOfState.person.name ? "mb-4" : ""}>
                <span className="font-mono text-[10px] text-[var(--color-text-tertiary)] tracking-wide uppercase">
                  Head of State
                </span>
                <p className="font-heading text-[22px] font-normal mt-1 text-[var(--color-text-primary)] leading-tight">
                  {headOfState.person.name}
                  <SourceDot source="wikidata" retrievedAt="2026-04-13" />
                </p>
              </div>
            )}
            {headOfGov && headOfGov.person.name !== headOfState?.person.name && (
              <div>
                <span className="font-mono text-[10px] text-[var(--color-text-tertiary)] tracking-wide uppercase">
                  Head of Government
                </span>
                <p className="font-heading text-[22px] font-normal mt-1 text-[var(--color-text-primary)] leading-tight">
                  {headOfGov.person.name}
                  <SourceDot source="wikidata" retrievedAt="2026-04-13" />
                </p>
              </div>
            )}
          </div>
        )}

        {/* Quick stats */}
        <div className="rounded-[var(--radius-sm)] border border-[var(--color-border-muted)] bg-[var(--color-surface-alt)] p-5">
          <h3 className="font-mono text-[10px] tracking-[0.15em] uppercase text-[var(--color-text-tertiary)] mb-4">
            At a Glance
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {factMap.get("population") && (
              <div>
                <span className="font-mono text-[10px] text-[var(--color-text-tertiary)] uppercase">Population</span>
                <p className="font-heading text-xl mt-1 text-[var(--color-text-primary)]">
                  {factMap.get("population")!.factValueNumeric
                    ? formatNumber(factMap.get("population")!.factValueNumeric!)
                    : factMap.get("population")!.factValue}
                </p>
              </div>
            )}
            {factMap.get("gdp_ppp") && (
              <div>
                <span className="font-mono text-[10px] text-[var(--color-text-tertiary)] uppercase">GDP (PPP)</span>
                <p className="font-heading text-xl mt-1 text-[var(--color-text-primary)]">
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
  );

  const governmentTab = (
    <div className="rounded-[var(--radius-sm)] border border-[var(--color-border-muted)] bg-[var(--color-surface-alt)] p-5">
      <p className="font-mono text-[13px] text-[var(--color-text-secondary)] leading-relaxed mb-7">
        {jurisdiction.name} is a {(jurisdiction.governmentTypeDetail ?? jurisdiction.governmentType ?? "sovereign state").toLowerCase()}.
        {headOfState && headOfGov && headOfGov.person.name === headOfState.person.name
          ? ` The ${govStructure.offices.find((o) => o.id === headOfState.term.officeId)?.name?.toLowerCase() ?? "head of state"} serves as both head of state and head of government.`
          : headOfState && headOfGov
            ? ` The head of state is separate from the head of government.`
            : ""}
      </p>
      {govStructure.bodies.map((body) => {
        const branchColor =
          body.branch === "executive" ? "#D4764E" :
          body.branch === "legislative" ? "#4E8BD4" :
          body.branch === "judicial" ? "#5CAA6E" : "#8899AA";
        const bodyOffices = govStructure.offices.filter((o) => o.bodyId === body.id);
        if (bodyOffices.length === 0) return null;
        return (
          <div key={body.id} className="mb-7 last:mb-0">
            <h3 className="font-mono text-[10px] tracking-[0.15em] uppercase mb-2.5" style={{ color: branchColor }}>
              {body.branch ?? body.name}
            </h3>
            {bodyOffices.map((office) => {
              const currentHolder = govStructure.currentTerms.find((t) => t.term.officeId === office.id);
              return (
                <div
                  key={office.id}
                  className="py-1.5 pl-3.5 my-1 font-mono text-xs text-[var(--color-text-secondary)]"
                  style={{ borderLeft: `2px solid ${branchColor}44` }}
                >
                  {office.name}
                  {currentHolder && (
                    <span className="text-[var(--color-text-tertiary)]"> — {currentHolder.person.name}</span>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );

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
    <div className="wide-container py-8 md:py-10">
      {/* Back link */}
      <a href="/countries" className="font-mono text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors no-underline mb-6 inline-block">
        &larr; Back
      </a>

      {/* Country header */}
      <div className="flex items-end gap-5 mb-2">
        <span className="text-[56px] leading-none">
          {countryFlag(jurisdiction.iso2)}
        </span>
        <div>
          <h1 className="font-heading text-[52px] font-normal tracking-tight leading-none m-0">
            {jurisdiction.name}
          </h1>
          <p className="font-mono text-xs mt-1.5" style={{ color }}>
            {jurisdiction.governmentTypeDetail ?? jurisdiction.governmentType}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <CountryTabs tabs={tabs} />
    </div>
  );
}
