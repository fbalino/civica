"use client";

import { useState } from "react";
import Link from "next/link";
import { Info } from "lucide-react";
import { CountryFlag } from "@/components/CountryFlag";
import { CountrySwitcherChips } from "./CountrySwitcherChips";
import { FactbookLightbox, type LightboxImage } from "./FactbookLightbox";
import { FactValueDot } from "./FactValueDot";
import type { ResolverOutput } from "@/lib/factbook/reconcile/types";
import { ciTier } from "@/lib/ci/tiers";

function MetaPill({
  label,
  value,
  note,
  dotColor,
  className,
}: {
  label?: string;
  value: string;
  note?: string | null;
  dotColor?: string;
  className?: string;
}) {
  return (
    <span
      className={`factbook-meta-pill${className ? ` ${className}` : ""}`}
      title={note ? undefined : value}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: "var(--text-14)",
        lineHeight: 1,
        color: "var(--color-text-60)",
        whiteSpace: "nowrap",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: dotColor ?? "var(--color-text-40)",
          alignSelf: "center",
          flexShrink: 0,
        }}
      />
      {label && (
        <span style={{ color: "var(--color-text-40)", fontSize: "var(--text-14)" }}>
          {label}
        </span>
      )}
      <span className="factbook-meta-pill-value" style={{ color: "var(--color-text-primary)" }}>
        {value}
      </span>
      {note ? (
        <button
          type="button"
          className="factbook-meta-pill-help"
          aria-label={`${value}: ${note}`}
          data-tooltip={note}
        >
          <Info focusable="false" />
        </button>
      ) : null}
    </span>
  );
}

function BetaTag() {
  return (
    <span
      className="ci-beta-pill"
      style={{ marginLeft: "var(--space-1)", alignSelf: "center", lineHeight: 1 }}
    >
      Beta
    </span>
  );
}

interface FactbookHeaderStripProps {
  slug: string;
  countryName: string;
  iso2: string | null;
  governmentTypeLabel: string;
  population: number | null;
  gdp?: number | null;
  ciScore?: number | null;
  cpDelta?: number | null;
  cpTrend?: "up" | "down" | "flat" | null;
  mapImages?: LightboxImage[];
  photos: LightboxImage[];
  /** Phase F.4 — resolver output for population_total. When
   *  provided, the Pop pill renders a `<FactValueDot>` that opens
   *  the alternate-values panel on click. Falls back to plain pill
   *  if absent (no reconciled data yet). */
  populationResolver?: ResolverOutput | null;
  /** Phase F.4 — resolver output for gdp_ppp_usd_billions. */
  gdpResolver?: ResolverOutput | null;
  /** Whether this jurisdiction is covered by the Atlas (sovereign states only).
   *  Hides the "Open in Atlas" chip for non-sovereign territories. */
  inAtlas?: boolean;
}

