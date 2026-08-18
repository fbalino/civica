# EXP-015 rendered Explore candidate

> **SUPERSEDED 2026-08-17.** Fernando rejected the image-led Explore
> megamenu direction and replaced it with a standard grouped header dropdown
> (commit `a8f58bcc`, PR #24). This document is retained unchanged as the
> historical record of the superseded direction; it does not describe what
> Civica ships. The current contract is the "Explore dropdown" entry in
> `DESIGN.md`.

Date: 2026-07-26

Status: deployed as a live candidate under the owner release instruction;
exact rendered owner approval is not yet recorded

## Approval boundary

Fernando approved the corrected eight-image light-master batch on 2026-07-25.
That approval did not approve the dark outputs, rendered menu, or deployment.
On 2026-07-26 Fernando separately instructed the finished work to be committed
and pushed live while the exact rendered decision remains pending. The forward
records preserve both facts: production release was authorized, Vercel later
reported the exact production deployment Ready, and
`ownerRenderedMenuApproval` remains false. The dated review field is named
`releaseAuthorizedAtReview: false` because it records the earlier 2026-07-25
review state; the later instruction is recorded separately as
`productionAuthorized: true`.

EXP-015 stays unchecked until the exact rendered owner decision is recorded.

## Candidate

The desktop disclosure uses the standard page-width token, a short orientation,
and two explicit 2 × 2 registers: `Start with a place` and `Research tools`.
Mobile keeps the same eight destinations, names, descriptions, order, and
artwork in the existing full-screen menu. `ExploreMenuPanel` is the sole
desktop composition; `EXPLORE_NAV_GROUPS` remains the shared identity source.

Every destination image is decorative. Names and descriptions form the
accessible link identity. Artwork mounts only while navigation is open and the
shared themed renderer resolves only the active theme.

## Dated browser captures

| Surface | Light | Dark |
| --- | --- | --- |
| Desktop panel | [PNG](rendered-candidate-2026-07-26/2026-07-26-exp-015-large-explore-candidate-desktop-light.png) · SHA-256 `debc40ebbaad914a0b595e1bbb09360b1dbed9a5790f7a493c6822f9e2f3031a` | [PNG](rendered-candidate-2026-07-26/2026-07-26-exp-015-large-explore-candidate-desktop-dark.png) · SHA-256 `0cd01a9b68b0e164f1274756094f0a265dfecbf333060310c66ee8835ad83ecd` |
| Small-mobile dialog | [PNG](rendered-candidate-2026-07-26/2026-07-26-exp-015-large-explore-candidate-small-mobile-light.png) · SHA-256 `080982653961b144c91eac3e01e2e1d0f6f333636bb82274ceb3b4c38f076bbc` | [PNG](rendered-candidate-2026-07-26/2026-07-26-exp-015-large-explore-candidate-small-mobile-dark.png) · SHA-256 `4da49e9607b010fbdded2261c323b0fbef3db5929c1324df8b9a4ec7b5c02669` |

The mobile captures are viewport crops; automated checks assert all eight links
exist in the scroll-contained dialog. The small floating `N` control is a local
development diagnostic, not part of a production build or this component.

## Verification

The focused Chromium review passed 7/7 across desktop and small-mobile,
light/dark:

```text
E2E_BASE_URL=http://localhost:3015 \
EXP015_CAPTURE_DIR=plan/evidence/EXP-015/rendered-candidate-2026-07-26 \
npx playwright test \
  e2e/exp-015-explore-megamenu.spec.ts \
  e2e/exp-017-navigation-asset-budget.spec.ts \
  --project=chromium --workers=1 --retries=0
```

It verifies ordered desktop Tab traversal and Escape restoration, the mobile
focus trap and Escape restoration, open-state WCAG A/AA checks, destination
order, absence of hard browser errors, deferred closed-menu artwork, active
theme-only transfers, and the declared 96 KB art ceiling. The light batch is
79,622 bytes and the dark batch is 67,056 bytes.

The design-token ratchet, alternative-text policy, TypeScript check, UI pattern
map, 11-test navigation drift lock, and forward illustration-manifest gate also
pass. All 16 optimized image assets have complete forward generation records.
The existing home-art record is preserved unchanged.

## Production deployment

The exact Vercel production deployment reached `READY`. The apex HTML contains
that deployment identity, and sampled light and dark navigation assets returned
HTTP 200 from the production domain. The machine-readable identity, commit,
verification time, and bounded checks are retained in
[`deployment.v1.json`](deployment.v1.json).

## Pending state

The candidate is live, but deployment does not constitute exact rendered owner
approval. Fernando should approve, revise, or reject the rendered candidate;
until that decision is recorded, EXP-015 remains open.
