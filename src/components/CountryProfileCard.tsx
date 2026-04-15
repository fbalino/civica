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
    <div className="cv-card" style={{ overflow: "hidden", padding: 0 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "16px 20px",
          borderBottom: "1px solid var(--color-stat-border)",
        }}
      >
        {flagUrl && (
          <img
            src={flagUrl}
            alt={`${name} flag`}
            style={{ width: 40, height: 28, objectFit: "cover", borderRadius: 2 }}
          />
        )}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <a
            href={`/countries/${slug}`}
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "var(--text-24)",
              letterSpacing: "var(--tracking-tight)",
              color: "var(--color-text-primary)",
              textDecoration: "none",
            }}
          >
            {name}
          </a>
          {continent && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: "var(--font-weight-mono)",
                fontSize: "var(--text-10)",
                textTransform: "uppercase",
                letterSpacing: "var(--tracking-wider)",
                color: "var(--color-text-30)",
                marginTop: 2,
              }}
            >
              {continent}
            </span>
          )}
        </div>
      </div>

      <dl style={{ margin: 0 }}>
        {rows.map((row) => (
          <div
            key={row.label}
            className="stat-row"
            style={{ paddingLeft: 20, paddingRight: 20 }}
          >
            <span className="stat-row__label">{row.label}</span>
            <span className="stat-row__value">
              {row.value}
              {source && retrievedAt && (
                <SourceDot source={source} retrievedAt={retrievedAt} />
              )}
            </span>
          </div>
        ))}
      </dl>
    </div>
  );
}