function formatPop(n: number | null): string | null {
  if (n == null) return null;
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

function formatGdp(n: number | null | undefined): string | null {
  if (n == null) return null;
  if (n >= 1_000_000_000_000) return `$${(n / 1_000_000_000_000).toFixed(1)}T`;
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
}

function splitGovernmentTypeLabel(label: string): {
  value: string;
  note: string | null;
} {
  const [value, ...noteParts] = label.split(";").map((part) => part.trim());
  const note = noteParts.join("; ").trim();
  return {
    value: value || label,
    note: note || null,
  };
}

export function FactbookHeaderStrip({
  slug,
  countryName,
  iso2,
  governmentTypeLabel,
  population,
  gdp,
  ciScore,
  cpDelta,
  cpTrend,
  mapImages = [],
  photos,
  populationResolver,
  gdpResolver,
  inAtlas = true,
}: FactbookHeaderStripProps) {
  const [lbOpen, setLbOpen] = useState(false);
  const [lbMode, setLbMode] = useState<"map" | "photos">("photos");

  // Bug 2 fix (2026-05-04): derive displayed values from the resolver's
  // canonical pick when available. The legacy `population` / `gdp` props
  // come from `jurisdictions.population` / `jurisdictions.gdp_billions` —
  // denormalised cache columns that may be up to 24 h stale and do NOT
  // reflect the multi-source reconciliation result.
  //
  // `populationResolver.canonical.factValueNumeric` is the raw head-count
  // (e.g. 45_700_000 for Argentina).
  // `gdpResolver.canonical.factValueNumeric` is in USD billions, so multiply
  // by 1e9 before passing to `formatGdp` (which expects raw USD).
  //
  // Falls back to the legacy props when the resolver returns no canonical
  // row (no `country_facts` data yet for the country).
  //
  // Coordination note: Bug 1 (forecast-vs-measurement resolver fix) is a
  // separate agent. Once Bug 1 lands, the resolver's canonical pick for
  // Argentina population will flip from the IMF 2030 forecast (50.4 M) to
  // the UN/WB 2023 measurement (~45.7 M). This component is agnostic to
  // that — it just consumes whatever the resolver returns.
  const resolvedPop =
    populationResolver?.canonical?.factValueNumeric ?? null;
  const resolvedGdpBillions =
    gdpResolver?.canonical?.factValueNumeric ?? null;

  const popStr = formatPop(resolvedPop !== null ? resolvedPop : population);
  const gdpStr = formatGdp(
    resolvedGdpBillions !== null
      ? resolvedGdpBillions * 1_000_000_000
      : gdp
  );

  const cpDisplay =
    cpDelta == null
      ? null
      : `${cpDelta > 0 ? "+" : cpDelta < 0 ? "−" : ""}${Math.abs(cpDelta).toFixed(1)}`;
  const ciScoreColor = ciScore != null ? ciTier(ciScore).cssVar : "var(--color-accent)";

  const trendArrow =
    cpTrend === "up" ? "↑" : cpTrend === "down" ? "↓" : cpTrend === "flat" ? "→" : null;
  const trendColor =
    cpTrend === "up"
      ? "var(--color-success)"
      : cpTrend === "down"
      ? "var(--color-danger)"
      : "var(--color-text-40)";

  const lightboxImages: LightboxImage[] =
    lbMode === "map"
      ? mapImages
      : photos;

  const coverMap = mapImages[0];
  const coverPhoto = photos[0];
  const governmentTypeDisplay = splitGovernmentTypeLabel(governmentTypeLabel);

  return (
    <>
      <section aria-label="Country header" className="factbook-hero">
        <div className="factbook-hero-left">
          <div className="factbook-hero-title-row">
            <div className="factbook-hero-flag">
              <CountryFlag iso2={iso2} size={48} />
            </div>
            <h1 className="factbook-hero-name">{countryName}</h1>
          </div>

          <div className="factbook-hero-pills">
            {governmentTypeLabel && (
              <MetaPill
                value={governmentTypeDisplay.value}
                note={governmentTypeDisplay.note}
                className="factbook-meta-pill--government"
              />
            )}
            {popStr &&
              (populationResolver?.canonical ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: "var(--text-14)",
                    lineHeight: 1,
                    whiteSpace: "nowrap",
                  }}
                >
                  <span
                    style={{
                      color: "var(--color-text-40)",
                      fontSize: "var(--text-14)",
                    }}
                  >
                    Pop
                  </span>
                  <span style={{ color: "var(--color-text-primary)" }}>
                    {popStr}
                  </span>
                  <FactValueDot
                    factKey="population_total"
                    factLabel="Population"
                    resolverOutput={populationResolver}
                    canonicalSourceId={
                      populationResolver.canonical?.sourceId ?? null
                    }
                    ariaLabel={`Population ${popStr}, see sources`}
                  />
                </span>
              ) : (
                <MetaPill label="Pop" value={popStr} />
              ))}
            {gdpStr &&
              (gdpResolver?.canonical ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: "var(--text-14)",
                    lineHeight: 1,
                    whiteSpace: "nowrap",
                  }}
                >
                  <span
                    style={{
                      color: "var(--color-text-40)",
                      fontSize: "var(--text-14)",
                    }}
                  >
                    GDP (PPP)
                  </span>
                  <span style={{ color: "var(--color-text-primary)" }}>
                    {gdpStr}
                  </span>
                  <FactValueDot
                    factKey="gdp_ppp_usd_billions"
                    factLabel="GDP (PPP)"
                    resolverOutput={gdpResolver}
                    canonicalSourceId={
                      gdpResolver.canonical?.sourceId ?? null
                    }
                    ariaLabel={`GDP (PPP) ${gdpStr}, see sources`}
                  />
                </span>
              ) : (
                <MetaPill label="GDP" value={gdpStr} />
              ))}
            {ciScore != null && (
              <Link
                href={`/civica-index/${slug}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: "var(--text-14)",
                  lineHeight: 1,
                  color: "var(--color-text-60)",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
                title="View Civica Index detail"
              >
                <span style={{ color: "var(--color-text-40)", fontSize: "var(--text-14)" }}>CI</span>
                <span
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: "var(--text-14)",
                    fontWeight: 400,
                    lineHeight: 1,
                    color: ciScoreColor,
                  }}
                >
                  {Math.round(ciScore)}
                </span>
                <BetaTag />
              </Link>
            )}
            {cpDisplay !== null && (
              <Link
                href={`/civica-index/${slug}#pulse`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: "var(--text-14)",
                  lineHeight: 1,
                  color: "var(--color-text-60)",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
                title="View Civica Pulse detail"
              >
                <span style={{ color: "var(--color-text-40)", fontSize: "var(--text-14)" }}>CP</span>
                <span style={{ color: "var(--color-text-primary)", lineHeight: 1 }}>{cpDisplay}</span>
                {trendArrow && (
                  <span
                    aria-label={`trending ${cpTrend}`}
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--text-12)",
                      lineHeight: 1,
                      marginLeft: 2,
                      color: trendColor,
                    }}
                  >
                    {trendArrow}
                  </span>
                )}
                <BetaTag />
              </Link>
            )}
          </div>

          <div className="factbook-hero-switcher-wrap">
            <CountrySwitcherChips slug={slug} active="factbook" inAtlas={inAtlas} />
          </div>
        </div>

        <div className="factbook-hero-boxes">
          <button
            type="button"
            onClick={() => {
              setLbMode("map");
              setLbOpen(true);
            }}
            aria-label={
              mapImages.length === 0
                ? "No maps available"
                : `Open ${mapImages.length} ${mapImages.length === 1 ? "map" : "maps"}`
            }
            disabled={mapImages.length === 0}
            className="factbook-hero-box"
            style={{ cursor: mapImages.length === 0 ? "default" : "pointer" }}
          >
            {coverMap ? (
              <img
                src={coverMap.src}
                alt=""
                style={{
                  objectFit: "contain",
                  background: "var(--color-bg)",
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "grid",
                  placeItems: "center",
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-10)",
                  color: "var(--color-text-40)",
                  letterSpacing: "var(--tracking-wider)",
                  textTransform: "uppercase",
                }}
              >
                No map yet
              </div>
            )}
            {mapImages.length > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: "var(--space-3)",
                  right: "var(--space-3)",
                  background:
                    "color-mix(in oklab, var(--color-text-primary) 75%, transparent)",
                  color: "var(--color-bg)",
                  padding: "var(--space-1) var(--space-3)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-10)",
                  letterSpacing: "var(--tracking-wider)",
                  textTransform: "uppercase",
                }}
              >
                {mapImages.length} map{mapImages.length === 1 ? "" : "s"}
              </span>
            )}
            <span className="label-strip">Map</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setLbMode("photos");
              setLbOpen(true);
            }}
            aria-label={
              photos.length === 0
                ? "No photos available"
                : `Open ${photos.length} ${photos.length === 1 ? "photo" : "photos"}`
            }
            disabled={photos.length === 0}
            className="factbook-hero-box"
            style={{ cursor: photos.length === 0 ? "default" : "pointer" }}
          >
            {coverPhoto ? (
              <img
                src={coverPhoto.src}
                alt=""
                loading="lazy"
                style={{ objectFit: "cover" }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "grid",
                  placeItems: "center",
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-10)",
                  color: "var(--color-text-40)",
                  letterSpacing: "var(--tracking-wider)",
                  textTransform: "uppercase",
                }}
              >
                No photos yet
              </div>
            )}
            {photos.length > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: "var(--space-3)",
                  right: "var(--space-3)",
                  background:
                    "color-mix(in oklab, var(--color-text-primary) 75%, transparent)",
                  color: "var(--color-bg)",
                  padding: "var(--space-1) var(--space-3)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-10)",
                  letterSpacing: "var(--tracking-wider)",
                  textTransform: "uppercase",
                }}
              >
                {photos.length} photo{photos.length === 1 ? "" : "s"}
              </span>
            )}
            <span className="label-strip">Images</span>
          </button>
        </div>
      </section>

      <FactbookLightbox
        open={lbOpen}
        mode={lbMode}
        images={lightboxImages}
        initialIndex={0}
        onClose={() => setLbOpen(false)}
      />
    </>
  );
}
