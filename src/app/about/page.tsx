import { SourceDot } from "@/components/SourceDot";

export const metadata = {
  title: "About — Civica",
  description:
    "Civica is an open reference to the world's governments, built as a modern successor to the CIA World Factbook.",
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
];

export default function AboutPage() {
  return (
    <div
      style={{
        maxWidth: "var(--max-w-content)",
        margin: "0 auto",
        padding: "60px var(--spacing-page-x)",
      }}
    >
      <h1 className="page-heading" style={{ marginBottom: 24 }}>
        About Civica
      </h1>

      <div
        style={{
          width: 40,
          height: 2,
          background: "var(--color-accent)",
          borderRadius: 1,
          marginBottom: 32,
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-13)",
            color: "var(--color-text-50)",
            lineHeight: "var(--leading-loose)",
          }}
        >
          Civica is an open reference platform that visualizes government
          structures for every country in the world. It combines data from
          multiple authoritative sources into a single, browsable atlas of
          political systems, constitutions, and country statistics.
        </p>

        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-13)",
            color: "var(--color-text-50)",
            lineHeight: "var(--leading-loose)",
          }}
        >
          The CIA World Factbook &mdash; for decades the definitive public reference on
          the world&rsquo;s nations &mdash; was sunset on February 4, 2026. Civica
          preserves its final archive and enriches it with live data from
          Wikidata and other open sources.
        </p>
      </div>

      <section style={{ marginTop: 60 }}>
        <h2
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "var(--text-24)",
            fontWeight: 400,
            letterSpacing: "var(--tracking-tight)",
            marginBottom: 24,
            color: "var(--color-text-primary)",
          }}
        >
          Data Sources
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {DATA_SOURCES.map((source) => (
            <div key={source.id} className="cv-card">
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <h3
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: "var(--text-18)",
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
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-12)",
                  color: "var(--color-text-50)",
                  lineHeight: "var(--leading-relaxed)",
                  marginBottom: 8,
                }}
              >
                {source.description}
              </p>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-11)",
                  color: "var(--color-text-30)",
                }}
              >
                License: {source.license}
              </span>
            </div>
          ))}
        </div>
      </section>

      <div style={{ height: 1, background: "var(--color-divider)", margin: "60px 0 0" }} />

      <section style={{ marginTop: 60 }}>
        <h2
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "var(--text-24)",
            fontWeight: 400,
            letterSpacing: "var(--tracking-tight)",
            marginBottom: 16,
            color: "var(--color-text-primary)",
          }}
        >
          Data Provenance
        </h2>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-12)",
            color: "var(--color-text-50)",
            lineHeight: "var(--leading-relaxed)",
            marginBottom: 16,
          }}
        >
          Every data point on Civica carries a provenance indicator showing its source and freshness.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="source-dot source-dot--live" data-source="" data-date="" />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-12)", color: "var(--color-text-50)" }}>
              Green dot &mdash; live or regularly updated source
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="source-dot source-dot--frozen" data-source="" data-date="" />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-12)", color: "var(--color-text-50)" }}>
              Amber dot &mdash; frozen archive (CIA World Factbook, January 2026)
            </span>
          </div>
        </div>
      </section>

      <div style={{ height: 1, background: "var(--color-divider)", margin: "60px 0 0" }} />

      <section style={{ marginTop: 60 }}>
        <h2
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "var(--text-24)",
            fontWeight: 400,
            letterSpacing: "var(--tracking-tight)",
            marginBottom: 16,
            color: "var(--color-text-primary)",
          }}
        >
          Open Source
        </h2>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-12)",
            color: "var(--color-text-50)",
            lineHeight: "var(--leading-relaxed)",
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
