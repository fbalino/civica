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
import { FactbookSectionNavUncontrolled } from "@/components/FactbookSectionNav";
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
      <nav className="text-sm text-[var(--color-text-tertiary)] mb-6">
        <a
          href="/countries"
          className="hover:text-[var(--color-text-secondary)] transition-colors"
        >
          Countries
        </a>
        <span className="mx-2">/</span>
        <span className="text-[var(--color-text-primary)]">
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
            <div className="mt-6 space-y-3">
              <h3 className="font-heading text-lg font-medium">Leadership</h3>
              {headOfState && (
                <div className="flex items-center gap-3 p-3 rounded-[var(--radius-md)] bg-[var(--color-surface-alt)]">
                  <div>
                    <div className="text-xs text-[var(--color-text-tertiary)] uppercase tracking-wide">
                      Head of State
                    </div>
                    <div className="text-sm font-medium text-[var(--color-text-primary)]">
                      {headOfState.person.name}
                    </div>
                  </div>
                </div>
              )}
              {headOfGov && (
                <div className="flex items-center gap-3 p-3 rounded-[var(--radius-md)] bg-[var(--color-surface-alt)]">
                  <div>
                    <div className="text-xs text-[var(--color-text-tertiary)] uppercase tracking-wide">
                      Head of Government
                    </div>
                    <div className="text-sm font-medium text-[var(--color-text-primary)]">
                      {headOfGov.person.name}
                    </div>
                  </div>
                </div>
              )}
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
          <FactbookSectionNavUncontrolled
            sections={sectionNames}
            defaultSection={sectionNames.includes("government") ? "government" : sectionNames[0]}
          >
            {(activeSection: string) => {
              const data = sectionDataMap.get(activeSection);
              if (!data) return null;
              const fields = jsonbToFields(data);
              return (
                <FactbookSection
                  sectionName={activeSection}
                  fields={fields}
                  source="cia_factbook"
                  retrievedAt="2026-01-23"
                />
              );
            }}
          </FactbookSectionNavUncontrolled>
        </section>
      )}
    </div>
  );
}
