import type { Metadata } from "next";
import { SourceDot } from "@/components/SourceDot";

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

const DATA_SOURCES = [
  {
    id: "cia_factbook",
    name: "CIA World Factbook",
    description:
      "Comprehensive country profiles covering geography, demographics, government, economy, military, and more. The Factbook was sunset on February 4, 2026; Civica preserves the final January 2026 archive.",
    license: "Public Domain",
    retrievedAt: "2026-01-23",
  },
  {
    id: "wikidata",
    name: "Wikidata",
    description:
      "Structured knowledge base providing current heads of state, heads of government, and legislative body data. Updated regularly via SPARQL queries.",
    license: "CC0 (Public Domain)",
    retrievedAt: "2026-04-13",
  },
  {
    id: "ipu_parline",
    name: "IPU Parline",
    description:
      "Inter-Parliamentary Union database on national parliaments. Provides chamber composition, electoral systems, and parliamentary structure data for legislatures worldwide.",
    license: "CC-BY-NC-SA-4.0",
    retrievedAt: null,
  },
  {
    id: "constitute_project",
    name: "Constitute Project",
    description:
      "Full-text constitution database covering 200+ countries. Provides searchable constitutional texts, amendment histories, and comparative constitutional data.",
    license: "Non-commercial",
    retrievedAt: null,
  },
  {
    id: "parlgov",
    name: "ParlGov",
    description:
      "Political party and election data for established democracies. Covers party positions, election results, and cabinet composition across parliamentary systems.",
    license: "Open",
    retrievedAt: null,
  },
  {
    id: "congress_gov",
    name: "Congress.gov",
    description:
      "Official legislative information for the United States Congress. Provides bill texts, voting records, and member data via the Library of Congress API.",
    license: "Public Domain",
    retrievedAt: null,
  },
  {
    id: "uk_parliament",
    name: "UK Parliament",
    description:
      "Members API for the Parliament of the United Kingdom. Provides current and historical data on MPs, Lords, constituencies, and parliamentary activity.",
    license: "Open Parliament Licence",
    retrievedAt: null,
  },
  {
    id: "eu_parliament",
    name: "European Parliament",
    description:
      "Open data portal for the European Parliament. Provides MEP profiles, committee membership, plenary votes, and legislative procedure data.",
    license: "CC-BY-4.0",
    retrievedAt: null,
  },
];

export default function AboutPage() {
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
          Civica draws from {DATA_SOURCES.length} authoritative sources. Every data point carries statement-level provenance.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 1, background: "var(--color-grid-bg)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
          {DATA_SOURCES.map((source) => (
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
                <SourceDot source={source.id} retrievedAt={source.retrievedAt ?? "pending"} />
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
