import type { ReactNode } from "react";

type BannerVariant = "warn" | "success" | "danger" | "info";

interface BannerProps {
  children: ReactNode;
  variant?: BannerVariant;
  className?: string;
}

export function Banner({ children, variant = "info", className }: BannerProps) {
  const variantClass = `editorial-banner--${variant}`;
  const composed = ["editorial-banner", variantClass, className]
    .filter(Boolean)
    .join(" ");
  return <div className={composed}>{children}</div>;
}
