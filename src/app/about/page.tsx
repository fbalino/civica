import type { Metadata } from "next";
import Link from "next/link";
import { SourceDot } from "@/components/SourceDot";
import { prettyDisplayValue } from "@/lib/data/humanize-label";
import { getAllSources } from "@/lib/db/queries";
import { civicaIndex, pulse } from "@/lib/content/site-state";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "About Civica Atlas — Open Reference Atlas of World Governments",
  description:
    "Civica Atlas is an academic-grade reference atlas of the world's countries, governments, and governance outcomes — built on multi-source reconciliation, statement-level provenance, and published methodology.",
  alternates: { canonical: "https://civicaatlas.org/about" },
  openGraph: {
    title: "About Civica Atlas — Open Reference Atlas of World Governments",
    description:
      "An academic-grade reference atlas of the world's countries, governments, and governance outcomes — multi-source reconciliation, statement-level provenance, and published methodology.",
    url: "https://civicaatlas.org/about",
  },
};

const SOURCE_DESCRIPTIONS: Record<string, string> = {
  cia_factbook:
    "Comprehensive country profiles covering geography, demographics, government, economy, military, and more. The Factbook was sunset on 4 February 2026; Civica preserves the final January 2026 archive as a frozen reference layer.",
  wikidata:
    "Structured knowledge base providing the country-identity spine plus heads of state, heads of government, and legislative body data. Updated regularly via SPARQL queries.",
  ipu_parline:
    "Inter-Parliamentary Union database on national parliaments. Provides chamber composition, electoral systems, and parliamentary structure for legislatures worldwide.",
  constitute_project:
    "Full-text constitution database covering 200+ countries. Searchable constitutional texts, amendment histories, and comparative constitutional data.",
  parlgov:
    "Political party and election data for established democracies. Covers party positions, election results, and cabinet composition across parliamentary systems.",
  congress_gov:
    "Official legislative information for the United States Congress. Bill texts, voting records, and member data via the Library of Congress API.",
  uk_parliament:
    "Members API for the Parliament of the United Kingdom. Current and historical data on MPs, Lords, constituencies, and parliamentary activity.",
  eu_parliament:
    "Open data portal for the European Parliament. MEP profiles, committee membership, plenary votes, and legislative procedure data.",
  bjornskov_rode:
    "Academic regime-classification dataset (Bjørnskov & Rode 2020, distributed by QoG). Underpins Civica's regime-type taxonomy as an alternate governance lens.",
  vdem:
    "Varieties of Democracy — 470+ indicators on democratic quality, produced by the V-Dem Institute. Provides Regimes of the World classification used as Civica's default governance peer lens.",
  worldbank_wgi:
    "Worldwide Governance Indicators — World Bank's six aggregate measures of governance quality, an input to the Civica Index.",
  worldbank_wdi:
    "World Development Indicators — World Bank's flagship economic and demographic dataset across ~190 countries.",
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
  imf_weo:
    "World Economic Outlook — IMF macroeconomic measurements and projections covering inflation, GDP, fiscal balance, and external accounts.",
  un_data:
    "UN Data and World Population Prospects — demographic and development data from UN Statistics Division and UN DESA.",
  who_gho:
    "Global Health Observatory — WHO health indicators including life expectancy, infant mortality, and disease burden.",
  unesco_uis:
    "UNESCO Institute for Statistics — education and literacy indicators including attainment levels and enrolment rates.",
  oecd_stat:
    "OECD.Stat — economic, social, and governance indicators across the 38 OECD member states with selected partner-country coverage.",
  fao_faostat:
    "FAOSTAT — agricultural, land-use, and food-security statistics from the UN Food and Agriculture Organization.",
  ilo_ilostat:
    "ILOSTAT — labour-market statistics from the International Labour Organization, including ILO-modelled estimates for low-survey-coverage countries.",
  eurostat:
    "Eurostat — official statistics for EU member states and EFTA countries, harmonized methodology across the European Statistical System.",
  wto_stats:
    "WTO Stats — international trade statistics from the World Trade Organization, focused on merchandise trade flows and tariff data.",
};

