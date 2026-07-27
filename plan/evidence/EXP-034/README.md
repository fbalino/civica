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

---

## Follow-up pass — focus management, sticky-header audit, keyboard fixture

This second pass closes the three items the scoped pass above explicitly left
open ("Remaining EXP-034 scope"), building on top of the shipped core
(commit `792d66f7`) without reverting or re-doing any of it. Nothing in the
core pass's findings table, baseline files, or `validate-landmarks.ts` was
touched.

### 1. Invalid fields receive focus on submit

**`/contact` (`src/app/contact/ContactClient.tsx`, client-validated).** Added
five refs (`summaryRef`, `firstChipRef`, `nameRef`, `emailRef`, `messageRef`)
and a `focusFirstInvalid(fieldErrors)` helper that walks the form's visual
order — category chips → Name → Email → Message — and calls `.focus()` on
the first ref whose field is invalid, falling back to the `role="alert"`
validation-summary banner (now `tabIndex={-1}` + given a ref) if none of the
known fields are invalid. Called from both failure paths: the synchronous
client-side `validate()` branch in `submit()`, and the server-side 422 branch
after `res.json()`. The category chip group has no single native input, so
the ref is attached to the *first* chip button (`SUBJECTS[0]`), which is
inside the `role="group"` container whose `aria-describedby` already points
at `contact-subject-error` (shipped in the core pass) — focusing an actual
interactive descendant of the described group, not a non-interactive
container.

**`/admin/sign-in` and `/admin/pulse-coding/sign-in`** are server-rendered
POST-and-reload forms with no client JS on the page (the sign-in page has no
`"use client"` directive), so there is no submit handler to hook. Both
already had a `role="alert"` error banner from the core pass
(`#signin-error` / `#signin-google-error` / `#coding-signin-error`); this
pass adds `tabIndex={-1} autoFocus` to each. Because these are React Server
Components, `autoFocus` compiles to the plain HTML `autofocus` attribute in
the server-rendered markup — the browser honors it at parse time with **no
client JavaScript required**, which is the correct primitive for a page that
intentionally ships without a client bundle for its form logic.

Live verification (Playwright, real browser — see §3; the Chrome-preview MCP
tab used for the rest of this pass's browser checks does not reliably honor
`autofocus` in its automation context, so this specific behavior was proven
via the e2e harness instead of the MCP tab):

- `/contact`, empty submit → focus lands on the first category chip
  ("Data correction"), `role="alert"` summary visible with real text.
- `/contact`, category+name+email valid but Message empty → focus lands on
  the `<textarea>`, `aria-invalid="true"`, `aria-describedby` resolves to a
  real "Required" element.
- `/contact`, Message present but < 10 chars → focus lands on the
  `<textarea>` with the length-specific error text.
- `/admin/sign-in?error=1` → `#signin-error` is focused on load, contains
  "did not match".
- `/admin/pulse-coding/sign-in?error=1` → `#coding-signin-error` is focused
  on load, contains "invalid, expired, or revoked".

### 2. Sticky UI clears the header

**Header geometry.** `#site-header` (`src/components/SiteHeader.tsx`) is
`position: sticky; top: 0; z-index: 100; height: 56px` — matches the
`--header-height: 56px` token (`src/app/globals.css:130`).

**Method.** Every `position: sticky` rule in `src/app/*.css` and
`src/components/**/*.module.css` was enumerated (`grep -rn "position:\s*sticky"`),
then each was either read for its `top` value against `--header-height`, or
measured live via `getBoundingClientRect()` in the browser (desktop 1280×900
and mobile 375×812) when the CSS alone didn't settle the question (grid
containing-block sizing, media-query overrides). Two representative pages
named in the brief were live-checked at both viewports:
`/civica-index/methodology` (ReaderSidebar) and `/country/japan/constitution`
(country-tab constitution outline, which reuses `FactbookSidebar`/
`.factbook-sidebar`, not the standalone `.constitution-reader-nav`). The
country tab bar (`.country-tabbar`, `src/components/country/CountryTabBar.tsx`)
was also checked directly.

**Bug found and fixed: `.compare-section-nav` (`/compare`).**
`src/app/editorial.css` had `position: sticky; top: 0; z-index: 40;` — the
*same* viewport position as `#site-header` (`top: 0`), but a *lower*
z-index (40 vs 100). Live measurement confirmed the bar was rendering
**completely hidden underneath the header** on scroll, not below it
(`getBoundingClientRect()` at `scrollY: 1200` before the fix:
`headerRect.bottom: 56`, `navRect.top: 0`, `navRect.bottom: 56.45` — 100%
overlap with the higher-stacked header). Fixed to
`top: var(--header-height)`; re-measured after the fix at the same scroll
position: `headerBottom: 56`, `navTop: 56`, `gap: 0` (flush below, zero
overlap). Confirmed visually with a real (non-JS-scroll) screenshot at
375×812 showing "Overview · Evidence · History · Chambers · Elections ·
International" fully visible directly under the header, both near the top
of the page and deep into the "Evidence" section.

