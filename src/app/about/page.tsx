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
    <div className="editorial-container py-[var(--spacing-section)]">
      <h1 className="font-heading text-4xl font-normal tracking-tight mb-6">
        About Civica
      </h1>

      <div className="space-y-6 text-[var(--color-text-secondary)] leading-relaxed">
        <p>
          Civica is an open reference platform that visualizes government
          structures for every country in the world. It combines data from
          multiple authoritative sources into a single, browsable atlas of
          political systems, constitutions, and country statistics.
        </p>

        <p>
          The CIA World Factbook — for decades the definitive public reference on
          the world&rsquo;s nations — was sunset on February 4, 2026. Civica
          preserves its final archive and enriches it with live data from
          Wikidata and other open sources.
        </p>
      </div>

      <section className="mt-[var(--spacing-section)]">
        <h2 className="font-heading text-2xl font-normal tracking-tight mb-6">
          Data Sources
        </h2>
        <div className="space-y-4">
          {DATA_SOURCES.map((source) => (
            <div
              key={source.id}
              className="p-5 rounded-[var(--radius-sm)] border border-[var(--color-border-muted)] bg-[var(--color-surface-elevated)]"
            >
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-heading text-lg font-normal">
                  {source.name}
                </h3>
                <SourceDot source={source.id} retrievedAt={source.retrievedAt} />
              </div>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-2">
                {source.description}
              </p>
              <span className="text-xs text-[var(--color-text-tertiary)]">
                License: {source.license}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-[var(--spacing-section)]">
        <h2 className="font-heading text-2xl font-normal tracking-tight mb-4">
          Data Provenance
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-4">
          Every data point on Civica carries a provenance indicator showing its
          source and freshness.
        </p>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span
              className="source-dot source-dot--live"
              data-source=""
              data-date=""
            />
            <span className="text-sm text-[var(--color-text-secondary)]">
              Green dot &mdash; live or regularly updated source
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="source-dot source-dot--frozen"
              data-source=""
              data-date=""
            />
            <span className="text-sm text-[var(--color-text-secondary)]">
              Amber dot &mdash; frozen archive (CIA World Factbook, January 2026)
            </span>
          </div>
        </div>
      </section>

      <section className="mt-[var(--spacing-section)]">
        <h2 className="font-heading text-2xl font-normal tracking-tight mb-4">
          Open Source
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
          Civica is built with Next.js, Neon (serverless Postgres), Drizzle ORM,
          and Tailwind CSS. The platform is designed to be a free, open reference
          — all public-domain and CC0-licensed data is freely available.
        </p>
      </section>
    </div>
  );
}
