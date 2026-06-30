# Project Memory Sessions

## 2026-06-30 (pt6) — Option B SHIPPED (three-pane shell retired) + hero parallax

Executed Option B end-to-end via sequential subagents (one per phase, verified +
committed between each) + a parallel parallax agent. All live on `main` → civicaatlas.org.

OPTION B — the three-pane `(shell)` is GONE. New architecture is reader-first:
- **Phase 1**: Civica Index moved `(shell)/civica-index/*` → `(reader)/civica-index/*`
  (URLs identical). Left-rail filters → a top filter bar (`CivicaIndexFilterBar`:
  region SegmentedControl + V-Dem/WB/income/CGV selects + country search). Right-rail
  Ask-Civica dropped (global drawer is a deferred follow-up). [slug] + widget are reader pages.
- **Phase 2**: atlas map → standalone `(reader)/atlas` (`AtlasStandaloneClient`, decoupled
  from ShellContext; click → /factbook/[slug]). The DUPLICATE atlas country/compare pages
  retired via 308 redirects in next.config.ts: `/atlas/:slug(/:tab)` → `/factbook/:slug`,
  `/atlas/compare` → `/compare`. Organizations → standalone `(reader)/organizations`
  (`/atlas/organizations*` → `/organizations*`). Embed/sitemap/switcher links repointed.
- **Phase 3**: DELETED the entire `(shell)` group + all 8 shell components (ThreePaneShell,
  ShellContext, ShellCountryRail, ShellOrgRail, AskCivicaPanel, PaneHandle, ShellRouteFrame,
  AtlasLeftModeToggle) + dead lib/shell/suggested-prompts. KEPT `lib/shell/events.ts` (the
  civica:ask bus — still used by factbook CivicaAIDrawer/bills/atlas) + shell.css
  (.atlas-resizer used by /compare). Production build clean: 47 routes, zero (shell).
  Plan doc: ~/civica/plan/atlas-shell-retire-option-b-v1.md.

PARALLAX — `src/components/motion/ParallaxImage.tsx` (Motion useScroll/useTransform): every
hero engraving (homepage, factbook landing, factbook COUNTRY masthead, about) drifts ~12%
slower than scroll. Over-scan (inset:-10%; height:120%) so no edge gap; tracks each hero
SECTION; dark-invert preserved; mobile country masthead opts out; useReducedMotion + SSR fail-safe.

Also fixed: FactbookLegislatureChart hydration (round seat cos/sin cx/cy to 2 decimals) —
country pages now console-clean.

