"use client";

import { useState, useEffect, useRef, useCallback } from "react";

import "./design-system.css";

const SURFACE_TOKENS = [
  { var: "--paper", use: "Base field. Everything sits on it." },
  { var: "--paper-2", use: "Quiet hover & zebra." },
  { var: "--paper-3", use: "Well / mini-map ground." },
  { var: "--ink", use: "Body type, rules, heavy UI." },
  { var: "--ink-2", use: "Secondary type, soft buttons." },
  { var: "--muted", use: "Captions, eyebrows, meta." },
  { var: "--rule", use: "Hairlines, borders." },
  { var: "--rule-2", use: "Graticules, dashed rules." },
];

const SIGNAL_TOKENS = [
  { var: "--accent", hex: "oklch(58% 0.14 35) · cinnabar", use: "The one live color: selection, CTAs, eyebrows." },
  { var: "--accent-soft", hex: "accent @ 92% L", use: "Pinned banners, accent wash." },
  { var: "--success", hex: "olive · oklch(55% 0.12 145)", use: "Passed · yes votes · stable." },
  { var: "--warn", hex: "amber · oklch(65% 0.14 75)", use: "In committee · deadline near." },
  { var: "--danger", hex: "brick · oklch(52% 0.18 25)", use: "Failed · nay votes · contested." },
  { var: "--info", hex: "slate · oklch(52% 0.10 240)", use: "Procedural · abstentions." },
];

const MAP_TOKENS = [
  { var: "--ocean", use: "Water & atlas ground." },
  { var: "--land", use: "Featured countries." },
  { var: "--land-dim", use: "Non-featured countries." },
  { var: "--land-selected", hex: "accent", use: "Current country." },
];

const SPACING = [
  { name: "--s-1", px: 2 },
  { name: "--s-2", px: 4 },
  { name: "--s-3", px: 8 },
  { name: "--s-4", px: 12 },
  { name: "--s-5", px: 16 },
  { name: "--s-6", px: 24 },
  { name: "--s-7", px: 32 },
  { name: "--s-8", px: 48 },
  { name: "--s-9", px: 64 },
];

const PARTIES = [
  "oklch(55% 0.15 25)",
  "oklch(55% 0.18 15)",
  "oklch(58% 0.13 145)",
  "oklch(60% 0.14 270)",
  "oklch(55% 0.15 25)",
];

function MiniHemicycle() {
  const svgRef = useRef<SVGGElement>(null);
  useEffect(() => {
    const g = svgRef.current;
    if (!g) return;
    g.innerHTML = "";
    const cx = 150, cy = 150;
    const rows = 5, seatsPerRow = 30;
    for (let r = 0; r < rows; r++) {
      const rad = 60 + r * 15;
      for (let i = 0; i < seatsPerRow; i++) {
        const t = Math.PI - (i / (seatsPerRow - 1)) * Math.PI;
        const x = cx + Math.cos(t) * rad;
        const y = cy - Math.sin(t) * rad;
        const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        c.setAttribute("cx", String(x));
        c.setAttribute("cy", String(y));
        c.setAttribute("r", "2.8");
        c.setAttribute("fill", PARTIES[Math.floor((i / seatsPerRow) * PARTIES.length)]);
        g.appendChild(c);
      }
    }
  }, []);
  return (
    <svg className="hemi-demo" viewBox="0 0 300 160" style={{ display: "block", maxWidth: 300 }}>
      <g ref={svgRef} />
      <line x1="150" y1="150" x2="150" y2="30" stroke="var(--danger)" strokeWidth="1" strokeDasharray="4 4" />
    </svg>
  );
}

export default function DesignSystemPage() {
  const [dark, setDark] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const [hexValues, setHexValues] = useState<Record<string, string>>({});

  const readHex = useCallback(() => {
    if (!rootRef.current) return;
    const css = getComputedStyle(rootRef.current);
    const vals: Record<string, string> = {};
    ["paper", "paper-2", "paper-3", "ink", "ink-2", "muted", "rule", "rule-2", "ocean", "land", "land-dim"].forEach((k) => {
      vals[k] = css.getPropertyValue("--" + k).trim();
    });
    setHexValues(vals);
  }, []);

  useEffect(() => {
    readHex();
  }, [dark, readHex]);

  return (
    <div ref={rootRef} className={`ds-page${dark ? " ds-dark" : ""}`}>
      <header className="ds-top">
        <div className="ds-brand">Civica<span className="d">.</span></div>
        <div className="ds-eyebrow">Design System · v0.1 · April 2026</div>
        <div className="ds-grow" />
        <div className="ds-theme-toggle">
          <button className={dark ? "" : "on"} onClick={() => setDark(false)}>Light</button>
          <button className={dark ? "on" : ""} onClick={() => setDark(true)}>Dark</button>
        </div>
      </header>

      <main className="ds-main">
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
                  <div className="hex">{hexValues[t.var.replace("--", "")] || ""}</div>
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
                  <div className="hex">{t.hex || hexValues[t.var.replace("--", "")] || ""}</div>
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
                <div className="slot" style={{ background: "#f4f1ea" }}>paper</div>
                <div className="slot" style={{ background: "#ebe6d6" }}>paper-2</div>
                <div className="slot" style={{ background: "#e2dcc8" }}>paper-3</div>
                <div className="slot" style={{ background: "#1a1a1a", color: "#f4f1ea" }}>ink</div>
                <div className="slot" style={{ background: "oklch(58% 0.14 35)", color: "#fff" }}>accent</div>
              </div>
            </div>
            <div className="ds-pair-card">
              <div className="hd">Dark</div>
              <div className="body" style={{ background: "#16140f", color: "#ebe6d6" }}>
                <div className="slot" style={{ background: "#16140f" }}>paper</div>
                <div className="slot" style={{ background: "#221e16" }}>paper-2</div>
                <div className="slot" style={{ background: "#2b2619" }}>paper-3</div>
                <div className="slot" style={{ background: "#ebe6d6", color: "#16140f" }}>ink</div>
                <div className="slot" style={{ background: "oklch(68% 0.15 35)", color: "#16140f" }}>accent</div>
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
                <span style={{ background: "var(--success)", color: "var(--paper)", padding: "3px 8px" }}>Passed</span>
                <span style={{ background: "var(--warn)", color: "var(--ink)", padding: "3px 8px" }}>In committee</span>
                <span style={{ background: "var(--danger)", color: "var(--paper)", padding: "3px 8px" }}>Failed</span>
                <span style={{ background: "var(--info)", color: "var(--paper)", padding: "3px 8px" }}>Procedural</span>
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
              <h4>Mini hemicycle</h4>
              <MiniHemicycle />
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
