/**
 * Civica site-state — typed project-state constants for reader-facing copy.
 *
 *   Adopted via: ~/civica/plan/site-stale-content-audit-v1.md (Phase 1)
 *   Companion :  src/lib/content/site-stats.ts (live DB-driven counters)
 *
 * This file is the single source of truth for project-state values that
 * the reader-facing site embeds in prose: Tier-1 publisher status, NSO
 * wave progress, methodology version stamps, cut-over dates, BETA pill
 * flags, dispute SLAs, advisory-board status, and so on. Values that
 * can be derived from the database (active source count, total facts,
 * fact-key coverage) live in `site-stats.ts` instead.
 *
 * **The rule for future contributors:** any reader-facing claim about
 * a count or milestone status reads from this file or from
 * `getSiteStats()`. New hardcoded prose in TSX or markdown is a bug.
 *
 * **Editing this file:** intended to be edited as the project advances
 * — when a new Tier-1 publisher ships, when an NSO wave rolls forward,
 * when a methodology version cuts over. Keep entries brief; the
 * TypeScript types catch shape drift at build time. Aim to keep this
 * file under ~300 lines; if it grows past that, split by topic
 * (`site-state-pulse.ts`, `site-state-reconciliation.ts`, etc.).
 *
 * Mirrors the precedent set by `src/lib/api/deprecation.ts` (a small
 * shared-constants module imported by every consumer).
 */

// ─────────────────────────────────────────────────────────────────────
// Project lifecycle
// ─────────────────────────────────────────────────────────────────────

/** Top-level project phase. Drives "pre-launch beta" prose on the
 *  README and About pages. Flip to `"launched"` once the site has
 *  inbound public traffic and the v1 milestone has been declared. */
export const launchPhase: "pre-launch-beta" | "launched" = "pre-launch-beta";

/** External academic methodology review status. Drives the "External
 *  methodology review | Not yet — planned post-v1" line on README L61. */
export const externalReviewStatus: "not-yet" | "in-review" | "complete" =
  "not-yet";

/** Current public-citation vintage handle. Format follows the
 *  reconciliation methodology page §vintaging convention. Refreshed
 *  by the quarterly vintage-cut script; until that script lands,
 *  edit by hand on each cut. */
export const currentVintage = "Civica Atlas 2026Q3" as const;

// ─────────────────────────────────────────────────────────────────────
// Civica Index (CI) — composite governance score
// ─────────────────────────────────────────────────────────────────────

/** Methodology-version state, dimension catalogue, and weights for the
 *  Civica Index. Resolves the README/About "six dimensions" vs CI
 *  methodology page "four dimensions" inconsistency: the running v2
 *  Beta scores produced by `src/lib/ci/calculate-v2.ts` use FOUR
 *  dimensions with PCA-derived weights 27/26/23/24. Verified
 *  2026-05-05 against `src/lib/ci/dimensions-v2.ts`,
 *  `src/app/(shell)/civica-index/[slug]/page.tsx` (line 51), and
 *  `getCIRankings()` defaulting to `methodologyVersion: "beta"`. */
