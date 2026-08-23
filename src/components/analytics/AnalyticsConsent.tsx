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
  decide: (decision: AnalyticsConsentDecision) => void;
  /** Clear the stored decision so the reader is asked again. */
  reset: () => void;
}

const AnalyticsConsentContext = createContext<AnalyticsConsentValue>({
  state: "unknown",
  configured: false,
  decide: () => {},
  reset: () => {},
});

export function useAnalyticsConsent(): AnalyticsConsentValue {
  return useContext(AnalyticsConsentContext);
}

function getServerConsent(): AnalyticsConsentState {
  return "unknown";
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
  const configured = analyticsConfigured();
  const granted = configured && state === "granted";

  useEffect(() => {
    if (granted) loadAnalytics();
  }, [granted]);

  const decide = useCallback((decision: AnalyticsConsentDecision) => {
    writeConsent(decision);
    if (decision === "denied") disableAnalytics();
  }, []);

  const reset = useCallback(() => {
    clearConsent();
    disableAnalytics();
  }, []);

  return (
    <AnalyticsConsentContext.Provider
      value={{ state, configured, decide, reset }}
    >
      {children}
      {granted ? <PageviewReporter /> : null}
    </AnalyticsConsentContext.Provider>
  );
}
