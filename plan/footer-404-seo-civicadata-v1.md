# Site chrome & credibility pass — v1 spec

Owner request (2026-07-04): constitution text bug · un-tab Civica Data ·
remove homepage tagline duplicate · massive footer · custom 404 · technical
SEO (schema/JSON-LD/meta). Design decisions in this doc are the contract;
implementation is delegated to subagents.

---

## 1. Constitution text bug (data ingestion)

**Diagnosis (confirmed against prod Neon, 2026-07-04):** 43 of 186 ingested
constitutions store heading-only articles (e.g. Japan `section/7` =
`<h3>Article 1</h3>`, avg article HTML 27–85 chars). Root cause in
`src/lib/constitute/sync-constitutions.ts` `parseConstitutionHtml()`: a
section with **no topic tags and no own heading is dropped** (line ~311), but
in these constitutions Constitute nests each article's body text in exactly
such a bare child `div.section` (section ids skip: 7, 9, 11 … the even ids
were the bodies). The body is excluded from the parent by `ownHtml()` (by
design) and then dropped entirely by the keep-filter.

**Fix:**
- Add an `ownText(sec)` helper (text of direct non-`div.section` children,
  whitespace-collapsed, trimmed).
- Keep-filter becomes: keep when `topics.length > 0 || heading || ownText`.
- Body-only sections get `headingLabel = nearestHeading(sec)` (already the
  behavior), so `buildArticleNav` folds them under their article entry —
  consecutive same-label sections collapse to one nav row (verified in
  `src/lib/constitution/article-nav.ts`). Part-heading continuation is
  already handled (group-reuse branch).
- Excerpt behavior unchanged (only tagged sections produce excerpt rows).

**Backfill without re-crawling:** `constitutions.full_text_html` stores the
full source HTML. New script `scripts/reparse-constitutions.ts`: for every
constitutions row, re-run `parseConstitutionHtml(full_text_html)`, update
`structured_articles`, rebuild topic excerpts via `replaceTopicExcerpts`.
**No `last_sync_at` stamp** — this is a local re-parse of already-synced
data, not a source fetch (document this in the script header; run
`npm run validate:sync-freshness` to prove compliance).

**Acceptance:** probe query (see `tmp/probe-constitutions.ts`) shows 0
countries with >80% tiny articles; Japan Article 1 contains the Emperor
symbol-of-State clause; a normal country (e.g. USA/Germany) is unchanged in
article count ±0 and spot-checked identical.

---

## 2. Civica Data: master–detail → factbook-style scroll

Owner: "if I'm in 01) Civica Index, I should scroll down to see
02) Government — not click each tab." This supersedes the earlier
master–detail brief recorded in `CivicaDataSections.tsx`.

**Target:** `/country/[slug]/civica-data` renders ALL visible sections
stacked in one scroll column, like the Factbook tab:

- Keep the sticky left nav (numbered `01–07`, same classes/visual) but make
  it **scroll-spy anchors** (use `useActiveSection`, same as factbook /
  constitution reader) instead of a panel switcher. Active item follows
  scroll; click = smooth scroll (respect `scroll-margin-top:
  calc(var(--header-height) + var(--space-5))`).
