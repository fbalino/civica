"use client";

import { dispatchCivicaAsk } from "@/lib/shell/events";

/**
 * Small client island for the per-bill "Ask Civica" trigger.
 *
 * Dispatches a `civica:ask` CustomEvent on `window`. The factbook
 * `<CivicaAIDrawer>` doesn't currently subscribe to this event — the
 * wiring is in place for when it does. In the meantime the click is a
 * no-op visually: the rest of the FactbookBills surface stays a server
 * component.
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
