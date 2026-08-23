/**
 * Consent-gated PostHog loader.
 *
 * Nothing in this module runs until a reader has explicitly granted consent
 * (`src/lib/analytics/consent.ts`). Before that point Civica loads no
 * analytics script, opens no connection to PostHog, and stores no analytics
 * identifier. Declining, or simply never answering, leaves the reader in
 * exactly the state they were in before this feature existed.
 *
 * PostHog is loaded through its published browser bundle rather than an npm
 * dependency. That is deliberate: several frozen Civica release artifacts (the
 * G2 Atlas candidate, the governance and Atlas review packets) pin
 * `package-lock.json`, so adding a runtime dependency would change the hash of
 * published, immutable research packages. Analytics must not perturb a
 * provenance artifact.
 *
 * `array.js` constructs and assigns `window.posthog` itself when the global is
 * absent, so no inline bootstrap stub is required — we load the bundle, then
 * initialize it on load.
 *
 * Configuration is deliberately minimal — see `ANALYTICS_CAPTURE_POLICY`. The
 * disclosure in `src/lib/privacy/data-handling.ts` (flow `product-analytics`)
 * and the `/privacy` page must stay consistent with the options set here.
 */

/** Public project token. Absent → analytics stays off and no banner is shown. */
export const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";

/** Ingestion host. US cloud unless a region or proxy host is configured. */
export const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

/**
 * The exact capture posture, stated once so the privacy disclosure and the
 * runtime configuration cannot drift apart. Every entry is enforced by a
 * corresponding option in `initOptions()`.
 */
export const ANALYTICS_CAPTURE_POLICY = {
  /** Page views are captured explicitly on navigation, never automatically. */
  pageviews: "manual",
  /** No automatic capture of clicks, form interactions, or on-page text. */
  autocapture: false,
  /** No session replay: Civica never records a reader's screen or input. */
  sessionRecording: false,
  /** No heatmap or mouse-movement capture. */
  heatmaps: false,
  /** No surveys rendered to readers. */
  surveys: false,
  /** No feature-flag evaluation request; Civica ships no reader-facing flags. */
  featureFlags: false,
  /** No person profile is created, because no reader is ever identified. */
  personProfiles: "identified_only",
  /** A browser "Do Not Track" signal suppresses capture even after consent. */
  respectDoNotTrack: true,
} as const;

/** Whether analytics is configured at all in this deployment. */
export function analyticsConfigured(): boolean {
  return POSTHOG_KEY.length > 0;
}

/**
 * Resolve the static-asset origin for an ingestion host. PostHog cloud serves
 * the bundle from a sibling `-assets` host; a self-hosted or reverse-proxied
 * deployment serves it from the ingestion origin itself.
 */
export function posthogAssetHost(host: string = POSTHOG_HOST): string {
  return host.includes(".i.posthog.com")
    ? host.replace(".i.posthog.com", "-assets.i.posthog.com")
    : host;
}

/** Minimal surface of the PostHog browser client that Civica actually calls. */
interface PostHogClient {
  init(key: string, options: Record<string, unknown>): void;
  capture(event: string, properties?: Record<string, unknown>): void;
  opt_out_capturing(): void;
  has_opted_out_capturing(): boolean;
  reset(resetDeviceId?: boolean): void;
}

declare global {
  interface Window {
    posthog?: PostHogClient;
  }
}

function initOptions(): Record<string, unknown> {
  return {
    api_host: POSTHOG_HOST,
    // Page views are captured by the provider on route change so App Router
    // client navigations are recorded once, after the route resolves.
    capture_pageview: false,
    capture_pageleave: true,
    autocapture: false,
    capture_heatmaps: false,
    disable_session_recording: true,
    disable_surveys: true,
    // Civica evaluates no reader-facing feature flags; disabling them removes
    // the flag-evaluation request entirely rather than merely ignoring it.
    advanced_disable_feature_flags: true,
    person_profiles: "identified_only",
    cross_subdomain_cookie: false,
    secure_cookie: true,
    respect_dnt: true,
  };
}

