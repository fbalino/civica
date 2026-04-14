import { SourceDot } from "./SourceDot";

interface StatCardProps {
  label: string;
  value: string;
  unit?: string;
  year?: number;
  source?: string;
  retrievedAt?: string;
  trend?: "up" | "down" | "stable";
}

export function StatCard({
  label,
  value,
  unit,
  year,
  source,
  retrievedAt,
  trend,
}: StatCardProps) {
  return (
    <div className="cv-card" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span className="section-header" style={{ marginBottom: 0 }}>
        {label}
      </span>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "var(--text-24)",
            letterSpacing: "var(--tracking-tight)",
            color: "var(--color-text-primary)",
          }}
        >
          {value}
        </span>
        {unit && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-12)", color: "var(--color-text-30)" }}>
            {unit}
          </span>
        )}
        {trend && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-12)",
              color: trend === "up" ? "var(--color-source-live)" : trend === "down" ? "#E44040" : "var(--color-text-30)",
            }}
          >
            {trend === "up" ? "\u2191" : trend === "down" ? "\u2193" : "\u2192"}
          </span>
        )}
        {source && retrievedAt && (
          <SourceDot source={source} retrievedAt={retrievedAt} />
        )}
      </div>
      {year && (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-10)", color: "var(--color-text-30)" }}>
          {year} est.
        </span>
      )}
    </div>
  );
}