export const civicaIndex = {
  status: "beta" as const,
  scaleMin: 0,
  scaleMax: 100,

  /** Number of governance-core dimensions. v2 Beta = 4 (Human
   *  Development + Stability/Security moved to Civica Conditions). */
  dimensionCount: 4 as const,

  /** Adopted dimensions + PCA-derived weights. Numbers MUST match
   *  `src/lib/ci/dimensions-v2.ts` V2_WEIGHTS — that file drives the
   *  scoring pipeline; this entry drives display copy. If you update
   *  one, update both. */
  dimensions: [
    { id: "democratic_quality", label: "Democratic quality", weight: 0.27 },
    { id: "rule_of_law",        label: "Rule of law",        weight: 0.26 },
    { id: "freedom_rights",     label: "Freedoms & rights",  weight: 0.23 },
    { id: "corruption_control", label: "Corruption control", weight: 0.24 },
  ] as const,

  /** Quarterly cut-over target — when the in-development methodology
   *  graduates from in-active-development to stable-Beta. Display form
   *  for prose ("Sept 30, 2026"); pair with `cutoverTargetIso` for
   *  API + machine-readable consumers. */
  cutoverTarget: "Sept 30, 2026" as const,
  /** ISO-formatted form of `cutoverTarget`. Used by API
   *  `meta.methodology` envelopes (src/lib/api/helpers.ts) and any
   *  machine-readable surface. Update both fields together. */
  cutoverTargetIso: "2026-09-30" as const,

  /** Last methodology-doc revision label. Pages prefer the database
   *  `methodology.publishedAt` value when present; this string is the
   *  fallback when the DB is unseeded. Pair with `lastRevisionIso`. */
  lastRevision: "Apr 2026" as const,
  /** ISO-formatted (year-month) form of `lastRevision`. Used by API
   *  `meta.methodology.last_revised`. Update both fields together. */
  lastRevisionIso: "2026-04" as const,

  /** Phase 5.3 PCA results — the empirical justification for
   *  weights above. Single source of truth for both the methodology
   *  page and the PCA appendix. */
  pca: {
    lastRunDate: "April 2026" as const,
    panelSize: 46 as const,
    dataVintage: "2023" as const,
    pc1VarianceExplained: 0.907 as const,
    pc1LoadingRange: [0.479, 0.516] as const,
    correlationRange: [0.74, 0.98] as const,
  },

  /** Status of the v2 methodology rebuild. v2 here refers to the
   *  *post-Beta-graduation* methodology refresh, distinct from the
   *  current "v2 Beta" running the 4-dim composite. Confusing — but
   *  the project memory uses both labels. */
  v2Status: "in-development" as const,
} as const;

// ─────────────────────────────────────────────────────────────────────
// Civica Pulse — daily directional signal
// ─────────────────────────────────────────────────────────────────────

export const pulse = {
  status: "beta" as const,

  /** Pulse v2 hard-coded taxonomy. Match against
   *  `src/lib/pulse/v2/taxonomy.ts` — that file drives classification;
   *  these counts drive display copy. */
  taxonomy: {
    version: "v2.0" as const,
    categoryCount: 61 as const,
    categoriesPerDimension: {
      democratic_quality: 12 as const,
      rule_of_law: 13 as const,
      freedom_rights: 19 as const,
      corruption_control: 6 as const,
      stability: 11 as const,
    },
    versionHistory: [
      { version: "v1.0", categoryCount: 30, ranAt: "2026-04" },
      { version: "v2.0", categoryCount: 61, ranAt: "2026-04-30" },
    ] as const,
  },

  /** Backtest cases per spec §5.3 (Pulse methodology launch checklist).
   *  10 named historical governance shocks. Page-display counts read
   *  `length`; the named list drives prose enumeration on the
   *  methodology hub. The graduation-threshold-ratio (0.8 = 8 of 10
   *  must pass) is locked methodology — do not change without a
   *  resolution doc. */
  backtest: {
    cases: [
      { country: "Myanmar",     year: 2021,   label: "Myanmar 2021" },
      { country: "Niger",       year: 2023,   label: "Niger 2023" },
      { country: "Tunisia",     year: 2021,   label: "Tunisia 2021" },
      { country: "Afghanistan", year: 2021,   label: "Afghanistan 2021" },
      { country: "Sri Lanka",   year: 2022,   label: "Sri Lanka 2022" },
      { country: "Brazil",      year: 2023,   label: "Brazil 2023" },
      { country: "Hungary",     range: "2010-present", label: "Hungary 2010-present" },
      { country: "Ethiopia",    range: "2020-22",      label: "Ethiopia 2020–22" },
      { country: "Colombia",    year: 2016,   label: "Colombia 2016" },
      { country: "Poland",      year: 2023,   label: "Poland 2023" },
    ] as const,
    /** 8 of 10 — locked methodology, see Pulse spec §6.4. */
    graduationThresholdRatio: 0.8 as const,
  },
} as const;

