import type { ReactNode } from "react";

type PillVariant = "default" | "accent" | "success" | "warn" | "danger";
type PillSize = "sm" | "md";

const VARIANT_COLOR: Record<PillVariant, string> = {
  default: "var(--color-text-40)",
  accent: "var(--color-accent)",
  success: "var(--color-status-success)",
  warn: "var(--color-status-warning)",
  danger: "var(--color-status-danger)",
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
  const color = VARIANT_COLOR[variant];
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        border: `1px solid ${color}`,
        background: `color-mix(in oklch, ${color} 16%, var(--color-page-bg) 84%)`,
        color: variant === "warn" ? "var(--color-on-warning)" : "var(--color-text-primary)",
        borderRadius: "var(--radius-sm)",
        padding: size === "sm" ? "2px 7px" : "4px 10px",
        fontFamily: "var(--font-mono)",
        fontSize: size === "sm" ? "var(--text-10)" : "var(--text-12)",
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
