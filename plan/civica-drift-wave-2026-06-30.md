# Civica drift-cleanup wave — architecture + ledger (2026-06-30)

Blind audit: 16 read-only finders (none seeded with owner examples) + adversarial
skeptic per finding. **208 raw → 79 confirmed (4 high / 22 med / 53 low), 129 refuted.**
Audit run: `wuwvml6ma`, 224 agents. Raw ledger: `scratchpad/audit-ledger.json`.

## Recall check (owner's 14 examples vs the blind audit)
- ✅ Caught independently: different-sized Beta pills (3 impls); `#a7afbc`/`text-30`/`text-25`
  low-contrast text; atlas reset glyph (`⌈`); atlas instructions bar square corners;
  contact page bespoke inline styling; CI pages need restyle (hardcoded px / mono / contrast).
- ⚠️ Recall MISSES (image/layout finders under-covered — caught in my own recon instead, fixes known):
  1. Vertical engraving cropping ("seat of power") — `.post-hero-img`/`.post-figure` force 16:9 + object-fit:cover.
  2. "More from The Record" cards still render the old hemicycle SVG — `blog/[slug]/page.tsx:465` uses raw `p.coverImage` (null) instead of `resolvePostCover(p)`.
  3. Homepage stat band wraps "Open data & provenance" / "Independent & nonpartisan" onto 2 lines (`home.css` `.home-stat`).
  4. Atlas hover card omits the country engraving image (deliberate `compact mode` comment, `AtlasWorldMap.tsx`).
  5. `/compare` has no primary-nav entry (reachable only via contextual links).
- These 5 are folded into the wave below.

