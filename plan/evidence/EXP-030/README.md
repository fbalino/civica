# EXP-030 — retired embed document contract

**Completed:** 2026-07-18

There is no published live Civica Index, scalar Pulse, or ranking widget to
resize or style. The selected public-product disposition retired
`/embed/[slug]`; every legacy preset/query now returns the same concise
`410 Gone` document rather than a stale or partly rendered score card.

## Document contract

The retirement document now has:

- one meaningful document title and H1 inside a labelled `main` landmark;
- a concise explanation that no composite score or rank is published;
- a country-specific Governance Evidence successor and a rights/reuse link;
- `noindex, nofollow` in both the document and `X-Robots-Tag` response header;
- no browser/CDN cacheability, while retaining frame permission so existing
  iframes show the retirement notice; and
- no visible score, rank, taxonomy, Pulse, or fact field that could clip or
  misstate current data.

## Browser fixtures

`e2e/exp-030-retired-embed.spec.ts` visits the retired Brazil route under
legacy `small` (320×240), `medium` (480×320), `large` (640×420), and `custom`
(360×320) dimensions in both light and dark query variants. Each fixture
checks the 410 status, robots policy, title/H1/landmark/links, and that neither
vertical nor horizontal document overflow exceeds the frame.

```sh
E2E_BASE_URL=http://localhost:3100 npm run test:e2e:embed
# 8 passed (2.0s)

node --import tsx --test src/lib/api/pulse-scalar-retirement.test.ts
# 4 passed

npx tsc --noEmit --pretty false
# exit 0

npm run validate:design-tokens
# pass; 209 pre-existing baseline violations remain
```

Browser evidence was run in a disposable detached worktree on port 3100. It
made only GET requests and performed no database write, production deployment,
or credential change.