// ─────────────────────────────────────────────────────────────────────
// Reconciliation methodology
// ─────────────────────────────────────────────────────────────────────

export const reconciliation = {
  /** Methodology version stamp embedded in vintage labels.
   *  R.23 rewrite (2026-05-05) bumped from v0.1 to v0.2-beta and
   *  re-framed graduation as a perpetual-beta posture: version
   *  bumps signal refinements, not graduation events. */
  version: "v0.2-beta" as const,
  status: "beta" as const,
  /** Original publication date of the methodology page; the R.23
   *  rewrite is dated separately as `lastUpdated`. */
  publishedAt: "2026-05-02" as const,
  /** Date of the most recent methodology-page rewrite. The
   *  reconciliation methodology meta line cites both dates. */
  lastUpdated: "2026-05-05" as const,
  /** First v1 quarterly vintage cut. */
  firstVintage: "2026-Q1" as const,
  /** Date the first v1 vintage was cut. */
  firstVintageCutDate: "2026-05-05" as const,

  /** Forward-looking v1.0 graduation criteria. Currently NOT
   *  rendered on the public page — the R.23 rewrite (2026-05-05)
   *  re-framed graduation as a perpetual-beta posture (version
   *  bumps signal refinement, not graduation). Preserved in state
   *  for future use; revisit if a "graduation" page is reintroduced
   *  or if external reviewers ask for explicit criteria. */
  v1GraduationCriteria: [
    "At least one external reviewer with relevant expertise plus a public response to their feedback.",
    "At least three quarters of vintaged Beta data so reviewers can audit drift.",
    "At least two documented disputes resolved end-to-end through the public queue.",
    "Interactive resolver demo at /factbook/methodology/reconciliation/explore.",
    "Read-only public disputes log at /factbook/methodology/reconciliation/disputes (shipped).",
  ] as const,
} as const;

// ─────────────────────────────────────────────────────────────────────
// Peer grouping methodology
// ─────────────────────────────────────────────────────────────────────

export const peerGrouping = {
  version: "v1.0" as const,
  adoptedAt: "2026-05-02" as const,
  externalReviewStatus: "pending" as const,
  /** Page-version changelog. Each revision documents what changed
   *  and why. */
  versionHistory: [
    { version: "v1.0", adoptedAt: "2026-05-02", note: "Initial publication." },
  ] as const,
} as const;

// ─────────────────────────────────────────────────────────────────────
// Source orchestrators
// ─────────────────────────────────────────────────────────────────────

/** The 12-publisher Tier-1 commitment from the reconciliation v1
 *  master plan. IEA was scrapped 2026-05-04 due to license
 *  incompatibility. 11 ship as canonical syncs writing into
 *  `country_facts`.
 *
 *  - `name`     — full Civica orchestrator label (e.g., "World Bank WDI"),
 *                 used in source-list tables, FactValueDot panels, and
 *                 the API.
 *  - `shortName` — organization-level shorthand (e.g., "World Bank"),
 *                  used in flowing prose where the full label reads as
 *                  too dataset-specific. */
