/**
 * publisher-attribution/v1 (CLM-020, APR-D174): how a displayed value relates
 * to the publisher named beside it.
 *
 * A number shown next to a publisher's name, source label, or SourceDot is
 * either that publisher's own figure (`publisher_published`), a category
 * Civica produced by applying the publisher's own published rule to captured
 * publisher figures (`publisher_rule_applied`, never a number), or a Civica
 * calculation (`civica_calculation`) that the reader must see marked as such.
 *
 * This module is UI-safe: types, labels, and the registered explanations of
 * Civica calculations only. The surface registry, the value checks, and the
 * static scan live in sibling modules so the reader bundle never carries them.
 */

export const PUBLISHER_ATTRIBUTION_VERSION = "publisher-attribution/v1" as const;

export type DisplayedValueOrigin =
  | { kind: "publisher_published" }
  | {
      /** A category only; a rule-applied value never prints a number. */
      kind: "publisher_rule_applied";
      ruleId: string;
      /** Reader explanation of the edition and the applied rule. */
      note: string;
    }
  | { kind: "civica_calculation"; transformationId: string };

export type DisplayedValueOriginKind = DisplayedValueOrigin["kind"];

export type PublisherValueOrigin = Extract<
  DisplayedValueOrigin,
  { kind: "publisher_published" | "publisher_rule_applied" }
>;

export type CivicaCalculationOrigin = Extract<
  DisplayedValueOrigin,
  { kind: "civica_calculation" }
>;

/** Visible marker text for a Civica calculation beside a publisher's name. */
export const CIVICA_CALCULATION_LABEL = "Civica calculation";

/** Column header for a table column that holds Civica calculations. */
export const CIVICA_CALCULATION_COLUMN_LABEL = "Civica calculation / year";

export interface CivicaCalculationDisclosure {
  /** Conditions component the calculation transforms. */
  componentId: string;
  /** Publisher source ids whose figure is the calculation's only input. */
  publisherSourceIds: readonly string[];
  /** Fixed bounds of the publisher's native scale used by the transform. */
  lowerBound: number;
  upperBound: number;
  direction: "higher_is_better" | "lower_is_better";
  /** Plain-language explanation shown to readers beside the number. */
  summary: string;
}

/**
 * Reader explanation for every registered Civica calculation that may appear
 * beside a publisher's name. The component, bounds, and direction must equal
 * the frozen Conditions parameter contract
 * (`EXPECTED_PARAMETER_CONTRACT` in `src/lib/conditions/release-live-validation.ts`);
 * the publisher-attribution tests and scan fail when they drift.
 */
export const CIVICA_CALCULATION_DISCLOSURES: Readonly<
  Record<string, CivicaCalculationDisclosure>
> = Object.freeze({
  "conditions-hdi-fixed-bound/v2": {
    componentId: "hdi",
    publisherSourceIds: ["undp_hdi"],
    lowerBound: 0,
    upperBound: 1,
    direction: "higher_is_better",
    summary:
      "Civica multiplied UNDP's Human Development Index value (0 to 1) by 100. UNDP's own value is listed with the components.",
  },
  "conditions-gpi-fixed-bound/v2": {
    componentId: "global_peace_index",
    publisherSourceIds: ["global_peace_index"],
    lowerBound: 1,
    upperBound: 5,
    direction: "lower_is_better",
    summary:
      "Civica converted the Global Peace Index score, where 1 is most peaceful and 5 least peaceful, to a 0 to 100 position: (5 − score) ÷ 4 × 100. The Institute for Economics & Peace's own score is listed with the components.",
  },
});

export function civicaCalculationDisclosure(
  transformationId: string,
): CivicaCalculationDisclosure | null {
  return CIVICA_CALCULATION_DISCLOSURES[transformationId] ?? null;
}

export interface DisplayedValueOriginDescription {
  /** Visible marker text, or null when only the explanation is shown. */
  visibleLabel: string | null;
  /** Accessible name of the InfoTip trigger. */
  buttonLabel: string;
  /** The explanation, shown in the InfoTip and as screen-reader text. */
  explanation: string;
}

/**
 * Reader presentation for a displayed value's origin. A publisher's own figure
 * needs no note; a rule-applied category gets its rule note; a Civica
 * calculation gets the visible marker plus its registered explanation. An
 * unregistered transformation still renders the marker (the UI fails safe);
 * the scan and value checks fail closed on it.
 */
export function describeDisplayedValueOrigin(
  origin: DisplayedValueOrigin,
): DisplayedValueOriginDescription | null {
  switch (origin.kind) {
    case "publisher_published":
      return null;
    case "publisher_rule_applied":
      return {
        visibleLabel: null,
        buttonLabel: "How this status was determined",
        explanation: origin.note,
      };
    case "civica_calculation": {
      const disclosure = civicaCalculationDisclosure(origin.transformationId);
      return {
        visibleLabel: CIVICA_CALCULATION_LABEL,
        buttonLabel: "How Civica calculated this number",
        explanation:
          disclosure?.summary ??
          `Civica calculated this number (method ${origin.transformationId}).`,
      };
    }
  }
}

/** Fixed-bound map of a publisher figure to Civica's 0 to 100 position. */
export function fixedBoundPosition(
  disclosure: Pick<
    CivicaCalculationDisclosure,
    "lowerBound" | "upperBound" | "direction"
  >,
  rawValue: number,
): number {
  const span = disclosure.upperBound - disclosure.lowerBound;
  const share =
    disclosure.direction === "higher_is_better"
      ? (rawValue - disclosure.lowerBound) / span
      : (disclosure.upperBound - rawValue) / span;
  return Math.min(100, Math.max(0, share * 100));
}
