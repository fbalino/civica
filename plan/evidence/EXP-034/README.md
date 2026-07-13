# EXP-034 — Document landmarks, headings, labels, form errors (scoped pass)

Scope of this pass (per the working brief): each page exposes exactly one
main landmark and correct banner/contentinfo usage, heading order has no
skipped levels or multiple `<h1>`, interactive controls carry accessible
labels, and form errors are programmatically associated with their fields.
This pass does NOT cover the full EXP-034 "Done when" in
`plan/MASTER-CHECKLIST.md` (sticky-offset repair and focus-management-on-error
are out of scope here — see "Remaining scope" below) and does not check the
EXP-034 box.

## Audit method

A durable, baseline-ratcheted static checker
(`scripts/validate-landmarks.ts`, tests in
`scripts/validate-landmarks.test.ts`) scans:

- all 227 tracked `src/**/*.tsx` files for a page-level `<main>` /
  `role="main"` outside the two files allowed to own the document `<main>`
  (`src/app/layout.tsx`, `src/app/global-error.tsx`), and for manual
  `role="banner"` / `role="contentinfo"` outside an (empty) allowlist;
- all 64 tracked `src/app/**/page.tsx` files for more than one literal `<h1>`
  in a single file.

Same baseline-ratchet mechanics as `validate-design-tokens.ts` /
`validate-alt-text-policy.ts`: `npm run validate:landmarks` fails only on NEW
drift above the checked-in `scripts/landmark-policy-baseline.json`;
`-- --update-baseline` re-baselines after a sanctioned cleanup. **Not added
to `package.json`** per instructions — the suggested line is:

```json
"validate:landmarks": "tsx scripts/validate-landmarks.ts"
```

Form-error association and the interactive-label sweep were manual review
(the 3 named forms) plus a targeted sweep of the shared header/nav/search/chat
controls, plus every file in `src/components/editorial/`, `src/components/*`
top-level shared components, and `src/components/{atlas,factbook,constitution,
pulse}/` (component-library + the four highest-traffic page-backing
directories) for icon-only interactive controls missing an accessible name.
Cross-checked against `src/lib/ci/index-change-control.ts` — no finding below
touches a protected file.

## Findings table

