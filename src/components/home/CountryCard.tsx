import Link from "next/link";
import { Chip } from "@/components/editorial/Pill";
import { CountryFlag } from "@/components/CountryFlag";
import { ThemedDecorativeImage } from "@/components/ThemedDecorativeImage";

/*
 * CountryCard (component spec v1 §7) — the recurring rich country data
 * card used on the homepage feature rows (Japan, Estonia).
 *
 * Presentational only: HomeGrid (an async server component) resolves all
 * data and passes it in. Every value is REAL or omitted — a stat with no
 * data is dropped rather than faked, and the income Chip only renders when
 * the canonical world_bank_income_group fact resolved.
 *
 * The country engraving (`/engravings/countries/<iso3>.webp`) is the card
 * image. When a matching `-dark.webp` asset exists, it is passed separately
 * through one CSS-backed themed renderer, so only the active variant loads.
 */

export interface CountryCardStat {
  label: string;
  value: string;
}

export interface CountryCardProps {
  /** Country display name (serif heading). */
  name: string;
  /** Native / official name shown muted below the name. Omitted if absent. */
  nativeName?: string | null;
  /** ISO-3166 alpha-2 code → real SVG flag image. Omitted if absent. */
  iso2?: string | null;
  /** Income-group label for the tonal sage Chip. Omitted if absent. */
  incomeGroup?: string | null;
  /** Pre-formatted, REAL stat columns. Omit any stat with no data. */
  stats: CountryCardStat[];
  /** ISO3 (lowercase) → engraving path. Omitted if no engraving. */
  iso3?: string | null;
  /** Optional dark-mode engraving path for the same ISO3. */
  engravingDarkSrc?: string | null;
  /** Destination for the footer link. */
  href: string;
  /** Footer link label (default "View country profile"). */
  ctaLabel?: string;
}

export function CountryCard({
  name,
  nativeName,
  iso2,
  incomeGroup,
  stats,
  iso3,
  engravingDarkSrc = null,
  href,
  ctaLabel = "View country profile",
}: CountryCardProps) {
  // PROVENANCE_COVERAGE: home.country-card
  const engraving = iso3 ? `/engravings/countries/${iso3}.webp` : null;
  return (
    <div className="country-card">
      <div className="country-card-body">
        <div className="country-card-header">
          {iso2 ? (
            <span className="country-card-flag" aria-hidden="true">
              <CountryFlag iso2={iso2} size={28} decorative />
            </span>
          ) : null}
          <div className="country-card-titles">
            <h3 className="country-card-name">{name}</h3>
            {nativeName ? (
              <p className="country-card-native">{nativeName}</p>
            ) : null}
            {incomeGroup ? (
              <span className="country-card-chip">
                <Chip variant="sage">{incomeGroup}</Chip>
              </span>
            ) : null}
          </div>
        </div>

        {stats.length > 0 ? (
          <div className="country-card-stats">
            {stats.map((s) => (
              <div key={s.label} className="country-card-stat">
                <span className="country-card-stat-label">{s.label}</span>
                <span className="country-card-stat-value">{s.value}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {engraving ? (
        <div className="country-card-img-wrap">
          <ThemedDecorativeImage
            className="country-card-img"
            src={engraving}
            darkSrc={engravingDarkSrc}
          />
        </div>
      ) : null}

      <div className="country-card-footer">
        <Link href={href} className="btn btn--text">
          <span>{ctaLabel}</span>
          <span className="btn__arrow" aria-hidden="true">
            &rarr;
          </span>
        </Link>
      </div>
    </div>
  );
}