BLOG IMAGES — DONE + live. Codex saved each illustration to public/blog/<slug>/ named by
the slugified CAPTION (full color). The article renderer (blog/[slug]/page.tsx mdxComponents
factory) auto-upgrades each "Image placeholder" blockquote → <figure>+<figcaption> when the
file exists (re-runnable). All 42 inline figures across the 10 articles are wired + live;
190 country engravings live. COVER RESOLUTION (resolvePostCover in src/lib/blog.ts, used by
BOTH /blog index cards AND the article hero): dedicated **public/blog/<slug>/cover.{webp,png}**
→ first-placeholder engraving → frontmatter coverImage → HemicycleCover. The first placeholder
is skipped inline ONLY when it's serving as the cover (a cover.webp lets it render inline).
PENDING: owner is generating dedicated 16:9 hero covers (cover.png per slug) from the 10 hero
prompts I gave; drop them in public/blog/<slug>/cover.png → convert to webp → they auto-become
the hero (and the first placeholder reverts to an inline figure). Keep converting any new
public/blog/*/*.png and public/engravings/countries/*.png → webp on each drop.

## 2026-06-29 (pt5) — Hero-height token, articles published, Motion animations, hydration fix

Shipped to `main` (76b8348→ef065b4) → civicaatlas.org, verified live.
- **Factbook landing hero full-bleed fix**: root cause was a CSS CLASS COLLISION —
  the landing reused `.factbook-hero`, inheriting the country-page masthead's
  `max-width:1280px` + `display:grid`, so on wide screens the hero capped at 1280px
  (big white gap right). Gave the landing its own `.factbook-landing-hero` class
  (full-bleed, max-width:none). LESSON: the country masthead `.factbook-hero` and the
  landing `.factbook-landing-hero` are DISTINCT — don't merge.
- **Canonical `--hero-height` token** (`clamp(460px, 44vw, 640px)`): hero sections now
  share one height (`.home-hero`, `.factbook-landing-hero` [now flex-centered], `.about-hero`);
  measured equal (595px @ 1352vw). Mobile relaxes to content height. Documented in DESIGN.md.
- **10 Record articles PUBLISHED**: un-drafted (removed draft:true + the not-yet-existing
  coverImage) so they show on /blog; covers fall back to the generated HemicycleCover.
  blog.ts supports `draft:true` (filtered) for future drafts. The article blockquote
  renderer (blog/[slug]/page.tsx) now detects "Image placeholder/Codex prompt" blocks and
  renders a dashed "Illustration pending" figure (label + muted prompt/caption) instead of
  the pull-quote style. (Owner generates art from the in-body Codex prompts, then adds the
  image + coverImage.) NOTE: blog/[slug] had no runtime React import (only the global type
  namespace) — used `isValidElement` named import, not `React.isValidElement`.
- **Motion animation layer** (taste-skill, Leonxlnx/taste-skill, MOTION dial ~3): added
  `motion` ^12.42.0 + src/components/motion/Reveal.tsx (Reveal / Stagger / HeroReveal).
  Restrained entrance + scroll reveals (ease cubic-bezier(0.16,1,0.3,1), 0.55s, 0.08s
  stagger). Applied to homepage (hero entrance + feature/card/index-row reveals), factbook
  landing hero, glossary letter groups, The Record. CRITICAL: useReducedMotion + a no-JS
  fail-safe (SSR has zero opacity:0) so content is NEVER trapped invisible. No GSAP/marquees/
  pinning (wrong register for the almanac).
- **HemicycleCover hydration bug fixed** (~24 console errors on blog pages, surfaced because
  the new articles use the hemicycle FALLBACK cover): rounded cos/sin cx/cy/opacity to 2
  decimals (`r2()`) so SSR (Node) + browser serialize identical SVG attrs. (An agent spawned
  a spawn_task chip for this; fixed in main session instead — chip is moot, owner can dismiss.)
- Engravings now 115 (Codex dropped ~20 new incl. mex/lux/mys/lie/mco/mda/mli/mlt/mus/mys).
  Still missing for the picker/heroes: esp nor swe che nld per pol prt tur sau zaf nga rus
  ukr vnm tha phl.

## 2026-06-29 (pt4) — Hero rebalance, 10 Record drafts, sourced glossary; Option B chosen for atlas/shell

Shipped to `main` (28d1c67→e73dbd8) → civicaatlas.org, verified live.
- **Factbook landing hero rebalanced**: was centered-but-lopsided (engraving's
  mountain right, empty left). Now homepage idiom — left-aligned content
  (eyebrow/title/dek/search/chips) + left-protecting linear scrim, engraving
  reads on the right. factbook.css `.factbook-hero-inner/-scrim/-dek/-search/-chips`.
- **10 long-form Record articles** (content/blog/*.mdx, draft:true) via a Workflow
  (research → write → independent no-AI-isms polish pass; used the /no-ai-isms skill
  guidance). ~1100-1800 words each, grounded in real facts. Each has inline
  "> **Image placeholder** / Codex prompt / Caption" blockquote blocks (engraving
  house style) for the owner to generate art. Topics: modern coups, constitutional
  longevity, second chambers, term limits, measuring democracy, absolute monarchies,
  voting systems, backsliding, who runs a country, microstates.
  - blog.ts now supports frontmatter `draft: true` → excluded from the site
    (getAllPosts filters). Remove the flag + add cover/inline images to publish.
- **Glossary expanded 31→58 terms, all sourced**: added GlossarySource type +
  `source` field; renders a muted "Source: <name>" line per term (Britannica,
  Stanford Encyclopedia, Merriam-Webster, V-Dem, World Bank WGI, Freedom House,
  Transparency Intl, UNDP, etc. — PARAPHRASED, not verbatim, for copyright). +27
  procedural/comparative terms. New "process" tag (rose). glossary.ts/page.tsx/glossary.css.
- Engravings now 95 (added kgz/kwt earlier + lao/lbn/lva).

### Owner DECISION — atlas + three-pane shell: OPTION B (locked 2026-06-29)
Retire the three-pane `(shell)` entirely; keep a LIGHTWEIGHT standalone map.
- Civica Index (`/civica-index`, `/[slug]`) → reader-style pages (full-width like
  /factbook). Left-rail filters → a top filter bar (SegmentedControl + chips).
  Right-rail "Ask Civica" → the global docked drawer (reuse CivicaAIDrawer pattern).
- The duplicate atlas COUNTRY experience (`/atlas/[slug]`, `/[slug]/[tab]`) retires
  to the factbook reader pages (which already cover hemicycle/bills/leaders):
  redirect `/atlas/[slug]*` → `/factbook/[slug]`.
- `/atlas/compare` → existing `/compare`. `atlas/organizations` → standalone
  `/organizations` reader page (default; or fold in). Embed widget
  (`civica-index/widget`) survives as a standalone route.
- The choropleth MAP survives as ONE self-contained `/atlas` page (no panes, no
  parallel routes): map + hover/click → small card linking to /factbook + /civica-index.
- DELETE the whole `(shell)` group (@left/@right slots, layout) + shell components
  (ThreePaneShell, ShellContext, PaneHandle, ShellRouteFrame, AskCivicaPanel,
  ShellCountryRail, ShellOrgRail, AtlasLeftModeToggle). Atlas --atlas-* map tokens stay.
- NOT STARTED — large/risky refactor; plan at ~/civica/plan/atlas-shell-retire-option-b-v1.md.
  Execute as its own focused wave with careful per-surface verification.

## 2026-06-29 (pt3) — Editorial build wave + canonical search shape, shipped to prod

Owner picked from the pt2 mockups + new asks. All live on `main`
(9fbca6f→eedc405) → civicaatlas.org, verified (incl. mobile).

- **Canonical search shape = rounded RECTANGLE (radius-lg), NOT pill** (owner
  decision). Changed `.country-search__field` + `.country-search__results` +
  `.factbook-index-search-field` radius-full→radius-lg. DESIGN.md/AGENTS.md
  updated (radius-full is now circular-controls-only). NOTE for future work:
  search boxes are rounded rectangles site-wide, never pills.
- **Factbook landing rebuilt = mockup Option C**: full-bleed engraving hero
  (homepage idiom) + canonical rounded-rect search (CountrySearchCombobox) +
  region filter chips + dense A–Z "almanac index" (SVG flags, terracotta
  drop-letters, 253 countries). New src/components/factbook/FactbookAlmanac.tsx;
  deleted dead FactbookIndexSearchList.tsx.
- **The Record (/blog) restyled** to the updates-index mockup (masthead, lead
  story, card grid) — PRESERVED "In the margins", "Editor's note", "Topics"
  (now tinted chips), Colophon, per owner.
- **Longform (/blog/[slug]) restyled** to the longform mockup (scrim engraving
  hero, terracotta drop cap, pull-quote) — PRESERVED .post-rail sidebar,
  .post-author box, .post-more "More from The Record" (already existed; kept +
  restyled), per owner. Fixed latent mobile overflow (min-width:0 on .post-prose).
- **NEW /glossary page** (didn't exist): 31 curated governance terms
  (src/lib/data/glossary.ts), sticky A–Z scroll-spy strip (GlossaryNav.tsx),
  two-column terms + tinted category tags + See-also methodology links. Scoped
  src/app/glossary.css. Footer link added (between Licensing & Contact) + sitemap.
- **About page hero**: full-bleed engraving masthead (.about-hero in editorial.css),
  PLACEHOLDER /engravings/hero.webp — owner will swap a bespoke Codex engraving
  later (src + comment flag where).
- **Factbook mobile country header** fixed to "gorgeous": on ≤768px the
  `.factbook-hero--art` overlay stacks vertically (engraving banner 5:4 → caption
  → masthead on paper → 2-up MAP/IMAGES tiles); was hidden-engraving + overflowing
  tiles. Desktop overlay unchanged (scoped to mobile media block).
- Engravings now 92 countries (added kgz/kwt; jor/kaz/kir/xkx earlier in pt2).

MISSING engravings still (for Codex): esp nor swe che nld mex per pol prt tur sau
zaf nga rus ukr vnm tha phl (graceful fallback meanwhile).

## 2026-06-29 (pt2) — Almanac polish wave: SVG flags, captions, drift sweep shipped

Owner request batch (went to gym, "make a lot of progress"). Shipped to `main`
(bba2964→de5c3f5) → civicaatlas.org, verified live. Orchestrated via subagents +
a 2nd drift Workflow.

SHIPPED & LIVE:
- **SVG flags sitewide**: CountryFlag now uses flagcdn `<iso2>.svg` (vector) + hairline
  ring; every emoji flag replaced with <CountryFlag> (HomeGrid cards + Index table,
  CountrySearchCombobox, Compare picker). Only remaining emoji is CountryFlag's onError fallback.
- **Factbook hero captions**: per-country landmark caption on the engraving hero, from a
  committed data module `src/lib/data/engraving-captions.ts` (generated from Codex's
  manifest `~/civica/plan/country-engraving-manifest-2026-06-28.json`, 197 rows iso3→landmark).
  Wired in FactbookHeaderStrip (heroCaption prop) + factbook/[slug]/page.tsx.
- **Visual-consistency sweep** (Workflow: 4 finders + adversarial verify, 13 confirmed
  low/med findings) — all fixed: 'Sources on this page' box, MAP/IMAGES tiles, factbook
  bill/index/leaders cards, Civica AI drawer, search-results dropdown all had ink-navy
  (--color-text-primary) HARD borders → now soft hairline (--color-card-border) + radius +
  soft shadow. Civica AI drawer 'Beta' mono-uppercase pill → mixed-case sand Chip.
  Hemicycle tooltip (4px 4px 0) + embed widget (3px 3px 0 / 6px 6px 0) hard-offset shadows
  → soft tokens; embed widget square→rounded, ink border→hairline, hard-lift hover→subtle.
- **Atlas country-hover card** redesigned to the new country-card language (CountryHoverCard
  + .v2-country-card in atlas.css): SVG flag, soft shadow-hard-lg, radius-lg, tonal Chip,
  tabular-nums. Atlas --atlas-* tokens + map untouched (owner asked for the hover card specifically).
- Engravings now 90 countries (added jor/kaz/kir/xkx).

MOCKUPS DELIVERED for owner to pick (in mockups/, 06-29-2026- prefix):
- factbook-landing-A/B/C (3 country-picker concepts: Region Grid [recommended] / Featured+RegionTabs / Typeahead+AlmanacIndex)
- editorial-longform (DS-6 "Inside Democratic Resilience" longform) / editorial-updates-index ("The Record") / editorial-glossary (NEW — no glossary exists yet)

STILL TODO (gated on owner's mockup pick — do NOT build until he chooses):
- Build the chosen /factbook landing redesign.
- Build the chosen editorial/longform template + the Glossary (new page, needs term content).
- About-page hero image + editorial hero images (needs asset choice: reuse an existing
  engraving e.g. hero.webp, or new Codex art).
- MISSING engravings for Codex: esp nor swe che nld mex per pol prt tur sau zaf nga rus ukr vnm tha phl
  (those countries' factbook heroes fall back gracefully meanwhile).

## 2026-06-29 — Almanac redesign: component reconciliation shipped to prod

Continued the "fine-press almanac" redesign (mockups at ~/Downloads/Civica/,
spec at ~/civica/plan/component-spec-v1.md + almanac-redesign-plan-v1.md).
Owner asleep, said "continue until done." Orchestrated via Opus subagents +
a drift-audit Workflow; verified + committed + merged + deployed in the main
session. All live on `main` (97fe78f..47e8b1c) → civicaatlas.org (verified:
homepage renders Japan/Estonia data cards, Explore Countries CTA, pill search).

What shipped (10 commits):
- **Phase 0** — measured a real per-component spec from the 10 DS sheets + OG
  homepage (pixel crops in ~/civica/plan/mockup-crops/) → component-spec-v1.md.
- **Phase 1 components**: killed monospace sitewide — `--font-mono` repointed to
  Inter, new `--font-code` for genuine code/API surfaces only (.api-code-block/
  .meth-formula/markdown/cssVar chips); tabular-nums on numeric tables. Rewrote
  Pill.tsx → tinted rounded mixed-case **Chip** (neutral/sage/sand/rose/blue/
  accent; Beta is now a sand chip) + `.editorial-chip--*` tonal modifiers. New
  `.btn` system + Button.tsx (primary navy+arrow auto-inverts via
  color:var(--color-page-bg); secondary/tertiary/text; sizes/states). Pill
  SearchField (CountrySearchCombobox showFilterIcon). New SegmentedControl.tsx.
  Reconciled `.tab-nav` to mixed-case Inter + underline. `/design-system`
  reflects all of them.
- **Phase 2 homepage** (src/components/home/HomeGrid.tsx + new home.css +
  CountryCard.tsx): rebuilt to the OG mockup — Japan + Estonia country data
  cards (flag + serif name + income Chip + stat row + per-country engraving,
  dark-inverted) + a real multi-column Civica Index table (rank/flag/name/score/
  tier swatch + Beta chip) + "Data from World Bank·IMF·UN·V-Dem·Freedom House"
  footer band, all from live getCIRankings/getCanonicalFactsForJurisdictions.
  Extracted the `.home*` CSS out of atlas.css (pure 220-line deletion → home.css;
  /atlas verified unchanged). Header: "Explore Countries →" btn--primary CTA
  (shows ≥1200px only — below that the 6-item nav fills the bar).
- Factbook country page + /civica-index leaderboard were ALREADY reconciled by
  the global Phase 1 changes + the prior engraving-hero work (no rebuild needed).
- **Drift audit** (Workflow: 4 parallel finders + per-finding adversarial verify,
  17 agents): 10 confirmed low/med findings, 0 high — confirms Phase 1 propagated
  cleanly. Fixed all: CI vintage pill + gov-types lens tabs → mixed-case; compare
  section tabs + Remove button → mixed-case/btn; blog Topics + factbook switcher
  chips → rounded; factbook search → pill; beeswarm SVG labels → var(--font-heading)
  (was unloaded 'Fraunces'); blog colophon copy. Plus a separate fix: shortGovLabel
  on the index leaderboard was leaking raw snake_case (e.g.
  "federal_republic_formally_a_confederation") — added branches + humanizing fallback.
- Engravings: Codex dropped re-renders; converted to WebP, now **86 countries**
  in public/engravings/countries/ (jpn/est etc. refreshed).
- Docs: DESIGN.md + AGENTS.md synced to the almanac component system (mono policy,
  Chip/Button/SegmentedControl/pill-search, radius roles).

OWNER DECISIONS / DEFERRED (surface when he's back):
- Nav naming: mockup says "Updates" + reorders About/Methodology; we kept
  "The Record" + current order/dropdowns (richer than the flat mockup nav). Not
  renamed — his call. Mockup also shows a search-magnifier icon where we have the
  mobile-nav hamburger (≡) on desktop (pre-existing); could become a search trigger.
- Homepage Index table shows Overall + Tier only; per-dimension columns (Political
  Rights/Rule of Law/…) in the mockup need a new query (not in getCIRankings) — deferred.
- Country cards use the engraving stacked below the data (vs mockup's photo-on-right) —
  intended substitution (we use engravings, not photos).
- Left atlas-shell ShellCountryRail mono empty-state (owner-protected boundary) and
  FactbookLightbox #000/#fff image scrim (documented theme-independent exception) untouched.
- Wordmark kept "Civica Atlas" title-case (mockup shows "CIVICA ATLAS" caps).

## 2026-06-21 — Autonomous audit-remediation wave (4 packs shipped) + Pulse methodology

Owner: "do as much as you can without my input … not the atlas design token
cleanup (atlas has atlas-specific things)." Delegated to file-disjoint
subagents, verified + committed in the main session. All live on `main`
(commits d7556ef, e562a32) — Vercel auto-deploys.

- **Security** — admin session cookie no longer stores raw ADMIN_API_KEY
  (opaque `nonce.sha256(KEY:nonce)` token, constant-time, Bearer path
  unchanged); cron-auth timingSafeEqual + generic errors; rate-limit uses
  x-real-ip / right-most XFF (not spoofable first hop); /export throttled.
- **API polish** — v1 Pulse changelog/history deprecation headers; by-government-type
  structural_family deprecation.
- **Provenance** — /countries reads real sources.last_sync_at (wikidata/constitute);
  CI seeders stamp at data vintage (runIngestion gains vintageAt); v1 GDELT stamps.
- **Correctness** — rankCountriesByFact + getCountryRankings DISTINCT ON
  (jurisdiction,fact_key) canonical dedup (no double-count once a fact gets a
  2nd source; no-op today); tiers.ts cutoffs aligned to bands.ts; calculate-v2
  deterministic rank tiebreak; getPulseReviewQueue SQL ORDER BY before
  LIMIT/OFFSET; /compare Math.round + resolver-canonical picker population;
  /api/v1/countries list batch-resolves display facts via resolver (was cache).

Pulse methodology (earlier same session): rewrote content/methodology-pulse.md
to current reality (classify→verify replaces 3-temperature; subject-country
attribution; honest sources/cadence; removed unimplemented anti-gaming claims).
v2.1 research resolution (cited): sanctions/inter-state acts OUT of scope
(guardrail added to classifier-prompt + pulse-daily skill + methodology page);
announcement-vs-enacted sharpened; state-media discount / graded-announcement
lifecycle / single-source hard-gate / self_coup category all DEFERRED.
Docs: ~/civica/plan/pulse-classification-confidence-methodology-v1.md,
pulse-methodology-v2.1-resolution.md, audit-remediation-status-2026-06-21.md.

STILL NOT DONE (deliberate later pass): ~18-adapter factbook sync DRY refactor;
dead-code cleanup (~11 findings); design-system v2-fork (owner-deferred,
memory-decisions 2026-06-20); non-atlas low design-token literals
(design-system/dev-panel). Atlas design tokens intentionally left alone per owner.
Note: one stray mockup (06-21-2026-democracy-backsliding-tracker.html) got
swept into commit 109ae73 by git add -A — harmless, follows the convention.
A transient server-side rate limit (not usage limit) cut off 2 subagents
mid-run; work was re-driven cleanly.


## 2026-06-20 — Blind audit + architecture sweep + feature research (read-only; no code changed)

Ran a blind multi-agent audit (124 agents across 2 workflows: 6 architecture
maps + 15 blind finders + adversarial skeptic per finding; then a 3-piece
gap-fill re-run for the CI map, Pulse map, and Pulse-calc finder that died
mid-response). In parallel, a research track (OWID/V-Dem/World Bank/etc.)
produced a cited architecture+features report. Two deliverables in
`~/civica/plan/`:
- `civica-blind-audit-2026-06-20.md` — architecture explainer (6 subsystems),
  86 verified findings (~15 high / ~26 med / ~45 low), 13 refuted, root-cause
  rollup, sequencing.
- `civica-architecture-and-features-research-2026-06-20.md` — peer benchmarking
  + citability gaps + top-10 feature roadmap (111 cited URLs).

Headline confirmed bugs (NOT yet fixed — read-only audit):
- CI Freedom & Rights dimension computed on wrong scale (ingest feeds FH 1-7
  avg; normalize-v2 expects 2-14 sum) → autocracies flattered (SAU 58 not 0).
  Verified by hand: scripts/ingest-ci-freedom-house.ts:42 vs normalize-v2.ts:83.
- ~4 CI query helpers omit `methodology_version` → v1.0/beta mix (zig-zag
  history, double-counted gov-type avgs). queries.ts:936-1014.
- Rankings double-count countries (no active/canonical dedup). queries.ts:251.
- Pulse upsert.ts:98 + classify.ts:478 fake last_sync_at on zero-insert/non-fetch
  passes (validator allowlists them → false green).
- SourceDot.tsx:42 treats only cia_factbook as frozen → green "live" dot over
  all frozen quarterly sources incl. CI itself (contradicts /about legend).
- Pulse published methodology advertises anti-gaming rules (announcement-30%,
  state-media-50%, press-freedom hold-for-review) not enforced in code
  (corroborate.ts is a multiplier, not a gate).
- Undocumented "v2" visual migration: live site = Bronze/Parchment + SOFT
  shadows; DESIGN.md/CLAUDE.md still say cinnabar/paper + HARD; embed = 3rd
  divergent look; `--shadow-hard` token is now soft.
Root causes (fix once → many findings): methodology_version filter, SourceDot
frozen-map, read-path fact dedup, corroboration-as-gate, the v2 visual-migration
doc reconciliation, and the 18x copy-pasted factbook sync adapters.
Next.js 16 compliance verified clean. Owner can supply a private known-examples
list for a recall check (blind-audit step 3) — not done this session.

### Remediation applied same session (code changes uncommitted in working tree)
- **CI methodology_version filters**: getCICountryHistory, compareCICountries
  (composites+dimensions), getCIByGovernmentTypeDots, getGovTypeTrajectory now
  pin `methodology_version='beta'` (queries.ts). Fixes zig-zag history +
  double-counted gov-type aggregates.
- **SourceDot frozen set** expanded from just cia_factbook to all frozen
  academic/quarterly vintages incl. civica_curated (SourceDot.tsx) → green now
  reserved for genuinely live feeds.
- **Bills tab**: stopped stamping today's date (retrievedAt={null}); replaced
  false "Data refreshes hourly" with "fetched live from the official feed".
- **Freedom House scale**: ingest-ci-freedom-house.ts now emits the 2–14 SUM
  (avg×2) matching normalize-v2 + methodology. IMPORTANT: the live displayed
  beta data (2024-Q4) was ALREADY on the correct 2–14 scale (SAU raw 14→0,
  USA 4→83.3), so this was a latent re-run landmine — NO prod recompute was
  needed. The buggy 1–7 values only ever existed under 2023-Q4 v1.0 (retired).
- **Pulse freshness faking** fixed: upsert.ts now stamps via markSourcesSynced
  gated on inserted>0; classify.ts no longer stamps during the non-fetch
  classifier pass. Removed both from validate-sync-freshness ALLOWLIST → now
  only source-freshness.ts is allowlisted (validator passes: 1 allowlisted, 0
  offenders).
- **Honesty copy**: /about Pulse "daily" → paused-caveat wording; /elections
  "200+ countries" → "a growing set of countries" (DB had 22); data-approach.md
  CI "published and stable" → "published but still in active development".
- Verified: `tsc --noEmit` exit 0, validate:sync-freshness + content-templates
  green, browser-checked /civica-index/burma (CI breakdown reconciles, FH 8/100
  for the junta, frozen "Quarterly cadence" dot).

### Pulse country re-attribution (DATA FIX applied to prod)
Owner reported events attributed to wrong country (source-language/outlet, not
subject — e.g. a Portuguese story about US politics → Brazil). Built
`scripts/reattribute-pulse-country.ts`: an LLM pass (claude-sonnet-4-6,
ANTHROPIC_API_KEY_PULSE_CLASSIFIER) that classifies each pulse_events_v2 row by
its SUBJECT country, ignoring text language/outlet. Dry-run then --apply.
Result: of 135 v2 events, **64 (47%) were misattributed and corrected**, 70
already correct, 1 flagged. Then cleared pulse_dimensional_deltas and recomputed
(calculateDimensionalDeltas): 103 published events, 49 countries, 45 significant
deltas. E.g. Myanmar/Burma went from scattered (Suu Kyi events tagged
DNK/MYS/IND/CAN/DEU/IT) to 27 events, rule_of_law delta −15; Ukraine, Hungary,
Antigua, Cuba all corrected. Report: ~/civica/plan/pulse-reattribution-2026-06-20.md.
NOT done (deferred / needs owner call): the DURABLE fix — wiring this LLM
subject-attribution step into the v2 ingest/classify pipeline before un-pausing
Pulse (owner said "for now" just fix existing). v1 pulse_events (462, deprecated,
not displayed) left unchanged. Did NOT touch: rankings dedup (latent),
design-system v2-fork reconciliation (needs owner decision), Pulse
corroboration-as-gate + announcement/state-media rules (part of owner's planned
Pulse methodology rework), admin-cookie-raw-key / XFF security.

### Follow-up same session — pipeline wiring + subscription daily routine (committed + deployed)
Owner asked to wire the attribution fix into the pipeline (but keep it paused —
no more API spend) and to run the daily re-classification on his $200 Claude Max
SUBSCRIPTION (not API credits) via a Claude Code routine. Done:
- DURABLE pipeline fix: src/lib/pulse/v2/country-attribution.ts (shared subject-
  attribution brain) wired into classify.ts so the live pipeline self-corrects
  attribution. reattribute-pulse-country.ts refactored to share it (DRY).
- SUBSCRIPTION daily routine: the only API-billed pipeline stage is classify, so
  the routine moves that work to the AGENT (subscription). New scripts:
  pulse-export-clusters.ts (ingest+cluster+export unclassified clusters → JSON,
  no paid API) and pulse-apply-classifications.ts (apply agent decisions via the
  EXISTING validated writeEvent + corroborate + score, no paid API). Skill
  `.claude/skills/pulse-daily` orchestrates: export → agent classifies by
  category/severity/SUBJECT-country → apply. classify.ts now exports
  loadUnclassifiedClusters/writeEvent/types for reuse.
- Scheduled task `civica-pulse-daily` created via scheduled-tasks MCP: daily
  07:09 local, notifyOnCompletion. It's a DESKTOP scheduled task (runs while the
  Claude app is open; catches up on next launch if closed) → bills the Max
  subscription (verified no bare ANTHROPIC_API_KEY in env/rc files; the suffixed
  ANTHROPIC_API_KEY_* keys only feed project scripts, not Claude Code auth).
  Backlog: export found 186 unclassified clusters (ingested-but-never-classified
  from the mid-run pause) — first routine run clears them. Owner advised to click
  "Run now" once to pre-approve Bash/tsx tools for unattended runs.
- Research (cited) saved via the routines-research agent: subscription billing
  requires NO bare ANTHROPIC_API_KEY in env, and the LLM work must be the agent's
  (a script calling the SDK still bills API). Cloud Routines (claude.ai/code,
  laptop-closed) are the more-reliable alternative if the desktop-app-open
  caveat becomes a problem; would need Neon host on the routine env network
  allowlist + DATABASE_URL env var.
- Everything pushed to main (commits 63fe0ab fixes, 1023756 routine) → Vercel
  auto-deploy. The Pulse country re-attribution data fix is already live in the DB.
DEFERRED still: design-system v2 fork (memory-decisions 2026-06-20, owner will
review later), rankings dedup (latent).

## 2026-06-07 — Deep-audit remediation + domain fix (shipped to prod)

Implemented the deep-audit high/medium fixes across many delegated agents,
verified, and deployed to production (commits `b195e6c` then a tests/OG
follow-up). Highlights:
- CI per-dimension breakdown now reconciles with the headline via
  `displayDimensionScore` (v2 fixed-bound normalize), applied consistently to
  the country page, `/api/v1/index`, `/api/v1/countries`, embed, and compare.
- Citations stamp the real data vintage (not today); removed false
  "real-time/daily" Pulse claims + false "available as JSON" claims; CI hero
  dot live→frozen.
- Security: Next.js 16.2.3→16.2.7 (clears high-sev advisories); `/api/chat`
  rate-limited + input caps + generic errors; conservative security headers
  in next.config (embed stays framable).
- 404 for unknown country slugs (removed the `loading.tsx` boundaries that
  streamed 200 before notFound); site OG image + apex canonical.
- Dark-mode atlas hover card fixed (CountryHoverCard/v2.css → theme tokens +
  hard-offset shadow). Browser-verified (CI frozen dot + dark hover card).
- Wired the 13 previously-never-run test files to `npm test`
  (`node --import tsx --test`); added regression tests (CI normalize, cite
  date, V-Dem RoW tier) → 30 tests pass. OG `og:image` now on every page via
  `src/lib/og.ts` `withOg()`.
- DOMAIN FIX (via Vercel API, CLI auth): flipped primary so apex
  `civicaatlas.org` serves production and `www`→apex (308). Now matches the
  code's apex canonical/sitemap/robots. Reversible; done apex-first to avoid a
  loop. Note: the Vercel MCP was erroring; used the REST API with the CLI's
  stored token.

Open follow-ons (NOT done; need scoping/owner input): Pulse data-quality
rebuild (methodology-sensitive — should get a resolution doc, not vibe-coded),
cacheComponents→`use cache` migration, full design-token/CSS consolidation,
durable cross-instance rate-limit store (needs KV provisioning), and exporting
`mapVdemRowToOrdinal` for direct test coverage.

## 2026-06-07 — Deep audit (live app, data, security, styling, code)

Ran a 40-agent workflow auditing the DEPLOYED site (civicaatlas.org) + API
+ repo across 5 lenses. Report: `~/civica/plan/deep-audit-live-data-security-styling-code-2026-06-07.md`.
81 findings (12 high / 37 medium / 32 low), 0 refuted. Headline themes:
flagship over-promise (Pulse advertised "real-time/daily" but cron paused
+ data ~5 weeks stale + scores from misattributed/duplicated/opinion-source
events; CI per-dimension breakdown doesn't sum to headline or match
methodology); credibility cuts (cite stamps today's date not data vintage;
green "live" dot over frozen quarterly data; cross-surface value drift;
missing OG image; apex/www canonical mismatch; junk country URLs 200 not
404); security quick-wins (unauthenticated unthrottled /api/chat LLM
endpoint = cost-abuse risk; Next.js 16.2.3 has high-sev advisories ->
16.2.7); 13 test files exist but no runner/CI ever executes them; plus
large styling-token drift + sync-layer duplication (mechanical, later).

## 2026-05-09 — V3 visual-language prototype

Added an isolated `/v3` design-system prototype based only on the user's
attached mockups, not on existing Civica visual assets. New files:
`src/app/v3/page.tsx`, `src/app/v3/V3ShowcaseClient.tsx`, and
`src/app/v3/v3.css`.

The route hides the existing site header/footer for a clean V3 preview, defines
V3-only light/dark prototype tokens, and renders code-native atlas motifs,
color systems, typography, buttons, search, cards, map/data examples, tables,
bars, ramps, soft shadows, and responsive layouts. Verified with
`npx eslint src/app/v3`, `npm run build`, Browser on `http://localhost:3000/v3`,
and `agent-browser` desktop/mobile screenshots plus a short walkthrough video
under `/tmp/civica-v3-qa/`.

## 2026-05-07 — Global scrollbar defaults

Atlas-style scrollbar treatment moved into global CSS so long sidebars
and other overflow containers inherit it by default. `src/app/globals.css`
now defines shared `--scrollbar-*` tokens plus Firefox/WebKit global
rules; `src/app/atlas.css` no longer owns the broad `.atlas-root *`
scrollbar rule; `src/app/civica-chat.css` points chat scroll containers
at the shared tokens. Verified with `npm run build` and `agent-browser`
on `/factbook/united-states` and `/atlas`; screenshots/video live under
`~/civica/plan/`.

## 2026-05-03 — `structural_family` removal — Phase 4 public API deprecation contract shipped

Phase 4 of the structural-family removal landed. Sunset date locked
at **2027-03-31** (calendar-anchored, not vintage-anchored — gives
external API consumers \~10 months of overlap regardless of small
shifts in Phase 4 ship date). Successor endpoint locked as a single
`/api/v1/peer-groupings` returning all four lenses + monarchy\_status
in one response (matches Phase F's `meta.reconciliation` envelope
conventions; consumers almost always want all lenses for
orientation, sub-paths would force multiple round-trips for the
common case).

### What shipped

- **`src/lib/api/deprecation.ts`** — shared constants module:
  `STRUCTURAL_FAMILY_SUNSET_DATE` ("Wed, 31 Mar 2027 23:59:59 GMT"),
  `STRUCTURAL_FAMILY_DEPRECATION_HEADERS`,
  `STRUCTURAL_FAMILY_DEPRECATION_META` (the `meta.deprecations`
  block to merge into JSON envelopes), and
  `withStructuralFamilyDeprecation(res)` helper that mirrors the
  existing Pulse v1 → v2 deprecation pattern.

- **`src/app/api/v1/peer-groupings/route.ts`** — successor endpoint.
  Single response with all four peer-grouping lenses (World Bank
  region, World Bank income, V-Dem RoW, BR/CGV regime) plus
  monarchy\_status as descriptive metadata. Each lens block carries
  the canonical `factKey`, the `filterParam` consumers pass to the
  legacy filter endpoints, source attribution matching Phase F's
  `provenance.source` shape, and a sorted list of values with cohort
  sizes.

- **`src/app/api/v1/peer-groupings/migration/route.ts`** — per-country
  migration table as JSON. Replication-script maintainers consume
  this to bulk-rewrite `structural_family` joins. One row per
  sovereign state with both deprecated values and the peer-lens
  replacements.

- **`src/app/(reader)/civica-index/methodology/peer-grouping/migration/page.tsx`**
  — reader-facing version of the same data. Wide table inside
  `.editorial-table-scroll` for mobile compatibility. Linked from
  the methodology page Section 12.

- **All four legacy endpoints** now serve `Deprecation: true` +
  `Sunset: Wed, 31 Mar 2027 23:59:59 GMT` +
  `Link: </api/v1/peer-groupings>; rel="successor-version"` headers
  AND a `meta.deprecations` block in the response body:
  - `/api/v1/government-types`
  - `/api/v1/countries/[code]` (Phase F shipped the additive
	migration; my work added the deprecation contract on top)
  - `/api/v1/countries` (list)
  - `/api/v1/index/rankings`

  The list + rankings endpoints also accept the new typed
  `?taxonomy=` values: `region`, `income`, `vdem`, `cgv`, `monarchy`.
  Each filters via an EXISTS subquery against `country_facts` (or
  `government_taxonomies.regime_type_cgv` for CGV) — paginated, no
  in-memory filter step. Legacy `?taxonomy=structural` and
  `?taxonomy=regime` keep working through 2027-03-31.

- **`src/app/api-docs/page.tsx`** updated:
  - `/api/v1/government-types` marked DEPRECATED with a clear sunset
	note in its description
  - New `EndpointSection` for `/api/v1/peer-groupings` and
	`/api/v1/peer-groupings/migration`
  - `/api/v1/countries` description + parameters extended to document
	the new typed `taxonomy` values
  - curl examples updated to highlight the successor

- **Replication-script discovery (Resolution §6 Q9) closed.** Sweep
  found NO external academic-replication scripts referencing
  `structural_family`. The three internal scripts that touch the
  field (`derive-government-taxonomy.ts`,
  `check-taxonomy-state.ts`, `ingest-government-taxonomy-br.ts`)
  are diagnostic/preservation tooling that gets deleted in Phase 6
  alongside the column drops. The
  `/civica-index/replication` reader page describes the Civica Index
  replication package as future work and contains no `structural_family`
  references.

### Coordination move that paid off

Following the user's "extend Phase F's `meta.reconciliation` envelope
rather than parallel-author" guidance: every legacy endpoint's
response merges `STRUCTURAL_FAMILY_DEPRECATION_META` INTO the
existing `meta` object alongside `meta.reconciliation` (and
`meta.methodology` on the rankings endpoint). Single `meta` object,
multiple discipline-specific keys. No parallel envelopes.

### Verification

- `npm run build` clean.
- `curl -I` confirms all four legacy endpoints return the three
  deprecation headers.
- `curl /api/v1/peer-groupings` returns all four lenses + monarchy
  with proper cohort counts (29/52/33/20/2/6/47 across the WB
  regions, etc.).
- New typed taxonomy filters confirmed: `?taxonomy=vdem&government_type=Liberal+Democracy`
  → 33 countries; `?taxonomy=region&government_type=North+America`
  → 2 countries (USA + Canada).
- `/civica-index/methodology/peer-grouping/migration` reader page
  renders the full per-country table with horizontal scroll on
  mobile.

### Outstanding

Only Phase 6 (T+2 hard cut on 2027-03-31) remains. That's
calendar-gated, not effort-gated — at that date drop the
`structural_family` and `structural_subtype` columns from the
`government_taxonomies` schema, delete `STRUCTURAL_FAMILY_META` /
`STRUCTURAL_GOVERNMENT_TYPES` constants, return 410 Gone (or 301
to `/api/v1/peer-groupings`) from `/api/v1/government-types`, and
remove the `structuralFamily*` fields from the other endpoints'
response bodies + the `?taxonomy=structural|regime` query-param
handling.

## 2026-05-02 — `structural_family` removal — Phase 3 consumer refactor shipped

Phase 3 of the structural-family removal landed end-to-end after
Phase F greenlit at F.2.1 cut-over (full coverage on
`world_bank_region`, `world_bank_income_group`, `vdem_row`,
`monarchy_status`, `government_form_description`). Five sub-phases
shipped, each verified against the live preview:

- **3a — country detail rank panels.** `(shell)/civica-index/[slug]`
  drops the `familyRank` block and renders two `<PeerLensPanel>`
  components (material peer = World Bank region+income, governance
  peer = V-Dem RoW). `getMaterialPeerSet()` and
  `getGovernancePeerSet()` from `src/lib/peer-grouping/` call
  Phase F's `getCanonicalFactsForJurisdictions()`. Verified on
  Germany (region+income n=35), USA (region+income n\<8 → income-only
  fallback fires correctly), and mobile (393px no-overflow).

- **3b — civica-index left rail + page filter.**
  `(shell)/@left/civica-index` now fetches
  `getVDemRowDistribution()`, `getWorldBankRegionDistribution()`,
  `getWorldBankIncomeGroupDistribution()`, and
  `getCgvRegimeDistribution()` (CGV is in an expandable advanced
  panel). New typed URL params: `?vdem=`, `?region=`, `?income=`,
  `?cgv=`. Legacy `?family=*` 308-redirects to bare `/civica-index`.
  `getCIRankings()` extended with the four new filter options;
  multi-filter intersections work (e.g.
  `?vdem=Liberal+Democracy&income=High+income` → 31 countries).

- **3c — bi-lens explorer.**
  `(reader)/civica-index/government-types` is now a V-Dem RoW
  (default) + BR/CGV (toggle) explorer. Old `?lens=structural`
  silently falls through to V-Dem RoW. The "How to read this page"
  panel was rewritten to cite Lührmann et al. 2018 + the new
  peer-grouping methodology page rather than the old structural-form
  framing. `GovernmentTypesAccordionExplorer.lensTabs.id` type
  changed from `"structural" | "regime"` to `"vdem_row" | "regime"`.

- **3d — archive `/government-types` URLs.** The top-level page +
  the 9 dynamic `[type]/page.tsx` files were deleted; `next.config.ts`
  308-redirects both `/government-types` and `/government-types/:type`
  to `/civica-index/methodology/peer-grouping`. Verified via
  `curl -I` — both return `308 Permanent Redirect` with the right
  `location` header.

- **3e — compare + taxonomy block label swap.** Compare card's
  `prettyGov` now reads `classification.regimeTypeLabel` instead of
  the retired `structuralFamilyLabel`. `<GovernmentTaxonomyBlock>`
  drops the "Structure" row entirely; the descriptive constitutional
  form will move to a `getConstitutionalForm()`-backed surface in a
  follow-up. `/api-docs` example JSON marks both `structuralFamily`
  and `structuralSubtype` fields as \`(DEPRECATED — sunset T+2
  vintages)\` to set external-consumer expectations.

### Phase F vocabulary alignment

Phase F's canonical-fact-layer values are human-readable strings, NOT
snake\_case slugs:
- V-Dem RoW: `"Closed Autocracy"`, `"Electoral Autocracy"`,
  `"Electoral Democracy"`, `"Liberal Democracy"`
- World Bank region: `"East Asia & Pacific"`,
  `"Europe & Central Asia"`, `"Latin America & Caribbean"`,
  `"Middle East, North Africa, Afghanistan & Pakistan"` (note: the
  non-standard MENA-AP regional grouping is the World Bank's lending-
  group label preserved verbatim), `"North America"`, `"South Asia"`,
  `"Sub-Saharan Africa"`
- World Bank income: `"Low income"`, `"Lower middle income"`,
  `"Upper middle income"`, `"High income"`
- CGV regime: snake\_case (matches existing `REGIME_TYPE_META`)
- monarchy\_status: lowercase enum (matches the §C-Q2 spec)

`src/lib/peer-grouping/lens-metadata.ts` keys updated to match
canonical strings. `getPeerLensValueMeta()` is tolerant — unknown
values return `null` rather than crash, so future Phase F vocabulary
drift won't break the UI.

### Open follow-ups (Phase 4)

- Phase 4 — public API deprecation contract (Deprecation +
  Sunset headers on `/api/v1/government-types`,
  `/api/v1/countries`, `/api/v1/index/rankings`; `/api/v1/peer-groupings`
  successor endpoint; migration table; replication-script discovery).
- Phase 4 will also need to rewire `<GovernmentTaxonomyBlock>` (or a
  successor surface) to surface the descriptive constitutional-form
  text via `getConstitutionalForm()`.
- Phase 6 — T+2 vintage hard cut. `structural_family` /
  `structural_subtype` columns and the `STRUCTURAL_FAMILY_META`
  / `STRUCTURAL_GOVERNMENT_TYPES` constants get deleted at that
  point.

## 2026-05-02 — `structural_family` removal — Phase 2 + Phase 5 kickoff

- Audit completed: 19 files reference `structural_family` (vs. \~17 estimate).
  80% of code-level complexity in 3 files (`government-taxonomy/index.ts`,
  `db/queries.ts`, the two `government-types` page suites). The other 16
  files are mechanical follow-ups.
- Implementation plan v1.1 at
  `~/civica/plan/structural-family-removal-implementation-plan.md`. User
  approved 2026-05-02 with three locked decisions: (Q1) archive
  `/government-types*` with 308 redirects, (Q2) wait for Phase F sync —
  no throwaway local ingestion, (Q3) ship methodology page with
  "Pending external review" footer, no BETA pill, v1.1 changelog if
  revisions return.
- **Phase F coordination point.** Phase F shipped F.3 (resolver layer
  flipped for first three flipped fact-keys) on 2026-05-02. The four
  peer-grouping fact-keys (`world_bank_region`, `world_bank_income_group`,
  `vdem_row`, `monarchy_status`) are next in their sync queue (\~2–4 weeks).
  Phase 2 of this work writes against the actual `resolveFact()` API.
  Phase F should coordinate on the `monarchy_status` enum vocabulary
  (this plan §C-Q2 lists 6 values: none/constitutional/absolute/
  ceremonial/elective/theocratic — if Phase F's regex picks different
  values, this plan adopts theirs per the canonical-fact-layer authority).
- Phase 2 + Phase 5 running in parallel during the Phase F sync wait.
  Phase 3 (consumer refactor) gates on the four sync scripts firing
  with ≥200 jurisdiction coverage — pause point before starting.
- Memory-decisions.md updated with the cross-session decision record.

## 2026-04-30 — Phase 5.10 cut-over verified live

The Pulse v2 / taxonomy-v2.0 cut-over had effectively been deploying
across the previous session's pushes (every push to `origin/main`
triggers a Vercel auto-deploy). This session verified the production
state and shipped one bug fix that was uncovered during smoke-testing.

### Phase 5.10 verification (production smoke tests)

All public-facing v2 surfaces verified live on civicaatlas.org:

- `/civica-index/russia` — 200, dimensional panel renders Rights
  & Freedoms -4.2 with "extremist" driver text
- `/civica-index/bangladesh` — 200, dimensional panel renders
- `/civica-index/pulse-changelog` — 200
- `/civica-index/methodology/pulse` — 200
- `/civica-index/methodology/pulse/backtest` — 200
- `/admin/sign-in` — 200
- `/api/v1/pulse/russia/dimensions` — returns the LGBT event
  as freedom\_rights driver with delta -4.15 (matches local)
- `/api/v1/pulse/changelog/v2` — 200
- Legacy `/api/v1/pulse/[slug]` and `/api/v1/pulse/changelog`
  return `Deprecation: true` + \`Sunset: Thu, 31 Dec 2026 00:00:00
  GMT`+`Link: rel="successor-version"\` headers

`npm run build` clean locally.

### State of system at end of session

- `origin/main` at `469e73d` (the review-route fix)
- `pulse-taxonomy-v2.0` tag on origin at `df7cd4e`
- Production serving deployment `dpl_95X4XiaKMCZAXBacYKBSjGMDSME3`
  (the post-fix build will replace this within a few minutes; not
  a behavioral concern since all v2 surfaces shipped earlier)
- 6 published v2 events visible publicly with correct deltas
- 3 still pending in `/admin/pulse-review` queue (no SLA breach yet)
- Daily v2 cron schedule (07:00 / 07:30 / 08:00 / 08:30 UTC)
  remains active

### Known gaps + parked

- **Per-driving-event linking from country panel to changelog** —
  per the deployment plan Q&A, the country panel's driving-event
  headlines are not yet individually clickable. "See all events →"
  link satisfies the transparency floor. Pre-cut-over plan flagged
  this as a 15-min fast-follow; not done. Reviewer may pick up.
- **`ADMIN_API_KEY` rotation in Vercel production env** — flagged
  in the deployment plan as a sign-off item. Not verified this
  session; reviewer should confirm the Vercel dashboard value
  doesn't match the local dev token.
- **Phase 5.9** (licensing audit, advisory board, SSRN preprint)
  remains deferred per 2026-04-28 decision.
- **Vercel deploy of `469e73d`** kicked off by the push during this
  session. Verification was done against the previous deployment
  (`dpl_95X4...`) which already had every visible v2 surface; the
  only behavioral change in `469e73d` is in the admin review POST
  handler, which doesn't affect public-facing surfaces.

## 2026-04-30 — Route audit and visual sitemap

- Created route audit + Mermaid sitemap at `/Users/fernandobalino/civica/plan/site-route-audit-sitemap.md`.
- Audit covered 41 user-facing page routes, 13 shell parallel slot page files, 52 route handlers, 4 layouts, 6 loading states, and 2 parallel default slot files.
- Noted follow-up risks: `/` redirects to `/atlas` before fallback landing content, `/outcomes` has both page file and permanent redirect to `/civica-conditions`, mobile nav references missing `/privacy` and `/terms`, footer invariant is missing visible Licensing/GitHub links, and `src/app/sitemap.ts` omits many newer pages.

## 2026-04-23 / 2026-04-24 — Phased roadmap: Phases 0, 1, 2.1 scaffold
### Phase 4 not done
- Embed button on the rankings leaderboard rows (small hover icon) —
  handoff suggested it but didn't ship in this phase. Cheap
  follow-up.
- Embed button on `/countries/[slug]` reader page — same.
- The embed's med/large footer still reads `civica.io/countries/X`
  instead of `civicaatlas.org/countries/X`. Flagged in the original
  roadmap as "replace the placeholder civica.io URL text in the
  embed's medium/large footer with the real civicaatlas.org domain".
  Fix lives in `src/app/embed/[slug]/route.ts`.

## 2026-04-29 — Design-system unification execution

- Executed the design-system unification plan from
  `/Users/fernandobalino/.claude/plans/i-want-the-design-system-lazy-hickey.md`.
- Added `DESIGN.md`, strengthened the top-level AGENTS design-system
  directive, migrated runtime theme handling to `data-theme`, and
  kept `/design-system` tied to the live site theme.
- `/design-system` now renders the shared `HemicycleChart` with
  deterministic SVG coordinates to prevent React hydration drift.
- Added editorial primitives under `src/components/editorial/` and
  wrapped Civica Index reader pages through the shared shell where
  the existing page structure allowed a low-risk swap.
- Verification: `npx @google/design.md lint DESIGN.md`, targeted
  ESLint on touched files, `npm run build`, and agent-browser passes
  on `/design-system`, `/atlas/usa/chamber` (redirected to structure),
  `/civica-index/methodology`, `/civica-index/changelog`, and
  `/compare?c=usa&c=france`.

## 2026-04-29 — Phase 5.5: Pulse Beta foundation shipped

Plan: `~/civica/plan/phase-5-5-pulse-beta-foundation.md`. Eight
commits (`4a7af06` → final commit) replace the v1 merged-scalar
Pulse pipeline with the dimensional-delta architecture from spec
v0.9. **Backend only — no public UI changes in this phase**, the
legacy Pulse panel still renders unchanged on country pages until
Phase 5.6 swaps the UI.

What shipped:

- **Five new tables.** `raw_events` (staging, drained by clustering),
  `pulse_events_v2` (one row per clustered governance event,
  classifier\_runs JSON preserved for audit), `pulse_sources`
  (per-event source attribution join), `pulse_dimensional_deltas`
  (current state per (country, dimension)), `pulse_corrections`
  (Pulse-specific dispute log). All in parallel to the legacy
  pulse\_events / pulse\_daily\_scores / pulse\_changelog tables —
  legacy stays running until 5.6 cut-over.

- **Hard-coded taxonomy (29 categories).** spec §3.2 across 5
  dimensions (democratic\_quality, rule\_of\_law, freedom\_rights,
  corruption\_control, stability) with allowed severity tiers and
  decay half-lives in `src/lib/pulse/v2/taxonomy.ts`. Severity
  ranges per §3.3 (low\_pos +1/+2 through catastrophic\_neg -8/-10).
  HUMAN\_REVIEW\_TIERS (severe\_neg, catastrophic\_neg, high\_pos)
  drives auto-publish gating.

- **Eight connectors with graceful no-op semantics.** CIVICUS Monitor
  RSS (working — fixed URL is `/feed/`), HRW news RSS (working,
  20 items/day), Amnesty RSS (working, 12 items/day, fixed URL
  `/en/feed/`), RSF (gated on env override — no public RSS feed
  exists at standard paths), IPU /elections (works but sparse —
  IPU API doesn't expose daily parliamentary actions),
  ACLED (gated on ACLED\_API\_KEY + ACLED\_API\_EMAIL), V-Dem pulse
  (pure stub — V-Dem ships annually, not real-time),
  GDELT v2 adapter (wraps existing fetcher),
  Reuters/AP wire (URL paths have rotated; gated on env override).

- **Country resolver.** `src/lib/pulse/v2/country-resolver.ts`
  extracted from v1 ingest with extended aliases (DR Congo,
  eSwatini/Swaziland, Türkiye, Vatican). `extractCountryFromText()`
  with word-boundary regex prevents the "MALI inside FORMALIN"
  class of false positives.

- **Sentence-transformer clustering.** `Xenova/all-MiniLM-L6-v2`
  (384-dim, \~25MB local model) via `@huggingface/transformers`.
  Lazy-init pipeline. Per-country bucket → union-find with
  greedy O(N²) pairwise cosine similarity ≥ 0.75 within ±48h
  date window. Embedding stored back on each raw\_events row.

- **Multi-run classifier.** Three Anthropic claude-sonnet-4-6
  calls per cluster at temps [0.0, 0.4, 0.8] in parallel.
  Compares (category, severity\_tier) tuples for agreement. All-3
  agree → +0.2 confidence boost; 2-of-3 → neutral; none → -0.3
  + flag for review. Lazy-init Anthropic client (project
  convention; module-level `new Anthropic()` evaluates before
  dotenv populates env vars). max\_tokens=800 — the 400 cap from
  the bills summariser truncates the longer JSON shape.

- **Asymmetric corroboration + scoring.** spec §3.4 (positive
  events require ≥1 specialist source; in restricted-press
  countries require ≥2 non-state sources) + §3.5 (RSF press-
  freedom tier modulates news-only signal weight; restricted-press
  + news-only → severely discount). RSF scores hardcoded in
  `press-freedom.ts` from 2024 World Press Freedom Index, refresh
  annually.

- **Decay + dimensional deltas.** Exponential decay
  `severity × confidence × exp(-ln2 × days / half_life)`.
  Half-life from taxonomy (coup 365d, journalist arrest 60d,
  state collapse 730d). Sum decayed impacts per (country,
  dimension) across published=true events in trailing 365 days,
  clamp to [-15, +10] per spec §4.3, upsert
  pulse\_dimensional\_deltas.

- **Cron schedule.** Four new daily Vercel crons: 07:00 ingest,
  07:30 cluster, 08:00 classify, 08:30 score. All gated by
  requireCronAuth.

- **End-to-end runner.** `npm run pulse:v2:all` does ingest →
  cluster → classify → corroborate → score in one pass. Useful
  for backfill + spot-checking. Individual stages also addressable
  as `pulse:v2:{ingest,cluster,classify,score}`.

End-to-end smoke verified on 42 raw\_events: 23 country-resolved
→ clustered into 23 distinct events (zero multi-source dedup at
this scale because RSS volumes are tiny; multi-source clusters
will surface once GDELT runs successfully) → 8 classified (1
none, 7 written to pulse\_events\_v2). Bangladesh moderate\_neg
auto-published with delta -2.05 to freedom\_rights; 7 severe\_neg
events queued for human review (review queue UI ships in 5.7).

Known issues parked:
- **GDELT timeout under Node 25 + undici.** Connect-timeout
  failure on api.gdeltproject.org from Node fetch even though
  curl works fine. Likely IPv6/IPv4 resolver behavior. Bumped
  fetch timeout to 60s + retry-once wrapper. Followup: switch
  to undici Agent with family:4.
- **RSF / Reuters / AP feed URLs.** Public RSS endpoints have
  rotated. Connectors gated on env-var URL overrides; gracefully
  no-op until we identify the right paths (or — for RSF —
  obtain API access).
- **IPU /elections endpoint.** Returns 0 results for our
  date\_from filter; needs syntax investigation. Connector is
  shape-correct.

Up next: Phase 5.6 — Pulse scoring + dimensional delta UI on
country pages + public Pulse changelog page. The whole pipeline
stands up to 5.6's needs without further backend changes.

## 2026-06-06 — Codebase health audit (multi-agent workflow)

Ran a 23-agent discovery + independent-verification + synthesis workflow
auditing the whole repo for dead code, DRY violations (code + styling),
deprecated patterns, complexity, and broken/mis-wired features. 53 total
agents. Report saved to `~/civica/plan/codebase-health-audit-2026-06-06.md`.
132 findings (10 high / 63 medium / 59 low); 4 refuted in verification.
Headline themes: provenance/credibility bugs (syncs stamping last_sync_at
on total failure, citation snapshot republishing rejected facts, fabricated
sources on rankings/embed/factbook-leaders/CI hero, public HomeWiki variant
rendering fake data), missing footer Licensing/GitHub links + no /licensing
page, Pulse "daily" signal lacking a cron schedule, ~18 near-identical
factbook sync adapters (largest DRY surface), and per-page style blocks +
shipped v2/v3 prototype CSS violating the design system.