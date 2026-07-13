# EXP-018 — Desktop/mobile primary nav synchronization

## Audit findings

The desktop "Explore" megamenu (`src/components/NavLinks.tsx`) and the
mobile menu (`src/components/MobileNav.tsx`) already share three of their
four destination lists through single canonical modules, each consumed
directly by both components (no local copy, no filter/sort/reorder):

- `EXPLORE_NAV_GROUPS` — `src/components/exploreNavItems.ts` (Countries &
  Places / Politics & Data, eight destinations with label, description,
  and `engraving` icon key).
- `INDEX_NAV_ITEMS` — `src/components/indexNavItems.ts` (Governance
  Evidence dropdown/group, five destinations).
- `METHODOLOGY_NAV_ITEMS` — `src/components/methodologyNavItems.ts`
  (Methodology dropdown/group, nine destinations).

One destination pair was hand-duplicated instead of shared: the trailing
"The Record" / "About" links existed as `TRAILING_LINKS` in
`NavLinks.tsx` and, separately, as `EDITORIAL_LINKS` in `MobileNav.tsx` —
two independently authored arrays with the same two hrefs/labels (mobile
additionally carried a `descriptor` field desktop never rendered). This is
the drift-prone shape the task is meant to close: identical today, but
free to diverge on the next edit to either file.

Icons/art (`engraving` key), ordering, and labels for the three
already-shared lists render identically on both surfaces by construction
— confirmed live (see Verification). The footer (`src/components/
SiteFooter.tsx`, `FOOTER_COLUMNS`) remains its own separate list, as
scoped by the task; it is not read by either primary nav surface and was
not touched.

### Current-route active state (pre-existing, now shared)

Desktop computed three composed "is this trigger active" booleans inline
in `NavLinks.tsx` (`indexActive`, `methodologyActive`, `exploreActive`),
each covering a URL-prefix union broader than the literal dropdown hrefs
(e.g. `methodologyActive` also covers `/civica-index/methodology*` and
`/country/methodology*`; `indexActive` covers the whole `/civica-index/*`
tree). Mobile's per-item highlighting used the same href-prefix rule
(`useIsActive`) but had no equivalent for the two group-title links
("Governance Evidence" / "Methodology") — those links never received an
active class, and no CSS rule existed for one.

`src/components/navActiveState.ts` now holds the three predicates
(`isGovernanceEvidenceGroupActive`, `isMethodologyGroupActive`,
`isExploreGroupActive`) as pure functions of `pathname`, extracted
verbatim from `NavLinks.tsx` — including the pre-existing characteristic
that `indexActive`/`isGovernanceEvidenceGroupActive` has no exclusion
against the methodology overlap, so a `/civica-index/methodology/*` page
highlights both the Governance Evidence and Methodology triggers at once
on both surfaces. `MobileNav.tsx` now calls the same two predicates to
set a `groupActive` prop on its `MenuLinkGroup` title links, which apply
`.mobile-menu__link-group-title.is-active` (reusing the existing
`var(--color-accent)` hover treatment — `src/app/globals.css`, no new
token). `NavLinks.tsx` renders unchanged.

The mobile menu's `UTILITY_LINKS` (Sources/API/Contact/Licensing/
Privacy/Terms) and its status-page link remain mobile-only — a compact
footer-equivalent for a surface with no page footer visible, not a
duplicate or fork of the primary nav's four destination lists. They are
unaffected by this task.

## What was unified

1. **`src/components/editorialNavItems.ts`** (new) — `EDITORIAL_NAV_ITEMS`,
   the single source for the "The Record" / "About" pair (href, label,
   descriptor). `NavLinks.tsx` and `MobileNav.tsx` both import and map it
   directly, replacing the two independently authored arrays. Labels,
   hrefs, order, and rendered output are unchanged.
2. **`src/components/navActiveState.ts`** (new) — the three shared
   active-state predicates described above. `NavLinks.tsx` now calls them
   instead of inlining the same logic; `MobileNav.tsx` calls the same two
   group predicates to light its "Governance Evidence" / "Methodology"
   group-title links, matching desktop's existing trigger highlighting.
