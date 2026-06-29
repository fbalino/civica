// Cross-component "Ask Civica" event bus.
//
// Problem: clicking "Ask AI" on a bill card needs to drive the Civica AI
// chat, but the trigger (a bill card deep in the atlas/factbook tree) and
// the chat surface live in different component subtrees, so a shared React
// ref or a passed-down callback can't reliably cross the boundary.
//
// Solution: a tiny typed CustomEvent bus on `window`. The chat surface
// (factbook's CivicaAIDrawer) listens; triggers dispatch.

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
