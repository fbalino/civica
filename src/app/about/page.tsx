import type { Metadata } from "next";
import Link from "next/link";
import { SourceDot } from "@/components/SourceDot";
import { Reveal } from "@/components/motion/Reveal";
import { PageHero } from "@/components/PageHero";
import { MarkdownContent } from "@/components/content/MarkdownContent";
import { prettyDisplayValue } from "@/lib/data/humanize-label";
import { getAllSources } from "@/lib/db/queries";
import { civicaIndex, pulse } from "@/lib/content/site-state";
import { withOg } from "@/lib/og";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "About — A Provenance-First Reference Atlas",
  // PUBLIC_CLAIM: about.metadata-positioning
  description:
    "Civica Atlas is a provenance-first comparative reference to how every country is governed. The atlas is primary; the Civica Index and Pulse are secondary research experiments.",
  alternates: { canonical: "https://civicaatlas.org/about" },
  openGraph: withOg({
    title: "About Civica Atlas — A Provenance-First Reference Atlas",
    description:
      "A provenance-first comparative reference to how every country is governed, with explicitly experimental Index and Pulse research outputs.",
    url: "https://civicaatlas.org/about",
  }),
};

const SOURCE_DESCRIPTIONS: Record<string, string> = {
  cia_factbook:
    "Comprehensive country profiles covering geography, demographics, government, economy, military, and more. The Factbook was sunset on 4 February 2026; Civica preserves the final January 2026 archive as a frozen reference layer.",
  wikidata:
    "Structured knowledge base providing the country-identity spine plus heads of state, heads of government, and legislative body data. Updated regularly via SPARQL queries.",
  ipu_parline:
    "Inter-Parliamentary Union database on national parliaments. Provides chamber composition, electoral systems, and parliamentary structure for legislatures worldwide.",
  constitute_project:
    "Full-text constitution database. Civica draws on a growing set of constitutional texts, amendment histories, and comparative constitutional data for selected jurisdictions.",
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

  // The pure-prose intro + "How it works" + "Methodology" + "Standing
  // posture" + "Open and free" sections live in content/about.md.
  // The 3-card "What we do" grid, the DB-driven sources grid, and
  // the provenance-dot legend stay in TSX because they're either
  // bespoke layout or live data, not prose. Per
  // ~/civica/plan/content-templating-audit-v1.md §3.1.
  const state = { civicaIndex, pulse };

  return (
    <>
      {/* Canonical full-bleed page hero (shared PageHero shell). */}
      <PageHero
        eyebrow="About"
        titleId="about-hero-title"
        title="About Civica Atlas"
        description={
          <>
            A provenance-first comparative reference to how every country is
            governed.
          </>
        }
        engraving={{
          src: "/engravings/pages/about.webp",
          darkSrc: "/engravings/pages/about-dark.webp",
        }}
      />

      <div
        className="editorial-page editorial-page--wide"
        style={{
          paddingTop: "var(--spacing-section-y)",
          paddingBottom: "var(--spacing-section-y)",
        }}
      >
        {/* Intro paragraphs — markdown body, sliced to everything
            BEFORE the "How it works" section. */}
      <Reveal as="section" className="editorial-section about-prose-intro" amount={0.15}>
        <MarkdownContent
          file="content/about.md"
          state={state as unknown as Record<string, unknown>}
          stats={null}
          slice={{ to: "how-it-works" }}
        />
      </Reveal>

      <div
        style={{
          height: 1,
          background: "var(--color-divider)",
          margin: "var(--spacing-section-y) 0",
        }}
      />

      <Reveal as="section" amount={0.12}>
        <h2 className="page-heading" style={{ marginBottom: 8 }}>
          What we do
        </h2>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-15)",
            color: "var(--color-text-50)",
            lineHeight: "var(--leading-normal)",
            marginBottom: 24,
            maxWidth: 720,
          }}
        >
          The country atlas is Civica&rsquo;s primary publication. The Index and
          Pulse are secondary research experiments, shown here with their beta
          status and limitations.
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
                href="/country"
                style={{ color: "inherit", textDecoration: "none" }}
              >
                Country Profiles
              </Link>
            </h3>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-15)",
                color: "var(--color-text-50)",
                lineHeight: "var(--leading-normal)",
                margin: 0,
              }}
            >
              Country dossiers — geography, demographics, government, economy,
              energy, environment, military, and more. Each fact is reconciled
              across multiple named sources where coverage exists, with source,
              freshness, and license context attached where available.
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
                fontSize: "var(--text-15)",
                color: "var(--color-text-50)",
                lineHeight: "var(--leading-normal)",
                margin: 0,
              }}
            >
              A secondary research-beta composite (0&ndash;100) computed across{" "}
              {civicaIndex.dimensionCount} governance
              dimensions:{" "}
              {civicaIndex.dimensions.map((d) => d.label.toLowerCase()).join(", ")}.
              Material outcomes (human development, peace &amp; security,
              economic stability) live on the separate Civica Conditions
              companion layer at <Link href="/civica-conditions">/civica-conditions</Link>.
              PCA-derived weights, frozen reference periods, and Monte Carlo
              input-variation ranges. These ranges are sensitivity summaries,
              not confidence intervals for a true country score.
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
                fontSize: "var(--text-15)",
                color: "var(--color-text-50)",
                lineHeight: "var(--leading-normal)",
                margin: 0,
              }}
            >
              An experimental governance-event ledger with model-assisted
              classification. The public feed reflects the most recent completed
              run and does not establish a continuous measure of governance
              change. Numeric effects remain experimental pending representative
              validation and independent review.
              {pulse.status === "beta" ? " Currently in BETA." : ""}
            </p>
          </div>
        </div>
      </Reveal>

      <div
        style={{
          height: 1,
          background: "var(--color-divider)",
          margin: "var(--spacing-section-y) 0",
        }}
      />

      {/* "How it works" + "Methodology" prose — markdown body sliced
          to the range between those two anchors. */}
      <Reveal as="section" className="editorial-section about-prose-howitworks" amount={0.12}>
        <MarkdownContent
          file="content/about.md"
          state={state as unknown as Record<string, unknown>}
          stats={null}
          slice={{ from: "how-it-works", to: "standing-posture" }}
        />
      </Reveal>

      <div
        style={{
          height: 1,
          background: "var(--color-divider)",
          margin: "var(--spacing-section-y) 0",
        }}
      />

      <Reveal as="section" id="sources" amount={0.08}>
        <h2 className="page-heading" style={{ marginBottom: 8 }}>
          Data sources
        </h2>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-15)",
            color: "var(--color-text-40)",
            lineHeight: "var(--leading-normal)",
            marginBottom: 24,
          }}
        >
          Civica currently catalogues {sourcesForDisplay.length} source records.
          Reader surfaces show source and freshness context where the underlying
          record carries it.
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
                  fontSize: "var(--text-15)",
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
                  fontSize: "var(--text-12)",
                  color: "var(--color-text-25)",
                  letterSpacing: "var(--tracking-wide)",
                }}
              >
                {source.license}
              </span>
            </div>
          ))}
        </div>
      </Reveal>

      <div
        style={{
          height: 1,
          background: "var(--color-divider)",
          margin: "var(--spacing-section-y) 0",
        }}
      />

      <Reveal as="section" amount={0.12}>
        <h2 className="page-heading" style={{ marginBottom: 8 }}>
          Provenance
        </h2>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--text-15)",
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
                fontSize: "var(--text-15)",
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
                fontSize: "var(--text-15)",
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
              fontSize: "var(--text-14)",
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
      </Reveal>

      <div
        style={{
          height: 1,
          background: "var(--color-divider)",
          margin: "var(--spacing-section-y) 0",
        }}
      />

      {/* "Standing posture" + "Open and free" prose — markdown body
          sliced from `standing-posture` to end of file. */}
      <Reveal as="section" className="editorial-section about-prose-outro" amount={0.12}>
        <MarkdownContent
          file="content/about.md"
          state={state as unknown as Record<string, unknown>}
          stats={null}
          slice={{ from: "standing-posture" }}
        />
      </Reveal>

      <div
        style={{
          height: 1,
          background: "var(--color-divider)",
          margin: "var(--spacing-section-y) 0",
        }}
      />

      <footer className="editorial-footer-nav">
        <Link href="/about/advisory-board">Advisory board →</Link>
        <Link href="/civica-index/methodology">Civica Index methodology →</Link>
        <Link href="/methodology">Methodology overview →</Link>
      </footer>
      </div>
    </>
  );
}
