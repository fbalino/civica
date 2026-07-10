# CLM-004 evidence — Public authority-claim correction

**Task:** Remove or qualify public claims of academic authority, validation,
uncertainty, cadence, and reuse rights that outrun the current evidence.

**Commit:** `feat(editorial): establish atlas-first truthful positioning (CLM-003, CLM-004)`

## Outcome

- Index Monte Carlo bounds are now called **input-variation ranges**. Public
  prose explicitly says they are sensitivity summaries under declared
  perturbations, not confidence intervals for a latent true country score.
- The current PCA is described as a limited, underpowered, single-year
  46-country analysis; planned longitudinal, factor, and substitution tests are
  no longer written as completed validation.
- Pulse is an experimental event ledger with optional numeric effects. Its
  pipeline is accurately described as scheduled daily, while successful
  completion, live streaming, and continuous governance measurement are kept
  distinct.
- Advisory-board pages now describe recruitment for a planned board and state
  that no board review or endorsement has occurred.
- Footer and Terms copy no longer says all mixed-source data is open or free to
  reuse. It points readers to per-source license and restriction terms.
- `src/lib/claims/authority-language.ts` and the public-claims validator fail on
  seeded academic-standing, governance-health, confidence-interval, daily
  governance-measure, blanket reuse-rights, and unsupported-superlative claims.

## Verification

| Command or check | Result |
|---|---|
| `npm run validate:public-claims` | Exit 0 — 0 unqualified high-authority phrases and 0 unregistered headline claims. |
| Focused repository prohibited-language search | Exit 0 with no positive matches across README, citation metadata, public content, app routes, public components, or OG copy. Remaining words such as “confidence interval” occur only in explicit negations or technical comments. |
| `npm test` | Exit 0 — authority-language positive and allowed-limitation fixtures passed within the full 47-test suite. |
| `npm run validate:content-templates` | Exit 0 — current methodology prose resolves cleanly. |
| `npm run validate:sync-freshness` | Exit 0 — 587 files scanned and 0 unsanctioned freshness writes. |
| Targeted ESLint | Exit 0 with no warnings or errors. |
| `npm run build` | Exit 0 — compilation, TypeScript, and static generation passed. |
| Production-server rendered audit over 10 named routes | Exit 0 — no prohibited authority/reuse phrase or rendered claim marker was found. |

## Runtime and browser evidence

- `vercel.json` schedules Pulse v2 ingest, cluster, classify, and score daily at
  08:00, 08:20, 08:40, and 09:00 UTC respectively.
- A read-only request to the [public Pulse changelog API](https://civicaatlas.org/api/v1/pulse/changelog/v2?limit=25)
  at `2026-07-10T01:06:14Z` returned 25 recent rows, a latest event date of
  `2026-07-08`, providers `anthropic`, `deepseek`, and `glm`, 12 published rows,
  and 13 review-queued rows. This falsified stale “paused” prose before commit.
- The browser audit searched ten rendered routes for the prohibited phrases,
  found zero, confirmed no visible registry comments or horizontal overflow,
  and returned an empty warning/error console log.
- Screenshot: `advisory-board-planned-review.png`.

## Limitations and follow-on work

- A configured daily schedule and recent rows do not prove that every run
  succeeds. CLM-007 will generate a runtime-method snapshot and reconcile exact
  active feeds, providers, review gates, cadence, and public numeric status.
- This task corrected blanket rights and universal-provenance wording where
  encountered, but CLM-018 and CLM-019 remain open until their full manifests,
  exports, embeds, and coverage fixtures pass.
- Neither model agreement nor these wording corrections constitute independent
  academic review. No external reviewer was contacted.
