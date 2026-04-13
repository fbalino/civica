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
    <div className="flex flex-col gap-1.5 p-4 rounded-[var(--radius-lg)] bg-[var(--color-surface-alt)] border border-[var(--color-border-muted)] card-hover">
      <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
        {label}
      </span>
      <div className="flex items-baseline gap-1.5">
        <span className="font-heading text-2xl font-medium tracking-tight text-[var(--color-text-primary)]">
          {value}
        </span>
        {unit && (
          <span className="text-sm text-[var(--color-text-tertiary)]">
            {unit}
          </span>
        )}
        {trend && (
          <span
            className={`text-xs ${
              trend === "up"
                ? "text-[var(--color-source-live)]"
                : trend === "down"
                  ? "text-red-500"
                  : "text-[var(--color-text-tertiary)]"
            }`}
          >
            {trend === "up" ? "\u2191" : trend === "down" ? "\u2193" : "\u2192"}
          </span>
        )}
        {source && retrievedAt && (
          <SourceDot source={source} retrievedAt={retrievedAt} />
        )}
      </div>
      {year && (
        <span className="text-xs text-[var(--color-text-tertiary)]">
          {year} est.
        </span>
      )}
    </div>
  );
}
