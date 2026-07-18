import {
  buildSourceDotDisclosure,
  type SourcePresentationState,
  type SourceRightsDisclosure,
} from "@/lib/data/sources";

export function SourceDot({
  source,
  retrievedAt,
  state,
  upstreamVintage,
  rights,
}: {
  source: string;
  retrievedAt: string | Date | null | undefined;
  /** Defaults to the source's registered live/frozen state. */
  state?: SourcePresentationState;
  /** Publisher vintage when this surface has one; absence stays explicit. */
  upstreamVintage?: string | null;
  /** Optional row-specific terms; otherwise the compact registry is used. */
  rights?: SourceRightsDisclosure;
}) {
  const disclosure = buildSourceDotDisclosure({
    source,
    retrievedAt,
    state,
    upstreamVintage,
    rights,
  });
  const ariaLabel = [
    `Source: ${disclosure.label}`,
    `state: ${disclosure.stateLabel}`,
    `source timestamp: ${disclosure.timestamp}`,
    `upstream vintage: ${disclosure.upstreamVintage}`,
    `rights: ${disclosure.rightsLabel}`,
  ].join("; ");

  return (
    <span
      className={`source-dot source-dot--${disclosure.state}`}
      data-source={disclosure.label}
      data-state={disclosure.stateLabel}
      data-date={disclosure.timestamp}
      data-vintage={`Upstream vintage: ${disclosure.upstreamVintage}`}
      data-rights={`Rights: ${disclosure.rightsLabel}`}
      role="img"
      tabIndex={0}
      aria-label={ariaLabel}
    />
  );
}