- Each section opens with a numbered section header (eyebrow `01 · Civica
  Index` style, mirroring the Factbook tab's section-header register) so the
  scroll has visible chapter boundaries.
- Deep links still work: `#legislature` and `?section=legislature` scroll to
  the section on load (no hidden panels — everything in the DOM and visible;
  better for SEO too).
- Keep: `CountryJumpSearch` on top, per-section `SourcesStrip`,
  `CiteAccordion` at the bottom. Keep section visibility gating.
- `CivicaDataSections.tsx` is rewritten (or replaced) accordingly; page.tsx
  keeps building `items` server-side. Update the component docblock — the
  owner's 2026-07-04 brief supersedes the old one.
- Mobile (≤900px): nav collapses to the same pattern the factbook tab uses
  (read `/country/[slug]/page.tsx` + `FactbookSidebar` first and mirror it).

---

## 3. Homepage tagline duplicate — remove

`src/components/home/HomeGrid.tsx` lines ~384–408: delete `.home-closing`
("Open · Transparent · Nonpartisan") and the whole `.home-sources` block
("Data from World Bank · IMF · …"). Remove now-dead CSS in
`src/app/home.css` (~lines 226–261). The footer trust band is the single
home for this message.

---

## 4. The Colophon — massive site footer (design spec)

Register: fine-press almanac colophon. Ivory paper, hairline rules, ink
navy, terracotta accents. Tokens only. Structure top → bottom:

### 4.1 Trust band (keep, it opens the footer)
Existing `site-footer__trust` band stays as-is (headline, blurb, engraved
source-logo strip, light/dark variants).

### 4.2 Main grid — brand column + 4 link columns
Left brand column (~320px):
- `CivicaLogo` + "Civica Atlas" wordmark, then a 2-line mission blurb:
  "An open, citable reference for how every country on Earth is governed —
  government structures, constitutions, elections, and the Civica Index."
- **Search**: reuse the global country search (`GlobalSearchWrapper` /
  `GlobalSearch`) styled to the canonical rounded search field. If the
  header component can't be cleanly reused, use `CountrySearchCombobox`.
  Label: "Find a country…". Must be a real, working search.
- Provenance legend (live/frozen dots) + the "Sources include …" line
  (existing).

Link columns (small-caps Inter eyebrow titles, Inter body links, generous
line-height; hairline rule above the grid):

- **Explore** — Countries `/country` · World Atlas `/atlas` · Compare
  `/compare` · Elections `/elections` · Electoral Systems
  `/elections/systems` · Rankings `/rankings` · Conditions
  `/civica-conditions` · Organizations `/organizations` · Glossary
  `/glossary`
- **Civica Index** — Overview `/civica-index` · Methodology
  `/civica-index/methodology` · The Pulse `/civica-index/methodology/pulse`
  · Pulse Changelog `/civica-index/pulse-changelog` · Government Types
  `/civica-index/government-types` · Replication
  `/civica-index/replication` · Corrections `/civica-index/corrections` ·
  Embed Widget `/civica-index/widget`
- **Research** — Methodology `/methodology` · Our Approach
  `/methodology/approach` · Data Reconciliation
  `/country/methodology/reconciliation` · Peer Grouping
  `/civica-index/methodology/peer-grouping` · The Record (Blog) `/blog` ·
  API Docs `/api-docs`
- **About** — About `/about` · Advisory Board `/about/advisory-board` ·
  Contact `/contact` · Licensing `/licensing` · Privacy `/privacy` · Terms
  `/terms` · Design System `/design-system` · Status Page (external ↗) ·
  GitHub (external ↗)

Implementer MUST verify every href resolves to a real route (no footer
404s). Footer invariants (AGENTS.md) preserved: Blog · API Docs · Design
System · Status Page · Licensing · Contact · GitHub.

### 4.3 Bottom bar
Hairline rule; left: `© 2026 Civica Atlas · Open data, free to use with
attribution.` Right: Privacy · Terms · Licensing. Small Inter, muted.

### 4.4 The brand moment — massive wordmark
Full-bleed "CIVICA" as the final element: real text (not an image), Source
Serif 4 via `var(--font-heading)`, uppercase, sized with viewport units
(`clamp`) to bleed edge-to-edge on one line, very low contrast ink
(`color-mix` of text color into bg, ~6–9%), cropped flush at the bottom
(container `overflow: hidden`, wordmark nudged down so baseline sits below
the fold edge — the heynowagents footer move, in Civica's register). Static
— no marquee/animation; `aria-hidden="true"`. Dark mode flips via tokens
automatically. Subtle entrance reveal is allowed only with
`useReducedMotion` + SSR-visible fail-safe (per project motion rules) — or
skip motion entirely.

### 4.5 Legal pages (new)
Create `/privacy` and `/terms` as narrow `EditorialPage` reader pages.
Plain-language, honest drafts for a site with **no user accounts**: what we
collect (check the codebase for analytics — reflect reality, don't invent),
cookies/localStorage actually used (theme, pane widths), data licensing
pointer to `/licensing`, contact email, "last updated" date, and a note
that the policy is written in plain language. No boilerplate lorem. These
are drafts pending counsel review (flag in the final report, not on-page).

### 4.6 CSS
All footer styles in `globals.css` under the existing `.site-footer` block
(footer is global chrome, not a reader page). Tokens only; no hex, no px
font sizes, no magic paddings. Responsive: columns → 2-col at `--bp-md`,
1-col at `--bp-sm`; wordmark stays one line (shrinks via vw).

---

## 5. 404 — "Off the map" (design spec)

Replace `src/app/not-found.tsx` (currently inline-styled). Register:
editorial, almanac, a little wit, zero gimmicks.

- Layout: centered editorial column (~760px), generous top space.
- Visual anchor: `SpotEngraving` compass — `/engravings/spot-compass.webp`
  (+ `-dark` variant), modest size, above or beside the heading.
- Eyebrow (small-caps Inter): `Error 404 · Terra incognita`.
- H1 (56px serif): `This page is off the map.`
- Dek (serif subtitle): `The atlas covers every country on Earth — but not
  this address. It may have moved when routes were consolidated, or never
  existed.`
- **Working country search** front and center (same canonical rounded
  search as the footer/header — `GlobalSearch` reuse or
  `CountrySearchCombobox`): placeholder `Find a country…`.
- Destination row below (6 cards or editorial chips): Countries ·
  Civica Index · World Atlas · Elections · Compare · The Record.
- Small print: link to `/contact` ("Convinced this page should exist?
  Tell us.").
- Styles: compose `editorial.css` classes; anything genuinely new goes in a
  dedicated `src/app/not-found.css` imported only by this file (do NOT
  touch editorial.css/globals.css — parallel agents own those). No inline
  style objects for layout/typography. `--font-mono` must not be used.
- Keep `robots: { index: false, follow: false }` metadata + proper 404
  status (App Router not-found does this). Motion: standard entrance only
  with reduced-motion + SSR fail-safe, or none.

---

## 6. Technical SEO (spec)

Brand rule for ALL metadata: the public brand is **"Civica Atlas"**
(disambiguates from civica.com and civicaatlas.ai). Site name, org schema,
title templates all say "Civica Atlas".

### 6.1 Titles & descriptions
- Root default title: `Civica Atlas — How Every Country Is Governed`
  (~45 chars; current 78-char default gets truncated in SERPs).
- Template: `%s · Civica Atlas`.
- OG `siteName`: `Civica Atlas`.
- Root description (~155 chars): `Interactive atlas of government
  structures, constitutions, elections, and governance data for every
  country — with the Civica Index, an original governance score.`
- Per-page-type templates (apply where pages already define metadata;
  front-load the subject, keep ≤60 chars where possible):
  - Country factbook: `{Name} — Government & Political System`
  - Civica Data tab: `{Name} — Civica Index & Governance Data` (exists)
  - Constitution tab: `Constitution of {Name} — Full Text`
  - Leaderboard: `Civica Index — Governance Scores for 190+ Countries`
  - Elections: `Elections Around the World — Calendar & Results`
  - Compare: `Compare Countries — Government, Economy & Governance`
  - Rankings: `Country Rankings — Democracy, Freedom & Governance`
  - Blog posts: post title (template appends brand).
  Audit every `generateMetadata`/`metadata` export; fix truncation-prone
  titles and empty/duplicate descriptions. Do not change page COPY, only
  metadata.

### 6.2 JSON-LD (new `src/lib/seo/jsonld.ts` + `<JsonLd>` component)
- Root layout: `Organization` (name "Civica Atlas", url, logo, sameAs:
  GitHub repo) + `WebSite` (name, alternateName "Civica", publisher ref).
  Note: Google retired the sitelinks-searchbox display; do NOT add
  `potentialAction` SearchAction noise.
- Country layout (`/country/[slug]/layout.tsx`): `BreadcrumbList`
  (Home → Countries → {Name}) and, where the jurisdiction has a Wikidata
  id available on an already-fetched object, an `about: Country` node with
  `sameAs` to Wikidata. Do not add new DB queries just for schema.
- Blog `[slug]`: `Article` (headline, datePublished, dateModified, author =
  Organization, image = resolved cover).
- `/civica-index`: `Dataset` (name, description, license, creator,
  temporalCoverage from displayed vintage, `distribution` → the public API
  endpoint documented at /api-docs).
- Validate shapes against schema.org; keys must render as one
  `<script type="application/ld+json">` per node, server-rendered.

### 6.3 Hygiene
- `sitemap.ts`: add `/elections/systems`, `/privacy`, `/terms`; blog
  lastModified already real; keep the rest.
- Verify robots.ts, canonical behavior, and that the empty `<head>` block
  in layout.tsx is removed/used properly.
- Do NOT touch not-found.tsx (owned by the 404 agent) or the footer JSX
  (owned by the footer agent — run after it).

---

## 7. Sequencing & ownership (for the workflow)

Parallel wave: (1) constitution fix, (2) civica-data scroll, (3) footer +
homepage + legal pages, (4) 404. SEO runs AFTER footer agent (both touch
layout.tsx). File ownership is exclusive per agent as specced. Verification
(build, preview, screenshots) + commit stay in the main session.
