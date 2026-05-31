"use client";

import { useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CircleHelp,
  Compass,
  Database,
  Download,
  Eye,
  Globe2,
  Home,
  Landmark,
  Leaf,
  Minus,
  Plus,
  Search,
  Share2,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

type Swatch = {
  name: string;
  token: string;
  note: string;
};

type ThemeMode = "light" | "dark";

const NAV_ITEMS = ["01 Brand", "02 Visual DNA", "03 Color", "04 Type", "05 Components", "06 Data", "07 Patterns"];

const NEUTRALS: Swatch[] = [
  { name: "Ink", token: "--v3-neutral-ink", note: "Primary text" },
  { name: "Charcoal", token: "--v3-neutral-charcoal", note: "Deep surface" },
  { name: "Slate", token: "--v3-neutral-slate", note: "Secondary UI" },
  { name: "Stone", token: "--v3-neutral-stone", note: "Muted text" },
  { name: "Pewter", token: "--v3-neutral-pewter", note: "Soft rule" },
  { name: "Mist", token: "--v3-neutral-mist", note: "Inset field" },
  { name: "Parchment", token: "--v3-neutral-parchment", note: "Page field" },
  { name: "Canvas", token: "--v3-neutral-canvas", note: "Card surface" },
];

const FOUNDATION: Swatch[] = [
  { name: "Navy", token: "--v3-foundation-navy", note: "Brand anchor" },
  { name: "Deep Teal", token: "--v3-foundation-teal", note: "Charts + maps" },
  { name: "Sage", token: "--v3-foundation-sage", note: "Land + balance" },
  { name: "Terracotta", token: "--v3-foundation-terracotta", note: "Events + action" },
  { name: "Gold", token: "--v3-foundation-gold", note: "Numbers + rules" },
  { name: "Sand", token: "--v3-foundation-sand", note: "Warm surfaces" },
];

const ACCENTS: Swatch[] = [
  { name: "Sky", token: "--v3-accent-sky", note: "Highlights" },
  { name: "Azure", token: "--v3-accent-azure", note: "Selected data" },
  { name: "Leaf", token: "--v3-accent-leaf", note: "Positive" },
  { name: "Violet", token: "--v3-accent-violet", note: "Categorical" },
  { name: "Rose", token: "--v3-accent-rose", note: "Risk" },
  { name: "Amber", token: "--v3-accent-amber", note: "Attention" },
];

const SOURCE_DOTS = [
  { label: "Government source", token: "--v3-source-government" },
  { label: "Intergovernmental", token: "--v3-source-igo" },
  { label: "Academic", token: "--v3-source-academic" },
  { label: "NGO / nonprofit", token: "--v3-source-ngo" },
  { label: "Private / industry", token: "--v3-source-private" },
  { label: "Media / public", token: "--v3-source-media" },
];

const TABLE_ROWS = [
  { rank: 1, flag: "🇩🇰", country: "Denmark", score: "88.7", rights: "95.2", law: "91.3", hdi: "0.947" },
  { rank: 2, flag: "🇫🇮", country: "Finland", score: "87.1", rights: "94.1", law: "90.4", hdi: "0.940" },
  { rank: 3, flag: "🇳🇴", country: "Norway", score: "86.3", rights: "93.6", law: "90.1", hdi: "0.961" },
  { rank: 4, flag: "🇳🇿", country: "New Zealand", score: "85.0", rights: "91.6", law: "88.7", hdi: "0.931" },
  { rank: 5, flag: "🇸🇪", country: "Sweden", score: "84.1", rights: "92.0", law: "87.9", hdi: "0.937" },
];

const BAR_ROWS = [
  { country: "Denmark", value: 89, token: "--v3-foundation-navy" },
  { country: "Finland", value: 87, token: "--v3-foundation-teal" },
  { country: "Norway", value: 86, token: "--v3-foundation-sage" },
  { country: "New Zealand", value: 85, token: "--v3-foundation-gold" },
  { country: "Sweden", value: 84, token: "--v3-foundation-terracotta" },
];

function tokenStyle(token: string) {
  return { "--v3-token": `var(${token})` } as React.CSSProperties;
}

function widthStyle(value: number) {
  return { "--v3-bar-value": `${value}%` } as React.CSSProperties;
}

function V3LogoMark() {
  return (
    <span className="v3-logo-mark" aria-hidden="true">
      <Compass size={26} strokeWidth={1.35} />
    </span>
  );
}

function SectionKicker({ number, label }: { number: string; label: string }) {
  return (
    <div className="v3-section-kicker">
      <span>{number}</span>
      <b>{label}</b>
    </div>
  );
}

function EngravedLandscape() {
  return (
    <svg className="v3-engraving" viewBox="0 0 720 360" role="img" aria-label="Engraved mountain and coast motif">
      <circle className="v3-engraving__faint" cx="426" cy="114" r="92" />
      <circle className="v3-engraving__faint" cx="426" cy="114" r="126" />
      <path className="v3-engraving__faint" d="M300 114h252M426 0v240M338 28l176 176M514 28 338 204" />
      <path className="v3-engraving__line" d="M44 252c58-28 115-38 171-30 54 8 92 28 148 26 72-2 108-42 168-36 45 5 78 32 125 22" />
      <path className="v3-engraving__line" d="M88 224l66-76 40 42 62-96 64 106 40-54 48 68" />
      <path className="v3-engraving__fine" d="M152 150l-13 61M170 168l-36 45M192 190l-42 28M256 96l-20 126M286 150l-46 74M318 202l-62 22M410 166l-10 64M432 192l-34 38" />
      <path className="v3-engraving__fine" d="M58 272c76-16 129-18 205-8M110 296c122-24 254-20 396 10M356 284c93-24 179-24 258-2" />
      <path className="v3-engraving__dark" d="M538 238c19 1 36 11 46 26-31 3-58-5-80-20 10-5 21-7 34-6Z" />
      <path className="v3-engraving__dark" d="M546 236l20-48 22 54M566 190v74" />
      <path className="v3-engraving__fine" d="M588 244c13 2 26 8 38 19M500 244c-20 4-36 13-51 28" />
      <path className="v3-engraving__fine" d="M66 318h552" />
    </svg>
  );
}

function CompassPlate() {
  return (
    <svg className="v3-compass-plate" viewBox="0 0 240 240" aria-hidden="true">
      <circle cx="120" cy="120" r="92" />
      <circle cx="120" cy="120" r="66" />
      <path d="M120 24v192M24 120h192M53 53l134 134M187 53 53 187" />
      <path className="v3-compass-plate__needle" d="M120 42l18 78-18 78-18-78Z" />
      <circle className="v3-compass-plate__center" cx="120" cy="120" r="8" />
    </svg>
  );
}

function MapPlate() {
  return (
    <svg className="v3-map-plate" viewBox="0 0 760 420" role="img" aria-label="Stylized choropleth world map example">
      <path className="v3-map-plate__grid" d="M60 70h640M60 140h640M60 210h640M60 280h640M60 350h640M140 40v340M260 40v340M380 40v340M500 40v340M620 40v340" />
      <path className="v3-map-land v3-map-land--a" d="M126 128l52-30 82 18 34 36-46 30-74-4-44 34-48-20 12-42Z" />
      <path className="v3-map-land v3-map-land--b" d="M284 186l62-18 46 34-10 58-46 62-42-24-18-58Z" />
      <path className="v3-map-land v3-map-land--c" d="M420 120l84-28 92 22 34 50-46 36-92-6-58 28-46-28Z" />
      <path className="v3-map-land v3-map-land--d" d="M520 244l66-20 62 44-10 54-72 26-48-34Z" />
      <path className="v3-map-land v3-map-land--e" d="M214 274l44 20 16 56-44 24-40-38Z" />
    </svg>
  );
}

function SwatchGrid({ title, items }: { title: string; items: Swatch[] }) {
  return (
    <div className="v3-panel v3-panel--flat">
      <h3 className="v3-panel-title">{title}</h3>
      <div className="v3-swatch-grid">
        {items.map((item) => (
          <div className="v3-swatch" key={item.name}>
            <span className="v3-swatch__chip" style={tokenStyle(item.token)} />
            <strong>{item.name}</strong>
            <span>{item.token}</span>
            <small>{item.note}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function CountryFactCard() {
  return (
    <article className="v3-country-card">
      <div className="v3-country-card__main">
        <div className="v3-country-card__identity">
          <span className="v3-country-card__flag">●</span>
          <div>
            <h3>Japan</h3>
            <p>日本国</p>
          </div>
        </div>
        <span className="v3-pill v3-pill--soft">High income</span>
        <div className="v3-fact-grid">
          <div>
            <Landmark size={15} />
            <span>Political system</span>
            <strong>Parliamentary democracy</strong>
          </div>
          <div>
            <UsersRound size={15} />
            <span>Population</span>
            <strong>123.3M</strong>
          </div>
          <div>
            <Database size={15} />
            <span>GDP nominal</span>
            <strong>$4.21T</strong>
          </div>
          <div>
            <ShieldCheck size={15} />
            <span>Institutions</span>
            <strong>Strong</strong>
          </div>
        </div>
        <div className="v3-source-row">
          <span>Sources (12)</span>
          <span>World Bank</span>
          <span>IMF</span>
          <span>UN</span>
          <span>V-Dem</span>
          <CircleHelp size={14} />
        </div>
      </div>
      <div className="v3-country-card__plate">
        <EngravedLandscape />
      </div>
    </article>
  );
}

function AtlasCard() {
  return (
    <article className="v3-atlas-card">
      <MapPlate />
      <div className="v3-floating-country">
        <div className="v3-floating-country__head">
          <span className="v3-flag-pill">🇪🇪</span>
          <div>
            <h3>Estonia</h3>
            <p>Republic of Estonia</p>
          </div>
        </div>
        <div className="v3-mini-landscape">
          <EngravedLandscape />
        </div>
        <div className="v3-floating-country__stats">
          <span>
            Political system <b>Parliamentary democracy</b>
          </span>
          <span>
            GDP per capita <b>$31,417</b>
          </span>
          <span>
            Population <b>1.3M</b>
          </span>
        </div>
        <a href="#v3-components">View country profile <ArrowRight size={14} /></a>
      </div>
      <div className="v3-map-controls" aria-label="Map controls">
        <button type="button" aria-label="Home">
          <Home size={15} />
        </button>
        <button type="button" aria-label="Zoom in">
          <Plus size={15} />
        </button>
        <button type="button" aria-label="Zoom out">
          <Minus size={15} />
        </button>
        <button type="button" aria-label="Globe">
          <Globe2 size={15} />
        </button>
      </div>
    </article>
  );
}

function IndexTable() {
  return (
    <article className="v3-index-table">
      <div className="v3-table-head">
        <div>
          <h3>Civica Index <span>Overall</span></h3>
          <p>Composite ranking of governance outcomes and institutional strength.</p>
        </div>
        <button type="button" className="v3-button v3-button--secondary">
          View full index <ArrowRight size={14} />
        </button>
      </div>
      <div className="v3-table-scroll">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Country</th>
              <th>Overall score</th>
              <th>Political rights</th>
              <th>Rule of law</th>
              <th>Human development</th>
            </tr>
          </thead>
          <tbody>
            {TABLE_ROWS.map((row) => (
              <tr key={row.country}>
                <td>{row.rank}</td>
                <td>
                  <span>{row.flag}</span> {row.country}
                </td>
                <td>{row.score}</td>
                <td>{row.rights}</td>
                <td>{row.law}</td>
                <td>{row.hdi}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <footer>
        <a href="#v3-data">View methodology <ArrowRight size={14} /></a>
        <span>Latest update: May 9, 2026</span>
      </footer>
    </article>
  );
}

function BarRows() {
  return (
    <div className="v3-bars">
      {BAR_ROWS.map((row) => (
        <div className="v3-bar-row" key={row.country}>
          <span>{row.country}</span>
          <div className="v3-bar-track">
            <i style={{ ...widthStyle(row.value), ...tokenStyle(row.token) }} />
          </div>
          <b>{row.value}</b>
        </div>
      ))}
    </div>
  );
}

export function V3ShowcaseClient() {
  const [mode, setMode] = useState<ThemeMode>("light");

  return (
    <div className="v3-scope" data-v3-mode={mode}>
      <header className="v3-nav">
        <a href="#v3-top" className="v3-brand" aria-label="Civica Atlas V3 top">
          <V3LogoMark />
          <span>Civica Atlas</span>
        </a>
        <nav aria-label="V3 sections">
          {NAV_ITEMS.map((item) => (
            <a key={item} href={`#v3-${item.split(" ")[1].toLowerCase()}`}>
              {item}
            </a>
          ))}
        </nav>
        <div className="v3-nav-actions">
          <button
            type="button"
            className={mode === "light" ? "is-active" : ""}
            aria-pressed={mode === "light"}
            onClick={() => setMode("light")}
          >
            Light
          </button>
          <button
            type="button"
            className={mode === "dark" ? "is-active" : ""}
            aria-pressed={mode === "dark"}
            onClick={() => setMode("dark")}
          >
            Dark
          </button>
        </div>
      </header>

      <main id="v3-top">
        <section className="v3-hero">
          <div className="v3-hero__copy">
            <p className="v3-version">Version 3.0 · May 9, 2026</p>
            <h1>Civica Atlas Design System</h1>
            <p className="v3-hero__subtitle">Foundations &amp; visual language</p>
            <p className="v3-hero__lede">
              Open, transparent, nonpartisan civic reference design: editorial typography,
              atlas engravings, quiet data surfaces, and provenance-first UI.
            </p>
            <div className="v3-rule-ornament" aria-hidden="true" />
          </div>
          <div className="v3-hero__art" aria-hidden="true">
            <EngravedLandscape />
          </div>
        </section>

        <section className="v3-foundation-grid" id="v3-brand">
          <article className="v3-principles">
            <SectionKicker number="01" label="Brand principles" />
            <div className="v3-principle">
              <Globe2 />
              <div>
                <h3>Open &amp; Trusted</h3>
                <p>Transparent, sourced, and free to use with proper attribution.</p>
              </div>
            </div>
            <div className="v3-principle">
              <Landmark />
              <div>
                <h3>Authoritative &amp; Neutral</h3>
                <p>Nonpartisan, evidence-based, and grounded in global institutions.</p>
              </div>
            </div>
            <div className="v3-principle">
              <Compass />
              <div>
                <h3>Clear &amp; Understandable</h3>
                <p>Complex topics made simple through structure and context.</p>
              </div>
            </div>
            <div className="v3-principle">
              <UsersRound />
              <div>
                <h3>Human-Centered</h3>
                <p>Designed for researchers, students, policymakers, and citizens.</p>
              </div>
            </div>
          </article>

          <article className="v3-visual-dna" id="v3-visual">
            <SectionKicker number="02" label="Core visual DNA" />
            <div className="v3-dna-grid">
              <div>
                <span className="v3-dna-circle v3-dna-circle--type">Aa</span>
                <h3>Editorial Typography</h3>
                <p>High-contrast serif for authority and elegance.</p>
              </div>
              <div>
                <span className="v3-dna-circle v3-dna-circle--scene"><EngravedLandscape /></span>
                <h3>Atlas Aesthetic</h3>
                <p>Engravings, maps, and timeless geography.</p>
              </div>
              <div>
                <span className="v3-dna-circle"><CompassPlate /></span>
                <h3>Navigation &amp; Orientation</h3>
                <p>Compass motifs and directional cues for exploration.</p>
              </div>
              <div>
                <span className="v3-dna-circle"><Landmark size={46} strokeWidth={1.25} /></span>
                <h3>Institutional Credibility</h3>
                <p>Signals of governance, heritage, and cooperation.</p>
              </div>
              <div>
                <span className="v3-dna-circle v3-data-circle">
                  <small>GDP (Nominal)</small>
                  <strong>$4.21T</strong>
                  <em>2023</em>
                </span>
                <h3>Data with Clarity</h3>
                <p>Clean, comparable data in context.</p>
              </div>
            </div>
          </article>
        </section>

        <section className="v3-section" id="v3-color">
          <div className="v3-section-header">
            <SectionKicker number="03" label="Color" />
            <h2>Color system for clarity and trust.</h2>
            <p>Natural pigments, historic materials, and data visualization conventions.</p>
          </div>
          <div className="v3-color-grid">
            <SwatchGrid title="Neutrals" items={NEUTRALS} />
            <SwatchGrid title="Foundation" items={FOUNDATION} />
            <SwatchGrid title="Accents" items={ACCENTS} />
            <div className="v3-panel v3-panel--flat">
              <h3 className="v3-panel-title">Semantic states</h3>
              <div className="v3-state-grid">
                {[
                  ["Success", "--v3-success"],
                  ["Warning", "--v3-warning"],
                  ["Error", "--v3-error"],
                  ["Info", "--v3-info"],
                ].map(([label, token]) => (
                  <div className="v3-state-row" key={label}>
                    <span className="v3-dot" style={tokenStyle(token)} />
                    <b>{label}</b>
                    {[100, 200, 300, 400].map((step) => (
                      <i key={step} style={tokenStyle(token)}>{step}</i>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <div className="v3-panel v3-panel--wide v3-panel--flat">
              <h3 className="v3-panel-title">Choropleth ramps</h3>
              <div className="v3-ramp-stack">
                <div><span>Sequential (Teal)</span><i className="v3-ramp v3-ramp--teal" /></div>
                <div><span>Sequential (Blue)</span><i className="v3-ramp v3-ramp--blue" /></div>
                <div><span>Sequential (Green)</span><i className="v3-ramp v3-ramp--green" /></div>
                <div><span>Sequential (Amber)</span><i className="v3-ramp v3-ramp--amber" /></div>
              </div>
            </div>
            <div className="v3-panel v3-panel--flat">
              <h3 className="v3-panel-title">Provenance dots</h3>
              <div className="v3-source-dot-grid">
                {SOURCE_DOTS.map((source) => (
                  <span key={source.label}>
                    <i className="v3-dot" style={tokenStyle(source.token)} />
                    {source.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="v3-section" id="v3-type">
          <div className="v3-section-header">
            <SectionKicker number="04" label="Typography" />
            <h2>Large editorial voice, compact data voice.</h2>
            <p>Serif display type does the storytelling; sans UI type keeps tables and controls precise.</p>
          </div>
          <div className="v3-type-grid">
            <article className="v3-type-card">
              <span>Display (serif)</span>
              <strong>Aa</strong>
              <h3>Fraunces / Regular</h3>
              <p>For hero titles, country names, and editorial moments.</p>
            </article>
            <article className="v3-type-card">
              <span>UI (sans)</span>
              <strong className="v3-type-card__sans">Aa</strong>
              <h3>Inter / Regular</h3>
              <p>For interface, labels, tables, filters, and source rows.</p>
            </article>
            <article className="v3-type-scale">
              {[
                ["H1", "56/64"],
                ["H2", "40/48"],
                ["H3", "28/36"],
                ["H4", "20/28"],
                ["Body", "16/24"],
                ["Small", "14/20"],
                ["Caption", "12/16"],
              ].map(([label, value]) => (
                <span key={label}><b>{label}</b>{value}</span>
              ))}
            </article>
          </div>
        </section>

        <section className="v3-section" id="v3-components">
          <div className="v3-section-header">
            <SectionKicker number="05" label="Components" />
            <h2>Components in action.</h2>
            <p>Cards, controls, search, tables, badges, and navigation patterns from the mockups.</p>
          </div>
          <div className="v3-components-grid">
            <article className="v3-component-demo v3-component-demo--controls">
              <h3>Buttons &amp; controls</h3>
              <div className="v3-control-row">
                <button type="button" className="v3-button v3-button--primary">Primary <ArrowRight size={14} /></button>
                <button type="button" className="v3-button v3-button--secondary">Secondary</button>
                <a className="v3-link-button" href="#v3-patterns">Tertiary link <ArrowRight size={14} /></a>
              </div>
              <label className="v3-search">
                <Search size={16} />
                <input readOnly value="" placeholder="Search countries, regions, institutions..." />
              </label>
              <div className="v3-icon-row" aria-label="Icon controls">
                {[Home, BookOpen, Download, Share2, Database, Eye, Globe2].map((Icon, index) => (
                  <button type="button" key={index} aria-label={`Icon control ${index + 1}`}>
                    <Icon size={17} />
                  </button>
                ))}
              </div>
            </article>

            <article className="v3-component-demo v3-component-demo--data-card">
              <h3>Data card</h3>
              <div className="v3-mini-stat-card">
                <Database size={17} />
                <span>GDP (Nominal)</span>
                <strong>$4.21T</strong>
                <small>2023</small>
              </div>
            </article>

            <div className="v3-component-demo v3-component-demo--country">
              <CountryFactCard />
            </div>

            <div className="v3-component-demo v3-component-demo--atlas">
              <AtlasCard />
            </div>

            <div className="v3-component-demo v3-component-demo--index">
              <IndexTable />
            </div>
          </div>
        </section>

        <section className="v3-section" id="v3-data">
          <div className="v3-section-header">
            <SectionKicker number="06" label="Data" />
            <h2>Charts, legends, and evidence surfaces.</h2>
            <p>Color never carries meaning alone; labels, icons, and scale markers do the work.</p>
          </div>
          <div className="v3-data-grid">
            <article className="v3-panel">
              <h3 className="v3-panel-title">Indicator scale</h3>
              <div className="v3-scale-card">
                <span>Political rights</span>
                <i className="v3-ramp v3-ramp--teal" />
                <footer><b>Low</b><b>High</b></footer>
              </div>
            </article>
            <article className="v3-panel">
              <h3 className="v3-panel-title">Rank bars</h3>
              <BarRows />
            </article>
            <article className="v3-panel">
              <h3 className="v3-panel-title">Regional distribution</h3>
              <div className="v3-donut" aria-label="Regional distribution donut">
                <span>195<small>Countries</small></span>
              </div>
            </article>
            <article className="v3-panel">
              <h3 className="v3-panel-title">Accessibility</h3>
              <div className="v3-accessibility-grid">
                <span><Eye /> Readable</span>
                <span><UsersRound /> Inclusive</span>
                <span><ShieldCheck /> Transparent</span>
                <span><Leaf /> Sustainable</span>
              </div>
            </article>
          </div>
        </section>

        <section className="v3-section" id="v3-patterns">
          <div className="v3-section-header">
            <SectionKicker number="07" label="Patterns" />
            <h2>Texture, gradients, shadows, and layout rhythm.</h2>
            <p>Soft elevation, hairline dividers, atlas marks, and quiet gradients give the system depth.</p>
          </div>
          <div className="v3-pattern-grid">
            <article className="v3-panel v3-shadow-demo">
              <h3 className="v3-panel-title">Shadows</h3>
              <span>Surface / default</span>
              <span>Surface / raised</span>
              <span>Surface / floating</span>
            </article>
            <article className="v3-panel v3-gradient-demo">
              <h3 className="v3-panel-title">Gradients</h3>
              <i className="v3-ramp v3-ramp--teal" />
              <i className="v3-ramp v3-ramp--blue" />
              <i className="v3-ramp v3-ramp--amber" />
            </article>
            <article className="v3-panel v3-layout-demo">
              <h3 className="v3-panel-title">Applied page slice</h3>
              <div className="v3-applied-slice">
                <div>
                  <SectionKicker number="01" label="Factbook" />
                  <h3>Explore country profiles and key facts at a glance.</h3>
                  <p>Clean, comparable, and sourced. Every figure is documented.</p>
                  <a href="#v3-components">Explore Factbook <ArrowRight size={14} /></a>
                </div>
                <CountryFactCard />
              </div>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}
