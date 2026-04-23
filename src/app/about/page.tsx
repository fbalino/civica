import type { Metadata } from "next";
import { SourceDot } from "@/components/SourceDot";
import { getAllSources } from "@/lib/db/queries";

export const metadata: Metadata = {
  title: "About Civica — Open-Source Government Structure Database",
  description:
    "Civica is an open-source, interactive platform visualizing government structures for every country. Built on Wikidata, IPU Parline, and Constitute Project data.",
  alternates: { canonical: "https://civicaatlas.org/about" },
  openGraph: {
    title: "About Civica — Open-Source Government Structure Database | Civica",
    description:
      "Civica is an open-source, interactive platform visualizing government structures for every country. Built on Wikidata, IPU Parline, and Constitute Project data.",
    url: "https://civicaatlas.org/about",
  },
};

const SOURCE_DESCRIPTIONS: Record<string, string> = {
  cia_factbook:
    "Comprehensive country profiles covering geography, demographics, government, economy, military, and more. The Factbook was sunset on February 4, 2026; Civica preserves the final January 2026 archive.",
  wikidata:
    "Structured knowledge base providing current heads of state, heads of government, and legislative body data. Updated regularly via SPARQL queries.",
  ipu_parline:
    "Inter-Parliamentary Union database on national parliaments. Provides chamber composition, electoral systems, and parliamentary structure data for legislatures worldwide.",
  constitute_project:
    "Full-text constitution database covering 200+ countries. Provides searchable constitutional texts, amendment histories, and comparative constitutional data.",
  parlgov:
    "Political party and election data for established democracies. Covers party positions, election results, and cabinet composition across parliamentary systems.",
  congress_gov:
    "Official legislative information for the United States Congress. Provides bill texts, voting records, and member data via the Library of Congress API.",
  uk_parliament:
    "Members API for the Parliament of the United Kingdom. Provides current and historical data on MPs, Lords, constituencies, and parliamentary activity.",
  eu_parliament:
    "Open data portal for the European Parliament. Provides MEP profiles, committee membership, plenary votes, and legislative procedure data.",
  bjornskov_rode:
    "Academic regime-classification dataset (Bjornskov & Rode 2020, distributed by QoG). Underpins Civica's structural and regime-type taxonomies.",
  vdem: "Varieties of Democracy — 470+ indicators on democratic quality, produced by the V-Dem Institute.",
  worldbank_wgi:
    "Worldwide Governance Indicators — World Bank's six aggregate measures of governance quality.",
  freedom_house:
    "Freedom in the World — annual assessment of political rights and civil liberties in 195 countries.",
  transparency_intl:
    "Corruption Perceptions Index — Transparency International's ranking of perceived public-sector corruption.",
  undp_hdi:
    "Human Development Index — UNDP composite measure of health, education, and standard of living.",
  global_peace_index:
    "Global Peace Index — Institute for Economics & Peace measure of societal safety, ongoing conflict, and militarisation.",
  fragile_states_index:
    "Fragile States Index — Fund for Peace annual assessment of state vulnerability.",
};

export default async function AboutPage() {
  const dbSources = await getAllSources();
  const sourcesForDisplay = dbSources.map((source) => ({
    id: source.id,
    name: source.name,
    license: source.license ?? "—",
    retrievedAt: source.lastSyncAt ? source.lastSyncAt.toISOString() : null,
    description:
      SOURCE_DESCRIPTIONS[source.id] ??
      "Data source integrated into the Civica pipeline.",
  }));
  return (
    <div className="cv-container" style={{ paddingTop: "var(--spacing-hero-top)", paddingBottom: "var(--spacing-section-y)" }}>
      <h1 className="hero-heading">
        About Civica
      </h1>

      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "var(--text-16)",
          color: "var(--color-text-60)",
          lineHeight: "var(--leading-normal)",
          maxWidth: 720,
          marginBottom: 12,
        }}
      >
        Civica is an open reference platform that visualizes government
        structures for every country in the world. It combines data from
        multiple authoritative sources into a single, browsable atlas of
        political systems, constitutions, and country statistics.
      </p>

      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "var(--text-16)",
          color: "var(--color-text-60)",
          lineHeight: "var(--leading-normal)",
          maxWidth: 720,
        }}
      >
        The CIA World Factbook &mdash; for decades the definitive public reference on
        the world&rsquo;s nations &mdash; was sunset on February 4, 2026. Civica
        preserves its final archive and enriches it with live data from
        Wikidata and other open sources.
      </p>

      <div style={{ height: 1, background: "var(--color-divider)", margin: "var(--spacing-section-y) 0" }} />

      <section>
        <h2 className="page-heading" style={{ marginBottom: 8 }}>
          Data Sources
        </h2>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-14)",
            color: "var(--color-text-40)",
            lineHeight: "var(--leading-normal)",
            marginBottom: 24,
          }}
        >
          Civica draws from {sourcesForDisplay.length} authoritative sources. Every data point carries statement-level provenance.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 1, background: "var(--color-grid-bg)", borderRadius: "var(--radius-sm)", overflow: "visible" }}>
          {sourcesForDisplay.map((source) => (
            <div key={source.id} style={{ background: "var(--color-bg)", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h3
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: "var(--text-20)",
                    fontWeight: 400,
                    margin: 0,
                    color: "var(--color-text-primary)",
                  }}
                >
                  {source.name}
                </h3>
                <SourceDot source={source.id} retrievedAt={source.retrievedAt} />
              </div>
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-14)",
                  color: "var(--color-text-50)",
                  lineHeight: "var(--leading-normal)",
                  margin: 0,
                }}
              >
                {source.description}
              </p>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontWeight: "var(--font-weight-mono)",
                  fontSize: "var(--text-11)",
                  color: "var(--color-text-25)",
                  letterSpacing: "var(--tracking-wide)",
                }}
              >
                {source.license}
              </span>
            </div>
          ))}
        </div>
      </section>

      <div style={{ height: 1, background: "var(--color-divider)", margin: "var(--spacing-section-y) 0" }} />

      <section>
        <h2 className="page-heading" style={{ marginBottom: 8 }}>
          Data Provenance
        </h2>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-14)",
            color: "var(--color-text-50)",
            lineHeight: "var(--leading-normal)",
            marginBottom: 20,
          }}
        >
          Every data point on Civica carries a provenance indicator showing its source and freshness.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="source-dot source-dot--live" data-source="" data-date="" />
            <span style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-14)", color: "var(--color-text-50)" }}>
              Green dot &mdash; live or regularly updated source
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="source-dot source-dot--frozen" data-source="" data-date="" />
            <span style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-14)", color: "var(--color-text-50)" }}>
              Amber dot &mdash; frozen archive (CIA World Factbook, January 2026)
            </span>
          </div>
        </div>
      </section>

      <div style={{ height: 1, background: "var(--color-divider)", margin: "var(--spacing-section-y) 0" }} />

      <section>
        <h2 className="page-heading" style={{ marginBottom: 8 }}>
          Open Source
        </h2>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-14)",
            color: "var(--color-text-50)",
            lineHeight: "var(--leading-normal)",
          }}
        >
          Civica is built with Next.js, Neon (serverless Postgres), Drizzle ORM,
          and Tailwind CSS. The platform is designed to be a free, open reference
          &mdash; all public-domain and CC0-licensed data is freely available.
        </p>
      </section>
    </div>
  );
}
