import Link from "next/link";
import { CountryFlag } from "@/components/CountryFlag";
import { Reveal } from "@/components/motion/Reveal";
import type { JurisdictionStatusPresentation } from "@/lib/jurisdictions/status-presentation";
import { comparePublicLabels } from "@/lib/i18n/presentation";

export interface CountryDirectoryEntry {
  id?: string | number;
  slug: string;
  name: string;
  iso2: string | null;
  continent?: string | null;
  status?: JurisdictionStatusPresentation;
}

interface CountryDirectoryProps {
  countries: ReadonlyArray<CountryDirectoryEntry>;
  hrefPrefix: string;
  queryParam?: string;
  animated?: boolean;
}

/**
 * The unmarked default of the directory. UN member states are the baseline
 * case, so repeating their label 193 times is noise; every OTHER status
 * (observer state, dependency, associated state, disputed, special area)
 * stays visibly labeled per jurisdiction-status/v1, and the full sourced
 * status disclosure lives on each profile.
 */
const DEFAULT_STATUS_LABEL = "UN member state";

function indexLetter(name: string): string {
  const first = name.trim().charAt(0).toUpperCase();
  return first >= "A" && first <= "Z" ? first : "#";
}

function destination(
  hrefPrefix: string,
  queryParam: string | undefined,
  slug: string,
): string {
  if (queryParam) {
    return `${hrefPrefix}?${queryParam}=${encodeURIComponent(slug)}`;
  }
  return `${hrefPrefix}/${encodeURIComponent(slug)}`;
}

/**
 * Canonical A–Z country directory used by country and evidence browse pages.
 * Callers own filtering and destination semantics; this component owns the
 * shared alphabet grouping, flags, status labels, and responsive layout.
 * Rows are single-line: flag slot, name, and a muted status suffix only for
 * non-default entries.
 */
export function CountryDirectory({
  countries,
  hrefPrefix,
  queryParam,
  animated = false,
}: CountryDirectoryProps) {
  const byLetter = new Map<string, CountryDirectoryEntry[]>();
  for (const country of [...countries].sort((a, b) =>
    comparePublicLabels(a.name, b.name),
  )) {
    const letter = indexLetter(country.name);
    const bucket = byLetter.get(letter);
    if (bucket) bucket.push(country);
    else byLetter.set(letter, [country]);
  }
  const groups = [...byLetter.entries()].sort(([a], [b]) =>
    comparePublicLabels(a, b),
  );

  const rows = groups.map(([letter, entries]) => (
    <section
      key={letter}
      id={`country-letter-${letter}`}
      className="country-directory__group"
      aria-label={`Countries starting with ${letter}`}
    >
      <div className="country-directory__heading">
        <span className="country-directory__letter">{letter}</span>
        <span className="country-directory__count">
          {entries.length} {entries.length === 1 ? "entry" : "entries"}
        </span>
      </div>
      <div className="country-directory__entries">
        {entries.map((country) => {
          const statusLabel =
            country.status && country.status.label !== DEFAULT_STATUS_LABEL
              ? country.status.label
              : null;
          return (
            <Link
              key={country.id ?? country.slug}
              href={destination(hrefPrefix, queryParam, country.slug)}
              className="country-directory__item"
            >
              <span className="country-directory__flag" aria-hidden="true">
                <CountryFlag iso2={country.iso2} size={21} decorative />
              </span>
              <span className="country-directory__name">
                <span className="country-directory__label">{country.name}</span>
                {statusLabel ? (
                  <span className="country-directory__status">
                    <span
                      className="country-directory__status-separator"
                      aria-hidden="true"
                    >
                      ·
                    </span>
                    {statusLabel}
                  </span>
                ) : null}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  ));

  return animated ? (
    <Reveal className="country-directory" amount={0.05}>
      {rows}
    </Reveal>
  ) : (
    <div className="country-directory">{rows}</div>
  );
}
