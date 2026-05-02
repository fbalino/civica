# Project Memory Decisions

## 2026-04-24 — Civica Index/Pulse methodology is beta and under rework

User disclosed (end of Phase 2.2 session) that the CI v1 composite + CP daily
scoring both have known flaws and will be recalculated with a new methodology.
The rework ships in beta form first. Implications:

- Do NOT optimize code paths around the current dimension weights or adapter
  outputs as if they were stable. The shape of `ci_scores` / `pulse_scores`
  rows may change, as will the composite formula and the dimension list.
- `/civica-index` hero copy currently reads more authoritatively than the
  product's maturity warrants. Add a visible `BETA` marker (hero eyebrow or
  pill) and a one-line "methodology under revision" disclosure in the lede
  before the rework ships — credibility hedge.
- Phase 5 in the roadmap (originally "CI/CP academic legitimacy — polish for
  citation") now scoped differently: it's the v2 methodology rebuild +
  beta→stable transition, not a polish pass. Treat the old Phase 5 framing as
  superseded.
- Routing / shell work (Phase 2.3+) is orthogonal. The reader-group migration
  of `/civica-index/methodology` doesn't care what the page says, only where
  the file lives and what layout wraps it. Safe to proceed.

How to apply: if you're writing CI-adjacent code, ask the user whether it
should assume the current methodology or a new one before committing to an
approach. Content changes on `/civica-index` pages should lean toward honest
hedging while the rework is in flight.

## 2026-04-21

- Government classification now uses three layers:
  - raw CIA Factbook label kept unchanged on `jurisdictions.government_type_detail`
  - normalized Bjornskov-Rode / CGV regime layer stored in `government_taxonomies`
  - derived structural form layer stored in `government_taxonomies`
- Structural form is the default public lens on `/civica-index/government-types`.
- Regime type is available as a second lens and is metadata only. It does not affect CI scoring.
- Switzerland is treated as a deliberate divergence case:
  - regime lens: presidential democracy
  - structural lens: federal directorial republic

## 2026-04-24

### Chat context scoping rule (Ask Civica)
The `contextChips` shown in the right-pane chat AND the `apiContext` sent to `/api/chat`
must only include state variables that are semantically relevant to the active tab.

House (upper/lower) is only meaningful on the `chamber` tab (amended 2026-04-24,
narrower than the original chamber+bills rule). It must be stripped from chips and
apiContext on ALL other tabs, including bills.

Why: the chamber tab is the only view with a visible upper/lower toggle driving what
the user is looking at. Bills, structure, democracy, etc. all display country-level
data regardless of which house was last selected. Showing the house chip on them reads
like the chamber selection is bleeding through. Example user report: on
`/atlas/usa/chamber` with lower selected → navigating to structure (which already
strips house) → then to bills, the chip still said "Lower" and felt like leaked state
rather than an intentional scope.

How to apply:
```ts
const tabNeedsHouse = tab === "chamber" || tab === "bills";
const contextChips = [
  { label: "Country", value: country.name },
  ...(tabNeedsHouse ? [{ label: "House", value: houseLabel }] : []),
  { label: "Tab", value: TAB_LABELS[tab] },
];
const apiContext = {
  country: country.name,
  tab,
  ...(tabNeedsHouse ? { house } : {}),
};
```

The URL's `?house=` query param is ALSO stripped when navigating to non-chamber/
non-bills tabs (updated 2026-04-24, supersedes earlier decision to preserve it).
Reason: a shared URL like `/atlas/usa/democracy?house=upper` looks broken to a
reader because house has no meaning on Democracy. If we want to preserve the
user's house choice across navigations, use `localStorage` (pattern: same as the
pane-width persistence in `ShellContext` under key `atlas_panels`), not URL state.
This same principle applies to any future per-tab context (e.g. a future
`currentBillId` should only appear on the bills tab).

## 2026-04-24 — Phase 2.1 extraction plan locked

- `?house=upper` is a URL search param, NOT a path segment. Avoids rebuilding three
  panes on chamber toggle.
- `BillCard.onAsk` cross-coupling (currently writes to `chatInputRef` directly) is
  being replaced by a `civica:ask` CustomEvent on `window`. `AskCivicaPanel` listens
  (gated by `listenForExternalAsk` prop) and pre-fills. This is the clean pattern
  when chat lives in a separate route slot from the trigger.
- International tab routes by 3-letter `country.id`, NOT by slug (see AtlasApp.tsx:763,
  comment at :761). Every other tab uses slug. `InternationalTab` props should name
  the field `countryId` to make the deviation explicit at call sites.
- Per-route defaults do NOT cascade through segment boundaries in Next.js 16 parallel
  routes. Every depth under `(shell)/atlas/` needs its own `@left/page.tsx` and
  `@right/page.tsx`, not just the root.
- Filter state (`searchQuery`, `regionFilter`, `govFilter`) stays owned by `AtlasApp`
  for the legacy `/` route because `setAtlasControls` at lines 359–415 reads them to
  inject into the global header. `AtlasCountryLeft` receives them as props, does not
  own them.

## 2026-05-01 — Atlas masthead facts must never be generated

The country masthead may only show source-backed facts or the explicit placeholder
`No source`. Do not reintroduce slug-hash/generated/demo values for language,
currency, trade, identifiers, literacy, medals, memberships, or other fact slots.

GDP in the masthead is CIA Factbook real GDP PPP and must be labeled `GDP (PPP)`.
If a future task switches to nominal GDP, update the label and source at the same
time.
