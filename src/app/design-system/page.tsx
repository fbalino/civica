import Link from "next/link";
import { FactbookLegislatureChart } from "@/components/factbook/FactbookLegislatureChart";
import { SectionHeader } from "@/components/editorial/SectionHeader";
import { Banner } from "@/components/editorial/Banner";
import { Pill } from "@/components/editorial/Pill";
import { StatusDot } from "@/components/editorial/StatusDot";
import { Tooltip, InfoTip } from "@/components/editorial/Tooltip";
import { ScorePosition } from "@/components/editorial/ScorePosition";
import { SourceDot } from "@/components/SourceDot";
import { DataValueState } from "@/components/DataValueState";
import { CountrySearchCombobox } from "@/components/CountrySearchCombobox";
import { PageHero } from "@/components/PageHero";
import { SegmentedControlDemo } from "./SegmentedControlDemo";
import { IndicatorTrendChartDemo } from "./IndicatorTrendChartDemo";
import { IdeologyCompassDemo } from "./IdeologyCompassDemo";
import { ExploreMenuDemo } from "./ExploreMenuDemo";
import { CountryDirectory } from "@/components/country/CountryDirectory";
import { MobileNav } from "@/components/MobileNav";

import "./design-system.css";

export const revalidate = 0;

type DesignTokenGroup = {
  id: string;
  title: string;
  tokens: Array<{ cssVar: string; defaultValue?: string }>;
};

const tokenGroup = (
  id: string,
  title: string,
  cssVars: string[],
  defaults: Record<string, string> = {},
): DesignTokenGroup => ({
  id,
  title,
  tokens: cssVars.map((cssVar) => ({ cssVar, defaultValue: defaults[cssVar] })),
});

// Read-only catalog for the canonical design-system page. The former local
// token editor and its mutable registry have been removed; these entries only
// identify the live CSS variables demonstrated below.
const DESIGN_TOKEN_GROUPS: DesignTokenGroup[] = [
  tokenGroup("surface", "Surface palette", [
    "--color-bg",
    "--color-surface-elevated",
    "--color-select-bg",
    "--color-text-primary",
    "--color-text-60",
    "--color-text-50",
    "--color-text-40",
    "--color-text-30",
    "--color-divider",
    "--color-stat-border",
    "--color-card-bg",
    "--color-card-border",
    "--color-card-hover-bg",
    "--color-card-hover-border",
    "--color-tooltip-bg",
    "--color-tooltip-text",
    "--color-tooltip-border",
    "--color-grid-bg",
    "--color-grid-cell",
    "--color-grid-cell-hover",
    "--color-grid-row-hover",
  ]),
  tokenGroup("accent", "Accent", ["--color-accent"]),
  tokenGroup("signal", "Signal colors", [
    "--color-success",
    "--color-warn",
    "--color-danger",
    "--color-info",
  ]),
  tokenGroup("indicator-ramp", "Indicator ramp (choropleth)", [
    "--ramp-indicator-1",
    "--ramp-indicator-2",
    "--ramp-indicator-3",
    "--ramp-indicator-4",
    "--ramp-indicator-5",
    "--ramp-no-data",
  ]),
  tokenGroup("gov", "Government type palette", [
    "--gov-parl",
    "--gov-pres",
    "--gov-semi",
    "--gov-mon",
    "--gov-abs",
    "--gov-theo",
    "--gov-one",
    "--gov-mil",
    "--gov-other",
  ]),
  tokenGroup("branch", "Government branch palette", [
    "--color-branch-executive",
    "--color-branch-legislative",
    "--color-branch-judicial",
    "--color-branch-monarchy",
  ]),
  tokenGroup("peer", "Peer-grouping lenses", [
    "--peer-region-eap",
    "--peer-region-eca",
    "--peer-region-lac",
    "--peer-region-mena",
    "--peer-region-na",
    "--peer-region-sa",
    "--peer-region-ssa",
    "--peer-income-low",
    "--peer-income-lower-mid",
    "--peer-income-upper-mid",
    "--peer-income-high",
  ]),
  tokenGroup("source", "Source provenance", [
    "--color-source-live",
    "--color-source-frozen",
  ]),
  tokenGroup("atlas", "Atlas map", [
    "--atlas-rule",
    "--atlas-rule-2",
    "--atlas-ocean",
    "--atlas-land",
    "--atlas-land-dim",
    "--atlas-land-hover",
    "--atlas-land-selected",
    "--atlas-accent-soft",
  ]),
  tokenGroup("spacing", "Spacing", [
    "--space-1",
    "--space-2",
    "--space-3",
    "--space-4",
    "--space-5",
    "--space-6",
    "--space-7",
    "--space-8",
    "--space-9",
  ]),
  tokenGroup(
    "layout",
    "Layout widths",
    ["--width-reference-content", "--width-reference-shell"],
    {
      "--width-reference-content": "1280px content",
      "--width-reference-shell": "1280px + two --space-6 gutters",
    },
  ),
  tokenGroup("radii", "Radii", [
    "--radius-sm",
    "--radius-md",
    "--radius-lg",
    "--radius-xl",
    "--radius-2xl",
    "--radius-full",
    "--radius-control",
    "--radius-chip",
    "--radius-search",
  ]),
  tokenGroup("borders", "Borders", ["--border-hairline"], {
    "--border-hairline": "1px",
  }),
  tokenGroup("shadows", "Shadows", [
    "--shadow-hard",
    "--shadow-hard-sm",
    "--shadow-hard-md",
    "--shadow-hard-lg",
    "--shadow-dark",
  ]),
  tokenGroup(
    "motion",
    "Motion",
    ["--motion-fast", "--motion-base", "--motion-slow", "--motion-slower"],
    {
      "--motion-fast": "120ms",
      "--motion-base": "180ms",
      "--motion-slow": "300ms",
      "--motion-slower": "500ms",
    },
  ),
];

