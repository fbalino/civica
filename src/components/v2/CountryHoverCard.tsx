"use client";

import { useState } from "react";
import { Chip } from "@/components/editorial/Pill";
import { CountryFlag } from "@/components/CountryFlag";

export type CountryHoverCardStat = {
  label: string;
  value: string;
  year?: string;
};

export type CountryHoverCardProps = {
  name: string;
  officialName: string;
  iso2: string;
  /**
   * Canonical World Bank income-group label ("High income", "Upper middle
   * income", …). When present, renders the tinted sage income Chip in the
   * title stack — matching the homepage CountryCard so the two read as the
   * same component family. Omitted when the fact is unresolved.
   */
  incomeGroup?: string | null;
  /** Sourced jurisdiction-status label from jurisdiction-status/v1. */
  statusLabel?: string | null;
  /** Optional. When omitted, the card renders compactly without a hero band. */
  heroImageUrl?: string;
  heroImageDarkUrl?: string;
  heroImageAlt?: string;
  stats: [CountryHoverCardStat, CountryHoverCardStat, CountryHoverCardStat];
  ctaHref: string;
  ctaLabel?: string;
};

/**
 * Route a local engraving through Next's built-in image optimizer so the hover
 * banner loads a small, resized webp (~20-40KB) instead of the full ~600KB
 * source. The optimized response is cached after the first request. Absolute
 * URLs and already-optimized URLs are returned untouched.
 */
function optimizedHeroSrc(url: string): string {
  if (!url.startsWith("/") || url.startsWith("/_next/image")) return url;
  return `/_next/image?url=${encodeURIComponent(url)}&w=640&q=70`;
}

export function CountryHoverCard({
  name,
  officialName,
  iso2,
  incomeGroup,
  statusLabel,
  heroImageUrl,
  heroImageDarkUrl,
  heroImageAlt,
  stats,
}: CountryHoverCardProps) {
  const [darkImageFailed, setDarkImageFailed] = useState(false);
  const hasDarkImage = Boolean(heroImageDarkUrl && !darkImageFailed);
  const lightClassName = hasDarkImage ? "theme-engraving-light" : undefined;

  return (
    <article className="v2-country-card" aria-label={name}>
      <div className="v2-country-card__body">
        <header className="v2-country-card__header">
          <span className="v2-country-card__flag" aria-hidden="true">
            <CountryFlag iso2={iso2} size={36} />
          </span>
          <div className="v2-country-card__title-stack">
            <h3 className="v2-country-card__name">{name}</h3>
            {officialName ? (
              <p className="v2-country-card__native">{officialName}</p>
            ) : null}
            {incomeGroup || statusLabel ? (
              <span className="v2-country-card__chips">
                {statusLabel ? <Chip variant="blue">{statusLabel}</Chip> : null}
                {incomeGroup ? <Chip variant="sage">{incomeGroup}</Chip> : null}
              </span>
            ) : null}
          </div>
        </header>

        {heroImageUrl && (
          <div className="v2-country-card__hero">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className={lightClassName}
              src={optimizedHeroSrc(heroImageUrl)}
              alt={heroImageAlt ?? name}
              loading="lazy"
              onError={(e) => {
                // Gracefully hide the banner if the engraving 404s.
                const wrap = e.currentTarget.parentElement;
                if (wrap) wrap.style.display = "none";
              }}
            />
            {heroImageDarkUrl && !darkImageFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="theme-engraving-dark"
                src={optimizedHeroSrc(heroImageDarkUrl)}
                alt={heroImageAlt ?? name}
                loading="lazy"
                onError={() => setDarkImageFailed(true)}
              />
            ) : null}
          </div>
        )}

        <div className="v2-country-card__stats">
          {stats.map((stat) => (
            <div key={stat.label} className="v2-country-card__stat">
              <span className="v2-country-card__stat-label">{stat.label}</span>
              <span className="v2-country-card__stat-value">
                {stat.value}
                {stat.year && (
                  <span className="v2-country-card__stat-year">
                    {" "}
                    ({stat.year})
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}
