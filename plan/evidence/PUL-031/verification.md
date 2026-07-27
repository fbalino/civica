# PUL-031 verification

Verified on 2026-07-12.

## Production migration and repair

- All 24 authoritative migrations are applied. The live public schema matches
  fingerprint `924e70bf4fbd6721becb65ec880fc3ea1f05d864639e983caface871c706fbc1`.
- The hash-pinned repair confirmed five duplicate incident pairs. Three pairs
  had event projections, reducing current projections from 383 to 380. The two
  remaining pairs were retained unclassified reports.
- The ledger retains 474 lower-confidence collision candidates for later
  review: 13 from the historical backfill and 461 from ordinary clustering.
  Candidate status has no merge, publication, or scoring effect.
- The final live invariant report found five confirmed resolutions, zero
  invalid incident states, zero duplicate current projections, zero running
  pipeline runs, and zero current deltas on an obsolete algorithm version.
- Corroboration recomputed 380 current events. The incident-aware score run
  examined 204 events across 65 countries and wrote 325 dimension rows, of
  which 76 crossed the experimental significance threshold.

## Interrupted-run recovery

The first ordinary clustering apply stopped after three assignments when a
floating-point cosine result exceeded the closed score range by a negligible
amount. The run was marked failed with its partial counts. The cosine is now
clamped to `[-1, 1]`. One incident created by that partial run had no raw
assignment, event, or resolution; that exact orphan was removed while its
database retention history remained intact. The remaining 125 reports then
completed successfully. Across the failed and resumed runs, all 128 incoming
reports reached a retained assignment or incident match.

## Automated and browser checks

- `npm run validate:claims-docs`: pass, including 883 unit tests.
- `npm run typecheck`: pass.
- `npm run validate:design-tokens`: pass with no new violations; the 209
  reported entries are the checked legacy baseline.
- `npm run validate:pulse-incidents` and
  `npm run validate:pulse-incidents:live`: pass.
- Authoritative migration, research-retention, runtime-method, Index
  change-control, and stable-incident validators: pass in their applicable
  static and live forms.
- `npm run build`: pass, generating 105 static pages. The existing Turbopack
  NFT trace warning remains non-fatal.
- Local browser check of `/civica-index/methodology/pulse`: the page rendered
  `pulse-v2.9-beta`, the exact stable-incident merge rules, review-only semantic
  thresholds, fallback limits, and retained losing projections. The browser
  reported no console warnings or errors.
