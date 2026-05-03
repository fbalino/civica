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
import {
  type Country,
  type CountryFactValue,
  type CountryMembershipChip,
} from "./data";
import { QuickCompareSearch } from "@/components/widget/QuickCompareSearch";
import { SourceDot } from "@/components/SourceDot";
import { FactValueDot } from "@/components/factbook/FactValueDot";
import type { ResolverOutput } from "@/lib/factbook/reconcile/types";
import type { AtlasHeaderFacts } from "./AtlasCountryShellClient";

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
 * A "+" toggle to the left of the grid expands a second row below the
 * primary facts:
 * 4. History & culture (founded, constitution, last election, religion,
 *    literacy, olympics)
 * 5. Identifiers (calling code, TLD, time zone, ISO, drives-on, anthem,
 *    national day)
 *
 * Every value shown here must be source-backed or rendered as "No source".
 * The previous Phase A demo generator was removed because generated facts
 * looked authoritative and damaged trust.
 */

function Fact({
  icon,
  label,
  fact,
  fallback,
  resolverOutput,
  resolverFactKey,
  resolverFactLabel,
}: {
  icon: React.ReactNode;
  label: string;
  fact?: CountryFactValue;
  fallback?: string;
  /** Phase F.4 — when provided, the source dot becomes a clickable
   *  `<FactValueDot>` that opens the alternate-values panel. */
  resolverOutput?: ResolverOutput | null;
  resolverFactKey?: string;
  resolverFactLabel?: string;
}) {
  const fallbackValue = fallback && fallback !== "—" ? fallback : null;
  const rawValue = fact?.value ?? fallbackValue;
  const value = formatFactDisplay(rawValue);
  const source = value ? fact?.source : undefined;
  const displayValue = value ?? "No source";
  const isMissing = !value;
  const hasResolverData = !!(
    resolverOutput &&
    resolverOutput.canonical &&
    resolverFactKey &&
    resolverFactLabel
  );

  return (
    <div
      className={`cm-fact${isMissing ? " cm-fact--missing" : ""}`}
      aria-label={`${label}: ${displayValue}`}
    >
      <span className="cm-fact-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="cm-fact-text">
        <span className="cm-fact-label">{label}:</span>{" "}
        <span className="cm-fact-value">{displayValue}</span>
        {/* Phase F.4 — when resolver data is present, the
         *  `<FactValueDot>` renders INSIDE the text span, tight
         *  against the value, so the click target sits adjacent
         *  to the number it describes. The plain SourceDot keeps
         *  using the separate `.cm-fact-source` slot to align
         *  vertically with neighboring rows. */}
        {hasResolverData && (
          <span className="cm-fact-inline-source">
            <FactValueDot
              factKey={resolverFactKey!}
              factLabel={resolverFactLabel!}
              resolverOutput={resolverOutput!}
              canonicalSourceId={resolverOutput!.canonical?.sourceId ?? null}
              ariaLabel={`${label} ${displayValue}, see sources`}
            />
          </span>
        )}
      </span>
      {!hasResolverData && source && (
        <span className="cm-fact-source">
          <SourceDot
            source={source.source}
            retrievedAt={source.retrievedAt}
          />
        </span>
      )}
    </div>
  );
}

function formatFactDisplay(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const clean = value.trim();
    return clean && clean !== "—" ? clean : null;
  }
  if (typeof value === "number") return value.toLocaleString();
  if (Array.isArray(value)) {
    const clean = value
      .map((item) => formatFactDisplay(item))
      .filter((item): item is string => !!item);
    return clean.length > 0 ? clean.join(", ") : null;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const direct = obj.text ?? obj.value ?? obj.name ?? obj.label;
    const directText = formatFactDisplay(direct);
    if (directText) return directText;
    const parts = Object.entries(obj)
      .map(([key, entry]) => {
        const text = formatFactDisplay(entry);
        return text ? `${key}: ${text}` : null;
      })
      .filter((item): item is string => !!item);
    return parts.length > 0 ? parts.join(", ") : null;
  }
  return null;
}

function Spacer() {
  return <div className="cm-fact-spacer" aria-hidden="true" />;
}

