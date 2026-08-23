# Privacy data handling

Contract: `civica-privacy-data-handling/v1`

Effective: 2026-08-23

## Canonical inventory

`src/lib/privacy/data-handling.ts` is the closed, typed inventory of Civica's
reader, voluntary-submission, owner-admin, reviewer, telemetry, error, and
provider data flows. The public `/privacy` page renders its visitor-facing
rows. `npm run validate:privacy-data-handling` fails when the registry, public
notice, retention constants, implementation sources, maintenance command, or
manual queue drift.

The inventory records current behavior, including honest limitations. A
provider-controlled retention period is not converted into a Civica promise,
and the absence of an automatic deletion job is stated rather than hidden.

## Consent-gated analytics

Product analytics (PostHog) is the only third-party analytics on the site, and
it is opt-in. `src/lib/analytics/consent.ts` owns the versioned decision
contract and `src/components/analytics/AnalyticsConsent.tsx` is the only place
permitted to load the provider bundle.

- Nothing loads before consent. An undecided or declining reader downloads no
  analytics script, opens no connection to PostHog, and is issued no
  identifier. Declining is therefore the reader's existing state, not a
  post-hoc suppression of collection that already happened.
- The decision is stored in the reader's `localStorage`, not a cookie, so
  recording a refusal does not require the mechanism being refused.
- Anything unreadable, unversioned, or written under a superseded contract
  version resolves to `pending`, which re-asks rather than assuming consent.
- Autocapture, session recording, heatmaps, surveys, and feature-flag requests
  are disabled; no person profile is created; the cookie is not shared across
  subdomains; and a browser Do Not Track signal suppresses capture even after
  consent. `ANALYTICS_CAPTURE_POLICY` states this posture once, and both the
  validator and `src/lib/analytics/consent.test.ts` fail on drift.
- Withdrawal is reversible from `/privacy#analytics`, which stops capture and
  discards the device identifier immediately.
- Absent `NEXT_PUBLIC_POSTHOG_KEY`, analytics and its banner do not exist for
  that deployment.

## Minimization and deletion

- New contact and advisory-application submissions do not persist raw IP
  addresses. Shared abuse controls retain only a scoped HMAC digest through
  the active fixed window.
- The authenticated owner-admin message detail can permanently delete a
  contact submission. Advisory applications already have an authenticated
  deletion action and an 18-month maximum.
- As of the read-only 2026-07-23 production audit, one legacy contact row and
  zero advisory-application rows retained a non-null legacy IP field. No value,
  row identity, message, or sender data was read into the evidence.
- `npm run plan:legacy-private-identifiers` reports only aggregate counts and
  performs no production mutation. Applying the purge requires explicit owner
  authority and both `--apply` and the exact confirmation flag documented by
  the command. Evidence may retain before/after counts and time only.

## Access and rights requests

Privacy requests arrive through `/contact`. The owner authenticates to the
admin surface, confirms the requester's scope without disclosing another
person's record, and records only the minimum operational evidence needed to
complete access, correction, or deletion. Contact messages can be deleted once
their purpose and any related complaint or security need are resolved.
Research-review evidence and security audit records are not silently rewritten;
their study-specific disposition must preserve integrity while honoring
applicable rights.

## Provider boundaries checked on 2026-07-23

- Vercel's official limits documentation describes Runtime Log availability by
  plan (currently one hour on Hobby, one day on Pro, and three days on
  Enterprise). Civica's actual plan and configured log products still require
  account-level verification:
  <https://vercel.com/docs/limits#logs>
- Anthropic documents that zero-data retention is organization-specific and
  must be enabled separately. Civica does not claim it is enabled:
  <https://docs.anthropic.com/en/docs/build-with-claude/zero-data-retention>
- Neon documents its platform security controls, but application-row retention
  remains Civica's responsibility:
  <https://neon.com/docs/security/security-overview>
- PostHog documents project-level data retention and deletion controls.
  Civica's configured project retention still requires account-level
  verification and is not asserted as a Civica promise:
  <https://posthog.com/docs/privacy>
- Mapbox publishes a product privacy policy and a current privacy/security FAQ;
  the optional 3D view remains an explicit remote-provider boundary:
  <https://www.mapbox.com/legal/privacy>
- OpenFreeMap publishes a privacy policy stating that it does not store IP
  addresses in regular server logs:
  <https://openfreemap.org/privacy/>
- FlagCDN/Flagpedia is identified as a remote image host. Its current provider
  terms and any configured PMTiles host must be reviewed at release time:
  <https://flagcdn.com/>

These links document public provider statements, not proof of Civica's account
settings, executed data-processing agreements, or legal compliance.

## Remaining authority

BRD-012 remains open until the owner authorizes the aggregate-only legacy-IP
purge and records its zero-row verification. Account-level Vercel and Anthropic
settings, the configured PMTiles host, provider agreements, operator identity,
applicable lawful bases, cross-border-transfer language, and the rights-request
procedure require professional privacy review before broad launch. This
repository work queues those checks; it does not claim legal advice or
professional clearance.
