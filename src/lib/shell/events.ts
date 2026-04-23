// Cross-component events for the three-pane shell.
//
// Problem: in the legacy Atlas, clicking "Ask AI" on a bill card writes
// directly into the chat textarea via a shared React ref (chatInputRef).
// When chat moves into its own route slot under (shell)/*/@right, refs can
// no longer cross the pane boundary. Passing a callback down also doesn't
// work — the triggers (bill cards, future structure-diagram tooltips, etc.)
// live in different route segments from the chat.
//
// Solution: a tiny typed CustomEvent bus on `window`. AskCivicaPanel
// listens (gated by `listenForExternalAsk`); triggers dispatch.

export const CIVICA_ASK_EVENT = "civica:ask";

export interface CivicaAskDetail {
  /** The question/prompt to send to Ask Civica. */
  question: string;
  /**
   * If true (default), the panel auto-sends immediately. If false, it just
   * pre-fills the textarea so the user can edit before sending.
   */
  autoSend?: boolean;
}

export function dispatchCivicaAsk(
  question: string,
  opts: { autoSend?: boolean } = {},
): void {
  if (typeof window === "undefined") return;
  const detail: CivicaAskDetail = {
    question,
    autoSend: opts.autoSend ?? true,
  };
  window.dispatchEvent(new CustomEvent(CIVICA_ASK_EVENT, { detail }));
}

// Typed helper for listeners. Returns a cleanup function.
export function onCivicaAsk(
  handler: (detail: CivicaAskDetail) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => {
    const custom = e as CustomEvent<CivicaAskDetail>;
    if (custom.detail) handler(custom.detail);
  };
  window.addEventListener(CIVICA_ASK_EVENT, listener);
  return () => window.removeEventListener(CIVICA_ASK_EVENT, listener);
}