/** Element id for the injected bundle, so the load is idempotent. */
const SCRIPT_ID = "civica-posthog";

let queuedPageview: string | null = null;
let ready = false;

/**
 * Load and initialize PostHog. Safe to call repeatedly; the bundle is fetched
 * at most once per document. Callers must confirm consent first.
 */
export function loadAnalytics(): void {
  if (typeof window === "undefined") return;
  if (!analyticsConfigured()) return;
  if (document.getElementById(SCRIPT_ID)) return;

  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.src = `${posthogAssetHost()}/static/array.js`;
  script.async = true;
  script.crossOrigin = "anonymous";
  script.addEventListener("load", () => {
    window.posthog?.init(POSTHOG_KEY, initOptions());
    ready = true;
    // A page view requested while the bundle was still downloading — most
    // often the very first one — is recorded now rather than dropped.
    if (queuedPageview !== null) {
      window.posthog?.capture("$pageview", { $current_url: queuedPageview });
      queuedPageview = null;
    }
  });
  script.addEventListener("error", () => {
    // A blocked or failed analytics bundle must never surface to the reader.
    queuedPageview = null;
  });
  document.head.appendChild(script);
}

/** Record one page view, queueing it if the bundle has not finished loading. */
export function capturePageview(url: string): void {
  if (typeof window === "undefined") return;
  if (!ready) {
    queuedPageview = url;
    return;
  }
  window.posthog?.capture("$pageview", { $current_url: url });
}

/**
 * Stop capturing and discard the analytics identifier after a reader withdraws
 * consent. The already-loaded bundle cannot be removed from a live document,
 * so this stops it at the source; on the reader's next page load the loader is
 * never reached at all.
 *
 * ORDER MATTERS. `reset()` clears PostHog's persisted state, INCLUDING the
 * opt-out flag — calling it after `opt_out_capturing()` silently re-enables
 * capture. Discard the identifier first, then opt out, then confirm the flag
 * actually took, so a future SDK change cannot quietly turn this into a no-op.
 */
export function disableAnalytics(): boolean {
  if (typeof window === "undefined") return false;
  queuedPageview = null;
  const client = window.posthog;
  if (!client) {
    // Nothing was ever loaded, but a previous visit may have left provider
    // storage behind. Clearing it keeps "off" meaning genuinely off.
    purgeProviderStorage();
    return true;
  }
  try {
    client.reset(true);
    client.opt_out_capturing();
    const optedOut = client.has_opted_out_capturing();
    // The opt-out is held in memory as well as in provider storage, so the
    // running instance stays disabled after the purge (verified in-browser).
    // Civica's own decision record in `localStorage` — not PostHog's — is what
    // prevents the bundle loading again on the reader's next visit.
    purgeProviderStorage();
    return optedOut;
  } catch {
    // A provider-side failure must never break the reader's page.
    return false;
  }
}

/**
 * Remove PostHog's own cookie and storage entries so withdrawing consent
 * leaves no analytics identifier behind, which is exactly what `/privacy`
 * promises. Scoped to the `ph_` prefix the SDK uses for this project.
 */
function purgeProviderStorage(): void {
  const expire = "; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  try {
    for (const name of document.cookie
      .split(";")
      .map((entry) => entry.split("=")[0].trim())
      .filter((name) => name.startsWith("ph_"))) {
      document.cookie = `${name}=${expire}`;
      document.cookie = `${name}=${expire}; domain=${window.location.hostname}`;
    }
  } catch {
    /* cookie access can be blocked; the opt-out above still holds */
  }
  for (const store of [window.localStorage, window.sessionStorage]) {
    try {
      for (const key of Object.keys(store).filter((key) =>
        key.startsWith("ph_"),
      )) {
        store.removeItem(key);
      }
    } catch {
      /* storage can be unavailable; the opt-out above still holds */
    }
  }
}
