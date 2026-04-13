import { SourceDot } from "./SourceDot";

interface CountryProfileCardProps {
  name: string;
  slug: string;
  flagUrl?: string;
  governmentType?: string;
  capital?: string;
  population?: number;
  gdpBillions?: number;
  areaSqKm?: number;
  languages?: string;
  currency?: string;
  continent?: string;
  source?: string;
  retrievedAt?: string;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString();
}

function formatArea(n: number): string {
  return `${n.toLocaleString()} km\u00B2`;
}

export function CountryProfileCard({
  name,
  slug,
  flagUrl,
  governmentType,
  capital,
  population,
  gdpBillions,
  areaSqKm,
  languages,
  currency,
  continent,
  source,
  retrievedAt,
}: CountryProfileCardProps) {
  const rows: { label: string; value: string }[] = [];
  if (capital) rows.push({ label: "Capital", value: capital });
  if (governmentType) rows.push({ label: "Government", value: governmentType });
  if (population) rows.push({ label: "Population", value: formatNumber(population) });
  if (gdpBillions) rows.push({ label: "GDP", value: `$${gdpBillions.toFixed(1)}B` });
  if (areaSqKm) rows.push({ label: "Area", value: formatArea(areaSqKm) });
  if (languages) rows.push({ label: "Languages", value: languages });
  if (currency) rows.push({ label: "Currency", value: currency });

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-elevated)] overflow-hidden">
      {/* Header with flag and name */}
      <div className="flex items-center gap-4 px-6 py-5 border-b border-[var(--color-border-muted)]">
        {flagUrl && (
          <img
            src={flagUrl}
            alt={`${name} flag`}
            className="w-10 h-7 object-cover rounded-[var(--radius-sm)] shadow-sm"
          />
        )}
        <div className="flex flex-col">
          <a
            href={`/countries/${slug}`}
            className="font-heading text-2xl font-medium tracking-tight text-[var(--color-text-primary)] hover:text-[var(--color-accent-text)] transition-colors no-underline"
          >
            {name}
          </a>
          {continent && (
            <span className="text-xs uppercase tracking-wide text-[var(--color-text-tertiary)] mt-0.5">
              {continent}
            </span>
          )}
        </div>
      </div>

      {/* Fact rows */}
      <dl className="divide-y divide-[var(--color-border-muted)]">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex justify-between items-baseline px-6 py-3"
          >
            <dt className="text-sm text-[var(--color-text-secondary)]">
              {row.label}
            </dt>
            <dd className="text-sm font-medium text-[var(--color-text-primary)] flex items-center gap-0">
              {row.value}
              {source && retrievedAt && (
                <SourceDot source={source} retrievedAt={retrievedAt} />
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
