import Link from "next/link";
import { DesignSystemSwatch } from "@/components/DesignSystemSwatch";
import { HemicycleChart } from "@/components/HemicycleChart";

import "./design-system.css";

const SURFACE_TOKENS = [
  { var: "--color-surface-primary", use: "Base field. Everything sits on it." },
  { var: "--color-surface-secondary", use: "Quiet hover & zebra." },
  { var: "--color-surface-tertiary", use: "Well / mini-map ground." },
  { var: "--color-text-primary", use: "Body type, rules, heavy UI." },
  { var: "--color-text-secondary", use: "Secondary type, soft buttons." },
  { var: "--color-text-muted", use: "Captions, eyebrows, meta." },
  { var: "--color-border-default", use: "Hairlines, borders." },
  { var: "--color-card-border", use: "Graticules, dashed rules." },
];

const SIGNAL_TOKENS = [
  { var: "--color-accent", hex: "cinnabar", use: "The one live color: selection, CTAs, eyebrows." },
  { var: "--color-selection", hex: "accent wash", use: "Pinned banners, accent wash." },
  { var: "--color-status-success", hex: "olive", use: "Passed · yes votes · stable." },
  { var: "--color-status-warning", hex: "amber", use: "In committee · deadline near." },
  { var: "--color-status-danger", hex: "brick", use: "Failed · nay votes · contested." },
  { var: "--color-status-info", hex: "slate", use: "Procedural · abstentions." },
];

const MAP_TOKENS = [
  { var: "--atlas-ocean", use: "Water & atlas ground." },
  { var: "--atlas-land", use: "Featured countries." },
  { var: "--atlas-land-dim", use: "Non-featured countries." },
  { var: "--atlas-land-selected", hex: "accent", use: "Current country." },
];

const SPACING = [
  { name: "--space-1", px: 2 },
  { name: "--space-2", px: 4 },
  { name: "--space-3", px: 8 },
  { name: "--space-4", px: 12 },
  { name: "--space-5", px: 16 },
  { name: "--space-6", px: 24 },
  { name: "--space-7", px: 32 },
  { name: "--space-8", px: 48 },
  { name: "--space-9", px: 64 },
];

const SAMPLE_PARTIES = [
  { name: "Civic Alliance", seats: 46, color: "var(--gov-parl)" },
  { name: "National Union", seats: 38, color: "var(--gov-pres)" },
  { name: "Green List", seats: 25, color: "var(--gov-theo)" },
  { name: "Liberal Forum", seats: 22, color: "var(--gov-semi)" },
  { name: "Independents", seats: 19, color: "var(--color-text-40)" },
];