| Route / file | Issue | Rule | Fix |
|---|---|---|---|
| `src/app/error.tsx` | Route-segment error boundary rendered its own `<main>`, nested inside the root layout's `<main>{children}</main>` | nested-main | Changed to `<div>` |
| `src/app/(coding-auth)/admin/pulse-coding/sign-in/page.tsx` | Sign-in page rendered its own `<main>` | nested-main | Changed to `<div>` (matches the already-correct `src/app/admin/sign-in/page.tsx` pattern) |
| `src/app/(coding)/admin/pulse-coding/layout.tsx` | Coding-portal shell rendered `<main className="admin-content">` inside the root `<main>` | nested-main | Changed to `<div>` (matches the already-correct `src/app/(admin)/layout.tsx` pattern) |
| `src/app/design-system/page.tsx` | Page rendered its own `<main className="ds-main">`, AND had zero literal `<h1>` (the visible "Civica Atlas." top bar is a `<span>`, not a heading) | nested-main + missing h1 | Changed `<main>`→`<div>`; added a visually-hidden `<h1 className="sr-only">Design System</h1>` (Tailwind `sr-only` utility, already used elsewhere in the repo — no new CSS) |
| `src/components/PageHero.tsx` (used live inside `design-system/page.tsx`) | The design-system page's own "One hero, everywhere" section renders a REAL, live `<PageHero>` instance as a component swatch. `PageHero` hardcodes `<h1>` for its title, so once the page above got its own h1, the live swatch created a second, simultaneous h1 ("Every page opens the same way.") | multiple-h1 (live, not mutually-exclusive-branch) | Added an opt-in `titleAs?: "h1" \| "p" \| "div"` prop (default `"h1"`, unchanged for every real page). The design-system swatch call site now passes `titleAs="p"` — identical pixels, no second heading. Verified: all 12 other `PageHero` call sites (`/about`, `/rankings`, `/compare`, `/glossary`, `/parties`, `/accessibility`, `/governance-evidence`, `/elections/systems`, `/civica-index/pulse-changelog`, `ElectionsClient.tsx`, `ConstitutionHero.tsx`) pass no `titleAs` and keep the real `<h1>`. |
| `src/app/contact/ContactClient.tsx` | Every field had `aria-invalid` but no `aria-describedby`; the per-field error `<div>`s had no `id`; no live-announced validation summary. Screen-reader users got no programmatic link between an invalid field and its error text | form-error association | Brought to parity with the sibling advisory-board form (`ApplyClient.tsx`, already shipped under GOV-007): each error `<div>` now has a stable id, each input/textarea/group gets `aria-describedby` pointing at it only when the error exists, and a `role="alert"` validation summary banner appears once `errors` is non-empty (reuses existing `.contact-validation-summary`/`.contact-error` classes from `contact.css` — no new CSS) |
| `src/app/admin/sign-in/page.tsx` | The credential-error and Google-error `<Banner>`s were purely visual — no `role="alert"`, and neither the `username`/`password` inputs nor the "Sign in with Google" link referenced them | form-error association | Wrapped each banner in `<div role="alert" id="...">`; added `aria-invalid`/`aria-describedby="signin-error"` to `username`/`password`, and `aria-describedby="signin-google-error"` to the Google link |
| `src/app/(coding-auth)/admin/pulse-coding/sign-in/page.tsx` | Same gap as above for the "invalid access code" banner | form-error association | Same fix: `role="alert"` wrapper + `aria-invalid`/`aria-describedby` on the access-code input |
| `src/app/about/advisory-board/apply/ApplyClient.tsx` | — | — | Already compliant (GOV-007) — reviewed as the reference pattern, no changes |
| `src/components/factbook/CivicaAIDrawer.tsx` | The Ask Civica chat input had only a dynamic `placeholder` (`Ask anything about {country}…`) and no accessible name | accessible label | Added `aria-label={\`Ask anything about ${countryName}\`}` alongside the existing placeholder |
| `src/components/GlobalSearch.tsx` / `CountrySearchCombobox.tsx` | — | — | Already compliant (`ariaLabel` prop wired through to `aria-label`) — reviewed, no changes |
| `src/components/SiteHeader.tsx`, `MobileNav.tsx`, `ThemeToggle.tsx` | — | — | Already compliant (theme toggle, hamburger, mobile-menu close, nav groups all carry `aria-label`/`aria-labelledby`) — reviewed, no changes |
| `src/components/atlas/AtlasWorldMap.tsx:624-635` | The zoom `+`/`−` buttons had literal glyph text content (`+`, `&minus;`) as their only accessible name — not a hard WCAG failure (they do have text), but announced as "plus"/"minus" instead of a real label, inconsistent with the adjacent `aria-label="Reset view"` button in the same `.atlas-zoombar` group | accessible label (quality) | Added `aria-label="Zoom in"` / `aria-label="Zoom out"`, moved the glyphs into `aria-hidden` spans so the announced name is the label, not the symbol |

### Multiple-`<h1>` — verified safe, baselined (not fixed)

Three `page.tsx` files render more than one `<h1>` in source, but each `<h1>`
lives in its own mutually-exclusive early-return branch (loading/error/
empty/success states that can never render together), so the live DOM never
has more than one. Read and confirmed by hand; recorded in
`scripts/landmark-policy-baseline.json` so the mechanical h1-count check
doesn't false-positive on them, while any FUTURE regression that pushes a
file's count past its baselined number still fails the gate:

| File | h1 count in source | Why safe |
|---|---|---|
| `src/app/blog/page.tsx` | 2 | Empty-state early return vs. normal listing — never both |
| `src/app/constitution/page.tsx` | 4 | Landing / catalog-unavailable / no-constitution-selected / loaded-constitution — four mutually-exclusive early returns |
| `src/app/(coding)/admin/pulse-coding/page.tsx` | 2 | Admin-dashboard branch vs. coder/adjudicator-dashboard branch (`dashboard.kind === "admin"` early return) |

### `role="banner"` / `role="contentinfo"` — zero found

