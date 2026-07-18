# EXP-014 — Explore navigation concept study

**Status:** complete; awaiting the owner selection required by EXP-015.

## Shared brief

All three directions expose the same eight reader destinations from
`EXPLORE_NAV_GROUPS`, in the same two registers:

| Countries & Places | Politics & Data |
| --- | --- |
| Countries · World Atlas · Compare · Constitutions | Parties · Elections · Rankings · Organizations |

They are decision mockups only. They do not replace the production navigation,
change a route, or select a visual direction. The rendered versions live in
`/design-system#explore-concepts`; all links use real destinations so hierarchy,
focus, and responsive behavior can be reviewed in a browser.

## Direction 01 — The scholarly index

**Visual thesis:** a quiet, numbered reference register that makes the atlas
feel like a carefully edited civic almanac.

**Hierarchy and information architecture:** `Explore` opens directly into two
named textual registers. Destination names are the dominant content; numbers
are scanning aids only and are hidden from assistive technology.

**Keyboard and focus:** ordinary semantic links follow the reading order:
Countries through Constitutions, then Parties through Organizations. Visible
focus adds the terracotta rule and accent text. The eventual header trigger
retains its existing Enter/Space toggle and Escape/trigger-focus-return
contract; this static mockup intentionally has no artificial menu role.

**Desktop/mobile relationship:** desktop keeps the two registers side by side;
mobile stacks them in that same reading order, without collapsing destination
names into an icon-only control.

**Performance and asset plan:** no raster art, no additional request, and no
new icon bundle. The future open-menu budget is 0 additional media bytes and
at most 8 KB of menu-only CSS after compression.

**Light/dark:** paper/ink, rules, accent, and focus color resolve entirely from
the existing semantic tokens.

## Direction 02 — The civic cabinet

**Visual thesis:** a compact cabinet of clear civic instruments: one functional
line emblem gives each named destination an immediate visual handle.

**Hierarchy and information architecture:** the same eight destinations render
as a four-column desktop array, retaining visible text labels and the shared
two-register order in the underlying data. Emblems supplement—never replace—
the destination identity.

**Keyboard and focus:** every tile is one native link, with an explicit visible
name. Tab order follows the shared data order; focus/hover use the same
terracotta border and tonal surface. The eventual header trigger keeps the
existing Escape and focus-return behavior.

**Desktop/mobile relationship:** the four-column desktop array becomes two
columns on mobile. Each destination remains a real, separately focusable link;
there is no hover-only information.

**Performance and asset plan:** uses the already-shipped Lucide line icons, not
new raster imagery. The implementation cap is zero additional image requests,
one icon family already present in the client bundle, and at most 12 KB of
menu-specific compressed CSS/JS beyond the current shared data model.

**Light/dark:** icon and interaction states use `--color-accent`, surface, and
border roles; neither theme needs a separate asset set.

## Direction 03 — The reading room

**Visual thesis:** an editorial reading room, with a short explanatory line and
an existing spot engraving to make each real destination easier to scan.

**Hierarchy and information architecture:** the two named registers each carry
four destination rows. A serif name is primary; the Inter description is
secondary; the engraving is decorative because the textual label is complete.

**Keyboard and focus:** links retain the live panel's native link behavior and
visible warm/focus state. The live `NavLinks` dropdown already owns its
trigger's `aria-expanded`, Escape close, focus-within, and trigger-focus-return
contract; the static mockup demonstrates the panel content, not a duplicate
interaction implementation.

**Desktop/mobile relationship:** the desktop panel is two columns. In the
mobile mockup, the two registers stack into one continuous reading order; all
eight links remain visible and no panel is clipped.

**Performance and asset plan:** this is the only art-led option. An eventual
implementation must lazy-load only the active-theme, opened-menu spot assets;
unopened menus make zero image requests. Generate appropriately sized 40px
derivatives before adoption: the current full-size spot WebPs are evidence
assets, not an acceptable open-menu byte budget. The proposed cap is eight
active-theme derivatives totaling at most 96 KB transferred after explicit
open, plus no inactive-theme transfer.

**Light/dark:** existing paired spot engravings use the canonical theme swap;
the surface, rule, and focus treatment remain semantic token-based.

## Browser mockup convention and evidence

The dated filename is:

`YYYY-MM-DD-<concept-id>-<viewport>-<theme>.png`

The 2026-07-18 capture set is under `plan/evidence/EXP-014/mockups/`:

- `typography-first-scholarly-index`, `emblem-led-compact-menu`, and
  `editorial-mega-menu` each have `desktop` and `small-mobile` screenshots in
  both `light` and `dark` themes (12 screenshots total).
- The capture test is `e2e/exp-014-explore-concepts.spec.ts`. It verifies all
  three concepts render the exact shared eight hrefs, every first link can
  receive keyboard focus, and the page has no horizontal overflow. It also
  captures the dated evidence only when `EXP014_CAPTURE_DIR` is supplied.
- The design-system page has a pre-existing hydration diagnostic in its
  unrelated ramp/tooltip demo (`page.tsx:433`); the browser test permits only
  that exact known artifact and fails on every other console/page/network/HTTP
  failure.

## Owner decision for EXP-015

Fernando should select one of the three directions using the mockups and this
brief. EXP-015—not this concept study—will then canonize the selected component,
tokens/assets, `DESIGN.md`, acceptance screenshots, and the production
navigation contract.
