"use client";

import {
  Building2,
  Calendar,
  Coins,
  Languages,
  MapPin,
  Package,
  ScrollText,
  Square,
  TrendingUp,
  Truck,
  User,
  UserPlus,
  Users,
} from "lucide-react";
import { type Country } from "./data";
import { ciTier } from "@/lib/ci/tiers";

/**
 * Phase A masthead — variant A1 (right-rail dashboard).
 *
 * Layout: country name + eyebrow + tight icon-fact grid on the left;
 * CI/CP big stacked + dimension chip strip on the right. The icon
 * column omits group titles and per-fact captions — the icon itself
 * communicates the data type — so we can pack ~13 facts into the
 * space that previously held 9.
 *
 * Real fields from the existing `Country` shape: gov, leader, capital,
 * pop, gdp. Everything else (head of government, currency, language,
 * area, founded, main export/import, score chips) is demo data tagged
 * data-demo="true" so a future grep finds the wiring points.
 */

interface MockData {
  ci: number;
  cp: number;
  hdi: number;
  dq: number;
  rol: number;
  fnr: number;
  cc: number;
  ss: number;
  govDetail: string;
  headOfGovernment: string;
  area: string;
  currency: string;
  language: string;
  mainExport: string;
  mainImport: string;
  foundingYear: string;
}

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

function pick<T>(seed: number, arr: readonly T[]): T {
  return arr[seed % arr.length]!;
}

function mockData(country: Country): MockData {
  const seed = hashSlug(country.slug ?? country.id);
  const usa = country.id === "usa";

  return {
    ci: mockScore(seed + 1, 70, 50),
    cp: mockScore(seed + 2, 70, 40),
    hdi: mockScore(seed + 3, 75, 40),
    dq: mockScore(seed + 4, 70, 60),
    rol: mockScore(seed + 5, 70, 50),
    fnr: mockScore(seed + 6, 70, 50),
    cc: mockScore(seed + 7, 65, 60),
    ss: mockScore(seed + 8, 75, 40),

    govDetail: usa
      ? "Presidential Democracy"
      : pick(seed, [
          "Parliamentary Democracy",
          "Constitutional Monarchy",
          "Federal Republic",
          "Semi-Presidential",
          "Directorial Republic",
        ]),
    headOfGovernment: usa
      ? "JD Vance"
      : pick(seed, [
          "Cabinet Chief",
          "Prime Minister",
          "Vice President",
          "Deputy Head",
        ]),
    area: usa
      ? "9.8M km²"
      : pick(seed, ["8.5M km²", "1.7M km²", "643k km²", "377k km²", "551k km²"]),
    currency: usa
      ? "US Dollar"
      : pick(seed, [
          "Euro",
          "Pound Sterling",
          "Yen",
          "Yuan",
          "Real",
          "Peso",
          "Rupee",
        ]),
    language: usa
      ? "English"
      : pick(seed, [
          "French",
          "Spanish",
          "German",
          "Mandarin",
          "Portuguese",
          "Arabic",
          "Hindi",
        ]),
    mainExport: pick(seed, [
      "Machinery",
      "Vehicles",
      "Electronics",
      "Pharmaceuticals",
      "Energy",
    ]),
    mainImport: pick(seed + 11, [
      "Pharmaceuticals",
      "Vehicles",
      "Machinery",
      "Refined oil",
      "Electronics",
    ]),
    foundingYear: usa
      ? "1776"
      : pick(seed, ["1789", "1804", "1867", "1949", "1922", "1945"]),
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

interface ChipScore {
  abbr: string;
  label: string;
  value: number;
}

function ScoreChip({ abbr, label, value }: ChipScore) {
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

function ChipStrip({ d }: { d: MockData }) {
  const chips: ChipScore[] = [
    { abbr: "HDI", label: "Human Development", value: d.hdi },
    { abbr: "DQ", label: "Democratic Quality", value: d.dq },
    { abbr: "ROL", label: "Rule of Law", value: d.rol },
    { abbr: "FNR", label: "Freedom & Rights", value: d.fnr },
    { abbr: "CC", label: "Corruption Control", value: d.cc },
    { abbr: "SS", label: "Stability & Security", value: d.ss },
  ];
  return (
    <div className="cm-chip-strip" role="list">
      {chips.map((c) => (
        <ScoreChip key={c.abbr} {...c} />
      ))}
    </div>
  );
}

function Fact({
  icon,
  value,
  demo,
  title,
}: {
  icon: React.ReactNode;
  value: string;
  demo?: boolean;
  title: string;
}) {
  return (
    <div
      className="cm-fact"
      data-demo={demo ? "true" : undefined}
      title={title}
    >
      <span className="cm-fact-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="cm-fact-value">{value}</span>
    </div>
  );
}

function FactGrid({ country, d }: { country: Country; d: MockData }) {
  return (
    <div className="cm-fact-grid">
      <Fact
        icon={<Building2 size={15} />}
        title="Government type"
        value={country.gov}
      />
      <Fact
        icon={<ScrollText size={15} />}
        title="Government detail"
        value={d.govDetail}
        demo
      />
      <Fact
        icon={<User size={15} />}
        title="Head of state"
        value={country.leader}
      />
      <Fact
        icon={<UserPlus size={15} />}
        title="Head of government"
        value={d.headOfGovernment}
        demo
      />
      <Fact
        icon={<MapPin size={15} />}
        title="Capital"
        value={country.capital}
      />
      <Fact
        icon={<Languages size={15} />}
        title="Official language"
        value={d.language}
        demo
      />
      <Fact
        icon={<Coins size={15} />}
        title="Currency"
        value={d.currency}
        demo
      />
      <Fact
        icon={<Users size={15} />}
        title="Population"
        value={country.pop}
      />
      <Fact
        icon={<TrendingUp size={15} />}
        title="GDP"
        value={country.gdp}
      />
      <Fact
        icon={<Square size={15} />}
        title="Area"
        value={d.area}
        demo
      />
      <Fact
        icon={<Calendar size={15} />}
        title="Founded"
        value={d.foundingYear}
        demo
      />
      <Fact
        icon={<Truck size={15} />}
        title="Main export"
        value={d.mainExport}
        demo
      />
      <Fact
        icon={<Package size={15} />}
        title="Main import"
        value={d.mainImport}
        demo
      />
    </div>
  );
}

export function CountryMasthead({ country }: { country: Country }) {
  const d = mockData(country);
  return (
    <section className="cm cm--a1">
      <header className="cm-a1-head">
        <div className="cm-a1-left">
          <div className="cm-eyebrow">
            {country.region.toUpperCase()} &middot; {country.id.toUpperCase()}
          </div>
          <h1 className="cm-name">{country.name}</h1>
          <FactGrid country={country} d={d} />
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
