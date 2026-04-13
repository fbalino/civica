import { notFound } from "next/navigation";
import {
  getJurisdictionBySlug,
  getFactbookSections,
  getCountryFacts,
  getGovernmentStructure,
} from "@/lib/db/queries";
import { CountryProfileCard } from "@/components/CountryProfileCard";
import { StatCard } from "@/components/StatCard";
import { FactbookSection } from "@/components/FactbookSection";
import { FactbookSectionTabs } from "@/components/FactbookSectionNav";
import { jsonbToFields } from "@/lib/data/factbook-fields";

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

  const economyFacts = facts.filter((f) => f.category === "economy");
  const demoFacts = facts.filter((f) => f.category === "demographics");

  const factMap = new Map(facts.map((f) => [f.factKey, f]));

  const sectionNames = sections.map((s) => s.sectionName);
  const sectionDataMap = new Map(
    sections.map((s) => [s.sectionName, s.sectionData])
  );

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

  return (
    <div className="wide-container py-[var(--spacing-section)]">
      {/* Breadcrumb */}
      <nav className="text-sm text-[var(--color-text-tertiary)] mb-8 flex items-center gap-2">
        <a
          href="/countries"
          className="hover:text-[var(--color-text-secondary)] transition-colors"
        >
          Countries
        </a>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="opacity-40">
          <path d="M4.5 2.5l3 3.5-3 3.5" />
        </svg>
        <span className="text-[var(--color-text-primary)] font-medium">
          {jurisdiction.name}
        </span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-[var(--spacing-section)]">
        {/* Profile card */}
        <div className="lg:col-span-1">
          <CountryProfileCard
            name={jurisdiction.name}
            slug={jurisdiction.slug}
            flagUrl={jurisdiction.flagUrl ?? undefined}
            governmentType={jurisdiction.governmentTypeDetail ?? undefined}
            capital={jurisdiction.capital ?? undefined}
            population={jurisdiction.population ?? undefined}
            gdpBillions={jurisdiction.gdpBillions ?? undefined}
            areaSqKm={jurisdiction.areaSqKm ?? undefined}
            languages={jurisdiction.languages ?? undefined}
            currency={jurisdiction.currency ?? undefined}
            continent={jurisdiction.continent ?? undefined}
            source="cia_factbook"
            retrievedAt="2026-01-23"
          />

          {/* Government leaders */}
          {(headOfState || headOfGov) && (
            <div className="mt-6">
              <h3 className="font-heading text-lg font-medium mb-3">Leadership</h3>
              <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] overflow-hidden divide-y divide-[var(--color-border-muted)]">
                {headOfState && (
                  <div className="flex items-center gap-4 px-5 py-4 bg-[var(--color-surface-elevated)]">
                    <div className="w-9 h-9 rounded-full bg-[var(--color-branch-executive)]/10 flex items-center justify-center flex-shrink-0">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--color-branch-executive)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="8" cy="5" r="3" />
                        <path d="M2.5 14c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--color-text-tertiary)] uppercase tracking-wide">
                        Head of State
                      </div>
                      <div className="text-sm font-medium text-[var(--color-text-primary)] mt-0.5">
                        {headOfState.person.name}
                      </div>
                    </div>
                  </div>
                )}
                {headOfGov && (
                  <div className="flex items-center gap-4 px-5 py-4 bg-[var(--color-surface-elevated)]">
                    <div className="w-9 h-9 rounded-full bg-[var(--color-branch-legislative)]/10 flex items-center justify-center flex-shrink-0">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--color-branch-legislative)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="2" width="10" height="12" rx="1.5" />
                        <path d="M6 5.5h4M6 8h4M6 10.5h2" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--color-text-tertiary)] uppercase tracking-wide">
                        Head of Government
                      </div>
                      <div className="text-sm font-medium text-[var(--color-text-primary)] mt-0.5">
                        {headOfGov.person.name}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Key stats grid */}
        <div className="lg:col-span-2">
          <h2 className="font-heading text-2xl font-medium tracking-tight mb-6">
            Key Statistics
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            {factMap.get("population") && (
              <StatCard
                label="Population"
                value={
                  factMap.get("population")!.factValueNumeric
                    ? `${(factMap.get("population")!.factValueNumeric! / 1e6).toFixed(1)}M`
                    : factMap.get("population")!.factValue ?? ""
                }
                year={factMap.get("population")!.factYear ?? undefined}
                source="cia_factbook"
                retrievedAt="2026-01-23"
              />
            )}
            {factMap.get("gdp_ppp") && (
              <StatCard
                label="GDP (PPP)"
                value={
                  factMap.get("gdp_ppp")!.factValueNumeric
                    ? `$${(factMap.get("gdp_ppp")!.factValueNumeric! / 1e9).toFixed(0)}B`
                    : factMap.get("gdp_ppp")!.factValue ?? ""
                }
                unit="PPP"
                year={factMap.get("gdp_ppp")!.factYear ?? undefined}
                source="cia_factbook"
                retrievedAt="2026-01-23"
              />
            )}
            {factMap.get("gdp_per_capita_ppp") && (
              <StatCard
                label="GDP per Capita"
                value={
                  factMap.get("gdp_per_capita_ppp")!.factValueNumeric
                    ? `$${factMap.get("gdp_per_capita_ppp")!.factValueNumeric!.toLocaleString()}`
                    : factMap.get("gdp_per_capita_ppp")!.factValue ?? ""
                }
                year={
                  factMap.get("gdp_per_capita_ppp")!.factYear ?? undefined
                }
                source="cia_factbook"
                retrievedAt="2026-01-23"
              />
            )}
            {factMap.get("literacy_rate") && (
              <StatCard
                label="Literacy Rate"
                value={factMap.get("literacy_rate")!.factValue ?? ""}
                source="cia_factbook"
                retrievedAt="2026-01-23"
              />
            )}
            {factMap.get("life_expectancy") && (
              <StatCard
                label="Life Expectancy"
                value={factMap.get("life_expectancy")!.factValue ?? ""}
                source="cia_factbook"
                retrievedAt="2026-01-23"
              />
            )}
            {factMap.get("total_area") && (
              <StatCard
                label="Area"
                value={factMap.get("total_area")!.factValue ?? ""}
                source="cia_factbook"
                retrievedAt="2026-01-23"
              />
            )}
          </div>
        </div>
      </div>

      {/* Factbook sections */}
      {sections.length > 0 && (
        <section>
          <h2 className="font-heading text-2xl font-medium tracking-tight mb-6">
            CIA World Factbook Archive
          </h2>
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
        </section>
      )}
    </div>
  );
}