function Memberships({ memberships }: { memberships: CountryMembershipChip[] }) {
  const source = memberships.find((m) => m.source)?.source;

  return (
    <div className="cm-orgs">
      <div className="cm-mini-title">
        <Network size={13} aria-hidden="true" />
        <span>Memberships</span>
        {source && (
          <SourceDot source={source.source} retrievedAt={source.retrievedAt} />
        )}
      </div>
      <div className="cm-orgs-list">
        {memberships.length > 0 ? (
          memberships.map((membership) => (
            <Link
              key={membership.slug}
              href={`/atlas/organizations/${membership.slug}`}
              className="cm-org-chip"
              title={`Open ${membership.name} in the Atlas`}
            >
              {membership.name}
            </Link>
          ))
        ) : (
          <span className="cm-org-empty">No source</span>
        )}
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

export function CountryMasthead({
  country,
  headerFacts,
}: {
  country: Country;
  headerFacts?: AtlasHeaderFacts;
}) {
  const [expanded, setExpanded] = useState(false);
  const slug = country.slug ?? country.id;
  const f = country.masthead;

  return (
    <section className="cm">
      <header className="cm-hero">
        <div className="cm-hero-left">
          <div className="cm-eyebrow">
            {country.region.toUpperCase()} &middot; {country.id.toUpperCase()}
          </div>
          <h1 className="cm-name">{country.name}</h1>
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

        <div className="cm-fact-grid">
          {/* Column 1: Government, leadership, capital/lang/currency */}
          <div className="cm-fact-col">
            <Fact
              icon={<Building2 size={15} />}
              label="Gov"
              fact={f?.gov}
              fallback={country.gov}
            />
            <Fact
              icon={<ScrollText size={15} />}
              label="Detail"
              fact={f?.govDetail}
              fallback={country.govDetail}
            />
            <Spacer />
            <Fact
              icon={<User size={15} />}
              label="Head of state"
              fact={f?.headOfState}
              fallback={country.leader}
            />
            <Fact
              icon={<UserPlus size={15} />}
              label="Head of govt"
              fact={f?.headOfGovernment}
            />
            <Spacer />
            <Fact
              icon={<MapPin size={15} />}
              label="Capital"
              fact={f?.capital}
              fallback={country.capital}
            />
            <Fact
              icon={<Languages size={15} />}
              label="Language"
              fact={f?.language}
            />
            <Fact
              icon={<Coins size={15} />}
              label="Currency"
              fact={f?.currency}
            />
          </div>

          {/* Column 2: Geography & economy */}
          <div className="cm-fact-col">
            <Fact
              icon={<Compass size={15} />}
              label="Region"
              fact={f?.region}
              fallback={country.region}
            />
            <Fact
              icon={<Square size={15} />}
              label="Area"
              fact={f?.area}
            />
            <Spacer />
            <Fact
              icon={<Users size={15} />}
              label="Population"
              fact={f?.population}
              fallback={country.pop}
              resolverOutput={headerFacts?.population}
              resolverFactKey="population_total"
              resolverFactLabel="Population"
            />
            <Fact
              icon={<TrendingUp size={15} />}
              label="GDP (PPP)"
              fact={f?.gdpPpp}
              fallback={country.gdp}
              resolverOutput={headerFacts?.gdp}
              resolverFactKey="gdp_ppp_usd_billions"
              resolverFactLabel="GDP (PPP)"
            />
            <Spacer />
            <Fact
              icon={<Truck size={15} />}
              label="Main exports"
              fact={f?.mainExport}
            />
            <Fact
              icon={<Package size={15} />}
              label="Main imports"
              fact={f?.mainImport}
            />
            <Fact
              icon={<Wallet size={15} />}
              label="Trade bal."
              fact={f?.tradeBalance}
            />
          </div>

          {/* Column 5 — Memberships + Quick compare (always visible, last) */}
          <div className="cm-fact-col cm-col-membership">
            <Memberships memberships={f?.memberships ?? []} />
            <Spacer />
            <QuickCompareBlock currentSlug={slug} />
          </div>

          {expanded && (
            <div className="cm-extra-grid">
              <div className="cm-fact-col">
                <Fact
                  icon={<Calendar size={15} />}
                  label="Independence"
                  fact={f?.independence}
                />
                <Spacer />
                <Fact
                  icon={<Landmark size={15} />}
                  label="Constitution"
                  fact={f?.constitution}
                />
                <Fact
                  icon={<Vote size={15} />}
                  label="Last election"
                  fact={f?.lastElection}
                />
                <Spacer />
                <Fact
                  icon={<Church size={15} />}
                  label="Religion"
                  fact={f?.religion}
                />
                <Fact
                  icon={<BookOpen size={15} />}
                  label="Literacy"
                  fact={f?.literacy}
                />
                <Fact
                  icon={<Award size={15} />}
                  label="Olympic medals"
                  fact={f?.olympicMedals}
                />
              </div>

              <div className="cm-fact-col">
                <Fact
                  icon={<Phone size={15} />}
                  label="Calling"
                  fact={f?.callingCode}
                />
                <Fact
                  icon={<Globe size={15} />}
                  label="TLD"
                  fact={f?.tld}
                />
                <Fact
                  icon={<Clock size={15} />}
                  label="Time zone"
                  fact={f?.timeZone}
                />
                <Spacer />
                <Fact
                  icon={<Hash size={15} />}
                  label="ISO"
                  fact={f?.iso}
                  fallback={country.id.toUpperCase()}
                />
                <Fact
                  icon={<CarFront size={15} />}
                  label="Drives on"
                  fact={f?.drivesOn}
                />
                <Spacer />
                <Fact
                  icon={<Music size={15} />}
                  label="Anthem"
                  fact={f?.anthem}
                />
                <Fact
                  icon={<Flag size={15} />}
                  label="National day"
                  fact={f?.nationalDay}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
