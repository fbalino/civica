import "../v2.css";
import { CountryHoverCard } from "@/components/v2/CountryHoverCard";
import { V2Button } from "@/components/v2/V2Button";
import { V2SearchBar } from "@/components/v2/V2SearchBar";
import { V2Pill } from "@/components/v2/V2Pill";
import { V2BarChart } from "@/components/v2/V2BarChart";
import { V2IndicatorLegend } from "@/components/v2/V2IndicatorLegend";

export const metadata = {
  title: "v2 — Component preview",
};

const FOUNDATION_SWATCHES = [
  { name: "Navy", hex: "#001B3A" },
  { name: "Deep Teal", hex: "#0B3D4E" },
  { name: "Sage", hex: "#6B7566" },
  { name: "Terracotta", hex: "#C25D3A" },
  { name: "Gold", hex: "#C9A24B" },
  { name: "Bronze", hex: "#A87241" },
];

const NEUTRAL_SWATCHES = [
  { name: "Ink", hex: "#0B1220" },
  { name: "Slate", hex: "#334155" },
  { name: "Stone", hex: "#64748B" },
  { name: "Mist", hex: "#CBD5E1" },
  { name: "Parchment", hex: "#FAF7F2" },
  { name: "Canvas", hex: "#FFFCF8" },
];

const CI_TOP5 = [
  { rank: 1, country: "Denmark", iso2: "dk", score: 88.7 },
  { rank: 2, country: "Finland", iso2: "fi", score: 87.1 },
  { rank: 3, country: "Norway", iso2: "no", score: 86.3 },
  { rank: 4, country: "New Zealand", iso2: "nz", score: 85.0 },
  { rank: 5, country: "Sweden", iso2: "se", score: 84.1 },
];