Civica's site chrome doesn't declare these roles manually: `SiteHeader.tsx`
is a `<nav>` (not `<header>`), and `SiteFooter.tsx` is a `<footer>` rendered
as a **sibling** of the root layout's `<main>` (not nested inside it), so it
gets the implicit `contentinfo` role for free. Per-page nested `<header>`/
`<footer>` elements (e.g. `design-system/page.tsx`'s `.ds-top`/`.ds-foot`,
card-level footers) are all descendants of the layout's `<main>`, so per the
HTML-ARIA mapping they get NO implicit landmark role — no conflict. The
baseline for this rule is `{}` (empty): any future manual `role="banner"`/
`role="contentinfo"` is immediate new drift.

## Index-change-control deferrals

None. All nine files touched were checked against
`INDEX_PROTECTED_FILES` in `src/lib/ci/index-change-control.ts` before
editing; none are protected, so every genuine violation found was fixed
directly — no deferral, no version bump.

## Pages verified with exactly one `<main>` after fixes (live browser DOM)

`document.querySelectorAll('main').length === 1` confirmed on: `/country/japan`
(1 h1 "Japan"), `/civica-index/methodology` (1 h1), `/contact` (1 h1, plus a
live validation-error DOM check — see below), `/admin/sign-in?error=1` (1 h1
"Sign in"), `/admin/pulse-coding/sign-in?error=1` (1 h1 "Independent coding"),
`/design-system` (1 h1, `sr-only`, "Design System"), `/about` (1 h1, confirms
the `PageHero` default path is unaffected), and the 404 page
`/this-route-does-not-exist-xyz` (1 h1 "This page is off the map."). No
console errors on any of these after the fixes (one transient
`TRAILING_LINKS is not defined` / Tooltip-hydration console warning was
observed once on `/design-system` during a `force` navigation but did not
reproduce on a clean reload — attributable to the shared dev server another
session was concurrently compiling against, not to code touched here; not
fixed, out of scope).

Live-DOM confirmation that the Contact form's error association actually
works: submitting the empty form set `aria-invalid="true"` +
`aria-describedby` on all three text fields, each `aria-describedby` id
resolved to a real element containing "Required", the category-chip group's
`aria-describedby` resolved to "Pick a category", and the
`role="alert"` validation-summary banner rendered with the expected text.

## Remaining EXP-034 scope (not done in this pass)

Per `plan/MASTER-CHECKLIST.md`'s full "Done when" for EXP-034, still open:

- **Sticky-UI header clearance** — no sweep done for elements obscured by the
  sticky site header (`#site-header`, `position: sticky; top: 0`) on
  in-page anchor jumps.
- **Focus management on invalid submit** — the fixed forms programmatically
  associate errors (`aria-describedby`/`role="alert"`), but none move focus
  to the first invalid field or the summary banner on a failed submit.
- **Keyboard/automated fixtures** — no new Playwright/e2e coverage was added
  for this class; `scripts/validate-landmarks.ts` is a static source-level
  gate, not a live keyboard-navigation test.
- **Interactive-label sweep scope** — this pass covers the confirmed
  global-chrome + named-form + chat-input gaps, plus every file in
  `src/components/editorial/` and `src/components/{atlas,factbook,
  constitution,pulse}/` (zero further violations found beyond the
  `AtlasWorldMap` zoom buttons above). It does not walk every page-local
  `page.tsx`/one-off component site-wide.

## Verification run

```
npx tsc --noEmit                                    # clean
node --import tsx --test scripts/validate-landmarks.test.ts   # 19/19 pass
npx tsx scripts/validate-landmarks.ts                # 8 baselined legacy violations, no new drift
npm run validate:design-tokens                       # 209 baselined legacy violations, no new drift
npm run validate:alt-text-policy                     # 3 baselined legacy violations, no new drift
```

`package.json` was not edited (no dependency, no script line added — see the
suggested `validate:landmarks` line above). `plan/MASTER-CHECKLIST.md`,
`plan/PROGRESS.md`, and `src/lib/ci/claims-docs-gate.ts` were not touched. No
commit was made.
