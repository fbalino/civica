import { Chip } from "@/components/editorial/Pill";
import { InfoTip } from "@/components/editorial/Tooltip";
import {
  describeDisplayedValueOrigin,
  type DisplayedValueOrigin,
} from "@/lib/provenance/publisher-attribution";

/**
 * ValueOriginNote — the canonical marker for how a displayed value relates to
 * the publisher named beside it (publisher-attribution/v1, CLM-020).
 *
 * - Civica calculation: a blue "Civica calculation" Chip plus an InfoTip with
 *   the registered explanation.
 * - Category produced by applying the publisher's own published rule: the
 *   InfoTip note only.
 * - The publisher's own figure: renders nothing.
 *
 * The explanation is also rendered as screen-reader text, because the InfoTip
 * bubble is only described while it is open. Server-safe: only InfoTip is a
 * client component. Styled by `.value-origin-note` in globals.css (tokens only).
 */
export function ValueOriginNote({ origin }: { origin: DisplayedValueOrigin }) {
  const note = describeDisplayedValueOrigin(origin);
  if (!note) return null;
  return (
    <span className="value-origin-note" data-value-origin={origin.kind}>
      {note.visibleLabel ? (
        <Chip variant="blue" size="sm">
          {note.visibleLabel}
        </Chip>
      ) : null}
      <InfoTip label={note.buttonLabel} content={note.explanation} />
      <span className="sr-only">{note.explanation}</span>
    </span>
  );
}
