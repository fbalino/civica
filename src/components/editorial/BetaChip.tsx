import type { CSSProperties, ReactNode } from "react";
import { Chip } from "./Pill";

/*
 * BetaChip — the single canonical "Beta" pill for the whole site.
 *
 * It is the sand Chip (design-system §2: sans, mixed-case, tonal warning wash,
 * fully rounded). This one component replaces the four hand-rolled class
 * families that previously each re-implemented the same look:
 *   .ci-beta-pill (civica-index.css)
 *   .editorial-beta-tag (editorial.css)
 *   .factbook-reconciliation-notice__beta (factbook.css)
 *
 * Use it for the Index Beta tag, methodology Beta tags, reconciliation version
 * tags, and advisory-board status. Content defaults to "Beta" but can be any
 * short status label (e.g. a version string).
 */

interface BetaChipProps {
  /** Chip content. Defaults to "Beta". */
  children?: ReactNode;
  /**
   * When true, applies the inline-with-a-heading spacing (left margin +
   * vertical-align) that the old `.editorial-beta-tag` carried next to an <h1>.
   */
  inHeading?: boolean;
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
  title?: string;
}

const HEADING_STYLE: CSSProperties = {
  marginLeft: "var(--space-3)",
  verticalAlign: "middle",
};

export function BetaChip({
  children = "Beta",
  inHeading = false,
  className,
  style,
  "aria-label": ariaLabel,
  title,
}: BetaChipProps) {
  return (
    <Chip
      variant="sand"
      size="sm"
      className={className}
      style={inHeading ? { ...HEADING_STYLE, ...style } : style}
      aria-label={ariaLabel}
      title={title}
    >
      {children}
    </Chip>
  );
}
