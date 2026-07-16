import { notFound } from "next/navigation";
import {
  getJurisdictionBySlug,
  getFactbookSections,
  getFactbookCountryOptions,
  getAllSources,
} from "@/lib/db/queries";
import { reconciliation } from "@/lib/content/site-state";
import { jsonbToFields } from "@/lib/data/factbook-fields";
import { sectionDataHasNormalizableGeographicName } from "@/lib/data/geographic-name-normalization";
import { FactbookSection } from "@/components/FactbookSection";
import { Banner } from "@/components/editorial/Banner";
import {
  FactbookSidebar,
  type FactbookSidebarItem,
} from "@/components/factbook/FactbookSidebar";
import { CountryJumpSearch } from "@/components/country/CountryJumpSearch";
import {
  FactbookRightRail,
  type SubsectionEntry,
  type SourceEntry,
} from "@/components/factbook/FactbookRightRail";
import {
  getCanonicalFactsForJurisdiction,
  getDistinctActiveSourcesForJurisdiction,
  FACTBOOK_RECONCILIATION_META,
} from "@/lib/factbook/reconcile/api";
import { CiteAccordion } from "@/components/cite/CiteAccordion";
import { humanizeSectionLabel } from "@/lib/data/humanize-label";
import { slugify } from "@/lib/text/slugify";

export const revalidate = 0;

// Factbook tab of the unified /country/[slug] page. Renders ONLY the
// CIA-sourced sections. The Government section here is the CIA prose
// ONLY — the gov-structure org chart and every Civica governance
// section (legislature, leaders, bills, scores, additional indicators)
// move to the Civica Data tab. The masthead, tab bar, reconciliation notice,
// and AI drawer live in the shared layout. The "jump to country" search +
// its sticky-bar handoff render here via <CountryJumpSearch> — a normal-flow
// field above the left sidebar that scrolls away, so the sticky bar never
// shows alongside it.
type SectionPlan = { id: string; label: string; sourceKey: string };

const SECTION_PLAN: SectionPlan[] = [
  { id: "overview", label: "Overview", sourceKey: "introduction" },
  { id: "geography", label: "Geography", sourceKey: "geography" },
  { id: "people", label: "People & Society", sourceKey: "people_and_society" },
  // Government here is CIA prose ONLY. The "How power is organised" org
  // chart + the Civica governance sections render on the Civica Data tab.
  { id: "government", label: "Government", sourceKey: "government" },
  { id: "economy", label: "Economy", sourceKey: "economy" },
  { id: "energy", label: "Energy", sourceKey: "energy" },
  { id: "communications", label: "Communications", sourceKey: "communications" },
  { id: "transport", label: "Transport", sourceKey: "transportation" },
  { id: "environment", label: "Environment", sourceKey: "environment" },
  { id: "military", label: "Military & Security", sourceKey: "military_and_security" },
  { id: "terrorism", label: "Terrorism", sourceKey: "terrorism" },
  { id: "space", label: "Space", sourceKey: "space" },
  { id: "transnational", label: "Transnational Issues", sourceKey: "transnational_issues" },
];

const FACTBOOK_RETRIEVED_AT = "2026-01-23";

