# CLM-005 — Neutral country-score presentation

Status: complete on 2026-07-09.

## Outcome

The Civica Index remains an active research-beta composite. This task removes
the unsupported categorical verdict layered on top of it: public country
letter grades, qualitative score bands, and traffic-light score colors.

Current public presentation is a numeric position on a declared 0–100 scale,
with the central input-variation range when available. The numeric composite,
dimension scores, ranks, histories, calculation pipeline, and public APIs
remain active and will enter the planned validation tournament.

The presentation follows the Fable design contract in
`plan/research/fable-index-design-space-2026-07-09.md` section 6: show
position, assumptions, disagreement, and limitations without assigning a
categorical country verdict.

## Implementation evidence

- Canonical UI primitive: `src/components/editorial/ScorePosition.tsx`.
- Canonical styling: `.score-position*` in `src/app/editorial.css`, using the
  sequential `--ramp-indicator-*` design tokens.
- Design-system specimen: `/design-system` under “Neutral research score”.
- Public country, Index, compare, map, rankings, home, outcomes, conditions,
  embed, and API-doc surfaces no longer expose Index grades or bands.
- The current calculator writes `ci_composite_scores.band = null`. The nullable
  column and deprecated band helper remain only for internal historical replay;
  curated public queries and APIs exclude the field.
- A repository guard in `src/lib/claims/country-grade-language.ts` is executed
  by `npm run validate:public-claims`, and the production build now runs that
  validator before compilation.
- The unnecessary peer-grouping migration reader page and API endpoint were
  removed. Public peer-grouping methodology describes the current system in
  the present tense.

## Automated verification

- `npm test`: 51 tests passed.
- `npm run validate:public-claims`: 27 claims, 14/14 required surfaces, 33
  markers, zero authority-language leaks, zero country-grade leaks, zero
  unregistered headline markers.
- `npm run validate:content-templates`: all seven templated reader files clean.
- `npm run validate:design-tokens`: no new token drift; the ratchet remains at
  the existing 412 legacy violations.
- `npm run validate:sync-freshness`: clean.
- `npx tsc --noEmit`: passed.
- `npm run build`: production build passed with 84 pages.
- Targeted ESLint over every modified TypeScript/TSX/JavaScript file: zero
  errors. The known unrelated repository-wide React/elections lint backlog
  remains outside this task, as documented in `AGENTS.md`.
- `git diff --check`: passed.

## Public API audit

The production server returned HTTP 200 and no public `band`, `grade`, or
`tier` key, old qualitative score value, or letter-grade value for:

- `/api/v1/index/japan`
- `/api/v1/index/japan/history`
- `/api/v1/index/compare?slug=japan&slug=denmark`
- `/api/v1/index/rankings?limit=10`
- `/api/v1/index/by-government-type?government_type=parliamentary`
- `/api/v1/index/methodology`
- `/api/v1/countries/japan`

The methodology response declares:

```json
{
  "format": "numeric_position",
  "scale": { "min": 0, "max": 100 },
  "input_variation_range": "central_90_percent",
  "categorical_grades": false
}
```

Both obsolete migration URLs return HTTP 404:

- `/civica-index/methodology/peer-grouping/migration`
- `/api/v1/index/methodology/peer-grouping/migration`

Light and dark embed responses for Japan and Denmark return HTTP 200, label
the score as research beta, and contain no grade/band label or legacy tier
class.

## Browser matrix

The local production build was audited at 1280×720 and 390×844 in light and
dark themes. The tested surfaces had zero horizontal overflow and no visible
Index letter grade, qualitative score band, or traffic-light legend.

The word “Authoritarian” on the Index leaderboard is Eritrea's separately
sourced government/regime metadata in the country column, not an Index score
band. The word “failed” on `/design-system` belongs to the generic
reconciliation-error banner, not country scoring.

Evidence captures:

- `index-desktop-dark-viewport.png`
- `index-score-policy-dark.png`
- `index-leaderboard-dark.png`
- `index-leaderboard-light.png`
- `index-mobile-light-top.png`
- `index-mobile-light-leaderboard.png`
- `country-japan-desktop-light-score.png`
- `country-japan-mobile-light-score.png`
- `methodology-presentation-desktop-light.png`
- `design-system-neutral-score-desktop-light.png`
