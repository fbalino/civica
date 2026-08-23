"use client";

import Link from "next/link";

import { Button } from "@/components/editorial/Button";
import { useAnalyticsConsent } from "@/components/analytics/AnalyticsConsent";

/**
 * Consent banner for optional product analytics.
 *
 * Shown only when analytics is configured for the deployment AND the reader
 * has not yet decided. Accept and decline carry equal visual weight, and
 * nothing is loaded while the banner is open — declining is not a "reject
 * after the fact" but a state the reader was already in.
 *
 * All presentation comes from the `.cookie-consent` block in `globals.css`
 * and the shared `<Button>` primitive; this component sets no local styles.
 */
export function CookieConsentBanner() {
  const { state, configured, decide } = useAnalyticsConsent();

  if (!configured || state !== "pending") return null;

  return (
    <div
      className="cookie-consent"
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-body"
    >
      <div className="cookie-consent__panel">
        <div className="cookie-consent__copy">
          <p id="cookie-consent-title" className="cookie-consent__title">
            Help us see which parts of the atlas get used
          </p>
          <p id="cookie-consent-body" className="cookie-consent__body">
            With your permission, Civica counts which pages get opened, so we
            know where to put the next round of work. It records page
            addresses, not you: no session recording, no advertising, no
            profile. Decline and no analytics code loads at all. Details on
            the <Link href="/privacy#analytics">privacy page</Link>.
          </p>
        </div>
        <div className="cookie-consent__actions">
          <Button
            variant="primary"
            size="sm"
            onClick={() => decide("granted")}
          >
            Allow
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => decide("denied")}
          >
            Decline
          </Button>
        </div>
      </div>
    </div>
  );
}
