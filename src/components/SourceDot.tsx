import {
  buildSourceDotDisclosure,
  type SourceDotDisclosure,
  type SourcePresentationState,
  type SourceRightsDisclosure,
} from "@/lib/data/sources";
import { SourceDotLegendTooltips } from "./SourceDotLegendTooltips";

type SourceDotInput = {
  source: string;
  retrievedAt: string | Date | null | undefined;
  /** Defaults to the source's registered live/frozen state. */
  state?: SourcePresentationState;
  /** Publisher vintage when this surface has one; absence stays explicit. */
  upstreamVintage?: string | null;
  /** Optional row-specific terms; otherwise the compact registry is used. */
  rights?: SourceRightsDisclosure;
};

function disclosureAriaLabel(disclosure: SourceDotDisclosure): string {
  return [
    `Source: ${disclosure.label}`,
    `state: ${disclosure.stateLabel}`,
    `source timestamp: ${disclosure.timestamp}`,
    `upstream vintage: ${disclosure.upstreamVintage}`,
    `rights: ${disclosure.rightsLabel}`,
  ].join("; ");
}

function disclosureDataAttributes(disclosure: SourceDotDisclosure) {
  return {
    "data-source": disclosure.label,
    "data-state": disclosure.stateLabel,
    "data-date": disclosure.timestamp,
    "data-vintage": `Upstream vintage: ${disclosure.upstreamVintage}`,
    "data-rights": `Rights: ${disclosure.rightsLabel}`,
  };
}

/** Small deterministic FNV-1a hash; identical on server and client. */
function hashText(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/**
 * DOM id of the shared provenance description for one disclosure inside one
 * legend scope. The scope keeps ids unique when several legends share a page.
 */
function sourceDotDescriptionId(scope: string, disclosure: SourceDotDisclosure): string {
  return `sd-${scope}-${hashText(disclosureAriaLabel(disclosure))}`;
}

/**
 * The canonical provenance dot. By default every dot carries its complete
 * disclosure (source, state, timestamp, upstream vintage, rights) as its
 * accessible name and as the data attributes the CSS tooltip reads.
 *
 * Long fact lists that repeat one disclosure hundreds of times pass
 * `legendScope` instead and render one `<SourceDotLegend>` with the same
 * scope. Each dot then references the shared description by id: screen
 * readers announce the identical text through `aria-labelledby`, and the
 * tooltip copies the same attributes onto the dot on hover, focus, or tap.
 */
export function SourceDot({
  source,
  retrievedAt,
  state,
  upstreamVintage,
  rights,
  legendScope,
}: SourceDotInput & {
  /** Reference a `<SourceDotLegend scope=…>` description instead of
   *  repeating the full disclosure on this dot. */
  legendScope?: string;
}) {
  const disclosure = buildSourceDotDisclosure({
    source,
    retrievedAt,
    state,
    upstreamVintage,
    rights,
  });

  if (legendScope) {
    return (
      <span
        className={`source-dot source-dot--${disclosure.state}`}
        role="img"
        tabIndex={0}
        aria-labelledby={sourceDotDescriptionId(legendScope, disclosure)}
      />
    );
  }

  return (
    <span
      className={`source-dot source-dot--${disclosure.state}`}
      {...disclosureDataAttributes(disclosure)}
      role="img"
      tabIndex={0}
      aria-label={disclosureAriaLabel(disclosure)}
    />
  );
}

/**
 * One shared provenance description per distinct disclosure in a scope.
 * Render it beside the `<SourceDot legendScope=…>` dots it describes, in the
 * same route segment, so the description is always present with its dots.
 */
export function SourceDotLegend({
  scope,
  dots,
}: {
  scope: string;
  dots: SourceDotInput[];
}) {
  const seen = new Set<string>();
  const entries: Array<{ id: string; disclosure: SourceDotDisclosure }> = [];
  for (const dot of dots) {
    const disclosure = buildSourceDotDisclosure(dot);
    const id = sourceDotDescriptionId(scope, disclosure);
    if (seen.has(id)) continue;
    seen.add(id);
    entries.push({ id, disclosure });
  }

  return (
    <>
      {entries.map(({ id, disclosure }) => (
        <span
          key={id}
          id={id}
          hidden
          {...disclosureDataAttributes(disclosure)}
        >
          {disclosureAriaLabel(disclosure)}
        </span>
      ))}
      <SourceDotLegendTooltips />
    </>
  );
}
