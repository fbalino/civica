"use client";

import { dispatchCivicaAsk } from "@/lib/shell/events";

/**
 * Small client island for the per-bill "Ask Civica" trigger.
 *
 * Dispatches a `civica:ask` CustomEvent on `window`; the factbook
 * `<CivicaAIDrawer>` subscribes and sends the prompt.
 */
export function FactbookBillAskButton({
  title,
  countryName,
}: {
  title: string;
  countryName: string;
}) {
  return (
    <button
      type="button"
      className="factbook-bill-btn factbook-bill-btn--primary"
      onClick={() =>
        dispatchCivicaAsk(
          `Explain "${title}" — what does it actually do, who wins, who loses, and where is it in ${countryName}'s legislative process?`,
        )
      }
    >
      Ask Civica
    </button>
  );
}