3. **`src/app/globals.css`** — one added selector,
   `.mobile-menu__link-group-title.is-active`, joined to the existing
   `:hover` rule (`color: var(--color-accent)`, the same token already
   used for the identical treatment on the per-item links and on
   desktop's `.tab-nav--active`).

No change to `EXPLORE_NAV_GROUPS`, `INDEX_NAV_ITEMS`, or
`METHODOLOGY_NAV_ITEMS` — they were already the single source for both
surfaces.

## Drift-fixture test

`src/components/__tests__/exp-018-nav-drift.test.ts` (node:test, picked
up by `npm test`'s `src/**/*.test.ts` glob), source-backed and pure — it
imports the four shared arrays and does static source-text checks on
`NavLinks.tsx`/`MobileNav.tsx`; nothing is rendered.

1. **Shape** — every shared list is non-empty, has unique internal
   (`/`-prefixed) hrefs (href is each entry's natural id — it is already
   the React `key` on both surfaces), and non-empty labels.
2. **No unhandled external destinations** — none of the four shared lists
   currently contains an absolute-URL entry (neither surface has
   target/rel handling wired for these lists, so one would silently
   render as an internal-style link).
3. **Single canonical import** — both `NavLinks.tsx` and `MobileNav.tsx`
   import all four lists from their one canonical module path each.
4. **Unmodified consumption** — both files render each list via a direct
   `IDENT.map(...)` or an unmodified prop-pass (`items={IDENT}`), never a
   filtered/sorted/sliced copy, and neither file locally redeclares any
   of the four identifiers.
5. **No hand-duplicated destination** — no `href: "..."` object-literal
   property in either file matches a canonical href from the four shared
   lists (the exact shape of the `TRAILING_LINKS`/`EDITORIAL_LINKS` drift
   this task closed), and the two retired identifiers cannot reappear.
6. **External-link security** — the mobile menu's status-page link
   (`https://statuspage.incident.io/civica-atlas`) carries both
   `target="_blank"` and `rel="noopener noreferrer"`.
7. **Accessible name parity** — the Explore item's link on both surfaces
   renders `{item.label}` before `{item.description}` as plain text
   content, with no `aria-label` override on that link — so the
   screen-reader-announced name is built the same way on both surfaces.

Sanity check on the fixture itself: temporarily reintroducing a
`TRAILING_LINKS`-shaped duplicate array into `NavLinks.tsx` (`{ href:
"/blog", label: "..." }`) made test 5 fail with the offending href
reported; reverting restored a clean pass. This confirms the fixture
actually catches the class of drift it is meant to lock, not just the
current state.

## Verification

- `npx tsc --noEmit` — clean, no errors.
- `node --import tsx --test "src/components/__tests__/exp-018-nav-drift.test.ts"` — 9/9 pass.
- `npm run validate:design-tokens` — `No new design-token drift (209 baselined legacy violations remain.)`
- `npm test` (full suite) — 1323 pass, 3 pre-existing skips, 0 fail.
- Browser, dev server on :3000 (desktop viewport, `/civica-index`):
  Explore megamenu opens with the same two labeled groups/eight items/
  icons as the shared source; `aria-expanded` toggles correctly; DOM
  order for all three dropdowns matches `EXPLORE_NAV_GROUPS` /
  `INDEX_NAV_ITEMS` / `METHODOLOGY_NAV_ITEMS` exactly; "Governance
  Evidence" trigger shows `tab-nav--active`; no console errors.
- Browser, dev server on :3000 (mobile viewport 375×812): mobile menu
  shows the identical Explore groups/items/icons/order; on
  `/civica-index`, the "Governance Evidence" group title carries
  `is-active` (accent color `rgb(183, 81, 43)` = `--color-accent`) while
  "Methodology" does not; on `/civica-index/methodology/pulse`, both
  group titles carry `is-active` simultaneously, matching desktop's
  identical simultaneous-highlight behavior on the same URL measured in
  the same session; on `/country/methodology/reconciliation`, only
  "Methodology" is active on both surfaces (the Explore/`/country`
  overlap exclusion holds on both). Editorial links (`/blog`, `/about`)
  and the status link's `href`/`target`/`rel` read correctly off the DOM.
  No console errors on any of the three routes checked.

## Scope notes

- No npm dependency installed; `package.json` untouched (the new test is
  a plain `node:test` file needing no new script).
- `plan/MASTER-CHECKLIST.md`, `plan/PROGRESS.md`, and
  `src/lib/ci/claims-docs-gate.ts` were not touched.
- Checked `src/lib/ci/index-change-control.ts`'s `INDEX_PROTECTED_FILES`
  registry before editing: none of `NavLinks.tsx`, `MobileNav.tsx`,
  `exploreNavItems.ts`, `indexNavItems.ts`, `methodologyNavItems.ts`,
  `editorialNavItems.ts`, or `navActiveState.ts` are listed, so no
  deferral was needed.
- No dev server was started or stopped by this task; the existing :3000
  server was used as-is. `npm run build` was not run.
- No commit was made.