const groupById = (id: string): DesignTokenGroup | undefined =>
  DESIGN_TOKEN_GROUPS.find((group) => group.id === id);

/** Color groups rendered as live swatch grids (in display order). */
const COLOR_GROUP_IDS = [
  "surface",
  "accent",
  "signal",
  "gov",
  "branch",
  "peer",
  "source",
  "atlas",
] as const;

const TYPE_SCALE = [
  {
    lab: "Display / H1",
    text: "Every government.",
    family: "var(--font-heading)",
    size: "var(--text-56)",
    weight: 600,
    lh: 1.05,
    tr: "var(--tracking-tight)",
    spec: "Source Serif 4 · 600 · 56/64",
  },
  {
    lab: "H2",
    text: "How every country is governed.",
    family: "var(--font-heading)",
    size: "var(--text-40)",
    weight: 600,
    lh: 1.1,
    tr: "var(--tracking-tight)",
    spec: "Source Serif 4 · 600 · 40/48",
  },
  {
    lab: "H3",
    text: "Parliament, live.",
    family: "var(--font-heading)",
    size: "var(--text-28)",
    weight: 600,
    lh: 1.2,
    tr: "var(--tracking-snug)",
    spec: "Source Serif 4 · 600 · 28/36",
  },
  {
    lab: "Lead / dek",
    text: "A semi-presidential republic in Western Europe.",
    family: "var(--font-heading)",
    size: "var(--text-22)",
    weight: 400,
    lh: 1.36,
    tr: "0",
    spec: "Source Serif 4 · 400 · 22/30",
  },
  {
    lab: "Body",
    text: "Hover any seat to meet the member. Compare two countries side by side.",
    family: "var(--font-body)",
    size: "var(--text-16)",
    weight: 400,
    lh: 1.625,
    tr: "0",
    spec: "Inter · 400 · 16/26",
  },
  {
    lab: "Caption",
    text: "577 seats · elected by a two-round system",
    family: "var(--font-body)",
    size: "var(--text-13)",
    weight: 400,
    lh: 1.5,
    tr: "0",
    spec: "Inter · 400 · 13",
  },
  {
    lab: "Label / eyebrow",
    text: "WELCOME · ATLAS",
    family: "var(--font-body)",
    size: "var(--text-12)",
    weight: 600,
    lh: 1.45,
    tr: "var(--tracking-caps)",
    spec: "Inter · 600 · 11 · +0.8% · caps",
    caps: true,
  },
  {
    lab: "Code",
    text: "var(--color-accent) · GET /api/v1/index",
    family: "var(--font-code)",
    size: "var(--text-12)",
    weight: 500,
    lh: 1.4,
    tr: "0",
    spec: "ui-monospace · 12 · code only",
  },
];

