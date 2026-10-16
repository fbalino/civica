"use client";

/**
 * Fetches the reconciliation detail for one fact when its source panel opens.
 *
 * Country pages carry only a compact source reference per value; the decision
 * trace, alternates and rejected rows come from
 * `/api/facts/:jurisdictionId/:factKey/panel` on demand. Results are kept for
 * the life of the tab so reopening a panel is instant. A request that is still
 * pending when the panel closes is aborted, and a hover must persist briefly
 * before any request is sent, so sweeping the pointer across a column of dots
 * does not spend the reader's request budget.
 */
import { useCallback, useEffect, useState } from "react";
import type { FactSourcePanel } from "@/lib/api/contract/fact-source-panel";
import type { FactValuePanelState } from "./FactValuePanel";

const HOVER_FETCH_DELAY_MS = 250;

const cache = new Map<string, FactSourcePanel>();

function panelUrl(jurisdictionId: string, factKey: string): string {
  return `/api/facts/${encodeURIComponent(jurisdictionId)}/${encodeURIComponent(factKey)}/panel`;
}

export function useFactSourcePanel(args: {
  jurisdictionId: string;
  factKey: string;
  /** The panel is open. */
  open: boolean;
  /** Opened by click or keyboard: fetch immediately. Hover waits briefly. */
  pinned: boolean;
}): { state: FactValuePanelState; retry: () => void } {
  const { jurisdictionId, factKey, open, pinned } = args;
  const key = `${jurisdictionId}/${factKey}`;
  const [fetched, setFetched] = useState<{
    key: string;
    result: FactValuePanelState;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);

  const cached = cache.get(key);
  const settled = fetched && fetched.key === key ? fetched.result : null;
  const state: FactValuePanelState = cached
    ? { status: "ready", panel: cached }
    : (settled ?? { status: "loading" });

  useEffect(() => {
    if (!open || cache.has(key)) return;
    const controller = new AbortController();
    const timer = setTimeout(
      async () => {
        try {
          const response = await fetch(panelUrl(jurisdictionId, factKey), {
            signal: controller.signal,
            headers: { Accept: "application/json" },
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          // The server validates the response against `zFactSourcePanel`;
          // the client only guards the schema version it knows how to render.
          const panel = (await response.json()) as FactSourcePanel;
          if (panel.schemaVersion !== "fact-source-panel/v1") {
            throw new Error("Unsupported fact source panel version");
          }
          cache.set(key, panel);
          setFetched({ key, result: { status: "ready", panel } });
        } catch {
          if (controller.signal.aborted) return;
          setFetched({ key, result: { status: "error" } });
        }
      },
      pinned ? 0 : HOVER_FETCH_DELAY_MS,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
      // A panel that closes after a failure starts fresh when reopened.
      setFetched((prev) => (prev?.result.status === "error" ? null : prev));
    };
  }, [open, pinned, key, jurisdictionId, factKey, attempt]);

  const retry = useCallback(() => {
    setFetched(null);
    setAttempt((n) => n + 1);
  }, []);

  return { state, retry };
}