export default function V2ShowcasePage() {
  return (
    <div className="v2-scope">
      <div className="v2-showcase">
        <div className="v2-showcase__header">
          <span className="v2-showcase__eyebrow">Civica Atlas · Design System v2</span>
        </div>
        <h1 className="v2-showcase__title">Component preview.</h1>
        <p className="v2-showcase__lede">
          A working sketch of the new visual language. Iterate by changing tokens
          in <code>v2.css</code> — every piece on this page reads from them.
        </p>

        {/* ---------- 01 Color ---------- */}
        <section className="v2-showcase__section">
          <div className="v2-showcase__section-header">
            <span className="v2-showcase__section-num">01</span>
            <span className="v2-showcase__section-label">Color</span>
          </div>
          <h2 className="v2-showcase__section-title">Foundation &amp; neutrals.</h2>
          <p className="v2-showcase__section-desc">
            Brand tones express identity; neutrals carry text, surfaces, and rules.
          </p>

          <div className="v2-showcase__panel" style={{ marginBottom: 16 }}>
            <div className="v2-swatch-row">
              {FOUNDATION_SWATCHES.map((s) => (
                <div key={s.hex} className="v2-swatch">
                  <div
                    className="v2-swatch__chip"
                    style={{ backgroundColor: s.hex }}
                  />
                  <div className="v2-swatch__name">{s.name}</div>
                  <div className="v2-swatch__hex">{s.hex}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="v2-showcase__panel">
            <div className="v2-swatch-row">
              {NEUTRAL_SWATCHES.map((s) => (
                <div key={s.hex} className="v2-swatch">
                  <div
                    className="v2-swatch__chip"
                    style={{ backgroundColor: s.hex }}
                  />
                  <div className="v2-swatch__name">{s.name}</div>
                  <div className="v2-swatch__hex">{s.hex}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- 02 Typography ---------- */}
        <section className="v2-showcase__section">
          <div className="v2-showcase__section-header">
            <span className="v2-showcase__section-num">02</span>
            <span className="v2-showcase__section-label">Typography</span>
          </div>
          <h2 className="v2-showcase__section-title">Display &amp; UI.</h2>
          <p className="v2-showcase__section-desc">
            Fraunces carries titles and editorial moments. Inter handles
            interface, labels, and data.
          </p>

          <div className="v2-showcase__grid-2">
            <div className="v2-showcase__panel">
              <div className="v2-type-specimen__display">Aa</div>
              <div className="v2-type-specimen__name">Fraunces · Regular / Medium</div>
              <div className="v2-type-specimen__use">
                Display, headlines, country names, editorial moments.
              </div>
            </div>
            <div className="v2-showcase__panel">
              <div className="v2-type-specimen__body">Aa</div>
              <div className="v2-type-specimen__name">Inter · Regular / Semibold</div>
              <div className="v2-type-specimen__use">
                UI, body, labels, data values, captions.
              </div>
            </div>
          </div>
        </section>

        {/* ---------- 03 Buttons ---------- */}
        <section className="v2-showcase__section">
          <div className="v2-showcase__section-header">
            <span className="v2-showcase__section-num">03</span>
            <span className="v2-showcase__section-label">Buttons</span>
          </div>
          <h2 className="v2-showcase__section-title">Controls.</h2>
          <p className="v2-showcase__section-desc">
            Pill-shaped, left-aligned. Primary is filled ink; tertiary uses
            bronze for editorial in-line action.
          </p>

          <div className="v2-showcase__panel">
            <div className="v2-showcase__row">
              <V2Button variant="primary">Explore countries</V2Button>
              <V2Button variant="secondary">Compare</V2Button>
              <V2Button variant="tertiary" showArrow>
                View methodology
              </V2Button>
              <V2Button variant="destructive">Reject</V2Button>
            </div>
          </div>
        </section>

        {/* ---------- 04 Search ---------- */}
        <section className="v2-showcase__section">
          <div className="v2-showcase__section-header">
            <span className="v2-showcase__section-num">04</span>
            <span className="v2-showcase__section-label">Search</span>
          </div>
          <h2 className="v2-showcase__section-title">Find anything.</h2>
          <p className="v2-showcase__section-desc">
            A single global input — countries, regions, organizations,
            indicators — with a keyboard shortcut affordance.
          </p>

          <div className="v2-showcase__panel">
            <V2SearchBar />
          </div>
        </section>

        {/* ---------- 05 Pills ---------- */}
        <section className="v2-showcase__section">
          <div className="v2-showcase__section-header">
            <span className="v2-showcase__section-num">05</span>
            <span className="v2-showcase__section-label">Status pills</span>
          </div>
          <h2 className="v2-showcase__section-title">Tags &amp; signals.</h2>
          <p className="v2-showcase__section-desc">
            Compact metadata: source state, methodology stage, regime tier.
          </p>

          <div className="v2-showcase__panel">
            <div className="v2-showcase__row">
              <V2Pill tone="success" dot>Live source</V2Pill>
              <V2Pill tone="warning" dot>Archived</V2Pill>
              <V2Pill tone="info">Beta</V2Pill>
              <V2Pill tone="accent">High income</V2Pill>
              <V2Pill tone="neutral">Parliamentary</V2Pill>
              <V2Pill tone="success">Liberal Democracy</V2Pill>
            </div>
          </div>
        </section>

        {/* ---------- 06 Charts ---------- */}
        <section className="v2-showcase__section">
          <div className="v2-showcase__section-header">
            <span className="v2-showcase__section-num">06</span>
            <span className="v2-showcase__section-label">Data viz</span>
          </div>
          <h2 className="v2-showcase__section-title">Choropleth ramps.</h2>
          <p className="v2-showcase__section-desc">
            Multi-hue scale (warm sand → cool grey → blue → deep navy) with paper
            grain inside every chip. Same ramp, two presentations: continuous
            (expanded) and discrete (binned).
          </p>

          <div className="v2-showcase__panel" style={{ marginBottom: 16 }}>
            <span
              style={{
                fontFamily: "var(--v2-font-body)",
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.10em",
                textTransform: "uppercase",
                color: "var(--v2-text-muted)",
                display: "block",
                marginBottom: 14,
              }}
            >
              Expanded
            </span>
            <V2IndicatorLegend
              title="GDP per Capita (Nominal)"
              unit="USD"
              variant="expanded"
            />
          </div>

          <div className="v2-showcase__panel" style={{ marginBottom: 16 }}>
            <span
              style={{
                fontFamily: "var(--v2-font-body)",
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.10em",
                textTransform: "uppercase",
                color: "var(--v2-text-muted)",
                display: "block",
                marginBottom: 14,
              }}
            >
              Binned
            </span>
            <V2IndicatorLegend
              title="GDP per Capita (Nominal)"
              unit="USD"
              variant="binned"
              bins={["< 2K", "2K – 10K", "10K – 20K", "20K – 60K", "> 60K"]}
            />
          </div>

          <div className="v2-showcase__panel">
            <div className="v2-showcase__row" style={{ marginBottom: 18 }}>
              <V2Pill tone="neutral">Civica Index · Top 5</V2Pill>
              <V2Pill tone="info">Beta</V2Pill>
            </div>
            <V2BarChart rows={CI_TOP5} max={100} />
          </div>
        </section>

        {/* ---------- 07 Cards ---------- */}
        <section className="v2-showcase__section">
          <div className="v2-showcase__section-header">
            <span className="v2-showcase__section-num">07</span>
            <span className="v2-showcase__section-label">Cards</span>
          </div>
          <h2 className="v2-showcase__section-title">Country hover card.</h2>
          <p className="v2-showcase__section-desc">
            What surfaces when you hover a country on the Atlas map. Translucent,
            paper-textured, with a bronze in-line CTA.
          </p>

          <div
            className="v2-showcase__panel"
            style={{
              display: "flex",
              justifyContent: "center",
              padding: 48,
              backgroundColor: "transparent",
              border: 0,
              boxShadow: "none",
            }}
          >
            <CountryHoverCard
              name="Estonia"
              officialName="Republic of Estonia"
              iso2="ee"
              heroImageUrl="https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Old_town_of_Tallinn_06-03-2012.jpg/1280px-Old_town_of_Tallinn_06-03-2012.jpg"
              heroImageAlt="Tallinn old town skyline"
              stats={[
                { label: "Political System", value: "Parliamentary Democracy" },
                { label: "GDP per Capita", value: "$31,417", year: "2023" },
                { label: "Population", value: "1.3M", year: "2023" },
              ]}
              ctaHref="/factbook/estonia"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