export default async function CountryFactbookTab({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const jurisdiction = await getJurisdictionBySlug(slug);
  if (!jurisdiction) notFound();

  const [sections, countryOptions, headerFacts, citeSources, allSources] =
    await Promise.all([
      getFactbookSections(jurisdiction.id),
      getFactbookCountryOptions().catch(() => []),
      // Resolver batch feeding FactbookSection LeafRow (single-shot leaves
      // keyed off LABEL_TO_FACT_KEY + multi-year groups keyed off
      // MULTI_YEAR_GROUP_TO_FACT_KEY, augmented with the reconciled
      // canonical row). One batch query covers the structured sections.
      getCanonicalFactsForJurisdiction(jurisdiction.id, [
        "population_total",
        "gdp_ppp_usd_billions",
        "capital",
        "official_languages",
        "currency_code",
        "birth_rate",
        "death_rate",
        "population_growth_rate",
        "fertility_rate",
        "gdp_nominal_usd_billions",
        "gdp_per_capita_usd",
        "gdp_real_growth_rate",
        "inflation_rate",
        "public_debt_pct_gdp",
        "public_debt_psnd_pct_gdp",
        "unemployment_rate_pct",
        "current_account_balance_usd",
        "exports_goods_services_usd",
        "imports_goods_services_usd",
        "military_expenditure_pct_gdp",
      ]).catch(
        () => ({}) as Record<string, import("@/lib/factbook/reconcile/types").ResolverOutput>
      ),
      // Per-country distinct active sources for the page-bottom
      // <CiteAccordion>. Soft-fail to [] so a Neon hiccup doesn't 500
      // the whole page; the accordion renders fine without source names.
      getDistinctActiveSourcesForJurisdiction(jurisdiction.id).catch(
        () => [] as Array<{ id: string; name: string }>
      ),
      // Whole sources table → real `last_sync_at` dates for the right-rail
      // "Sources on this page" list. Soft-fails to [] so a Neon hiccup just
      // drops the dates, never the page.
      getAllSources().catch(
        () => [] as Awaited<ReturnType<typeof getAllSources>>
      ),
    ]);

  const sectionDataMap = new Map(
    sections.map((s) => [s.sectionName, s.sectionData])
  );

  const visibleSections = SECTION_PLAN.filter((s) => {
    const data = sectionDataMap.get(s.sourceKey);
    if (!data) return false;
    if (typeof data !== "object") return false;
    // Empty section objects (e.g. Space with only null-valued keys)
    // produce zero renderable fields. Hide them rather than render a
    // bare "No data available" stub.
    return jsonbToFields(data).length > 0;
  });

  const sidebarItems: FactbookSidebarItem[] = [
    ...visibleSections.map((s) => ({ id: s.id, label: s.label })),
    { id: "cite", label: "Cite this page" },
  ];

  // Build the per-section subsection map for the right rail.
  const subsectionsBySection: Record<string, SubsectionEntry[]> = {};
  for (const section of visibleSections) {
    const subs: SubsectionEntry[] = [];
    const data = sectionDataMap.get(section.sourceKey);
    if (data) {
      const fields = jsonbToFields(data);
      for (const f of fields) {
        if (f.kind === "group") {
          const label = humanizeSectionLabel(f.label);
          subs.push({ id: `${section.id}--${slugify(label)}`, label });
        }
      }
    }
    subsectionsBySection[section.id] = subs.slice(0, 12);
  }

  // Right-rail "Sources on this page" — accurate to the Factbook tab's
  // content: the CIA World Factbook prose plus every reconciled fact source
  // that actually wrote an active row for this jurisdiction (V-Dem, World
  // Bank, IMF, national statistics offices, Wikidata, …). Derived from the
  // distinct-active-sources query rather than a static list, so a country
  // with 13 contributing sources shows 13, not a stub. Each entry carries
  // its real source id (→ correct green/amber <SourceDot>) and real
  // `last_sync_at` date.
  const sourceById = new Map(allSources.map((s) => [s.id, s]));
  const formatSyncDate = (id: string, fallback: string): string => {
    const d = sourceById.get(id)?.lastSyncAt ?? null;
    return d ? d.toISOString().slice(0, 10) : fallback;
  };
  // `citeSources` already labels + sorts the distinct active source ids with
  // CIA Factbook + Wikidata pinned to the end. Guarantee CIA Factbook is
  // present even if (rarely) no country_facts row is attributed to it, since
  // the prose itself is CIA-sourced.
  const railSourceList = [...citeSources];
  if (!railSourceList.some((s) => s.id === "cia_factbook")) {
    railSourceList.push({ id: "cia_factbook", name: "CIA World Factbook" });
  }
  const sources: SourceEntry[] = railSourceList.map((s) => ({
    name: s.name,
    date: formatSyncDate(
      s.id,
      s.id === "cia_factbook" ? FACTBOOK_RETRIEVED_AT : "Not yet synced"
    ),
    sourceId: s.id,
  }));

  return (
    <div className="factbook-tab">
      <div className="factbook-body">
        <div className="factbook-left-rail">
          <CountryJumpSearch
            country={{ name: jurisdiction.name, iso2: jurisdiction.iso2 }}
            countries={countryOptions}
          />
          <FactbookSidebar items={sidebarItems} />
        </div>

        <div className="factbook-main">
        {visibleSections.map((section) => {
          const data = sectionDataMap.get(section.sourceKey);
          const fields = data ? jsonbToFields(data) : [];

          return (
            <section
              key={section.id}
              id={section.id}
              className="factbook-section"
            >
              <header className="factbook-section-header">
                <h2 className="factbook-section-title">{section.label}</h2>
              </header>

              {/* Geographic-name provenance note. Shown ONLY when this
               *  section's raw CIA prose actually contains a phrase we
               *  normalize for display (today: "Gulf of America" →
               *  "Gulf of Mexico"). The stored CIA JSONB is left verbatim;
               *  this discloses the house naming convention. */}
              {data != null &&
                sectionDataHasNormalizableGeographicName(data) && (
                  <Banner variant="info">
                    <strong>Naming:</strong>{" "}
                    Civica uses &ldquo;Gulf of Mexico,&rdquo; the name
                    recognized by the International Hydrographic Organization
                    and the United Nations. The source data (CIA World
                    Factbook) adopted &ldquo;Gulf of America&rdquo; following
                    a U.S. executive order in January 2025.
                  </Banner>
                )}

              {fields.length > 0 && (
                <FactbookSection
                  sectionName={humanizeSectionLabel(section.label)}
                  fields={fields}
                  source="cia_factbook"
                  retrievedAt={FACTBOOK_RETRIEVED_AT}
                  idPrefix={section.id}
                  resolverFacts={headerFacts}
                />
              )}
            </section>
          );
        })}

        {/* Per-country citation footer. */}
        <section
          id="cite"
          className="editorial-section"
          aria-labelledby="cite-heading"
        >
          <h2 id="cite-heading">Cite this page</h2>
          <CiteAccordion
            subject={`Civica Atlas — ${jurisdiction.name} — vintage ${
              FACTBOOK_RECONCILIATION_META.vintage.split("vintage ")[1] ?? ""
            }`}
            pageTitle={`${jurisdiction.name} factbook`}
            url={`https://civicaatlas.org/country/${slug}`}
            downloadSlug={slug}
            dataVintage={reconciliation.firstVintageCutDate}
            sourceNames={citeSources.map((s) => s.name)}
          />
        </section>
      </div>

        <FactbookRightRail
          subsectionsBySection={subsectionsBySection}
          sources={sources}
        />
      </div>
    </div>
  );
}
