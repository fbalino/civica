"use client";

import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";

import {
  readConsent,
  subscribeConsent,
  writeConsent,
  clearConsent,
  type AnalyticsConsentState,
  type AnalyticsConsentDecision,
} from "@/lib/analytics/consent";
import {
  analyticsConfigured,
  capturePageview,
  disableAnalytics,
  loadAnalytics,
} from "@/lib/analytics/posthog";
import {
  applyInternalTrafficParam,
  readInternalTraffic,
  readStoredInternalMark,
  subscribeInternalTraffic,
  writeInternalTraffic,
} from "@/lib/analytics/internal-traffic";

/**
 * Reader-facing analytics consent state.
 *
 * The provider is the ONLY place that may load analytics. It loads nothing
 * until `state === "granted"`, so a reader who has not decided, or who has
 * declined, never contacts the analytics provider. Subscribing through
 * `useSyncExternalStore` mirrors `ThemeProvider`: the server snapshot is
 * `"unknown"`, so the server renders no banner and hydration stays stable.
 */
interface AnalyticsConsentValue {
  state: AnalyticsConsentState;
  /** False when the deployment has no analytics configured at all. */
  configured: boolean;
  /**
   * True when this browser is excluded as internal traffic (`?internal`, or a
   * non-production origin). Suppresses the loader and the banner outright.
   */
  internal: boolean;
  /** True when the exclusion came from an explicit `?internal` mark. */
  internalMarked: boolean;
  decide: (decision: AnalyticsConsentDecision) => void;
  /** Clear the stored decision so the reader is asked again. */
  reset: () => void;
  /** Set or clear the internal-traffic exclusion for this browser. */
  setInternal: (internal: boolean) => void;
}

const AnalyticsConsentContext = createContext<AnalyticsConsentValue>({
  state: "unknown",
  configured: false,
  internal: false,
  internalMarked: false,
  decide: () => {},
  reset: () => {},
  setInternal: () => {},
});

export function useAnalyticsConsent(): AnalyticsConsentValue {
  return useContext(AnalyticsConsentContext);
}

function getServerConsent(): AnalyticsConsentState {
  return "unknown";
}

// The server cannot see the reader's storage or hostname, so it must not
// assume an exclusion in either direction; the client re-renders with the real
// value immediately after hydration.
function getServerInternal(): boolean {
  return false;
}

/**
 * Captures a page view on every resolved route, including App Router client
 * navigations. Rendered only while consent is granted, so it cannot fire for
 * an undecided reader.
 *
 * `useSearchParams` must sit inside a Suspense boundary (see the wrapper
 * below): without one, this root-layout component would opt every statically
 * rendered page in the site into dynamic rendering.
 */
function PageviewReporterInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    const query = searchParams?.toString();
    capturePageview(
      `${window.location.origin}${pathname}${query ? `?${query}` : ""}`,
    );
  }, [pathname, searchParams]);

  return null;
}

function PageviewReporter() {
  return (
    <Suspense fallback={null}>
      <PageviewReporterInner />
    </Suspense>
  );
}

export function AnalyticsConsentProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(
    subscribeConsent,
    readConsent,
    getServerConsent,
  );
  const internal = useSyncExternalStore(
    subscribeInternalTraffic,
    readInternalTraffic,
    getServerInternal,
  );
  const internalMarked = useSyncExternalStore(
    subscribeInternalTraffic,
    () => readStoredInternalMark() === "on",
    getServerInternal,
  );
  const configured = analyticsConfigured();

  // `?internal` is applied before the load effect below runs, so a first visit
  // carrying the parameter never loads analytics even once.
  useEffect(() => {
    if (applyInternalTrafficParam() === "on") disableAnalytics();
  }, []);

  const granted = configured && !internal && state === "granted";

  useEffect(() => {
    if (granted) loadAnalytics();
  }, [granted]);

  // Marking a browser internal mid-session stops anything already running and
  // discards its identifier, rather than waiting for the next page load.
  useEffect(() => {
    if (internal) disableAnalytics();
  }, [internal]);

  const decide = useCallback((decision: AnalyticsConsentDecision) => {
    writeConsent(decision);
    if (decision === "denied") disableAnalytics();
  }, []);

  const reset = useCallback(() => {
    clearConsent();
    disableAnalytics();
  }, []);

  const setInternal = useCallback((next: boolean) => {
    writeInternalTraffic(next ? "on" : "off");
    if (next) disableAnalytics();
  }, []);

  return (
    <AnalyticsConsentContext.Provider
      value={{ state, configured, internal, internalMarked, decide, reset, setInternal }}
    >
      {children}
      {granted ? <PageviewReporter /> : null}
    </AnalyticsConsentContext.Provider>
  );
}
