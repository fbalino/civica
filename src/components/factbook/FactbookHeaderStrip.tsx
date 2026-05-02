"use client";

import { useState } from "react";
import Link from "next/link";
import { CountryFlag } from "@/components/CountryFlag";
import { CountrySwitcherChips } from "./CountrySwitcherChips";
import { FactbookLightbox, type LightboxImage } from "./FactbookLightbox";

function MetaPill({
  label,
  value,
  dotColor,
}: {
  label?: string;
  value: string;
  dotColor?: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "baseline",
        gap: 6,
        fontSize: "var(--text-14)",
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
        <span style={{ color: "var(--color-text-40)", fontSize: "var(--text-12)" }}>
          {label}
        </span>
      )}
      <span style={{ color: "var(--color-text-primary)" }}>{value}</span>
    </span>
  );
}

function BetaTag() {
  return (
    <span
      className="ci-beta-pill"
      style={{ marginLeft: "var(--space-1)", alignSelf: "center" }}
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
  mapUrl?: string | null;
  mapCaption?: string;
  photos: LightboxImage[];
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
  mapUrl,
  mapCaption,
  photos,
}: FactbookHeaderStripProps) {
  const [lbOpen, setLbOpen] = useState(false);
  const [lbMode, setLbMode] = useState<"map" | "photos">("photos");

  const popStr = formatPop(population);
  const gdpStr = formatGdp(gdp);

  const cpDisplay =
    cpDelta == null
      ? null
      : `${cpDelta > 0 ? "+" : cpDelta < 0 ? "−" : ""}${Math.abs(cpDelta).toFixed(1)}`;

  const trendArrow =
    cpTrend === "up" ? "↑" : cpTrend === "down" ? "↓" : cpTrend === "flat" ? "→" : null;
  const trendColor =
    cpTrend === "up"
      ? "var(--color-success)"
      : cpTrend === "down"
      ? "var(--color-danger)"
      : "var(--color-text-40)";

  const lightboxImages: LightboxImage[] =
    lbMode === "map" && mapUrl
      ? [{ src: mapUrl, alt: `${countryName} locator map`, caption: mapCaption ?? `${countryName} — locator map · Wikimedia Commons` }]
      : photos;

  const coverPhoto = photos[0];

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
            {governmentTypeLabel && <MetaPill value={governmentTypeLabel} />}
            {popStr && <MetaPill label="Pop" value={popStr} />}
            {gdpStr && <MetaPill label="GDP" value={gdpStr} />}
            {ciScore != null && (
              <Link
                href={`/civica-index/${slug}`}
                style={{
                  display: "inline-flex",
                  alignItems: "baseline",
                  gap: 6,
                  fontSize: "var(--text-14)",
                  color: "var(--color-text-60)",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
                title="View Civica Index detail"
              >
                <span
                  aria-hidden
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "var(--color-accent)",
                    alignSelf: "center",
                    flexShrink: 0,
                  }}
                />
                <span style={{ color: "var(--color-text-40)", fontSize: "var(--text-12)" }}>CI</span>
                <span
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: "var(--text-20)",
                    fontWeight: 400,
                    color: "var(--color-accent)",
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
                  alignItems: "baseline",
                  gap: 6,
                  fontSize: "var(--text-14)",
                  color: "var(--color-text-60)",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
                title="View Civica Pulse detail"
              >
                <span
                  aria-hidden
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: trendColor,
                    alignSelf: "center",
                    flexShrink: 0,
                  }}
                />
                <span style={{ color: "var(--color-text-40)", fontSize: "var(--text-12)" }}>CP</span>
                <span style={{ color: "var(--color-text-primary)" }}>{cpDisplay}</span>
                {trendArrow && (
                  <span
                    aria-label={`trending ${cpTrend}`}
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "var(--text-12)",
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
            <CountrySwitcherChips slug={slug} active="factbook" />
          </div>
        </div>

        <div className="factbook-hero-boxes">
          <button
            type="button"
            onClick={() => {
              setLbMode("map");
              setLbOpen(true);
            }}
            aria-label="Open detailed map"
            className="factbook-hero-box"
          >
            {mapUrl ? (
              <img
                src={mapUrl}
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
                }}
              >
                <svg viewBox="0 0 240 200" aria-hidden style={{ width: "90%", height: "90%" }}>
                  <path
                    d="M70,30 L150,25 L185,55 L195,90 L188,135 L170,170 L135,185 L100,190 L75,175 L60,140 L55,95 L62,60 Z"
                    fill="#bdb39c"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  />
                </svg>
              </div>
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
