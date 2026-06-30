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
}: CountryHoverCardProps) {
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
              <span className="v2-country-card__chip">
                <Chip variant="neutral">{officialName}</Chip>
              </span>
            ) : null}
          </div>
        </header>

        {heroImageUrl && (
          <div className="v2-country-card__hero">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroImageUrl}
              alt={heroImageAlt ?? name}
              loading="lazy"
              onError={(e) => {
                // Gracefully hide the banner if the engraving 404s.
                const wrap = e.currentTarget.parentElement;
                if (wrap) wrap.style.display = "none";
              }}
            />
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
