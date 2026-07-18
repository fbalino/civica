# QA-016 — Supported-browser and graceful-degradation verification

## Design brief

This task does not introduce a visual feature. It makes the reader's existing
progressive-enhancement posture explicit and tests it on real production routes.
The affected map fallback stays inside the established country-map canvas and
uses the existing factbook design-system tokens; it never replaces country
evidence, source links, or the Atlas table alternative.

## Support boundary

`civica-reader-browser-support/v1` declares the current Playwright-managed
desktop Chromium, Firefox, and WebKit profiles for critical reader journeys.
That is deliberately not a claim about every historical browser version,
extension configuration, or branded browser release. The boundary was checked
on 2026-07-18 against the [Playwright browser documentation](https://playwright.dev/docs/browsers): Playwright pins its own browser binaries, supports
Chromium/Firefox/WebKit projects, and notes that its Firefox/WebKit builds are
not the branded Firefox/Safari applications.

The required CI command installs the pinned profiles and runs the support suite.
The controlled read-only fixture database adds the data-backed Atlas and country
failure paths; the credential-free CI subset still runs all three browsers for
home, accessibility, Record, and no-JavaScript reader rendering.

## Degradation contract

The contract and its tests cover these exact reader promises:

1. Server-rendered home and Record content stays visible without JavaScript;
   maps, filters, search, and other client-side controls remain progressive
   enhancements.
2. Atlas falls back from the external geometry CDN to checked local geometry and
   retains its complete table alternative.
3. A country map tries the keyless OpenFreeMap style after a self-hosted map
   failure, then presents a status rather than an empty canvas.
4. A failed Wikimedia leader portrait becomes a monogram while the leader and
   office text remain available.
5. A failed Ask Civica provider returns a generic temporary-unavailability
   state without replacing source-linked reader facts.
6. A failed Pulse source basket stays `source_outage` and `not_assessable`; it
   never means no event, stability, or country quality.

## Completion path

1. Add the checked support/degradation contract and an accessibility-page
   disclosure of the bounded browser commitment and unsupported behavior.
2. Configure isolated Firefox and WebKit projects so only QA-016's critical
   support suite runs beyond Chromium; preserve the broader Chromium suite's
   existing scope.
3. Add CI installation plus credential-free cross-browser checks. Add
   controlled read-only failure fixtures for Atlas, country map, portrait, and
   Ask Civica only when `E2E_PERFORMANCE_FIXTURE_DB=1` is supplied.
4. Verify the four production browsers/fixture paths, record screenshots and
   output under `plan/evidence/QA-016/`, then update the master/area plan only
   if the exact suite and affected validators pass.