export default async function AboutPage() {
  const dbSources = await getAllSources();
  const sourcesForDisplay = dbSources.map((source) => ({
    id: source.id,
    name: source.name,
    license: prettyDisplayValue(source.license),
    retrievedAt: source.lastSyncAt ? source.lastSyncAt.toISOString() : null,
    description:
      SOURCE_DESCRIPTIONS[source.id] ??
      "Data source integrated into the Civica pipeline.",
  }));

  return (
    <div
      className="cv-container"
      style={{
        paddingTop: "var(--spacing-hero-top)",
        paddingBottom: "var(--spacing-section-y)",
      }}
    >
      <h1 className="hero-heading">About Civica Atlas</h1>

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
        Civica Atlas is an open reference atlas of the world&apos;s countries,
        governments, and governance outcomes. It combines data from
        authoritative sources into a single, browsable atlas of political
        systems, demographics, economies, and the institutions that shape them.
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
        The project is built in the same posture as Our World in Data, the
        V-Dem Institute, and the World Bank&rsquo;s statistical division
        &mdash; an academic publication with a UI on top, not a website that
        happens to have data. Every fact carries provenance, every methodology
        decision is documented, and every disagreement between sources is
        surfaced rather than hidden.
      </p>

      <div
        style={{
          height: 1,
          background: "var(--color-divider)",
          margin: "var(--spacing-section-y) 0",
        }}
      />

      <section>
        <h2 className="page-heading" style={{ marginBottom: 8 }}>
          What we do
        </h2>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-14)",
            color: "var(--color-text-50)",
            lineHeight: "var(--leading-normal)",
            marginBottom: 24,
            maxWidth: 720,
          }}
        >
          We do three things, each addressing a different question a serious
          reader might ask about a country.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 1,
            background: "var(--color-grid-bg)",
            borderRadius: "var(--radius-sm)",
            overflow: "hidden",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              background: "var(--color-bg)",
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <h3
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "var(--text-20)",
                fontWeight: 400,
                margin: 0,
                color: "var(--color-text-primary)",
              }}
            >
              <Link
                href="/factbook"
                style={{ color: "inherit", textDecoration: "none" }}
              >
                Civica Factbook
              </Link>
            </h3>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-14)",
                color: "var(--color-text-50)",
                lineHeight: "var(--leading-normal)",
                margin: 0,
              }}
            >
              Country dossiers — geography, demographics, government, economy,
              energy, environment, military, and more. Each fact is reconciled
              across multiple authoritative sources where coverage exists, with
              per-fact provenance revealing every alternate source, freshness
              date, and license.
            </p>
          </div>

          <div
            style={{
              background: "var(--color-bg)",
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <h3
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "var(--text-20)",
                fontWeight: 400,
                margin: 0,
                color: "var(--color-text-primary)",
              }}
            >
              <Link
                href="/civica-index"
                style={{ color: "inherit", textDecoration: "none" }}
              >
                Civica Index
              </Link>
            </h3>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-14)",
                color: "var(--color-text-50)",
                lineHeight: "var(--leading-normal)",
                margin: 0,
              }}
            >
              An original composite governance score (0&ndash;100) computed
              quarterly across {civicaIndex.dimensionCount} governance
              dimensions:{" "}
              {civicaIndex.dimensions.map((d) => d.label.toLowerCase()).join(", ")}.
              Material outcomes (human development, peace &amp; security,
              economic stability) live on the separate Civica Conditions
              companion layer at <Link href="/civica-conditions">/civica-conditions</Link>.
              PCA-derived weights, frozen reference periods, Monte Carlo
              uncertainty intervals.
              {civicaIndex.status === "beta"
                ? " Currently in BETA pending external review."
                : ""}
            </p>
          </div>

          <div
            style={{
              background: "var(--color-bg)",
              padding: "20px 24px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <h3
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "var(--text-20)",
                fontWeight: 400,
                margin: 0,
                color: "var(--color-text-primary)",
              }}
            >
              <Link
                href="/civica-index/pulse-changelog"
                style={{ color: "inherit", textDecoration: "none" }}
              >
                Civica Pulse
              </Link>
            </h3>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-14)",
                color: "var(--color-text-50)",
                lineHeight: "var(--leading-normal)",
                margin: 0,
              }}
            >
              A daily, event-driven directional signal layered on the Index.
              Multi-run LLM classifier with three-temperature agreement scoring,
              asymmetric corroboration rules, severity-tier human review.
              Backtested against {pulse.backtest.cases.length} named historical
              governance shocks.
              {pulse.status === "beta" ? " Currently in BETA." : ""}
            </p>
          </div>
        </div>
      </section>

      <div
        style={{
          height: 1,
          background: "var(--color-divider)",
          margin: "var(--spacing-section-y) 0",
        }}
      />

      <section>
        <h2 className="page-heading" style={{ marginBottom: 8 }}>
          How it works
        </h2>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-14)",
            color: "var(--color-text-50)",
            lineHeight: "var(--leading-normal)",
            marginBottom: 16,
            maxWidth: 720,
          }}
        >
          The data pipeline has three layers, each addressing a known failure
          mode in single-source reference works.
        </p>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-14)",
            color: "var(--color-text-50)",
            lineHeight: "var(--leading-normal)",
            marginBottom: 12,
            maxWidth: 720,
          }}
        >
          <strong style={{ color: "var(--color-text-primary)" }}>
            Sync orchestrators (one per source).
          </strong>{" "}
          A dedicated module per upstream publisher pulls fresh data on a
          documented cadence and writes into the canonical{" "}
          <code style={{ fontFamily: "var(--font-mono)" }}>country_facts</code>{" "}
          table with statement-level provenance.
        </p>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-14)",
            color: "var(--color-text-50)",
            lineHeight: "var(--leading-normal)",
            marginBottom: 12,
            maxWidth: 720,
          }}
        >
          <strong style={{ color: "var(--color-text-primary)" }}>
            Reconciliation resolver.
          </strong>{" "}
          When two or more sources publish a value for the same country and
          fact-key, the resolver picks a canonical based on freshness rules,
          editorial assertions, and forecast-vs-measurement distinctions. When
          sources disagree by more than a configurable threshold, it creates a
          dispute record routed to human review rather than silently picking.
        </p>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-14)",
            color: "var(--color-text-50)",
            lineHeight: "var(--leading-normal)",
            marginBottom: 16,
            maxWidth: 720,
          }}
        >
          <strong style={{ color: "var(--color-text-primary)" }}>
            Reader surfaces.
          </strong>{" "}
          Every reader-facing page consumes the resolver. Every value renders a{" "}
          <em>FactValueDot</em> &mdash; a small chevron that opens a panel
          revealing the canonical pick, every alternate source, freshness
          dates, and licenses.
        </p>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-14)",
            color: "var(--color-text-50)",
            lineHeight: "var(--leading-normal)",
            maxWidth: 720,
          }}
        >
          For a plain-English walkthrough, see{" "}
          <Link
            href="/methodology/approach"
            style={{
              color: "var(--color-text-60)",
              textDecoration: "underline",
              textUnderlineOffset: "2px",
            }}
          >
            How we approach data
          </Link>
          . For the deep technical specification, see{" "}
          <Link
            href="/factbook/methodology/reconciliation"
            style={{
              color: "var(--color-text-60)",
              textDecoration: "underline",
              textUnderlineOffset: "2px",
            }}
          >
            Methodology &mdash; Reconciliation
          </Link>
          .
        </p>
      </section>

      <div
        style={{
          height: 1,
          background: "var(--color-divider)",
          margin: "var(--spacing-section-y) 0",
        }}
      />

      <section>
        <h2 className="page-heading" style={{ marginBottom: 8 }}>
          Methodology
        </h2>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-14)",
            color: "var(--color-text-50)",
            lineHeight: "var(--leading-normal)",
            marginBottom: 16,
            maxWidth: 720,
          }}
        >
          Every load-bearing methodology decision in Civica is documented as a
          citable resolution before the corresponding code ships. Published
          methodology pages cover composite scoring (the Civica Index), event
          classification (the Civica Pulse), peer grouping (the V-Dem RoW +
          World Bank region/income lens architecture), reconciliation rules,
          forecast-vs-measurement, and regime classification.
        </p>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-14)",
            color: "var(--color-text-50)",
            lineHeight: "var(--leading-normal)",
            marginBottom: 16,
            maxWidth: 720,
          }}
        >
          Browse the full set at{" "}
          <Link
            href="/methodology"
            style={{
              color: "var(--color-text-60)",
              textDecoration: "underline",
              textUnderlineOffset: "2px",
            }}
          >
            /methodology
          </Link>
          .
        </p>
      </section>

      <div
        style={{
          height: 1,
          background: "var(--color-divider)",
          margin: "var(--spacing-section-y) 0",
        }}
      />

      <section id="sources">
        <h2 className="page-heading" style={{ marginBottom: 8 }}>
          Data sources
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
          Civica draws from {sourcesForDisplay.length} authoritative sources.
          Every data point carries statement-level provenance.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: 1,
            background: "var(--color-grid-bg)",
            borderRadius: "var(--radius-sm)",
            overflow: "visible",
          }}
        >
          {sourcesForDisplay.map((source) => (
            <div
              key={source.id}
              style={{
                background: "var(--color-bg)",
                padding: "20px 24px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
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
                <SourceDot
                  source={source.id}
                  retrievedAt={source.retrievedAt}
                />
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

      <div
        style={{
          height: 1,
          background: "var(--color-divider)",
          margin: "var(--spacing-section-y) 0",
        }}
      />

      <section>
        <h2 className="page-heading" style={{ marginBottom: 8 }}>
          Provenance
        </h2>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-14)",
            color: "var(--color-text-50)",
            lineHeight: "var(--leading-normal)",
            marginBottom: 20,
            maxWidth: 720,
          }}
        >
          Every data point on Civica carries a provenance indicator showing its
          source and freshness. Multi-source reconciled facts also expose a
          rich panel revealing every alternate source.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              className="source-dot source-dot--live"
              data-source=""
              data-date=""
            />
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-14)",
                color: "var(--color-text-50)",
              }}
            >
              Green dot &mdash; live or regularly updated source
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              className="source-dot source-dot--frozen"
              data-source=""
              data-date=""
            />
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-14)",
                color: "var(--color-text-50)",
              }}
            >
              Amber dot &mdash; frozen archive (CIA World Factbook, January
              2026)
            </span>
          </div>
          <div
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-13)",
              color: "var(--color-text-40)",
              marginTop: 8,
              maxWidth: 720,
            }}
          >
            On reader pages, multi-source reconciled facts also display a small
            chevron (the FactValueDot) next to the value. Click or hover it to
            see the canonical pick, every alternate source, freshness dates,
            licenses, and any open dispute markers.
          </div>
        </div>
      </section>

      <div
        style={{
          height: 1,
          background: "var(--color-divider)",
          margin: "var(--spacing-section-y) 0",
        }}
      />

      <section>
        <h2 className="page-heading" style={{ marginBottom: 8 }}>
          Standing posture
        </h2>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-14)",
            color: "var(--color-text-50)",
            lineHeight: "var(--leading-normal)",
            marginBottom: 16,
            maxWidth: 720,
          }}
        >
          Civica&rsquo;s approach is shaped by the institutions it cites and
          aspires to be cited alongside. Our World in Data is the canonical
          model for academic-grade public data presentation. The V-Dem
          Institute sets the methodological standard for comparative-politics
          regime classification. The World Bank, IMF, UN agencies, OECD, and
          other Tier-1 publishers form the backbone of the data layer.
        </p>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-14)",
            color: "var(--color-text-50)",
            lineHeight: "var(--leading-normal)",
            maxWidth: 720,
          }}
        >
          We are not these institutions. We do not have their funding, their
          staff, their decades of accumulated trust, or their formal review
          processes. What we have is a discipline of treating methodology
          decisions as citable artifacts, an honest beta posture for novel
          work, and a commitment to surfacing disagreement rather than hiding
          it.
        </p>
      </section>

      <div
        style={{
          height: 1,
          background: "var(--color-divider)",
          margin: "var(--spacing-section-y) 0",
        }}
      />

      <section>
        <h2 className="page-heading" style={{ marginBottom: 8 }}>
          Open and free
        </h2>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-14)",
            color: "var(--color-text-50)",
            lineHeight: "var(--leading-normal)",
            maxWidth: 720,
          }}
        >
          Civica Atlas is built to be a free, open reference. The codebase is
          open-source. Public-domain and CC0-licensed data is freely available.
          Per-source licenses are preserved at the row level and disclosed on
          every reader page. If you are an academic interested in reviewing the
          methodology, citing the data, or collaborating on extensions, please{" "}
          <Link
            href="/contact"
            style={{
              color: "var(--color-text-60)",
              textDecoration: "underline",
              textUnderlineOffset: "2px",
            }}
          >
            get in touch
          </Link>
          . External review is an explicit goal of the project, not a
          hypothetical.
        </p>
      </section>
    </div>
  );
}
