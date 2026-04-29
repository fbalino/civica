import type { ReactNode } from "react";

type BannerVariant = "warn" | "success" | "danger" | "info";

const VARIANT_COLOR: Record<BannerVariant, string> = {
  warn: "var(--color-status-warning)",
  success: "var(--color-status-success)",
  danger: "var(--color-status-danger)",
  info: "var(--color-status-info)",
};

interface BannerProps {
  children: ReactNode;
  variant?: BannerVariant;
  className?: string;
}

export function Banner({ children, variant = "info", className }: BannerProps) {
  const color = VARIANT_COLOR[variant];
  return (
    <div
      className={className}
      style={{
        background: `color-mix(in oklch, ${color} 10%, var(--color-page-bg) 90%)`,
        border: `1px solid ${color}`,
        borderRadius: "var(--radius-md)",
        color: "var(--color-text-primary)",
      }}
    >
      {children}
    </div>
  );
}