export const tier1Publishers = [
  { id: "world_bank",  name: "World Bank WDI",   shortName: "World Bank", shipped: true,  scrapped: false },
  { id: "imf_weo",     name: "IMF WEO",          shortName: "IMF",        shipped: true,  scrapped: false },
  { id: "un_data",     name: "UN Data",          shortName: "UN",         shipped: true,  scrapped: false },
  { id: "who_gho",     name: "WHO GHO",          shortName: "WHO",        shipped: true,  scrapped: false },
  { id: "unesco_uis",  name: "UNESCO UIS",       shortName: "UNESCO",     shipped: true,  scrapped: false },
  { id: "undp_hdi",    name: "UNDP HDI",         shortName: "UNDP",       shipped: true,  scrapped: false },
  { id: "oecd_stat",   name: "OECD.Stat",        shortName: "OECD",       shipped: true,  scrapped: false },
  { id: "fao_faostat", name: "FAO FAOSTAT",      shortName: "FAO",        shipped: true,  scrapped: false },
  { id: "iea",         name: "IEA",              shortName: "IEA",        shipped: false, scrapped: true,  scrapReason: "license incompatibility (≤5 data points 'occasional, ad-hoc' ToU)" },
  { id: "ilo_ilostat", name: "ILO ILOSTAT",      shortName: "ILO",        shipped: true,  scrapped: false },
  { id: "eurostat",    name: "Eurostat",         shortName: "Eurostat",   shipped: true,  scrapped: false },
  { id: "wto_stats",   name: "WTO Stats",        shortName: "WTO",        shipped: true,  scrapped: false },
] as const;

/** NSO Wave 1 — first wave of national-statistics-office syncs.
 *  Per user resolution 2026-05-05, NBS-Nigeria is permanently
 *  deferred (not just deferred for this wave). Destatis-DE is
 *  deferred to v1.1 per the reconciliation methodology page
 *  (Genesis-Online API requires manual account creation outside
 *  Civica's unattended-cron architecture; Eurostat republishes
 *  Destatis figures in the meantime).
 *
 *  In live status terms:
 *    - 6 NSOs are `in-progress` (live) — US Census, ONS-UK,
 *      INSEE-FR, Statistics Canada, IBGE-BR, Stats SA.
 *    - 1 NSO is `deferred` to v1.1 — Destatis-DE.
 *    - 1 NSO is `deferred-permanently` — NBS-Nigeria. */
export const nsoWave1 = [
  { id: "us_census",    name: "US Census Bureau",  status: "in-progress" as const },
  { id: "ons_uk",       name: "ONS-UK",            status: "in-progress" as const },
  { id: "insee_fr",     name: "INSEE-FR",          status: "in-progress" as const },
  { id: "destatis_de",  name: "Destatis-DE",       status: "deferred" as const,
    deferReason: "Deferred to v1.1 — Genesis-Online API requires manual account creation with regulatory review, outside Civica's unattended-cron architecture. Eurostat republishes Destatis figures in the meantime." },
  { id: "statcan_ca",   name: "Statistics Canada", status: "in-progress" as const },
  { id: "ibge_br",      name: "IBGE-BR",           status: "in-progress" as const },
  { id: "stats_sa",     name: "Stats SA",          status: "in-progress" as const },
  { id: "nbs_nigeria",  name: "NBS-Nigeria",       status: "deferred-permanently" as const,
    deferReason: "Deferred 2026-05-05 — primary data is PDF/Excel; ingestion cost not justified for v1." },
] as const;

/** Aggregate NSO target across all waves. The "30-40 NSO domains"
 *  prose target in the reconciliation methodology page. */
export const nsoTarget = { min: 30, max: 40 } as const;

/** Multi-canonical fact-keys — fact-keys where two or more sync
 *  orchestrators ship `civicaRole: 'canonical'` for the same fact-key
 *  in defined scopes. Hand-maintained because `civicaRole`
 *  assertions live per-source in `src/lib/factbook/reconcile/sync-*.ts`
 *  and there is no central registry that aggregates them.
 *
 *  Update when a methodology resolution adds a new canonical-overlap.
 *  Cross-reference: each entry should be traceable to a
 *  `~/civica/plan/<source>-resolution-v1.md` decision. */
