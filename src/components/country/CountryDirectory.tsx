import Link from "next/link";
import { CountryFlag } from "@/components/CountryFlag";
import { Reveal } from "@/components/motion/Reveal";
import type { JurisdictionStatusPresentation } from "@/lib/jurisdictions/status-presentation";

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

function indexLetter(name: string): string {
  const first = name.trim().charAt(0).toUpperCase();
  return first >= "A" && first <= "Z" ? first : "#";
}

function regionDot(continent: string | null | undefined): string {
  switch (continent) {
    case "Africa":
      return "var(--color-status-warning)";
    case "North America":
    case "South America":
      return "var(--color-accent)";
    case "Asia":
      return "var(--color-status-info)";
    case "Europe":
      return "var(--color-status-success)";
    case "Oceania":
    case "Antarctica":
      return "var(--gov-semi)";
    default:
      return "var(--color-text-30)";
  }
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
 * shared alphabet grouping, flags, region signals, and responsive layout.
 */
export function CountryDirectory({
  countries,
  hrefPrefix,
  queryParam,
  animated = false,
}: CountryDirectoryProps) {
  const byLetter = new Map<string, CountryDirectoryEntry[]>();
  for (const country of [...countries].sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const letter = indexLetter(country.name);
    const bucket = byLetter.get(letter);
    if (bucket) bucket.push(country);
    else byLetter.set(letter, [country]);
  }
  const groups = [...byLetter.entries()].sort(([a], [b]) => a.localeCompare(b));

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
      {entries.map((country) => (
        <Link
          key={country.id ?? country.slug}
          href={destination(hrefPrefix, queryParam, country.slug)}
          className="country-directory__item"
        >
          <span className="country-directory__flag" aria-hidden="true">
            <CountryFlag iso2={country.iso2} size={21} />
          </span>
          <span className="country-directory__name">
            {country.name}
            {country.status ? (
              <span className="country-directory__status">
                {country.status.label}
              </span>
            ) : null}
          </span>
          <span
            className="country-directory__dot"
            style={{ background: regionDot(country.continent) }}
            aria-hidden="true"
          />
        </Link>
      ))}
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
