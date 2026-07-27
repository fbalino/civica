# EXP-015 rendered Explore candidate

Date: 2026-07-25

Status: implementation and browser verification complete; exact rendered owner
decision pending

## Approval boundary

Fernando approved the exact corrected eight-image light-master batch and asked
Codex to build a much larger, image-led Explore mega menu. That approval does
not pre-approve this rendered composition, its matched dark outputs, a
checklist completion, canonization, or deployment. Commit `4b7385fd` records
the candidate and its review evidence only.

## Candidate

The desktop disclosure uses the standard 1200-pixel design-system width token,
a short editorial introduction, and two explicit 2 × 2 registers:
`Start with a place` and `Research tools`. Mobile keeps the same eight
destinations, names, descriptions, order, and artwork in the existing
full-screen menu. `ExploreMenuPanel` is the sole desktop composition;
`EXPLORE_NAV_GROUPS` remains the shared identity source for both surfaces.

Every destination image is decorative. Names and descriptions form the
accessible link identity. Artwork mounts only while navigation is open and the
shared themed renderer resolves only the active theme.

## Dated browser captures

| Surface | Light | Dark |
| --- | --- | --- |
| Desktop panel | [PNG](rendered-candidate-2026-07-25/2026-07-25-exp-015-large-explore-candidate-desktop-light.png) · SHA-256 `788dfae323f04969d8bacadef0a2ea60302a0f97f47e85b35d0d3f3c90f3cb5a` | [PNG](rendered-candidate-2026-07-25/2026-07-25-exp-015-large-explore-candidate-desktop-dark.png) · SHA-256 `91a4c114620db690139476a7781db96923ef4f58a16a15b6c3f0e990d995975b` |
| Small-mobile dialog | [PNG](rendered-candidate-2026-07-25/2026-07-25-exp-015-large-explore-candidate-small-mobile-light.png) · SHA-256 `710e231b4aae27d868fc53712b3ecbb5451080f86ca309046a813f864aa82f81` | [PNG](rendered-candidate-2026-07-25/2026-07-25-exp-015-large-explore-candidate-small-mobile-dark.png) · SHA-256 `8e61fe1d4819d890e7c4a7fd297e94320570e6ee0a8aa73fb0d913da77e3ea27` |

The mobile captures are viewport crops; automated checks assert all eight links
exist in the scroll-contained dialog. The small floating `N` and `Type lab`
controls visible near the lower edge are local-development diagnostics, not
part of a production build or this component.

## Verification

The focused Chromium review passed 9/9 across desktop and small-mobile,
light/dark:

```text
E2E_BASE_URL=http://localhost:3002 \
EXP015_CAPTURE_DIR=plan/evidence/EXP-015/rendered-candidate-2026-07-25 \
npx playwright test \
  e2e/exp-014-explore-concepts.spec.ts \
  e2e/exp-015-explore-megamenu.spec.ts \
  --project=chromium --workers=1 --retries=0
```

It verifies the rejected EXP-014 captures remain historical, only one current
candidate appears on `/design-system`, destination order is unchanged, desktop Tab
order and Escape dismissal work, mobile focus trapping and Escape restoration
work, the open states pass automated accessibility checks, and both surfaces
remain free of horizontal overflow and hard browser errors.

The separate navigation budget suite passed 3/3. The closed desktop and mobile
menus request no Explore artwork; opening loads only the active theme. The
light batch is 79,622 bytes and the dark batch is 67,056 bytes, each below the
96 KB active-theme ceiling. The design-token ratchet, TypeScript check, and
11-test source-drift lock also pass. The complete production build passed,
including Civica's prebuild validation chain, optimized compilation,
TypeScript, page-data collection, and static-page generation.

All 16 optimized image assets have complete forward generation records and
checked manifest hashes. Their release state remains
`candidate-pending-owner-render-approval`, and production authorization remains
false.

After candidate commit `4b7385fd`, the canonical illustration manifest was
regenerated once so all 16 assets now bind their first-tracked provenance to
that commit instead of retaining the pre-commit null. The full editorial
illustration chain passes for 568 assets. The fixed local G4 runner then passed
master-plan integrity, the verification matrix, the unit suite, TypeScript,
lint, and the production build; G4 remains correctly blocked by its open tasks.

An in-app browser review confirmed the real header disclosure, all eight
accessible link names, dark-theme asset resolution, mobile dialog structure,
and Escape unmount/focus restoration against `localhost:3002`.

## Owner decision requested

Fernando should review the local home-header disclosure and the four dated
captures, then record one of:

- approve the exact rendered candidate;
- revise it, naming the specific visual or interaction changes; or
- reject it.

No deployment is authorized by that visual decision. EXP-015 and EXP-016 remain
open until the decision is recorded and the accepted or revised canonical
pattern is reconciled in a separate closure commit.