const SAMPLE_CHAMBER = {
  id: "sample-lower",
  slot: "lower" as const,
  name: "Sample Country · National Assembly",
  total: 150,
  sub: "150 seats",
  parties: [
    {
      id: "civic-alliance",
      name: "Civic Alliance",
      seats: 46,
      color: "var(--gov-parl)",
    },
    {
      id: "national-union",
      name: "National Union",
      seats: 38,
      color: "var(--gov-pres)",
    },
    {
      id: "green-list",
      name: "Green List",
      seats: 25,
      color: "var(--gov-theo)",
    },
    {
      id: "liberal-forum",
      name: "Liberal Forum",
      seats: 22,
      color: "var(--gov-semi)",
    },
    {
      id: "independents",
      name: "Independents",
      seats: 19,
      color: "var(--color-text-40)",
    },
  ],
};

function SwatchGrid({ group }: { group: DesignTokenGroup }) {
  return (
    <>
      <h3 className="ds-sub">{group.title}</h3>
      <div className="ds-swatches">
        {group.tokens.map((t) => (
          <div key={t.cssVar} className="ds-swatch">
            <div className="chip" style={{ background: `var(${t.cssVar})` }} />
            <div className="meta">
              <div className="var">{t.cssVar}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export default function DesignSystemPage() {
  const ramp = groupById("indicator-ramp");
  const spacing = groupById("spacing");
  const layout = groupById("layout");
  const radii = groupById("radii");
  const borders = groupById("borders");
  const shadows = groupById("shadows");
  const motion = groupById("motion");

  return (
    <div className="ds-page">
      <header className="ds-top">
        <span className="ds-brand">
          Civica Atlas<span className="d">.</span>
        </span>
        <span className="ds-eyebrow">Design System · v0.2 · June 2026</span>
        <span className="ds-grow" />
      </header>

      {/* Not a <main>: the root layout already provides the page's single
          main landmark (src/app/layout.tsx). */}
      <div className="ds-main">
        {/* Visually hidden — the visible "Civica Atlas." wordmark above is
            site chrome, not a page title, so this page had no accessible h1.
            Matches the <title>/metadata above without changing any pixel. */}
        <h1 className="sr-only">Design System</h1>
        <div className="ds-directive">
          <strong>This page is the canonical reference.</strong> Every swatch
          and component below renders live from the design tokens in{" "}
          <code>globals.css</code> — change a token and it changes here and
          across the site. If a page doesn&rsquo;t look like an extension of
          this one, it&rsquo;s off-system. See{" "}
          <Link href="https://github.com/fbalino/civica/blob/main/DESIGN.md">
            DESIGN.md
          </Link>
          . No hardcoded colors, fonts, or sizes elsewhere.
        </div>

        {/* 00 Foundation */}
        <section className="ds-section">
          <div className="ds-section-head">
            <span className="num">00 · Foundation</span>
            <h2>A fine-press almanac.</h2>
            <span className="dek">
              Warm ivory paper, ink-navy type, a terracotta accent, hairline
              rules, and antique engraved illustration. Dark mode is the same
              vocabulary at night.
            </span>
          </div>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-16)",
              color: "var(--color-text-secondary)",
              maxWidth: "64ch",
              lineHeight: "var(--leading-normal)",
              margin: 0,
            }}
          >
            Civica Atlas is a provenance-first comparative reference to how
            every country is governed. The atlas is primary; original
            measurements remain secondary research experiments. The system is
            built on a warm paper field, navy ink, a single editorial accent,
            hairline rules, and provenance controls where the underlying
            renderer supports them. Color is reserved for meaning.
          </p>
        </section>

        {/* 01 Color */}
        <section className="ds-section">
          <div className="ds-section-head">
            <span className="num">01 · Color</span>
            <h2>Ivory, ink-navy, terracotta.</h2>
            <span className="dek">
              Every color token, live from both themes. Toggle the site theme to
              see dark.
            </span>
          </div>

          {COLOR_GROUP_IDS.map((id) => {
            const g = groupById(id);
            return g ? <SwatchGrid key={id} group={g} /> : null;
          })}

          {ramp ? (
            <>
              <h3 className="ds-sub">{ramp.title}</h3>
              <div className="ds-ramp">
                {ramp.tokens.map((t) => (
                  <Tooltip
                    key={t.cssVar}
                    className="ds-ramp-cell-tip"
                    content={t.cssVar}
                  >
                    <div
                      className="ds-ramp-cell"
                      style={{ background: `var(${t.cssVar})` }}
                    />
                  </Tooltip>
                ))}
              </div>
            </>
          ) : null}
        </section>

        {/* 02 Typography */}
        <section className="ds-section">
          <div className="ds-section-head">
            <span className="num">02 · Typography</span>
            <h2>Source Serif 4, Inter, mono.</h2>
            <span className="dek">
              A high-contrast serif for voice, a precise sans for data, mono for
              labels and codes.
            </span>
          </div>
          {TYPE_SCALE.map((t) => (
            <div key={t.lab} className="ds-type-row">
              <span className="lab">{t.lab}</span>
              <span
                style={{
                  fontFamily: t.family,
                  fontSize: t.size,
                  fontWeight: t.weight,
                  lineHeight: t.lh,
                  letterSpacing: t.tr,
                  color: "var(--color-text-primary)",
                  textTransform: t.caps ? "uppercase" : "none",
                }}
              >
                {t.text}
              </span>
              <span className="spec">{t.spec}</span>
            </div>
          ))}
        </section>

        {/* 03 Spacing & shape */}
        <section className="ds-section">
          <div className="ds-section-head">
            <span className="num">03 · Spacing &amp; Shape</span>
            <h2>4-pt grid, small radii, soft shadows.</h2>
            <span className="dek">
              A tight spacing scale, print-like radii, and restrained
              navy-tinted elevation.
            </span>
          </div>

          <h3 className="ds-sub">Spacing</h3>
          <div style={{ maxWidth: 560 }}>
            {spacing?.tokens
              .filter((t) => t.cssVar.startsWith("--space-"))
              .map((t) => (
                <div key={t.cssVar} className="ds-space-row">
                  <span className="label">
                    {t.cssVar.replace("--space-", "space-")}
                  </span>
                  <span className="bar" style={{ width: `var(${t.cssVar})` }} />
                </div>
              ))}
          </div>

          <h3 className="ds-sub">Layout widths</h3>
          <div
            className="ds-row"
            style={{
              fontFamily: "var(--font-code)",
              fontSize: "var(--text-13)",
              color: "var(--color-text-secondary)",
            }}
          >
            {layout?.tokens.map((token) => (
              <span key={token.cssVar}>
                {token.cssVar} · {token.defaultValue}
              </span>
            ))}
          </div>

          <h3 className="ds-sub">Radii</h3>
          <div className="ds-tiles">
            {radii?.tokens.map((t) => (
              <div
                key={t.cssVar}
                className="ds-tile"
                style={{ borderRadius: `var(${t.cssVar})` }}
              >
                {t.cssVar.replace("--radius-", "r-")}
              </div>
            ))}
          </div>

          <h3 className="ds-sub">Rules</h3>
          <div className="ds-row">
            {borders?.tokens.map((token) => (
              <span key={token.cssVar}>
                {token.cssVar} · {token.defaultValue}
              </span>
            ))}
          </div>

          <h3 className="ds-sub">Elevation</h3>
          <div className="ds-tiles">
            {shadows?.tokens.map((t) => (
              <div
                key={t.cssVar}
                className="ds-tile"
                style={{
                  boxShadow: `var(${t.cssVar})`,
                  borderRadius: "var(--radius-md)",
                }}
              >
                {t.cssVar.replace("--shadow-", "")}
              </div>
            ))}
          </div>

          <h3 className="ds-sub">Motion</h3>
          <div
            className="ds-row"
            style={{
              fontFamily: "var(--font-code)",
              fontSize: "var(--text-13)",
              color: "var(--color-text-secondary)",
            }}
          >
            {motion?.tokens.map((t) => (
              <span key={t.cssVar}>
                {t.cssVar.replace("--motion-", "")} {t.defaultValue}
              </span>
            ))}
          </div>
        </section>

        {/* 04 Components */}
        <section className="ds-section">
          <div className="ds-section-head">
            <span className="num">04 · Components</span>
            <h2>The building blocks.</h2>
            <span className="dek">
              Real primitives — the same components the site renders.
            </span>
          </div>

          <div className="ds-comp-grid">
            <div className="ds-comp ds-comp--wide">
              <h4>Buttons (real .btn system)</h4>
              <div className="ds-row">
                <button type="button" className="btn btn--primary">
                  <span>Primary Button</span>
                  <span className="btn__arrow" aria-hidden="true">
                    &rarr;
                  </span>
                </button>
                <button type="button" className="btn btn--secondary">
                  Secondary Button
                </button>
                <button type="button" className="btn btn--tertiary">
                  Tertiary
                </button>
                <button type="button" className="btn btn--text">
                  <span>Text link</span>
                  <span className="btn__arrow" aria-hidden="true">
                    &rarr;
                  </span>
                </button>
              </div>
              <div className="ds-row" style={{ marginTop: "var(--space-4)" }}>
                <button type="button" className="btn btn--primary btn--sm">
                  Small
                </button>
                <button type="button" className="btn btn--primary">
                  Default
                </button>
                <button type="button" className="btn btn--primary btn--lg">
                  Large
                </button>
                <button type="button" className="btn btn--secondary" disabled>
                  Disabled
                </button>
                <button type="button" className="btn btn--primary is-loading">
                  <span>Loading</span>
                  <span className="btn__spinner" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="ds-comp">
              <h4>Chips (real)</h4>
              <div className="ds-row">
                <Pill>Neutral</Pill>
                <Pill variant="sage">High income</Pill>
                <Pill variant="sand">Beta</Pill>
                <Pill variant="rose">Fragile</Pill>
                <Pill variant="blue">EU Member</Pill>
                <Pill variant="accent">Accent</Pill>
              </div>
            </div>

            <div className="ds-comp ds-comp--wide">
              <h4>Data availability states (real)</h4>
              <div className="ds-row">
                <DataValueState status="observed">42</DataValueState>
                <DataValueState
                  status="missing"
                  reason="Expected import row is absent."
                />
                <DataValueState
                  status="unknown"
                  reason="Publisher reports unknown."
                />
                <DataValueState
                  status="not_applicable"
                  reason="Indicator does not apply."
                />
                <DataValueState
                  status="not_observed"
                  reason="No observation for this period."
                />
                <DataValueState status="disputed" reason="Sources conflict.">
                  42
                </DataValueState>
                <DataValueState
                  status="withheld"
                  reason="Release rights are restricted."
                />
              </div>
            </div>

            <div className="ds-comp">
              <h4>Filter chips</h4>
              <div className="ds-row">
                <button className="ds-chip on">All</button>
                <button className="ds-chip">Europe</button>
                <button className="ds-chip">Parliamentary</button>
                <button className="ds-chip">Monarchy</button>
              </div>
            </div>

            <div className="ds-comp ds-comp--wide">
              <h4>Search field (real, pill)</h4>
              <CountrySearchCombobox
                countries={[]}
                placeholder="Search countries, regions, institutions…"
                ariaLabel="Search"
                showShortcut
                showFilterIcon
              />
            </div>

            <div className="ds-comp">
              <h4>Segmented control (real)</h4>
              <SegmentedControlDemo />
            </div>

            <div className="ds-comp ds-comp--wide">
              <h4>Tooltip + InfoTip (real)</h4>
              <div
                className="ds-row"
                style={{
                  alignItems: "center",
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-14)",
                  color: "var(--color-text-secondary)",
                }}
              >
                <Tooltip content="Instant, inverted, portalled above the trigger — flips below when it would clip.">
                  <button type="button" className="btn btn--secondary">
                    Hover or focus me
                  </button>
                </Tooltip>
                <span>
                  Civica-derived estimate
                  <InfoTip content="Not a source figure — Civica computes this from the underlying data. Hover the trigger for the note." />
                </span>
              </div>
            </div>

            <div className="ds-comp ds-comp--wide">
              <h4>Tabs (real .tab-nav)</h4>
              <div
                style={{
                  display: "flex",
                  gap: "var(--space-5)",
                  borderBottom: "1px solid var(--color-card-border)",
                }}
              >
                {["Overview", "Data", "Compare", "Methodology"].map((label) => (
                  <button
                    key={label}
                    type="button"
                    className={`tab-nav${label === "Overview" ? " tab-nav--active" : ""}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="ds-comp">
              <h4>Provenance — SourceDot (real)</h4>
              <div
                className="ds-row"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-14)",
                  color: "var(--color-text-secondary)",
                }}
              >
                <span>
                  Live <SourceDot source="wikidata" retrievedAt="2026-06-01" />
                </span>
                <span>
                  Frozen{" "}
                  <SourceDot source="cia_factbook" retrievedAt="2026-01-15" />
                </span>
              </div>
            </div>

            <div className="ds-comp">
              <h4>StatusDot (real)</h4>
              <div
                className="ds-row"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-14)",
                  color: "var(--color-text-secondary)",
                }}
              >
                <span>
                  <StatusDot state="active" /> Active
                </span>
                <span>
                  <StatusDot state="idle" /> Idle
                </span>
                <span>
                  <StatusDot state="warn" /> Warn
                </span>
                <span>
                  <StatusDot state="down" /> Down
                </span>
              </div>
            </div>

            <div className="ds-comp">
              <h4>Gov-type badges</h4>
              <div className="ds-row">
                {[
                  ["Parliamentary", "--gov-parl"],
                  ["Presidential", "--gov-pres"],
                  ["Semi-presidential", "--gov-semi"],
                  ["Monarchy", "--gov-mon"],
                  ["Theocracy", "--gov-theo"],
                ].map(([label, v]) => (
                  <span
                    key={v}
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "var(--text-12)",
                      fontWeight: 600,
                      color: `var(${v})`,
                      background: `color-mix(in oklab, var(${v}) 14%, transparent)`,
                      border: `1px solid color-mix(in oklab, var(${v}) 34%, transparent)`,
                      padding: "2px 8px",
                      borderRadius: "var(--radius-sm)",
                    }}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <div className="ds-comp">
              <h4>Neutral research score</h4>
              <div className="ds-card">
                <div className="nm">Denmark</div>
                <div className="meta">Parliamentary · Europe · 5.9M</div>
                <div className="foot">
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--text-12)",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    CIVICA INDEX · RESEARCH BETA
                  </span>
                  <span className="ds-score">71</span>
                </div>
                <ScorePosition
                  value={71}
                  lower={66}
                  upper={76}
                  label="Example Civica Index estimate"
                  compact
                />
              </div>
            </div>

            <div className="ds-comp ds-comp--wide">
              <h4>Banners (real)</h4>
              <div style={{ display: "grid", gap: "var(--space-3)" }}>
                <Banner variant="info">
                  Methodology in active development.
                </Banner>
                <Banner variant="success">
                  All sources synced this quarter.
                </Banner>
                <Banner variant="warn">
                  Pulse is experimental — check the last completed computation.
                </Banner>
                <Banner variant="danger">
                  This figure failed reconciliation.
                </Banner>
              </div>
            </div>

            <div className="ds-comp ds-comp--wide">
              <h4>Explore megamenu (real .explore-menu)</h4>
              <p
                style={{
                  margin: "0 0 var(--space-4)",
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-13)",
                  color: "var(--color-text-muted)",
                  maxWidth: "48ch",
                }}
              >
                The header&rsquo;s &ldquo;Explore&rdquo; panel, shown open.
                Ivory paper, a terracotta hairline top rule, and destination
                rows that pair a spot engraving with a serif name and a one-line
                description. Rows warm on hover and keyboard focus.
              </p>
              <ExploreMenuDemo />
            </div>

            <div className="ds-comp ds-comp--wide">
              <h4>Full-screen atlas menu (real)</h4>
              <p
                style={{
                  margin: "0 0 var(--space-4)",
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-13)",
                  color: "var(--color-text-muted)",
                  maxWidth: "48ch",
                }}
              >
                The hamburger opens the canonical full-viewport navigation:
                image-led browse destinations, research and methodology
                registers, search, status, and reference links. Escape closes it
                and keyboard focus remains inside while open.
              </p>
              <MobileNav />
            </div>

            <div className="ds-comp ds-comp--wide">
              <h4>Section header (real)</h4>
              <SectionHeader
                eyebrow="Evidence"
                title="Readable structure."
                dek="The same SectionHeader primitive used across reader and methodology pages."
              />
            </div>

            <div className="ds-comp ds-comp--wide">
              <h4>Country directory (real)</h4>
              <p
                style={{
                  margin: "0 0 var(--space-4)",
                  fontFamily: "var(--font-body)",
                  fontSize: "var(--text-13)",
                  color: "var(--color-text-muted)",
                  maxWidth: "48ch",
                }}
              >
                Shared A&ndash;Z country directory used by the country catalog
                and Governance Evidence. Callers provide the destination; the
                grouping, flags, region signals, and responsive columns remain
                identical.
              </p>
              <CountryDirectory
                hrefPrefix="/country"
                countries={[
                  {
                    slug: "andorra",
                    name: "Andorra",
                    iso2: "AD",
                    continent: "Europe",
                  },
                  {
                    slug: "barbados",
                    name: "Barbados",
                    iso2: "BB",
                    continent: "North America",
                  },
                  {
                    slug: "denmark",
                    name: "Denmark",
                    iso2: "DK",
                    continent: "Europe",
                  },
                  {
                    slug: "guyana",
                    name: "Guyana",
                    iso2: "GY",
                    continent: "South America",
                  },
                  {
                    slug: "japan",
                    name: "Japan",
                    iso2: "JP",
                    continent: "Asia",
                  },
                  {
                    slug: "holy-see-vatican-city",
                    name: "Vatican City",
                    iso2: "VA",
                    continent: "Europe",
                  },
                ]}
              />
            </div>

            <div className="ds-comp ds-comp--wide">
              <h4>Hemicycle (canonical FactbookLegislatureChart)</h4>
              <FactbookLegislatureChart
                chamber={SAMPLE_CHAMBER}
                houseLabel="Lower house"
                countryName="Sample Country"
              />
            </div>

            <div className="ds-comp ds-comp--wide">
              <h4>Long-run indicator trend (IndicatorTrendChart)</h4>
              <IndicatorTrendChartDemo />
            </div>

            <div className="ds-comp ds-comp--wide">
              <h4>Ideology compass (IdeologyCompass)</h4>
              <IdeologyCompassDemo />
            </div>
          </div>
        </section>

        {/* 05 Page hero */}
        <section className="ds-section">
          <div className="ds-section-head">
            <span className="num">05 · Page hero</span>
            <h2>One hero, everywhere.</h2>
            <span className="dek">
              The single <code>&lt;PageHero&gt;</code> shell every browse and
              landing page shares — full-bleed band, shared height, 1200px inner
              column, eyebrow → serif H1 → dek, with optional engraving, search,
              and chip slots. Only <code>/blog</code> and methodology pages opt
              out.
            </span>
          </div>
          {/* Real PageHero, rendered live. It is 100vw full-bleed by design, so
              it breaks out of this container exactly as it does on real pages.
              titleAs="p": this is a component SWATCH, not this page's actual
              title (that's the sr-only <h1> above) — a real page passes no
              titleAs and gets the default <h1>. */}
          <PageHero
            eyebrow="Section · Page"
            titleId="ds-page-hero-title"
            titleAs="p"
            title="Every page opens the same way."
            description="Eyebrow, serif headline, and a one-line standfirst on a full-bleed engraving band. Pages add a search field or filter chips through slots; the frame never changes."
            engraving={{
              src: "/engravings/pages/index.webp",
              darkSrc: "/engravings/pages/index-dark.webp",
            }}
            search={
              <CountrySearchCombobox
                countries={[]}
                placeholder="Optional search slot…"
                ariaLabel="Demo search"
              />
            }
          />
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "var(--text-13)",
              color: "var(--color-text-muted)",
              maxWidth: "64ch",
              margin: "var(--space-5) 0 0",
              lineHeight: "var(--leading-normal)",
            }}
          >
            Import from <code>@/components/PageHero</code>. Props:{" "}
            <code>eyebrow</code>, <code>title</code>, <code>description</code>,{" "}
            <code>engraving</code> (light/dark asset), <code>search</code>,{" "}
            <code>chips</code>, and a trailing <code>children</code> slot for a
            stat strip or CTA. Given the same content it renders identical to
            the home, <code>/country</code>, and <code>/about</code> heroes.
          </p>
        </section>

        {/* 06 Voice */}
        <section className="ds-section">
          <div className="ds-section-head">
            <span className="num">06 · Voice</span>
            <h2>Clear, civic, dry.</h2>
            <span className="dek">
              Like a textbook written by a journalist. Factual, spare, a little
              warm.
            </span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "var(--space-7)",
            }}
          >
            <div
              style={{
                borderLeft: "2px solid var(--color-success)",
                padding: "var(--space-3) var(--space-5)",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontWeight: "var(--font-weight-mono)",
                  fontSize: "var(--text-12)",
                  letterSpacing: "var(--tracking-caps)",
                  textTransform: "uppercase",
                  color: "var(--color-success)",
                }}
              >
                Do
              </div>
              <p
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "var(--text-18)",
                  color: "var(--color-text-primary)",
                  margin: "var(--space-3) 0 0",
                }}
              >
                &ldquo;France is a semi-presidential republic. The President and
                Prime Minister share executive power.&rdquo;
              </p>
            </div>
            <div
              style={{
                borderLeft: "2px solid var(--color-danger)",
                padding: "var(--space-3) var(--space-5)",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontWeight: "var(--font-weight-mono)",
                  fontSize: "var(--text-12)",
                  letterSpacing: "var(--tracking-caps)",
                  textTransform: "uppercase",
                  color: "var(--color-danger)",
                }}
              >
                Don&apos;t
              </div>
              <p
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "var(--text-18)",
                  color: "var(--color-text-primary)",
                  margin: "var(--space-3) 0 0",
                }}
              >
                &ldquo;Dive into France&apos;s fascinating governmental
                landscape, where dual executives share the stage in an exciting
                political dance!&rdquo;
              </p>
            </div>
          </div>
        </section>
      </div>

      <footer className="ds-foot">
        <span>Civica Design System · v0.2</span>
        <span>June 2026</span>
      </footer>
    </div>
  );
}
