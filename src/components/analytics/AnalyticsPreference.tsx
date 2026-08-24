"use client";

import { Button } from "@/components/editorial/Button";
import { useAnalyticsConsent } from "@/components/analytics/AnalyticsConsent";

/**
 * Reader control for the analytics decision, rendered on `/privacy`.
 *
 * Shows the current state in plain language and offers the opposite choice, so
 * a decision made once in the banner is reversible at any time from a stable
 * URL. Renders nothing when the deployment has no analytics configured, since
 * there would be nothing to consent to.
 */
export function AnalyticsPreference() {
  const { state, configured, internal, internalMarked, decide, setInternal } =
    useAnalyticsConsent();

  if (!configured) return null;

  // Internal traffic (an explicit `?internal` mark, or a development origin)
  // outranks the consent decision: nothing can load, so showing Allow/Decline
  // here would be a control that does nothing.
  if (internal) {
    return (
      <div className="analytics-preference">
        <p className="analytics-preference__state">
          This browser is excluded from analytics as internal traffic. No
          analytics code loads, and the consent banner does not appear.
        </p>
        <div className="analytics-preference__actions">
          <Button variant="primary" size="sm" onClick={() => setInternal(false)}>
            Stop excluding this browser
          </Button>
        </div>
        <p className="analytics-preference__note">
          {internalMarked
            ? "This browser was marked with the ?internal link. The mark is stored per site address, so it applies here only."
            : "This address is a development or preview origin, which is excluded automatically."}
        </p>
      </div>
    );
  }

  // `unknown` is the pre-hydration server state; render the neutral pending
  // copy rather than asserting a decision the server cannot know.
  const decided = state === "granted" || state === "denied";

  return (
    <div className="analytics-preference">
      <p className="analytics-preference__state">
        {state === "granted"
          ? "Analytics is currently ON for this browser."
          : state === "denied"
            ? "Analytics is currently OFF for this browser. No analytics code is loaded."
            : "You have not made a choice yet on this browser. Until you do, no analytics code is loaded."}
      </p>
      <div className="analytics-preference__actions">
        <Button
          variant={state === "granted" ? "secondary" : "primary"}
          size="sm"
          onClick={() => decide("granted")}
          disabled={state === "granted"}
        >
          Allow analytics
        </Button>
        <Button
          variant={state === "denied" ? "secondary" : "primary"}
          size="sm"
          onClick={() => decide("denied")}
          disabled={state === "denied"}
        >
          Turn analytics off
        </Button>
      </div>
      {decided ? (
        <p className="analytics-preference__note">
          This choice is stored in this browser only, under{" "}
          <code>civica.analytics-consent</code>. Clearing your site data resets
          it, and you will be asked again.
        </p>
      ) : null}
    </div>
  );
}
