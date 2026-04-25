"use client";

import { useSearchParams } from "next/navigation";
import {
  Banknote,
  Building2,
  Calendar,
  Globe2,
  Languages,
  MapPin,
  Square,
  TrendingUp,
  Truck,
  Users,
} from "lucide-react";
import { type Country } from "./data";
import { ciTier } from "@/lib/ci/tiers";

/**
 * Three-variant Phase A mockup of the country masthead. The variant is
 * chosen via the `?layout=A1|A2|A3` query param; default is A1.
 *
 * All score values are demo (data-demo="true") — Phase A is a visual
 * pass, not a data-wiring pass. Real CI/Pulse/dimension data is wired
 * in a follow-up phase once the user picks a variant.
 *
 * Static country fields (capital, population, GDP, government type)
 * come from the existing `Country` shape. Currency, language, area,
 * main export, founding year are demo for now.
 */

type LayoutVariant = "A1" | "A2" | "A3";

interface ScoreValue {
  label: string;
  abbr: string;
  value: number;
}

interface MockData {
  ci: number;
  cp: number;
  hdi: number;
  dq: number;
  rol: number;
  fnr: number;
  cc: number;
  ss: number;
  area: string;
  currency: string;
  language: string;
  mainExport: string;
  foundingYear: string;
}

// Deterministic pseudo-random scores per country slug so the demo values
// are stable across reloads and consistent across variants.
function hashSlug(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return h;
}

function mockScore(seed: number, base: number, spread: number): number {
  const x = Math.sin(seed) * 10000;
  const r = x - Math.floor(x);
  return Math.max(0, Math.min(100, Math.round(base + (r - 0.5) * spread)));
}

function mockData(country: Country): MockData {
  const seed = hashSlug(country.slug ?? country.id);
  return {
    ci: mockScore(seed + 1, 70, 50),
    cp: mockScore(seed + 2, 70, 40),
    hdi: mockScore(seed + 3, 75, 40),
    dq: mockScore(seed + 4, 70, 60),
    rol: mockScore(seed + 5, 70, 50),
    fnr: mockScore(seed + 6, 70, 50),
    cc: mockScore(seed + 7, 65, 60),
    ss: mockScore(seed + 8, 75, 40),
    area: ["9.8M km²", "8.5M km²", "1.7M km²", "643k km²", "377k km²"][
      seed % 5
    ]!,
    currency: country.id === "usa"
      ? "US Dollar"
      : ["Euro", "Pound Sterling", "Yen", "Yuan", "Real", "Peso"][seed % 6]!,
    language: country.id === "usa"
      ? "English"
      : ["French", "Spanish", "German", "Mandarin", "Portuguese", "Arabic"][
          seed % 6
        ]!,
    mainExport: ["Machinery", "Vehicles", "Electronics", "Pharmaceuticals", "Energy"][
      seed % 5
    ]!,
    foundingYear: ["1776", "1789", "1804", "1867", "1949"][seed % 5]!,
  };
}

function BigScore({
  abbr,
  label,
  value,
}: {
  abbr: string;
  label: string;
  value: number;
}) {
  const tier = ciTier(value);
  return (
    <div className="cm-bigscore" data-demo="true">
      <span className="cm-bigscore-label">{abbr}</span>
      <span
        className="cm-bigscore-value"
        style={{ color: tier.cssVar }}
      >
        {value}
      </span>
      <span className="cm-bigscore-meta">
        <span className="cm-bigscore-tier" style={{ color: tier.cssVar }}>
          {tier.label}
        </span>
        <span className="cm-bigscore-name">{label}</span>
      </span>
    </div>
  );
}

function ScoreChip({ abbr, label, value }: ScoreValue) {
  const tier = ciTier(value);
  return (
    <div
      className="cm-chip"
      title={`${label}: ${value}/100 — ${tier.label}`}
      data-demo="true"
    >
      <span className="cm-chip-label">{abbr}</span>
      <span className="cm-chip-value" style={{ color: tier.cssVar }}>
        {value}
      </span>
    </div>
  );
}

function IconFact({
  icon,
  label,
  value,
  demo,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  demo?: boolean;
}) {
  return (
    <div className="cm-icon-fact" data-demo={demo ? "true" : undefined}>
      <span className="cm-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="cm-fact-body">
        <span className="cm-fact-label">{label}</span>
        <span className="cm-fact-value">{value}</span>
      </span>
    </div>
  );
}

function IconFactGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="cm-icon-group">
      <div className="cm-icon-group-title">{title}</div>
      <div className="cm-icon-group-body">{children}</div>
    </div>
  );
}

function CountryName({ country }: { country: Country }) {
  return (
    <>
      <div className="cm-eyebrow">
        {country.region.toUpperCase()} &middot; {country.id.toUpperCase()}
      </div>
      <h1 className="cm-name">{country.name}</h1>
    </>
  );
}

