import Link from "next/link";

export type CountryHoverCardStat = {
  label: string;
  value: string;
  year?: string;
};

export type CountryHoverCardProps = {
  name: string;
  officialName: string;
  iso2: string;
  /** Optional. When omitted, the card renders compactly without a hero band. */
  heroImageUrl?: string;
  heroImageAlt?: string;
  stats: [CountryHoverCardStat, CountryHoverCardStat, CountryHoverCardStat];
  ctaHref: string;
  ctaLabel?: string;
};

export function CountryHoverCard({
  name,
  officialName,
  iso2,
  heroImageUrl,
  heroImageAlt,
  stats,
  ctaHref,
  ctaLabel = "View country profile",
}: CountryHoverCardProps) {
  const code = iso2.toLowerCase();
  return (
    <article className="v2-country-card" aria-label={name}>
      <header className="v2-country-card__header">
        <div className="v2-country-card__flag">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://flagcdn.com/w160/${code}.png`}
            srcSet={`https://flagcdn.com/w160/${code}.png 1x, https://flagcdn.com/w320/${code}.png 2x`}
            alt={`Flag of ${name}`}
            width={56}
            height={56}
            loading="lazy"
          />
        </div>
        <div className="v2-country-card__title-stack">
          <h3 className="v2-country-card__name">{name}</h3>
          <p className="v2-country-card__official">{officialName}</p>
        </div>
      </header>

      {heroImageUrl && (
        <div className="v2-country-card__hero">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={heroImageUrl} alt={heroImageAlt ?? name} loading="lazy" />
        </div>
      )}

      <div className="v2-country-card__stats">
        {stats.map((stat) => (
          <div key={stat.label} className="v2-country-card__stat">
            <div className="v2-country-card__stat-label">{stat.label}</div>
            <div className="v2-country-card__stat-value">{stat.value}</div>
            {stat.year && (
              <div className="v2-country-card__stat-year">({stat.year})</div>
            )}
          </div>
        ))}
      </div>

      <Link href={ctaHref} className="v2-country-card__cta">
        {ctaLabel}
        <span aria-hidden className="v2-country-card__cta-arrow">→</span>
      </Link>
    </article>
  );
}