export const multiCanonicalFactKeys = [
  {
    factKey: "public_debt_pct_gdp",
    canonicalSources: ["imf_weo", "eurostat", "oecd_stat"],
    note: "Eurostat canonical for EU members, OECD canonical for OECD members, IMF canonical globally. Per R.11 Eurostat resolution.",
  },
  {
    factKey: "current_health_expenditure_pct_gdp",
    canonicalSources: ["who_gho", "oecd_stat"],
    note: "Both apply SHA-2011 methodology jointly developed by WHO/OECD/Eurostat. Per R.7.5 fact-key registry expansion.",
  },
  {
    factKey: "literacy_rate_pct",
    canonicalSources: ["unesco_uis"],
    // UNESCO is canonical-flip target as of R.7.5; UNDP HDI republishes UNESCO.
    note: "UNESCO is upstream-of-record. UNDP HDR republishes the same value as alternate.",
  },
] as const;

// ─────────────────────────────────────────────────────────────────────
// Adopted methodology resolution docs
// ─────────────────────────────────────────────────────────────────────

/** Count of adopted methodology resolution docs in the planning
 *  archive (`~/civica/plan/*-resolution-v1.md` plus a handful of
 *  non-suffixed mini-resolutions like `forecast-vs-measurement-v1.md`,
 *  `factbook-prose-extraction-v1.md`, `factbook-multi-year-rendering-v1.md`,
 *  `monarchy-status-coding-v1.md`, `trade-aggregate-fact-keys-v1.md`,
 *  `nso-landscape-survey-v1.md`).
 *
 *  Increment when a new resolution lands. The full list lives in the
 *  planning archive itself — embedding every name here would just
 *  duplicate the file system. The README and methodology-hub copy
 *  cite the count as `{state.adoptedResolutionCount}+`. */
export const adoptedResolutionCount = 30 as const;

// ─────────────────────────────────────────────────────────────────────
// Coverage and SLAs
// ─────────────────────────────────────────────────────────────────────

/** Dispute resolution targets. Surfaced verbatim on the CI methodology
 *  page §13.2, the Pulse methodology §corrections, the corrections
 *  page footer, and the reconciliation methodology page §disputes.
 *  Group-specific SLAs apply to the reconciliation methodology page
 *  only; the CI/Pulse pages cite the headline initial+disposition
 *  values. */
export const disputeSla = {
  initialResponseDays: 7 as const,
  fullDispositionDays: 30 as const,
  group: {
    /** Group A identity overrides — short, since these are usually
     *  bug-class. */
    A: 7 as const,
    /** Group B numeric tier-1 vs tier-1 disagreements. */
    B_tier1: 14 as const,
    /** Group C breakdown overrides — slowest, since these usually
     *  involve interpretation. */
    C: 30 as const,
    /** Plausibility-envelope rejections — fastest, since these are
     *  usually pipeline bugs. */
    plausibility: 1 as const,
  },
} as const;

// ─────────────────────────────────────────────────────────────────────
// Advisory board (planned)
// ─────────────────────────────────────────────────────────────────────

export const advisoryBoard = {
  status: "coming-soon" as const,
  targetSize: { min: 3, max: 5 } as const,
  reviewCadence: "quarterly" as const,
  recruitmentTrigger: "after methodology v2 cut-over" as const,
} as const;

// ─────────────────────────────────────────────────────────────────────
// Replication package (planned)
// ─────────────────────────────────────────────────────────────────────

export const replication = {
  status: "coming-soon" as const,
  shipTarget: "Q3 2026" as const,
} as const;

// ─────────────────────────────────────────────────────────────────────
// Methodology-page beta flags
// ─────────────────────────────────────────────────────────────────────

/** Drives the BETA pill on the methodology hub at /methodology and
 *  any per-page beta tag. `beta: true` means a Civica-asserted novel
 *  methodology (subject to external review). `beta: false` means
 *  Civica is citing externally-attested standards (V-Dem, World
 *  Bank, BR/CGV). Per the resolution-doc convention. */
export const methodologyPages = {
  reconciliation:        { beta: true  },
  civicaIndex:           { beta: true  },
  pcaAppendix:           { beta: true  },
  pulse:                 { beta: true  },
  pulseBacktest:         { beta: true  },
  peerGrouping:          { beta: false },
  peerGroupingMigration: { beta: false },
} as const;