function buildChipScores(d: MockData): ScoreValue[] {
  return [
    { abbr: "HDI", label: "Human Development", value: d.hdi },
    { abbr: "DQ", label: "Democratic Quality", value: d.dq },
    { abbr: "ROL", label: "Rule of Law", value: d.rol },
    { abbr: "FNR", label: "Freedom & Rights", value: d.fnr },
    { abbr: "CC", label: "Corruption Control", value: d.cc },
    { abbr: "SS", label: "Stability & Security", value: d.ss },
  ];
}

function ChipStrip({ d }: { d: MockData }) {
  const chips = buildChipScores(d);
  return (
    <div className="cm-chip-strip" role="list">
      {chips.map((c) => (
        <ScoreChip key={c.abbr} {...c} />
      ))}
    </div>
  );
}

function IconRow({ country, d }: { country: Country; d: MockData }) {
  return (
    <div className="cm-icon-row">
      <IconFactGroup title="Geography & people">
        <IconFact
          icon={<MapPin size={16} />}
          label="Capital"
          value={country.capital}
        />
        <IconFact
          icon={<Users size={16} />}
          label="Population"
          value={country.pop}
        />
        <IconFact
          icon={<Square size={16} />}
          label="Area"
          value={d.area}
          demo
        />
      </IconFactGroup>

      <IconFactGroup title="Economy">
        <IconFact
          icon={<Banknote size={16} />}
          label="Currency"
          value={d.currency}
          demo
        />
        <IconFact
          icon={<TrendingUp size={16} />}
          label="GDP"
          value={country.gdp}
        />
        <IconFact
          icon={<Truck size={16} />}
          label="Main export"
          value={d.mainExport}
          demo
        />
      </IconFactGroup>

      <IconFactGroup title="Identity">
        <IconFact
          icon={<Building2 size={16} />}
          label="Government"
          value={country.gov}
        />
        <IconFact
          icon={<Languages size={16} />}
          label="Language"
          value={d.language}
          demo
        />
        <IconFact
          icon={<Calendar size={16} />}
          label="Founded"
          value={d.foundingYear}
          demo
        />
      </IconFactGroup>
    </div>
  );
}

function VariantBadge({ variant }: { variant: LayoutVariant }) {
  return (
    <div className="cm-variant-badge" aria-label={`Layout variant ${variant}`}>
      Mockup · Layout {variant}
    </div>
  );
}

function LayoutA1({ country, d }: { country: Country; d: MockData }) {
  return (
    <section className="cm cm--a1">
      <header className="cm-a1-head">
        <div className="cm-a1-left">
          <CountryName country={country} />
          <IconRow country={country} d={d} />
        </div>
        <div className="cm-a1-right">
          <div className="cm-a1-bigscores">
            <BigScore abbr="CI" label="Civica Index" value={d.ci} />
            <BigScore abbr="CP" label="Civica Pulse" value={d.cp} />
          </div>
          <ChipStrip d={d} />
        </div>
      </header>
    </section>
  );
}

function LayoutA2({ country, d }: { country: Country; d: MockData }) {
  return (
    <section className="cm cm--a2">
      <header className="cm-a2-head">
        <CountryName country={country} />
        <div className="cm-a2-bigrow">
          <BigScore abbr="CI" label="Civica Index" value={d.ci} />
          <BigScore abbr="CP" label="Civica Pulse" value={d.cp} />
        </div>
        <ChipStrip d={d} />
        <IconRow country={country} d={d} />
      </header>
    </section>
  );
}

function LayoutA3({ country, d }: { country: Country; d: MockData }) {
  return (
    <section className="cm cm--a3">
      <header className="cm-a3-head">
        <div className="cm-a3-left">
          <CountryName country={country} />
          <IconRow country={country} d={d} />
        </div>
        <div className="cm-a3-right">
          <BigScore abbr="CI" label="Civica Index" value={d.ci} />
          <BigScore abbr="CP" label="Civica Pulse" value={d.cp} />
        </div>
      </header>
      <div className="cm-a3-statbar">
        <Globe2 size={14} aria-hidden="true" />
        <ChipStrip d={d} />
      </div>
    </section>
  );
}

export function CountryMasthead({ country }: { country: Country }) {
  const sp = useSearchParams();
  const raw = sp?.get("layout") ?? "A1";
  const variant: LayoutVariant =
    raw === "A2" ? "A2" : raw === "A3" ? "A3" : "A1";

  const d = mockData(country);

  return (
    <>
      <VariantBadge variant={variant} />
      {variant === "A1" ? (
        <LayoutA1 country={country} d={d} />
      ) : variant === "A2" ? (
        <LayoutA2 country={country} d={d} />
      ) : (
        <LayoutA3 country={country} d={d} />
      )}
    </>
  );
}
