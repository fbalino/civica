# ATL-022 evidence — source-native governance-change explorer

Date: 2026-07-23

Contract: `source-native-governance-change/v1`

Status: complete

## What shipped

`/governance-change` compares one declared external publisher series over an
exact user-selected start/end window. It currently supports the retained
V-Dem liberal-democracy, World Bank WGI rule-of-law, Freedom House total, and
Transparency CPI histories. It does not combine those series, construct a
Civica change score, include HDI as governance, or assign country grades.

Each result retains the exact endpoint values, publisher-native delta,
publisher scale and orientation, captured upstream release, method version,
source freshness, and missingness rule. A country without both exact endpoints
is excluded rather than assigned zero or “no change.” The page also reports
the range across every observed start ±1/end ±1 endpoint combination and says
whether those adjacent choices preserve the declared direction.

Ranking is fail-closed. It requires at least 30 exact-window sovereign states
and 50% coverage of sovereign states with any retained observation in the
selected series. Below either threshold, the table becomes alphabetical,
position is suppressed, and the reason is visible.

## Live read-only audit

The production database was queried without writes on 2026-07-23:

| Series | Retained years | Window | Eligible | Exact endpoints | Coverage | Direction-sensitive |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| V-Dem liberal democracy | 1789–2025 | 2015–2025 | 173 | 172 | 99.42% | 28 |
| WGI rule of law | 1996–2024 | 2014–2024 | 193 | 193 | 100% | 57 |
| Freedom House total | 2003–2025 | 2015–2025 | 193 | 193 | 100% | 40 |
| Transparency CPI | 2012–2024 | 2014–2024 | 178 | 171 | 96.07% | 58 |

The V-Dem rows identify their retained release as
`vdem historical series retained before DAT-033`. These are captured-release
comparisons, not assertions that each publisher's current downloadable release
is identical. Observation-level confidence intervals are not retained, so the
page explicitly describes point estimates, revisions, and endpoint sensitivity
without claiming statistical uncertainty bounds.

## Browser verification

System Chrome against the real Next.js app passed:

- HTTP 200, correct title and H1, 172 default V-Dem rows, and the comparable
  ranking state;
- the decreases view returned 118 rows and updated the query URL;
- the deliberately thin 1789–1790 window returned 52 alphabetical rows,
  displayed “No ranking,” explained the withheld ordering, and rendered `—`
  rather than positions;
- desktop light and 360 × 800 dark mode both had zero document-level
  horizontal overflow; and
- there were no console warnings, console errors, or page errors.

The inspected mobile image is
`output/playwright/atl-022-mobile-dark.png`.

## Verification

```text
npm run validate:governance-change
npm run validate:design-tokens
npx tsc --noEmit
npx eslint src/app/(reader)/governance-change/page.tsx \
  src/lib/governance-change/explorer.ts \
  src/lib/governance-change/explorer.test.ts \
  src/lib/governance-change/query.ts \
  scripts/validate-governance-change.ts
```

No external review, production write, deployment, statistical confidence
interval, or causal finding is claimed.