## Root-cause fixes (fix once → many findings)
- **R1 — Contrast token.** Darken `--color-text-30` (#A7AFBC "Mist") and `--color-text-25`
  to AA-passing values in `globals.css` (verify both themes). Decorative-only uses (dots,
  hairlines) tolerate the darker gray. Resolves HIGH#4, MED#22, the sitewide `#a7afbc` complaint.
- **R2 — One Beta tag.** Collapse `.ci-beta-pill` + `.editorial-beta-tag` +
  `.factbook-drawer-beta__pill` + `.factbook-reconciliation-notice__beta` into a single
  `<Chip tone="sand">Beta</Chip>` (or one `.beta-tag` class). Repoint all call sites.
- **R3 — One Button/Chip system.** Replace hand-rolled buttons with `.btn`/`<Button>` and
  selector chips with `<Chip>`: contact submit/reset/subject, corrections submit, admin
  data-disputes `.editorial-button`, admin pulse-review, admin sign-out, admin sign-in.
  (Masthead `CountrySwitcherChips` is removed by S1, not restyled.)
- **R4 — px font-size → `var(--text-*)`** in civica-index.css, civica-index-detail.css,
  editorial.css, globals.css, home.css.
- **R5 — Monospace → `var(--font-body)`** on non-code surfaces: compare eyebrow, RankingTable,
  leaderboard meta, pulse/corr/fact-value chips, HistoryChart SVG axis labels, contact buttons,
  factbook gov "structure" eyebrow.
- **R6 — radius literals → `var(--radius-*)`** (13 findings) incl. cards (pulse event, feature
  visual, CI dims table, CI panel, RankingTable) and atlas hints bar + compare banner (square→rounded).
- **R7 — spacing literals → `var(--space-*)`** (11 findings).
- **R8 — Eyebrow primitive.** Standardize on `.editorial-eyebrow`/`<SectionHeader>` (consistent
  color/case/font + decorative rules): contact, CI detail, compare, widget inline `<style>` eyebrows.

## Surface / feature fixes
- **S1 — Civica Index → factbook section (APPROVED).** Extract `/civica-index/[slug]` body into
  `<CivicaIndexCountryView>`; render as a `civica` section (`id="civica-index"`) in
  `factbook/[slug]/page.tsx` SECTION_PLAN reusing already-fetched `ciDetail`/`pulseV2` (+ history,
  changelog, rankings, peer sets). Add sidebar anchor. Redirect `/civica-index/[slug]` →
  `/factbook/[slug]#civica-index` (308). Remove `CountrySwitcherChips`. Repoint masthead CI/CP
  pills to `#civica-index`/`#pulse`. (Factbook page is scroll+sidebar, so the sidebar entry IS
  the "tab"; not a literal tab bar.) The standalone `/civica-index` leaderboard stays.
- **S2 — Contact page rebuild** (biggest finding cluster: 3 high). Wrap in `EditorialPage`;
  `contact.css` classes; `.btn` buttons; `<Chip>` subjects; eyebrow primitive; fix error alert.
- **S3 — Homepage.** (a) stat-band: keep ◆ + label on one line; (b) repoint `GlobalSearch`
  (homepage hero) from `/countries` → `/factbook`.
- **S4 — Atlas.** (a) reset glyph → recognizable icon (lucide RotateCcw / ↻); (b) hints bar +
  compare banner rounded + hairline; (c) hover card shows the country engraving image.
- **S5 — Blog images.** (a) "More from The Record" → `resolvePostCover`; (b) vertical covers/figures
  display fully (respect native aspect ratio — no forced 16:9 crop on portrait art).
- **S6 — Nav/IA.** (a) add **Compare** to the header primary nav; (b) `/countries` consolidation
  (OWNER DECISION below); (c) `/about/advisory-board` — link from `/about` or remove if stub.
- **S7 — Tables/cards.** RankingTable radius + mono; card radii.

## LOCKED ARCHITECTURE (owner, 2026-06-30) — unified `/country/[slug]`, 3 tabs
Owner rejected the 7-tab idea (repeats a past mistake). Final shape:
- Canonical page renamed `/factbook/[slug]` → **`/country/[slug]`** (safe: Ahrefs DR 0, 0 traffic,
  0 organic keywords, 233 referring domains all spam). 109 internal `/factbook` refs to update + sitemap/OG/redirects.
- **Three tabs:**
  1. **Factbook** — the CIA reference (current scroll + `FactbookSidebar` + sections), as-is.
  2. **Civica Data** — SAME scroll+sidebar format, holding the Civica layer: Civica Index, Bills,
     Government, Leaders, Legislature, Organizations, Rankings, Pulse.
  3. **Constitution** — its own tab, built as the **Constitution Explorer** (mockup:
     `mockups/04-18-2026-constitution-explorer.html`).
- All redirect in: `/factbook/[slug]`, `/civica-index/[slug]`, `/countries/[slug]` → `/country/[slug]`
  (Civica Index + Constitution land on their tab). Standalone `/civica-index` leaderboard stays.
- REUSE the surviving (currently dead) Atlas tab components: `src/components/atlas/tabs/{BillsTab,
  ChamberTab,ConstitutionTab,InternationalTab,ScoresTab}.tsx` for the Civica Data + Constitution tabs.
- This is **Wave 1b** (the restructure). Wave 1a = the URL-independent drift fixes (running now).

## MOCKUP BACKLOG (stage AFTER this wave — owner wants these, prioritized roadmap to follow)
~15 genuine feature ideas (the civica-index-*/editorial-*/factbook-landing-* mockups are already built).
Map to new IA: Civica Data tab deepenings (legislature deep-dive, party browser, gov-hierarchy chart,
leader profiles, leadership transitions, international-orgs, outcome bars); Civica Index (democracy
dashboard, backsliding tracker, press-freedom, historical trends, compare); standalone (constitution
explorer [this wave], provision search, election calendar, electoral-systems explainer, map-layer
switcher, advanced filters, embeddable cards). Build in focused waves, not all at once.

## (superseded) earlier OWNER DECISION — `/countries/[slug]` (the third country page)
It's a legacy **tabbed** country page (CountryTabs) duplicating factbook + CI, with possibly-unique
**constitution text** + **democracy-score comparison**. Options:
- (a) Redirect `/countries/*` → `/factbook/*`; port the unique sections (constitution, democracy
  comparison) into the factbook page in this wave. [Recommended — full consolidation, no content loss]
- (b) Redirect `/countries/*` → `/factbook/*`; drop the unique sections.
- (c) Keep `/countries`; only fix its drift + repoint homepage search.

## Execution
Root-cause fixes first (R1–R8 — token/system level, broad blast radius), then surface fixes
(S1–S7), each delegated to file-disjoint subagents where safe, verified (tsc + build + live
browser), committed with explicit pathspec, shipped to main. Deferred (do NOT touch): the v2
palette fork (accent/paper/shadows — owner-deferred 2026-06-20); the contrast fix (text-30) is
separate and in-scope.

## WAVE 1a — SHIPPED (commit 0de5f1e + engravings c3a508d, 2026-06-30)
7 file-disjoint agents; tsc + next build clean; browser-verified homepage/contact/civica-index/atlas/blog.
Done: R1 contrast (text-30 #A7AFBC→#5C6B7A 4.68:1, text-25, dark mode), R2 beta chip, R3 buttons
(contact rebuilt on EditorialPage/Banner/Chip; admin; corrections; sign-in), R4 px-fonts, R5 mono,
R6 radii, R7 spacing, R8 eyebrows; S3a stat-band; S4 atlas (reset icon, hints/banner rounded, hover
engraving image); S5 blog images (portrait shows full) + "More from Record" already on resolvePostCover;
S6a Compare in nav; S6c advisory-board linked; S7 RankingTable.

### Wave 1a leftover findings (fold into 1b cleanup)
- widget page inline `<style>` eyebrows (MED #10) — `civica-index/widget/page.tsx`.
- api-docs missing breadcrumb (MED #20).
- about `.cv-container` vs `.editorial-page` (MED #19) — verify whether F's footer-nav edit covered it.
- glossary container width 1040px (LOW) — `glossary.css`.
- countries/search radius/bg/ad-hoc (MED #11-13) — MOOT once `/countries` redirects in 1b.
- `--color-text-40` (#6A7688) is ~4.01:1 (just under AA) — OPTIONAL small bump; it's the core muted
  color, so flag to owner rather than change unilaterally.

## WAVE 1b — SHIPPED (f172524 → 3ab3fe0, 2026-06-30). Owner decisions: full Constitution
Explorer (adapted to design system); landing heading → "Countries"; URL renamed to /country.
- 1b.1 (f172524): `/country/[slug]` shell — shared layout (masthead + Factbook·Civica Data·Constitution
  tab bar) + Factbook tab (CIA sections). FactbookHeaderStrip gained optional `nav` prop.
- 1b.2 (f3a1536): Civica Data tab — CI (extracted CivicaIndexPanel) + Government + Legislature +
  Leaders + Bills + Organizations + Rankings, sidebar+sections, gated.
- 1b.3 (b0890f4): Constitution Explorer — two-pane, design-system, honest to metadata-only data.
- 1b.4 (3ab3fe0): FLIP — renamed /factbook→/country (landing "Countries"); moved methodology;
  deleted /factbook/[slug] + /civica-index/[slug] + /countries/*; 308 redirects (lookahead keeps the
  /civica-index leaderboard live); repointed ~33 files + masthead pills + search + sitemap + embed;
  removed CountrySwitcherChips. tsc+build clean; curl-verified all redirects; regression: all key routes 200.
- 1b.5 (in progress): leftover audit findings (widget eyebrows, api-docs breadcrumb, about container,
  glossary width).

### KNOWN DATA GAP (flag to owner / roadmap)
The `constitution` table is METADATA-ONLY (20 rows, 0 with fullTextHtml; ~170 countries no row). The
Constitution Explorer is honest about this (metadata + guided deep-links to Constitute Project; renders
fullTextHtml automatically if ever ingested). A true full-text reader needs a constitution-text ingestion
— Constitute Project is NON-COMMERCIAL-only (licensing caveat). Future work.

## (historical) WAVE 1b sub-plan:
- 1b.1 Route rename `/factbook/[slug]` → `/country/[slug]` (move dir; update ~109 internal refs incl.
  NavLinks/home/sitemap/OG/embed; add 308 `/factbook/:path*`→`/country/:path*`). Verify build + redirects.
- 1b.2 Add 3-tab shell (Factbook | Civica Data | Constitution); default = Factbook (current content).
- 1b.3 Build "Civica Data" tab = scroll+sidebar folding in CI + Bills + Government + Leaders + Legislature
  + Organizations + Rankings + Pulse (reuse atlas tabs/* + the CI page body). Redirect
  `/civica-index/[slug]` → `/country/[slug]` (civica-data tab). Drop CountrySwitcherChips; repoint masthead pills.
- 1b.4 Constitution tab = Constitution Explorer (mockup 04-18). Redirect `/countries/[slug]` → `/country/[slug]`.
- 1b.5 Cleanup: delete old page bodies now redirected, repoint homepage search → `/country`, fix the 1a
  leftover findings, final browser pass.

## MOCKUP ROADMAP — deliver after Wave 1b (owner wants these, prioritized).