export default function DesignSystemPage() {
  return (
    <div className="ds-page atlas-root">
      <header className="ds-top">
        <div className="ds-brand">Civica<span className="d">.</span></div>
        <div className="ds-eyebrow">Design System · v0.1 · April 2026</div>
        <div className="ds-grow" />
      </header>

      <main className="ds-main">
        <div className="ds-directive-banner">
          <strong>This is the canonical look.</strong>{" "}
          Every page on civicaatlas.org should match these tokens. See{" "}
          <Link href="https://github.com/fbalino/civica/blob/main/DESIGN.md">DESIGN.md</Link>. No hardcoded colors, fonts, or sizes elsewhere.
        </div>

        {/* 00 Foundation */}
        <section className="ds-section">
          <div className="ds-section-header">
            <span className="num">00 · Foundation</span>
            <h2>An editorial civic atlas.</h2>
            <span className="dek">Warm newsprint paper, inky type, a cinnabar accent for anything live. Dark mode is the same vocabulary under a starless sky.</span>
          </div>
          <p style={{ fontFamily: "var(--sans)", fontSize: 14, color: "var(--ink-2)", maxWidth: 640, lineHeight: 1.6, margin: "0 0 10px" }}>
            Civica is an interactive civic-education atlas: one world map, every chamber, every bill.
            The system is built on four moves — a warm paper field, ink-black structure, a single signal color,
            and a hairline rule. Dark mode inverts the field, keeps the ink, and warms the signal.
          </p>
          <p style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 14, color: "var(--muted)", maxWidth: 640 }}>
            No gradients. No drop shadows (except the occasional blocky offset). Color is reserved for meaning,
            not decoration.
          </p>
        </section>

        {/* 01 Color */}
        <section className="ds-section">
          <div className="ds-section-header">
            <span className="num">01 · Color</span>
            <h2>Paper, ink, cinnabar.</h2>
            <span className="dek">Every token is defined in both themes. Signals hold the same role across modes.</span>
          </div>

          <h3 className="ds-sub">Surface — paper &amp; ink</h3>
          <div className="ds-swatches">
            {SURFACE_TOKENS.map((t) => (
              <div key={t.var} className="ds-swatch">
                <div className="chip" style={{ background: `var(${t.var})` }} />
                <div className="meta">
                  <div className="nm">{t.var}</div>
                <div className="hex">{t.var}</div>
                  <div className="use">{t.use}</div>
                </div>
              </div>
            ))}
          </div>

          <h3 className="ds-sub">Signal</h3>
          <div className="ds-swatches">
            {SIGNAL_TOKENS.map((t) => (
              <div key={t.var} className="ds-swatch">
                <div className="chip" style={{ background: `var(${t.var})` }} />
                <div className="meta">
                  <div className="nm">{t.var}</div>
                  <div className="hex">{t.hex}</div>
                  <div className="use">{t.use}</div>
                </div>
              </div>
            ))}
          </div>

          <h3 className="ds-sub">Map</h3>
          <div className="ds-swatches">
            {MAP_TOKENS.map((t) => (
              <div key={t.var} className="ds-swatch">
                <div className="chip" style={{ background: `var(${t.var})` }} />
                <div className="meta">
                  <div className="nm">{t.var}</div>
                  <div className="hex">{t.hex || t.var}</div>
                  <div className="use">{t.use}</div>
                </div>
              </div>
            ))}
          </div>

          <h3 className="ds-sub">Both modes, side by side</h3>
          <div className="ds-pair-grid">
            <div className="ds-pair-card">
              <div className="hd">Light — default</div>
              <div className="body" style={{ background: "#f4f1ea", color: "#1a1a1a" }}>
                <DesignSystemSwatch label="paper" bg="#f4f1ea" />
                <DesignSystemSwatch label="paper-2" bg="#ebe6d6" />
                <DesignSystemSwatch label="paper-3" bg="#e2dcc8" />
                <DesignSystemSwatch label="ink" bg="#1a1a1a" fg="#f4f1ea" />
                <DesignSystemSwatch label="accent" bg="oklch(58% 0.14 35)" fg="#ffffff" />
              </div>
            </div>
            <div className="ds-pair-card">
              <div className="hd">Dark</div>
              <div className="body" style={{ background: "#16140f", color: "#ebe6d6" }}>
                <DesignSystemSwatch label="paper" bg="#16140f" />
                <DesignSystemSwatch label="paper-2" bg="#221e16" />
                <DesignSystemSwatch label="paper-3" bg="#2b2619" />
                <DesignSystemSwatch label="ink" bg="#ebe6d6" fg="#16140f" />
                <DesignSystemSwatch label="accent" bg="oklch(68% 0.15 35)" fg="#16140f" />
              </div>
            </div>
          </div>
        </section>

        {/* 02 Type */}
        <section className="ds-section">
          <div className="ds-section-header">
            <span className="num">02 · Type</span>
            <h2>Fraunces, Inter, Mono.</h2>
            <span className="dek">A contemporary serif for voice. A precise sans for data. A mono for labels and codes.</span>
          </div>

          <div className="ds-type-row">
            <span className="lab">Display / H1</span>
            <span style={{ fontFamily: "var(--serif)", fontWeight: 400, fontSize: 72, lineHeight: 0.95, letterSpacing: "-0.03em" }}>Every chamber.</span>
            <span className="spec">Fraunces · 400 · 72/0.95 · -3%</span>
          </div>
          <div className="ds-type-row">
            <span className="lab">H2 / Section</span>
            <span style={{ fontFamily: "var(--serif)", fontWeight: 400, fontSize: 40, letterSpacing: "-0.02em" }}>Parliament, live.</span>
            <span className="spec">Fraunces · 400 · 40 · -2%</span>
          </div>
          <div className="ds-type-row">
            <span className="lab">H3 / Subhead</span>
            <span style={{ fontFamily: "var(--serif)", fontWeight: 400, fontSize: 22, letterSpacing: "-0.01em" }}>The Chamber</span>
            <span className="spec">Fraunces · 400 · 22</span>
          </div>
          <div className="ds-type-row">
            <span className="lab">Dek / Lede</span>
            <span style={{ fontFamily: "var(--serif)", fontStyle: "italic", fontSize: 17, color: "var(--ink-2)" }}>A semi-presidential republic in Western Europe.</span>
            <span className="spec">Fraunces · italic · 17</span>
          </div>
          <div className="ds-type-row">
            <span className="lab">Body</span>
            <span style={{ fontFamily: "var(--sans)", fontSize: 14, lineHeight: 1.55, color: "var(--ink-2)" }}>Hover any seat to meet the member. Hold Shift and click two countries to compare them side-by-side.</span>
            <span className="spec">Inter · 400 · 14/1.55</span>
          </div>
          <div className="ds-type-row">
            <span className="lab">Caption</span>
            <span style={{ fontFamily: "var(--sans)", fontSize: 12, color: "var(--muted)" }}>577 seats · elected by two-round system</span>
            <span className="spec">Inter · 400 · 12</span>
          </div>
          <div className="ds-type-row">
            <span className="lab">Eyebrow</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase" as const, color: "var(--accent)" }}>Welcome · Atlas</span>
            <span className="spec">Mono · 10 · 16% track</span>
          </div>
          <div className="ds-type-row">
            <span className="lab">Meta / Code</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-2)" }}>FRA · 48.8° N, 2.3° E · GMT+1</span>
            <span className="spec">Mono · 11</span>
          </div>
        </section>

        {/* 03 Spacing & Shape */}
        <section className="ds-section">
          <div className="ds-section-header">
            <span className="num">03 · Spacing &amp; Shape</span>
            <h2>Tight grid, hard edges.</h2>
            <span className="dek">A 4-pt scale, near-zero radii, and blocky offset shadows for anything that wants to float.</span>
          </div>

          <h3 className="ds-sub">Scale</h3>
          <div style={{ maxWidth: 520 }}>
            {SPACING.map((s) => (
              <div key={s.name} className="ds-space-row">
                <span className="label">{s.name}</span>
                <span className="px">{s.px}</span>
                <div className="bar" style={{ width: s.px }} />
              </div>
            ))}
          </div>

          <h3 className="ds-sub">Radii</h3>
          <div className="ds-radii">
            <div className="r" style={{ borderRadius: 0 }}>r-0 · 0</div>
            <div className="r" style={{ borderRadius: 2 }}>r-1 · 2px</div>
            <div className="r" style={{ borderRadius: 6 }}>r-2 · 6px</div>
          </div>

          <h3 className="ds-sub">Elevation</h3>
          <div style={{ display: "flex", gap: 28, marginTop: 10 }}>
            <div style={{ width: 180, height: 100, background: "var(--paper)", border: "1px solid var(--ink)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--mono)", fontSize: 11 }}>flat</div>
            <div style={{ width: 180, height: 100, background: "var(--paper)", border: "1px solid var(--ink)", boxShadow: "var(--shadow-hard)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--mono)", fontSize: 11 }}>shadow-hard</div>
            <div style={{ width: 180, height: 100, background: "var(--paper)", border: "1px solid var(--ink)", boxShadow: "var(--shadow-hard-lg)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--mono)", fontSize: 11 }}>shadow-hard-lg</div>
          </div>
        </section>

        {/* 04 Components */}
        <section className="ds-section">
          <div className="ds-section-header">
            <span className="num">04 · Components</span>
            <h2>The building blocks.</h2>
            <span className="dek">Patterns used across Atlas, Chamber, and Compare.</span>
          </div>

          <div className="ds-comp-grid">
            <div className="ds-comp">
              <h4>Buttons</h4>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button className="ds-btn">Default</button>
                <button className="ds-btn primary">Primary</button>
                <button className="ds-btn accent">Accent</button>
                <button className="ds-btn ghost">Ghost</button>
                <button className="ds-btn primary hard">Primary · hard</button>
              </div>
            </div>

            <div className="ds-comp">
              <h4>Chips / Filters</h4>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button className="ds-chip on">All</button>
                <button className="ds-chip">Europe</button>
                <button className="ds-chip">Americas</button>
                <button className="ds-chip">Federal</button>
                <button className="ds-chip">Parliamentary</button>
                <button className="ds-chip">Monarchy</button>
              </div>
            </div>

            <div className="ds-comp">
              <h4>Search input</h4>
              <div className="ds-input">
                <span style={{ color: "var(--muted)", fontFamily: "var(--mono)", fontSize: 11 }}>&#x2315;</span>
                <input type="text" placeholder="Find a country, leader, bill..." readOnly />
                <span className="kbd">&#x2318;K</span>
              </div>
            </div>

            <div className="ds-comp">
              <h4>Tabs</h4>
              <div className="ds-tabs">
                <button className="on">I · The Chamber</button>
                <button>II · Laws in Motion</button>
                <button>III · Full Structure</button>
              </div>
            </div>

            <div className="ds-comp">
              <h4>Country hover card</h4>
              <div className="ds-hov">
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 4 }}>
                  <span className="code">FRA</span>
                </div>
                <h3>France</h3>
                <div className="row"><span>Semi-Presidential</span><b>Europe</b></div>
                <div className="row"><span>Paris · 68M</span><b>$3.0T</b></div>
                <div className="cta">Click to enter chamber &#x2197;</div>
              </div>
            </div>

            <div className="ds-comp">
              <h4>Status badges</h4>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" as const }}>
                <span style={{ background: "var(--success)", color: "var(--color-on-accent)", padding: "3px 8px" }}>Passed</span>
                <span style={{ background: "var(--warn)", color: "var(--color-on-warning)", padding: "3px 8px" }}>In committee</span>
                <span style={{ background: "var(--danger)", color: "var(--color-on-accent)", padding: "3px 8px" }}>Failed</span>
                <span style={{ background: "var(--info)", color: "var(--color-on-accent)", padding: "3px 8px" }}>Procedural</span>
                <span style={{ border: "1px solid var(--rule)", color: "var(--ink-2)", padding: "3px 8px" }}>Draft</span>
              </div>
            </div>

            <div className="ds-comp">
              <h4>Party seats</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontFamily: "var(--sans)", fontSize: 12 }}>
                <div className="ds-seat"><span className="d" style={{ background: "oklch(55% 0.15 25)" }} />National Rally · 89</div>
                <div className="ds-seat"><span className="d" style={{ background: "oklch(60% 0.14 270)" }} />Renaissance · 171</div>
                <div className="ds-seat"><span className="d" style={{ background: "oklch(58% 0.13 145)" }} />Ecologists · 23</div>
                <div className="ds-seat"><span className="d" style={{ background: "oklch(55% 0.18 15)" }} />Socialists · 66</div>
                <div className="ds-seat"><span className="d" style={{ background: "var(--muted)" }} />Independent · 12</div>
              </div>
            </div>

            <div className="ds-comp">
              <h4>Hemicycle</h4>
              <HemicycleChart
                totalSeats={150}
                parties={SAMPLE_PARTIES}
                chamberName="Sample Country · National Assembly"
              />
            </div>
          </div>

          <h3 className="ds-sub" style={{ marginTop: 48 }}>Editorial primitives</h3>
          <div className="ds-comp-grid">
            <div className="ds-comp">
              <h4>SourceDot</h4>
              <p style={{ fontFamily: "var(--sans)", fontSize: 14, color: "var(--ink-2)", margin: 0 }}>
                Every data point carries live or frozen provenance.
              </p>
            </div>
            <div className="ds-comp">
              <h4>Pill / Badge</h4>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span className="ds-chip on">Exceptional</span>
                <span className="ds-chip">Warning</span>
                <span className="ds-chip">Live</span>
              </div>
            </div>
            <div className="ds-comp">
              <h4>Banner / Alert</h4>
              <div className="ds-directive-banner" style={{ margin: 0, boxShadow: "none" }}>
                Methodology in active development.
              </div>
            </div>
            <div className="ds-comp">
              <h4>Section header</h4>
              <div className="ds-section-header" style={{ margin: 0 }}>
                <span className="num">Evidence</span>
                <h2 style={{ fontSize: "var(--text-28)" }}>Readable structure.</h2>
              </div>
            </div>
          </div>

          <h3 className="ds-sub" style={{ marginTop: 48 }}>Country masthead</h3>
          <div className="ds-comp" style={{ padding: "28px 32px" }}>
            <div className="ds-mast">
              <div>
                <div className="ey">FRA · Western Europe</div>
                <h1>France</h1>
                <div className="dek">A semi-presidential republic of 68 million.</div>
              </div>
              <div className="qf">
                <div className="r"><b>Leader</b><span>Pres. L. Dubois</span></div>
                <div className="r"><b>Gov</b><span>Semi-Presidential</span></div>
                <div className="r"><b>Capital</b><span>Paris</span></div>
                <div className="r"><b>Pop</b><span>68M</span></div>
                <div className="r"><b>GDP</b><span>$3.0T</span></div>
              </div>
            </div>
          </div>
        </section>

        {/* 05 Voice */}
        <section className="ds-section">
          <div className="ds-section-header">
            <span className="num">05 · Voice</span>
            <h2>Clear, civic, dry.</h2>
            <span className="dek">Like a textbook written by a journalist. Factual, spare, a little warm.</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
            <div style={{ borderLeft: "2px solid var(--success)", padding: "8px 18px" }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "var(--success)" }}>Do</div>
              <p style={{ fontFamily: "var(--serif)", fontSize: 16, color: "var(--ink)", margin: "8px 0 0" }}>&ldquo;France is a semi-presidential republic. The President and Prime Minister share executive power.&rdquo;</p>
            </div>
            <div style={{ borderLeft: "2px solid var(--danger)", padding: "8px 18px" }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase" as const, color: "var(--danger)" }}>Don&apos;t</div>
              <p style={{ fontFamily: "var(--serif)", fontSize: 16, color: "var(--ink)", margin: "8px 0 0" }}>&ldquo;Dive into France&apos;s fascinating governmental landscape, where dual executives share the stage in an exciting political dance!&rdquo;</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="ds-foot">
        <span>Civica Design System · v0.1</span>
        <span>April 2026</span>
      </footer>
    </div>
  );
}
