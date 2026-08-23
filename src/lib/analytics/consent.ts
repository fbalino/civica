/**
 * Canonical visitor analytics-consent contract.
 *
 * Civica loads NO product-analytics code until a reader explicitly grants
 * consent. This module owns the whole decision state — the storage key, the
 * closed state set, the version stamp that forces a fresh ask when the
 * disclosed practice changes, and the change notification other client
 * components subscribe to.
 *
 * Storage is the reader's own `localStorage`, not a cookie: a visitor who has
 * not decided, or who has declined, is never given an identifier of any kind
 * and never causes a request to the analytics provider. See
 * `src/lib/analytics/posthog.ts` for the loader this gates and
 * `src/lib/privacy/data-handling.ts` (flow `product-analytics`) for the
 * disclosure that must stay consistent with it.
 */

export const ANALYTICS_CONSENT_VERSION = "civica-analytics-consent/v1" as const;

/** Reader-owned localStorage key. Never a cookie — see the module note. */
export const ANALYTICS_CONSENT_STORAGE_KEY = "civica.analytics-consent";

/** Dispatched on the window whenever the stored decision changes. */
export const ANALYTICS_CONSENT_EVENT = "civica-analytics-consent-change";

/**
 * Closed decision set.
 *
 * `unknown` is the server/pre-hydration state: the server cannot read the
 * reader's browser storage, so it must not assume a decision in either
 * direction. Only `granted` may load analytics; `pending` is the only state
 * that shows the consent banner.
 */
export type AnalyticsConsentState = "unknown" | "pending" | "granted" | "denied";

/** A decision a reader can actually make. */
export type AnalyticsConsentDecision = Extract<
  AnalyticsConsentState,
  "granted" | "denied"
>;

interface StoredConsent {
  version: string;
  state: AnalyticsConsentDecision;
  decidedAt: string;
}

/**
 * Parse a stored record. Anything unreadable, unversioned, or written under a
 * superseded contract version resolves to `pending` so the reader is asked
 * again rather than silently held to a decision about different practices.
 */
export function parseStoredConsent(raw: string | null): AnalyticsConsentState {
  if (!raw) return "pending";
  try {
    const parsed = JSON.parse(raw) as Partial<StoredConsent> | null;
    if (!parsed || parsed.version !== ANALYTICS_CONSENT_VERSION) return "pending";
    if (parsed.state === "granted" || parsed.state === "denied") return parsed.state;
    return "pending";
  } catch {
    return "pending";
  }
}

/** Serialize a decision. `now` is injected so this stays pure and testable. */
export function serializeConsent(
  state: AnalyticsConsentDecision,
  now: Date,
): string {
  const record: StoredConsent = {
    version: ANALYTICS_CONSENT_VERSION,
    state,
    decidedAt: now.toISOString(),
  };
  return JSON.stringify(record);
}

/** Read the current decision from the reader's browser. */
export function readConsent(): AnalyticsConsentState {
  if (typeof window === "undefined") return "unknown";
  try {
    return parseStoredConsent(
      window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY),
    );
  } catch {
    // Storage can be unavailable (private mode, blocked storage). Fail closed:
    // an unreadable decision is not consent.
    return "pending";
  }
}

/** Persist a decision and notify subscribers in this tab. */
export function writeConsent(state: AnalyticsConsentDecision): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      ANALYTICS_CONSENT_STORAGE_KEY,
      serializeConsent(state, new Date()),
    );
  } catch {
    // A reader who cannot persist a decision still gets the in-page effect
    // below; they will simply be asked again on their next visit.
  }
  window.dispatchEvent(new Event(ANALYTICS_CONSENT_EVENT));
}

/** Clear the decision so the reader is asked again. */
export function clearConsent(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ANALYTICS_CONSENT_STORAGE_KEY);
  } catch {
    /* see writeConsent */
  }
  window.dispatchEvent(new Event(ANALYTICS_CONSENT_EVENT));
}

/** Subscribe to decision changes in this tab and across tabs. */
export function subscribeConsent(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(ANALYTICS_CONSENT_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(ANALYTICS_CONSENT_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}