Fixing the bar's position also exposed a second-order issue: `.compare-section`
had `scroll-margin-top: calc(56px + var(--space-5));` (a hardcoded `56px`
literal, commented "sticky header offset literal") — sized to clear the
header *alone*, from when the nav bar was (bug notwithstanding) invisible.
With the nav bar now correctly visible and occupying its own ~56.4px of
vertical space below the header, an in-page anchor jump (clicking a
"Chambers"/"Elections"/etc. link) would have scrolled the target heading to
land right under the now-visible nav bar. Updated to
`scroll-margin-top: calc(var(--header-height) * 2 + var(--space-5));`
(128px — replaces the hardcoded literal with the token, and accounts for
both stacked bars). Live-verified: clicking the "Chambers" nav link scrolls
`#chambers` to `top: 127.75px`, which is `>= navRect.bottom` (112.45px) and
`>= headerRect.bottom` (56px) — clears both bars.

**Already clearing correctly — measured, no change needed:**

| Element | File | `top` | Header bottom | Live gap | Notes |
|---|---|---|---|---|---|
| `.methodology-sidebar` (ReaderSidebar via `MethodologyLayout`) | `editorial.css` | `80px` | 56px | **24px** | Measured live on `/civica-index/methodology` at 1280×900. Already-tokenized-equivalent (80 = header-height(56) + space-6(24), noted in an existing code comment); becomes `position: static` under `max-width: 900px` (mobile), so no sticky-clearance question applies on mobile — confirmed via source (`editorial.css:669`) and not further changed (functionally correct; the hardcoded-vs-token cosmetic gap is pre-existing baselined drift, not a clearance bug, so left as-is per the brief's "if it already clears, document — no change needed"). |
| `.factbook-sidebar` / `.factbook-rail` (FactbookSidebar / ReaderSidebar; country-tab Factbook, Civica Data, and Constitution-with-`--no-outline` tabs) | `factbook.css` | `calc(var(--header-height) + var(--space-9) + var(--space-5))` = 136px | 56px | **80px** | Already uses the token. Live-measured on `/country/japan/constitution`. Becomes `position: static` under `max-width: 768px` (mobile) — confirmed via source (`factbook.css:757`), no clearance question on mobile. |
| `.factbook-sticky-country-search` (reveal-on-scroll country search bar, desktop `>= 769px`) | `factbook.css` | `var(--header-height)` | 56px | **0px (flush, not overlapping)** | Already uses the token; docks exactly at the header's bottom edge. |
| `.constitution-explorer-right` / `.constitution-reader-nav` (standalone `/constitution` explorer, not the country-tab variant) | `editorial.css` | `72px` | 56px | **16px** | Confirmed via source read (not live-browsed, since the country-tab route was the one named in the brief and already covers the sticky-outline pattern). Both become `position: static` under `max-width: 1100px` / `720px` respectively — no mobile clearance question. |
| `.org-standalone__sidebar` (`/organizations`) | `atlas.css` | `var(--header-height)` | 56px | **0px (flush)** | Already uses the token. |
| `.admin-nav`, `.coding-sticky-form` (internal admin/coding portals, not public reader surfaces) | `admin.css` | `calc(var(--header-height) + var(--space-5))` = 72px | 56px | **16px** | Already uses the token. Noted for completeness; not a public reader page. |
| `.glossary-azbar` (A–Z index strip, `/glossary`) | `glossary.css` | `var(--header-height, 0px)` | 56px | **0px (flush)** | Already uses the token. |
| `.post-rail-stuck` (blog article side rail, `/blog/[slug]`) | `globals.css` | `80px` | 56px | **24px** | Same 80px pattern as `.methodology-sidebar`; `display: none` under `max-width: 1000px` — no mobile question. Not named in the brief's representative list; found during the full-repo sticky sweep and included for completeness. Not changed (already clears). |
| `.country-tabbar` (Factbook / Civica Data / Constitution tab strip) | `factbook.css` | — | — | n/a | **Not sticky at all** (no `position: sticky` rule) — scrolls away with the masthead, so header-clearance doesn't apply. Confirmed via source (no match in `factbook.css` for a sticky rule on this selector). |
| `CountryOutcomeBars.module.css` `.cob__groupHeader` | component-scoped CSS module | `0px` | n/a | n/a | Sticky relative to its own scrollable list container (an internal component scroll region), not the page/site header — different sticky context entirely, out of scope for this audit. |

**Other pre-existing hardcoded `56px`/`80px`/`88px` literals found during the
sweep** (`civica-data.css:122`, `organizations-section.css:18`,
`factbook.css:863`, `globals.css:3488`, `editorial.css:2497`) are
`scroll-margin-top` values that already numerically clear their respective
sticky bars (each ≥ 56px + buffer); they are cosmetic hardcoded-vs-token
drift already covered by the 209-violation `validate:design-tokens`
baseline, not sticky-clearance bugs. Left untouched — fixing them is a
separate, broader design-token cleanup pass, not part of this scoped
header-clearance fix, and `validate:design-tokens` confirms no *new* drift
was introduced.

### 3. Keyboard / automated fixture

Added `e2e/exp-034-forms-keyboard.spec.ts` on the QA-009 harness
(`e2e/harness/fixtures.ts`), reusing the already-running dev server on
`:3000` (no new server spawned). Six tests:

1. Keyboard reachability — focus the first category chip, `Tab` five times,
   land on the Name field with no trap (chips → Name → Email → Message,
   confirmed via an ad hoc debug trace during authoring, then asserted
   directly).
2. Empty submit — `role="alert"` summary visible with real text; the
   category group's `aria-describedby` resolves to a real, non-empty error
   element; focus lands on the first invalid field (first chip button).
3. Only Message invalid — focus lands on the `<textarea>`,
   `aria-invalid="true"`, `aria-describedby` resolves to "Required".
4. Message present but too short — focus lands on the `<textarea>` with the
   length-specific error text.
5–6. `/admin/sign-in?error=1` and `/admin/pulse-coding/sign-in?error=1` —
   the respective `#signin-error` / `#coding-signin-error` alert is focused
   on load (proves the `autofocus` HTML attribute actually works in a real
   browser, since the MCP preview tab used elsewhere in this pass could not
   reliably confirm it).

One authoring correction worth recording: `page.getByRole("alert")` is
ambiguous on every page in this app — Next.js's own
`#__next-route-announcer__` also carries `role="alert"` (hidden, always
present) — so all alert assertions in this spec scope by a stable
class/id (`.contact-validation-summary`, `#signin-error`,
`#coding-signin-error`) rather than an unscoped role query.

```
npm run test:e2e -- exp-034-forms-keyboard   # 6/6 pass
```

### Index-change-control deferrals

None. Files touched in this pass: `src/app/contact/ContactClient.tsx`,
`src/app/admin/sign-in/page.tsx`,
`src/app/(coding-auth)/admin/pulse-coding/sign-in/page.tsx`,
`src/app/editorial.css`, and the new `e2e/exp-034-forms-keyboard.spec.ts`.
None appear in `INDEX_PROTECTED_FILES` in
`src/lib/ci/index-change-control.ts` (checked directly — that list only
covers `src/lib/ci/*`, `src/lib/db/queries*.ts`, `src/lib/pulse/v2/*`, and a
handful of named data/script files, none of which overlap this pass).

### Verification run (this pass)

```
npx tsc --noEmit                                              # clean
npm run validate:design-tokens                                # 209 baselined legacy violations, no new drift
npx tsx scripts/validate-landmarks.ts                          # 8 baselined legacy violations, no new drift
node --import tsx --test scripts/validate-landmarks.test.ts    # 19/19 pass (unchanged core check, re-run for regression safety)
npm test                                                        # 1342 passed, 3 skipped (pre-existing), 0 failed
npm run test:e2e -- exp-034-forms-keyboard                     # 6/6 pass
npm run test:e2e -- qa-005-route-authorization                 # 17/17 pass (regression check — /contact, admin routes)
npm run test:e2e -- responsive-matrix                          # 29/30 pass; the 1 "failure" (atlas route timeout under
                                                                 # 6-worker parallel contention) is a pre-existing flake
                                                                 # unrelated to this pass — re-ran in isolation
                                                                 # (--workers=1) and it passed in 37.9s. Not touched by
                                                                 # any file in this pass (atlas.css, AtlasWorldMap, and
                                                                 # the /atlas route were not edited).
```

Browser-verified live (Chrome preview MCP + Playwright, desktop 1280×900 and
mobile 375×812): `/contact` focus-on-submit behavior (three scenarios above),
`/compare` sticky-nav fix (before/after geometry + visual screenshot at
375×812), `/civica-index/methodology` ReaderSidebar clearance (24px gap),
`/country/japan/constitution` FactbookSidebar clearance (80px gap, and its
mobile static fallback confirmed via source). Admin sign-in `autofocus`
behavior was proven via the Playwright e2e suite rather than the MCP preview
tab, which does not reliably honor the native `autofocus` attribute in its
automation context (a documented limitation of that tool, not of the
implementation — separately confirmed the `autofocus=""` attribute *is*
present in the server-rendered HTML via `outerHTML` inspection even when the
MCP tab's `document.activeElement` didn't reflect it).

The committed core (commit `792d66f7`) was not reverted, re-touched, or
re-scoped: no changes were made to `scripts/validate-landmarks.ts`,
`scripts/landmark-policy-baseline.json`, `src/app/error.tsx`,
`src/app/(coding-auth)/admin/pulse-coding/sign-in/page.tsx`'s existing
`role="alert"`/`aria-describedby` wiring (only additive `tabIndex`/
`autoFocus` were added), `src/app/(coding)/admin/pulse-coding/layout.tsx`,
`src/app/design-system/page.tsx`, `src/components/PageHero.tsx`,
`src/components/factbook/CivicaAIDrawer.tsx`,
`src/components/atlas/AtlasWorldMap.tsx`, or any of the other core-pass
findings. `package.json`, `plan/MASTER-CHECKLIST.md`, `plan/PROGRESS.md`,
`src/lib/ci/claims-docs-gate.ts`, and the EXP-034 checkbox were not touched.
No commit was made.
