"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Award,
  BookOpen,
  Building2,
  Calendar,
  CarFront,
  Church,
  Clock,
  Coins,
  Compass,
  Flag,
  Globe,
  Hash,
  Landmark,
  Languages,
  MapPin,
  Minus,
  Music,
  Network,
  Package,
  Phone,
  Plus,
  ScrollText,
  Square,
  TrendingUp,
  Truck,
  User,
  UserPlus,
  Users,
  Vote,
  Wallet,
} from "lucide-react";
import { type Country } from "./data";
import { ciTier } from "@/lib/ci/tiers";
import { QuickCompareSearch } from "@/components/widget/QuickCompareSearch";

/**
 * Phase A masthead — country page header.
 *
 * Default layout (3 columns):
 * 1. Government & people (gov, gov detail, head of state, head of govt,
 *    capital, language, currency)
 * 2. Geography & economy (region, area, population, GDP, exports,
 *    imports, trade balance)
 * 3. Memberships (clickable chips → International tab) + Quick compare
 *    typeahead search
 *
 * A "+" toggle to the left of the grid expands to a 5-column layout
 * adding two extra columns:
 * 4. History & culture (founded, constitution, last election,
 *    religion, literacy, olympics)
 * 5. Identifiers (calling code, TLD, time zone, ISO, drives-on,
 *    anthem, national day)
 *
 * Real fields (capital, pop, gdp, gov, leader, region, id) come from
 * the existing `Country` shape. Everything else is demo data tagged
 * data-demo="true" — Phase A is a layout pass, not a data pass.
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
  tradeBalance: string;
  foundingYear: string;
  constitutionYear: string;
  lastElection: string;
  dominantReligion: string;
  literacyRate: string;
  olympicMedals: string;
  callingCode: string;
  tld: string;
  timeZone: string;
  drivesOn: string;
  anthem: string;
  nationalDay: string;
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
      ? "US Dollar (USD)"
      : pick(seed, [
          "Euro (EUR)",
          "Pound Sterling (GBP)",
          "Yen (JPY)",
          "Yuan (CNY)",
          "Real (BRL)",
          "Peso (MXN)",
          "Rupee (INR)",
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
    tradeBalance: usa
      ? "−$948B"
      : pick(seed + 13, ["+$112B", "−$54B", "+$31B", "+$210B", "−$78B"]),
    foundingYear: usa
      ? "1776"
      : pick(seed, ["1789", "1804", "1867", "1949", "1922", "1945"]),
    constitutionYear: usa ? "1787" : pick(seed + 17, ["1789", "1949", "1958", "1978", "1991"]),
    lastElection: usa
      ? "Nov 2024"
      : pick(seed + 19, ["May 2024", "Oct 2023", "Apr 2024", "Sep 2024", "Jul 2025"]),
    dominantReligion: usa
      ? "Christianity"
      : pick(seed + 21, [
          "Islam",
          "Buddhism",
          "Hinduism",
          "Christianity",
          "Secular",
          "Shinto",
        ]),
    literacyRate: usa
      ? "99%"
      : pick(seed + 23, ["96%", "92%", "78%", "99%", "85%"]),
    olympicMedals: usa
      ? "2,977"
      : pick(seed + 25, ["402", "856", "1,140", "237", "94"]),
    callingCode: usa ? "+1" : pick(seed + 27, ["+33", "+44", "+49", "+55", "+81", "+86", "+91"]),
    tld: usa ? ".us" : pick(seed + 29, [".fr", ".uk", ".de", ".br", ".jp", ".cn", ".in"]),
    timeZone: usa ? "UTC−5 to −10" : pick(seed + 31, ["UTC+1", "UTC+0", "UTC+9", "UTC−3", "UTC+8", "UTC+5:30"]),
    drivesOn: pick(seed + 33, ["Right", "Left"]),
    anthem: usa
      ? "Star-Spangled Banner"
      : pick(seed + 35, [
          "La Marseillaise",
          "God Save the King",
          "Hino Nacional",
          "Kimigayo",
          "Jana Gana Mana",
        ]),
    nationalDay: usa ? "Jul 4" : pick(seed + 37, ["Jul 14", "May 5", "Sep 7", "Aug 15", "Oct 1"]),
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
      <span className="cm-bigscore-value" style={{ color: tier.cssVar }}>
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
    <div
      className="cm-fact"
      data-demo={demo ? "true" : undefined}
      title={`${label}: ${value}`}
    >
      <span className="cm-fact-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="cm-fact-text">
        <span className="cm-fact-label">{label}:</span>{" "}
        <span className="cm-fact-value">{value}</span>
      </span>
    </div>
  );
}

function Spacer() {
  return <div className="cm-fact-spacer" aria-hidden="true" />;
}

function Memberships({ orgs }: { orgs: string[] }) {
  return (
    <div className="cm-orgs" data-demo="true">
      <div className="cm-mini-title">
        <Network size={13} aria-hidden="true" />
        <span>Memberships</span>
      </div>
      <div className="cm-orgs-list">
        {orgs.map((o) => {
          const slug = o.toLowerCase();
          return (
            <Link
              key={o}
              href={`/atlas/organizations/${slug}`}
              className="cm-org-chip"
              title={`Open ${o} in the Atlas`}
            >
              {o}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function QuickCompareBlock({ currentSlug }: { currentSlug: string }) {
  return (
    <div className="cm-qc">
      <div className="cm-mini-title">
        <Compass size={13} aria-hidden="true" />
        <span>Quick compare</span>
      </div>
      <QuickCompareSearch currentSlug={currentSlug} />
    </div>
  );
}

export function CountryMasthead({ country }: { country: Country }) {
  const [expanded, setExpanded] = useState(false);
  const d = mockData(country);
  const slug = country.slug ?? country.id;

  return (
    <section className="cm">
      <header className="cm-hero">
        <div className="cm-hero-left">
          <div className="cm-eyebrow">
            {country.region.toUpperCase()} &middot; {country.id.toUpperCase()}
          </div>
          <h1 className="cm-name">{country.name}</h1>
        </div>
        <div className="cm-hero-scores">
          <BigScore abbr="CI" label="Civica Index" value={d.ci} />
          <BigScore abbr="CP" label="Civica Pulse" value={d.cp} />
        </div>
      </header>

      <div className="cm-grid-wrap">
        <button
          type="button"
          className="cm-expand-btn"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? "Hide extra details" : "Show more details"}
          title={expanded ? "Hide extra details" : "Show more details"}
        >
          {expanded ? <Minus size={14} /> : <Plus size={14} />}
        </button>

        <div
          className={`cm-fact-grid${expanded ? " cm-fact-grid--expanded" : ""}`}
        >
          {/* Column 1: Government, leadership, capital/lang/currency */}
          <div className="cm-fact-col">
            <Fact
              icon={<Building2 size={15} />}
              label="Gov"
              value={country.gov}
            />
            <Fact
              icon={<ScrollText size={15} />}
              label="Detail"
              value={d.govDetail}
              demo
            />
            <Spacer />
            <Fact
              icon={<User size={15} />}
              label="Head of state"
              value={country.leader}
            />
            <Fact
              icon={<UserPlus size={15} />}
              label="Head of govt"
              value={d.headOfGovernment}
              demo
            />
            <Spacer />
            <Fact
              icon={<MapPin size={15} />}
              label="Capital"
              value={country.capital}
            />
            <Fact
              icon={<Languages size={15} />}
              label="Language"
              value={d.language}
              demo
            />
            <Fact
              icon={<Coins size={15} />}
              label="Currency"
              value={d.currency}
              demo
            />
          </div>

          {/* Column 2: Geography & economy */}
          <div className="cm-fact-col">
            <Fact
              icon={<Compass size={15} />}
              label="Region"
              value={country.region}
            />
            <Fact
              icon={<Square size={15} />}
              label="Area"
              value={d.area}
              demo
            />
            <Spacer />
            <Fact
              icon={<Users size={15} />}
              label="Population"
              value={country.pop}
            />
            <Fact
              icon={<TrendingUp size={15} />}
              label="GDP"
              value={country.gdp}
            />
            <Spacer />
            <Fact
              icon={<Truck size={15} />}
              label="Main export"
              value={d.mainExport}
              demo
            />
            <Fact
              icon={<Package size={15} />}
              label="Main import"
              value={d.mainImport}
              demo
            />
            <Fact
              icon={<Wallet size={15} />}
              label="Trade bal."
              value={d.tradeBalance}
              demo
            />
          </div>

          {/* Column 3 — History & culture (only when expanded) */}
          {expanded && (
            <div className="cm-fact-col">
              <Fact
                icon={<Calendar size={15} />}
                label="Founded"
                value={d.foundingYear}
                demo
              />
              <Spacer />
              <Fact
                icon={<Landmark size={15} />}
                label="Constitution"
                value={d.constitutionYear}
                demo
              />
              <Fact
                icon={<Vote size={15} />}
                label="Last election"
                value={d.lastElection}
                demo
              />
              <Spacer />
              <Fact
                icon={<Church size={15} />}
                label="Religion"
                value={d.dominantReligion}
                demo
              />
              <Fact
                icon={<BookOpen size={15} />}
                label="Literacy"
                value={d.literacyRate}
                demo
              />
              <Fact
                icon={<Award size={15} />}
                label="Olympic medals"
                value={d.olympicMedals}
                demo
              />
            </div>
          )}

          {/* Column 4 — Identifiers (only when expanded) */}
          {expanded && (
            <div className="cm-fact-col">
              <Fact
                icon={<Phone size={15} />}
                label="Calling"
                value={d.callingCode}
                demo
              />
              <Fact
                icon={<Globe size={15} />}
                label="TLD"
                value={d.tld}
                demo
              />
              <Fact
                icon={<Clock size={15} />}
                label="Time zone"
                value={d.timeZone}
                demo
              />
              <Spacer />
              <Fact
                icon={<Hash size={15} />}
                label="ISO"
                value={country.id.toUpperCase()}
              />
              <Fact
                icon={<CarFront size={15} />}
                label="Drives on"
                value={d.drivesOn}
                demo
              />
              <Spacer />
              <Fact
                icon={<Music size={15} />}
                label="Anthem"
                value={d.anthem}
                demo
              />
              <Fact
                icon={<Flag size={15} />}
                label="National day"
                value={d.nationalDay}
                demo
              />
            </div>
          )}

          {/* Column 5 — Memberships + Quick compare (always visible, last) */}
          <div className="cm-fact-col cm-col-membership">
            <Memberships orgs={["NATO", "WHO", "WTO"]} />
            <Spacer />
            <QuickCompareBlock currentSlug={slug} />
          </div>
        </div>
      </div>

      <ChipStrip d={d} />
    </section>
  );
}
