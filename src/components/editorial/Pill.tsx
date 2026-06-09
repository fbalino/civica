import type { ReactNode } from "react";

type PillVariant = "default" | "accent" | "success" | "warn" | "danger" | "info";
type PillSize = "sm" | "md";

/*
 * v2 Pill — vivid, tonal. Each variant gets:
 *   - a tinted fill (22% of the variant color blended with transparent),
 *   - a same-hue border at 40% alpha,
 *   - darker variant-hue text (variant ↘ 30% black via color-mix),
 *
 * which keeps Pills readable against the parchment page bg while
 * making each tone visually distinct. Replaces the v1 16%-blend +
 * `--color-text-primary` approach (which read flat).
 */
const VARIANT_TOKEN: Record<PillVariant, string> = {
  default: "var(--color-text-40)",
  accent:  "var(--color-accent)",
  success: "var(--color-status-success)",
  warn:    "var(--color-status-warning)",
  danger:  "var(--color-status-danger)",
  info:    "var(--color-status-info)",
};

interface PillProps {
  children: ReactNode;
  variant?: PillVariant;
  size?: PillSize;
  className?: string;
}

export function Pill({
  children,
  variant = "default",
  size = "sm",
  className,
}: PillProps) {
  const tone = VARIANT_TOKEN[variant];
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        background: `color-mix(in oklab, ${tone} 22%, transparent)`,
        border: `1px solid color-mix(in oklab, ${tone} 40%, transparent)`,
        color: `color-mix(in oklab, ${tone}, black 30%)`,
        borderRadius: "var(--radius-sm)",
        padding: size === "sm" ? "2px 7px" : "4px 10px",
        fontFamily: "var(--font-mono)",
        fontSize: size === "sm" ? "var(--text-12)" : "var(--text-13)",
        fontWeight: "var(--font-weight-mono)",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}
