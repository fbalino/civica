import { sql as dsql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  integer,
  date,
  timestamp,
  real,
  boolean,
  jsonb,
  uniqueIndex,
  index,
  foreignKey,
} from "drizzle-orm/pg-core";

export const jurisdictions = pgTable("jurisdictions", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").unique().notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  iso2: text("iso2"),
  iso3: text("iso3"),
  wikidataQid: text("wikidata_qid"),
  continent: text("continent"),
  governmentType: text("government_type"),
  governmentTypeDetail: text("government_type_detail"),

  // ── Phase F cache columns (eventually-consistent with the resolver). ──
  //
  // Per ~/civica/plan/phase-f-schema-v0.1.md §11: these stay as
  // a denormalised read-through optimisation, refreshed nightly
  // by `scripts/refresh-jurisdiction-cache.ts`. Surfaces that
  // need provenance / alternates call the resolver directly via
  // `getCanonicalFact()`. Surfaces that just need the value (map
  // hover, search snippets, list pages) may read from these
  // columns and accept up-to-24h staleness.
  capital: text("capital"),
  population: integer("population"),
  gdpBillions: real("gdp_billions"),
  areaSqKm: integer("area_sq_km"),
  languages: text("languages"),
  currency: text("currency"),
  democracyIndex: real("democracy_index"),
  /** When the nightly cache refresh last ran for this jurisdiction.
   *  SourceDots reading the cache should display this timestamp,
   *  not a fake "live" stamp. Phase F.3.5 addition. */
  factCacheRefreshedAt: timestamp("fact_cache_refreshed_at"),

  flagUrl: text("flag_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const governmentBodies = pgTable("government_bodies", {
  id: uuid("id").primaryKey().defaultRandom(),
  jurisdictionId: uuid("jurisdiction_id")
    .references(() => jurisdictions.id)
    .notNull(),
  name: text("name").notNull(),
  bodyType: text("body_type").notNull(),
  chamberType: text("chamber_type"),
  totalSeats: integer("total_seats"),
  branch: text("branch"),
  wikidataQid: text("wikidata_qid"),
  ipuParlineId: text("ipu_parline_id"),
  hierarchyLevel: integer("hierarchy_level"),
  parentBodyId: uuid("parent_body_id"),
  /**
   * Electoral-system classification for this chamber, from IPU Parline
   * (`/chambers` → `electoral_system` / `electoral_subsystem`), stored as IPU's
   * own snake_case terms verbatim — no invented Civica taxonomy.
   *
   * `electoralSystemFamily` is one of IPU's four families:
   * `plurality_majority`, `proportional_representation`, `mixed_system`,
   * `other_systems`. `electoralSubsystem` is IPU's sub-type term (e.g.
   * `first_past_the_post_fptp`, `list_proportional_representation_list_pr`,
   * `two_round_system_trs`, `parallel_systems`,
   * `mixed_member_proportional_system_mmp`, `single_transferable_vote_stv`,
   * `alternative_vote_av`, `single_non_transferable_vote_sntv`, `block_vote_bv`,
   * `other`). Both are nullable — IPU leaves many appointed/indirect upper
   * chambers unclassified. Human-readable display labels live in the page layer
   * (`src/lib/elections/electoral-systems.ts`), keyed 1:1 off these terms.
   * Populated by `scripts/sync-ipu-parline.ts`.
   */
  electoralSystemFamily: text("electoral_system_family"),
  electoralSubsystem: text("electoral_subsystem"),
});

export const offices = pgTable("offices", {
  id: uuid("id").primaryKey().defaultRandom(),
  bodyId: uuid("body_id")
    .references(() => governmentBodies.id)
    .notNull(),
  name: text("name").notNull(),
  officeType: text("office_type").notNull(),
  isElected: boolean("is_elected"),
  wikidataQid: text("wikidata_qid"),
  reportsToOfficeId: uuid("reports_to_office_id"),
  /**
   * Presentation order within a body, preserving the source list order.
   *
   * Populated by the CIA World Leaders cabinet sync
   * (`src/lib/factbook/cia-cabinets-sync.ts`) with the position's index in
   * the CIA "Leaders and Cabinet Members" list — that order is protocol /
   * seniority, not alphabetical, so preserving it makes the Government org
   * chart read correctly. Nullable and additive: legacy offices leave it
   * null and fall back to the rank sort. NOT pushed in the P4 dry-run round;
   * staged for the apply pass's `db:push`.
   */
  displayOrder: integer("display_order"),
});

export const persons = pgTable("persons", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  dateOfBirth: date("date_of_birth"),
  wikidataQid: text("wikidata_qid"),
  // `photoUrl` stores the Wikimedia Commons FILE NAME of the leader's P18
  // portrait (NOT a full URL). The renderer builds a thumbnail via
  // `wikimediaUrl(file, size)` — the same hotlink-the-CDN approach the country
  // photo galleries use — so a serverless monthly cron can refresh portraits
  // with no local image files. A null value renders the monogram fallback.
  photoUrl: text("photo_url"),
  // Per-portrait Commons attribution (image files are CC-BY-SA / PD / open-gov,
  // NOT CC0 like the Wikidata statement). Rendered as a small credit caption on
  // the portrait, mirroring the country-gallery `license`/`credit` fields.
  photoLicense: text("photo_license"),
  photoCredit: text("photo_credit"),
  parlinePersonCode: text("parline_person_code"),
});

export const terms = pgTable("terms", {
  id: uuid("id").primaryKey().defaultRandom(),
  officeId: uuid("office_id")
    .references(() => offices.id)
    .notNull(),
  personId: uuid("person_id")
    .references(() => persons.id)
    .notNull(),
  partyName: text("party_name"),
  partyColor: text("party_color"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  isCurrent: boolean("is_current").default(true),
});

export const legislatureParties = pgTable("legislature_parties", {
  id: uuid("id").primaryKey().defaultRandom(),
  bodyId: uuid("body_id")
    .references(() => governmentBodies.id)
    .notNull(),
  partyName: text("party_name").notNull(),
  partyColor: text("party_color"),
  seatCount: integer("seat_count").notNull(),
  isRulingCoalition: boolean("is_ruling_coalition").default(false),
  wikidataQid: text("wikidata_qid"),
});

export const elections = pgTable("elections", {
  id: uuid("id").primaryKey().defaultRandom(),
  jurisdictionId: uuid("jurisdiction_id")
    .references(() => jurisdictions.id)
    .notNull(),
  electionDate: date("election_date"),
  electionType: text("election_type"),
  electionName: text("election_name"),
  electoralSystem: text("electoral_system"),
  bodyId: uuid("body_id").references(() => governmentBodies.id),
  turnoutPercent: real("turnout_percent"),
  registeredVoters: integer("registered_voters"),
  totalValidVotes: integer("total_valid_votes"),
  wikidataQid: text("wikidata_qid"),
  /**
   * Whether `electionDate` is a source-confirmed date or a Civica-computed
   * projection. `"confirmed"` = an IPU/Wikidata-published date. `"estimated"`
   * = a `last_election + parliamentary_term` projection (reserved; NOT emitted
   * in elections v1 — the conservative default excludes Civica-computed next
   * dates from the public page per the resolution's deferred Q2). Nullable so
   * the hand-seeded legacy rows are unaffected. See
   * `plan/elections-data-sourcing-resolution-v1.md` §3, §6.1.
   */
  dateConfidence: text("date_confidence"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const electionResults = pgTable("election_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  electionId: uuid("election_id")
    .references(() => elections.id)
    .notNull(),
  partyName: text("party_name"),
  partyColor: text("party_color"),
  partyWikidataQid: text("party_wikidata_qid"),
  candidateName: text("candidate_name"),
  votesCount: integer("votes_count"),
  votesPercent: real("votes_percent"),
  seatsWon: integer("seats_won"),
  isWinner: boolean("is_winner").default(false),
});

export const constitutions = pgTable("constitutions", {
  id: uuid("id").primaryKey().defaultRandom(),
  jurisdictionId: uuid("jurisdiction_id")
    .references(() => jurisdictions.id)
    .notNull(),
  constituteProjectId: text("constitute_project_id"),
  year: integer("year"),
  yearUpdated: integer("year_updated"),
  fullTextHtml: text("full_text_html"),
  /**
   * Parsed Constitute HTML, one entry per tagged/titled `<div class="section">`:
   * `[{ sectionId, headingLabel, topics: string[], html }]`. `topics` are the
   * Constitute ontology leaf keys pulled from the section's `data-topics`
   * attribute; `headingLabel` is the nearest ancestor article/title heading;
   * `html` is the section's own inner HTML (nested sub-sections excluded, so a
   * clause isn't duplicated across its ancestors). Populated by
   * `sync-constitutions`. Feeds the reading column and `constitution_topic_excerpts`.
   */
  structuredArticles: jsonb("structured_articles"),
  lastFetched: timestamp("last_fetched"),
});

/**
 * Cross-reference index for the Constitution Explorer's topic pane.
 *
 * One row per (constitution section × Constitute ontology topic key). Built at
 * ingest time by parsing `data-topics` on each `<div class="section">`, so the
 * "how do peer constitutions handle <topic>?" pane is a pure DB query
 * (`topic_key = ? AND jurisdiction_id != ?`) with no live Constitute calls at
 * page view. `excerpt_html` is the tagged section's FULL subtree inner HTML
 * (nested sub-sections included, capped ~8KB at a clean tag boundary) so the
 * pane always shows the passage — Constitute often tags a heading-only wrapper
 * whose clause text lives in child sections. Sections with no meaningful text
 * are skipped. `article_label` is the best-effort nearest heading (e.g.
 * "Article I"). Idempotent: a country's rows are delete+reinserted on each sync.
 */
export const constitutionTopicExcerpts = pgTable(
  "constitution_topic_excerpts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jurisdictionId: uuid("jurisdiction_id")
      .references(() => jurisdictions.id)
      .notNull(),
    constitutionId: uuid("constitution_id")
      .references(() => constitutions.id)
      .notNull(),
    /** Constitute ontology topic key, e.g. `lhterm` (joins to the taxonomy). */
    topicKey: text("topic_key").notNull(),
    /** Human label for the topic at ingest time, e.g. "Term length of first chamber". */
    topicLabel: text("topic_label").notNull(),
    /** Constitute section id the excerpt came from, e.g. `section/8`. */
    sectionId: text("section_id"),
    /** The tagged section's full subtree inner HTML (the passage), capped ~8KB. */
    excerptHtml: text("excerpt_html").notNull(),
    /** Best-effort nearest article/title heading, e.g. "Article I". */
    articleLabel: text("article_label"),
  },
  (table) => [
    index("idx_constitution_topic_excerpts_topic").on(table.topicKey),
    index("idx_constitution_topic_excerpts_jurisdiction").on(
      table.jurisdictionId,
    ),
  ],
);

export const countryFactbookSections = pgTable(
  "country_factbook_sections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jurisdictionId: uuid("jurisdiction_id")
      .references(() => jurisdictions.id)
      .notNull(),
    sectionName: text("section_name").notNull(),
    sectionData: jsonb("section_data").notNull(),
    displayOrder: integer("display_order"),
    importPhase: integer("import_phase").default(1),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_factbook_sections_unique").on(
      table.jurisdictionId,
      table.sectionName
    ),
  ]
);

/**
 * Phase F — multi-source country facts.
 *
 * Pre-Phase F shape: one row per (jurisdiction_id, fact_key), CIA-
 * sourced. F.1 extends this in place to one row per
 * (jurisdiction_id, fact_key, source_id) so the resolver can pick
 * canonical values from CIA / Wikidata / World Bank / IMF / UN.
 *
 * Existing column names (`fact_value`, `fact_value_numeric`,
 * `fact_unit`, `fact_year`, `source_note`) preserved for
 * back-compat with existing callers (atlas masthead, factbook
 * reader, queries lib). F.4 migrates them to the resolver.
 *
 * Methodology: ~/civica/plan/phase-f-methodology-v0.1.md
 * Schema doc: ~/civica/plan/phase-f-schema-v0.1.md §1, §11
 */
export const countryFacts = pgTable(
  "country_facts",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // ── Identity ──
    jurisdictionId: uuid("jurisdiction_id")
      .references(() => jurisdictions.id)
      .notNull(),
    /** Stable Civica fact-key — see
     *  src/lib/factbook/reconcile/fact-keys.ts for the enum. */
    factKey: text("fact_key").notNull(),
    /** 'A' (identity, slow-changing) | 'B' (quantitative, fast-changing)
     *  | 'C' (categorical / structural) per methodology §1.1.
     *  Legacy CIA-only rows backfilled to 'B'; resolver overrides
     *  per-fact-key from the canonical enum at runtime. */
    factGroup: text("fact_group").notNull().default("B"),
    /** Logical category for UI grouping. */
    category: text("category").notNull(),

    // ── Source provenance (Phase F additions) ──
    /** FK to sources.id. Default 'cia_factbook' lets existing
     *  legacy rows backfill automatically on schema push. New
     *  inserts always specify source_id explicitly. */
    sourceId: text("source_id")
      .references(() => sources.id)
      .notNull()
      .default("cia_factbook"),
    /** Direct URL to upstream record where applicable. */
    sourceUrl: text("source_url"),
    /** Wikidata-only: Q-ID of the entity (e.g. "Q1033"). */
    wikidataQid: text("wikidata_qid"),
    /** Wikidata-only: P-ID of the property (e.g. "P1082"). */
    wikidataPid: text("wikidata_pid"),
    /** Wikidata-only: claim rank — 'preferred' | 'normal' | 'deprecated'. */
    wikidataRank: text("wikidata_rank"),
    /** JSON array of accepted reference Q-IDs / URLs from upstream
     *  claim, captured at sync time. Lets the alternate-values
     *  panel show readers exactly which World Bank URL a Wikidata
     *  claim cites. Per OQ-2 (resolved) / methodology §13.4. */
    references: jsonb("references"),
    /** Stable hash of the upstream payload + value, for sync
     *  idempotency (skip upsert if nothing changed). */
    sourceHash: text("source_hash"),

    // ── Value (parallel typed columns; one or more populated) ──
    /** Display value, always populated. Existing column name
     *  preserved for back-compat. */
    factValue: text("fact_value"),
    /** Numeric form when available, used for material-error checks
     *  and sorting. Existing column name preserved. */
    factValueNumeric: real("fact_value_numeric"),
    /** Unit when relevant. Existing column name preserved. */
    factUnit: text("fact_unit"),
    /** Year (int) the upstream source assigned. Existing column. */
    factYear: integer("fact_year"),
    /** Free-form structured value where neither text nor numeric
     *  fits — religion / ethnic / language breakdowns. Phase F. */
    valueJson: jsonb("value_json"),

    // ── Vintaging / freshness (Phase F additions) ──
    /** Full date the upstream assigned, where finer than year. */
    asOf: date("as_of"),
    /** When our sync pulled the row. Backfilled to created_at. */
    retrievedAt: timestamp("retrieved_at").defaultNow().notNull(),
    /** Upstream dataset version handle, e.g. "WB WDI 2026.04",
     *  "CIA Factbook 2026-01-frozen". */
    upstreamVintageLabel: text("upstream_vintage_label"),

    // ── Civica-side bookkeeping (Phase F additions) ──
    /** Methodology version that admitted this row.
     *  Updated to v0.2-beta (v1.0 follow-up §1.2, 2026-05-06) —
     *  all existing rows backfilled via scripts/backfill-methodology-version.ts.
     */
    methodologyVersion: text("methodology_version")
      .notNull()
      .default("v0.2-beta"),
    /** 'active' | 'rejected' | 'superseded'. Rejected rows are
     *  kept for transparency but excluded from resolver input. */
    status: text("status").notNull().default("active"),
    /** Reason text when status='rejected'. */
    statusReason: text("status_reason"),
    /** Pointer to immutable upstream snapshot. */
    snapshotId: uuid("snapshot_id"),

    /** Free-form note from the seed/sync script. Existing column. */
    sourceNote: text("source_note"),

    /** 'measured' | 'projected'. A `measured` row is an empirical
     *  observation at the upstream's vintage cut (or a model-imputed
     *  measurement that the upstream itself publishes as a measurement,
     *  e.g., ILO modelled estimates, UNDP HDI composite). A `projected`
     *  row is a model output that the upstream itself publishes as a
     *  projection / forecast (e.g., IMF WEO forecast-year rows,
     *  OECD Economic Outlook projection-year rows). The resolver
     *  prefers `measured` over `projected` for canonical purposes;
     *  projected rows stay in alternates for transparency.
     *
     *  Set by each sync orchestrator at write time. Defaults to
     *  `'measured'` so legacy rows backfill correctly on schema push
     *  (no projections existed pre-Bug-1; IMF's 1,716 forecast rows
     *  are flipped to `'projected'` by the Bug-1 backfill SQL).
     *
     *  See `~/civica/plan/forecast-vs-measurement-v1.md` for the
     *  methodology, the resolver rule ("any measured row beats all
     *  projected rows"), and the per-source tagging policies for
     *  R.2 IMF / R.6 UNDP HDI / R.7 OECD / R.10 ILO. */
    valueType: text("value_type").notNull().default("measured"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    /** Phase F: identity is now (jurisdiction, fact_key, source). */
    uniqueIndex("idx_country_facts_jurisdiction_factkey_source").on(
      table.jurisdictionId,
      table.factKey,
      table.sourceId
    ),
    index("idx_country_facts_key").on(table.factKey),
    index("idx_country_facts_category").on(table.category),
    index("idx_country_facts_status").on(table.status),
    index("idx_country_facts_factgroup").on(table.factGroup),
    index("idx_country_facts_jurisdiction").on(table.jurisdictionId),
    index("idx_country_facts_numeric").on(
      table.factKey,
      table.factValueNumeric
    ),
    /** Bug-1 — supports the resolver's "any measured row exists?"
     *  partition probe and the replication CSV's value-type filter. */
    index("idx_country_facts_factkey_valuetype").on(
      table.factKey,
      table.valueType
    ),
  ]
);

/**
 * `country_facts.value_type` enum values.
 *
 * - `measured` — empirical observation at the upstream's vintage
 *   cut, or a model-imputed measurement the upstream itself
 *   publishes as a measurement.
 * - `projected` — a model output the upstream itself publishes as
 *   a projection / forecast.
 *
 * See `~/civica/plan/forecast-vs-measurement-v1.md` § 2d.
 */
export type FactValueType = "measured" | "projected";

/**
 * Phase F — quarterly fact vintages.
 *
 * Frozen snapshot of resolver output per (jurisdiction, fact_key,
 * vintage_label). Mirrors `ci_composite_scores.vintage_label`.
 * Lets a reader citing "Civica Atlas, Nigeria GDP, vintage 2026Q3"
 * get a value that won't move.
 *
 * Methodology §4. Schema doc §2.
 *
 * Phase R.22 (2026-05-05) added three additive nullable columns
 * for academic-replication purposes: `cut_at_timestamp` (per-cut
 * batch timestamp distinct from per-row `snapshot_at`),
 * `content_hash` (SHA-256 of the canonical row's reproducibility-
 * relevant fields), and `is_disputed_at_cut` (frozen copy of the
 * resolver's cut-time dispute state). See
 * `~/civica/plan/vintage-cadence-resolution-v1.md`.
 *
 * The runtime-vs-snapshot split: reader-facing factbook pages and
 * the public API call the resolver at runtime via
 * `getCanonicalFact()` (live data, includes new sources
 * immediately). This table is the *citation-handle* surface — a
 * frozen artefact for academic replication. Cuts are quarterly via
 * the `/api/cron/factbook/snapshot-vintage` cron at T+15 days
 * after each quarter close.
 */
export const countryFactVintages = pgTable(
  "country_fact_vintages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jurisdictionId: uuid("jurisdiction_id")
      .references(() => jurisdictions.id)
      .notNull(),
    factKey: text("fact_key").notNull(),
    /** Civica-side vintage handle. Phase R.22+: format
     *  `"Civica Atlas Reconciled v<methodology_version> — vintage
     *  <YYYY-Qn>"` (e.g. `"Civica Atlas Reconciled v0.2-beta —
     *  vintage 2026-Q1"`). Pre-R.22 legacy format
     *  `"Civica Atlas <YYYYQn>"` is preserved on existing rows for
     *  backwards compatibility. */
    vintageLabel: text("vintage_label").notNull(),
    /** The country_facts.id that won the resolver at vintage time. */
    canonicalFactId: uuid("canonical_fact_id")
      .references(() => countryFacts.id)
      .notNull(),
    /** Frozen-at-vintage copy of the value fields, queryable
     *  without joining country_facts. */
    valueText: text("value_text"),
    valueNumeric: real("value_numeric"),
    valueUnit: text("value_unit"),
    valueJson: jsonb("value_json"),
    asOf: date("as_of"),
    sourceId: text("source_id").notNull(),
    methodologyVersion: text("methodology_version").notNull(),
    snapshotAt: timestamp("snapshot_at").defaultNow().notNull(),
    /** R.22 — cut-batch timestamp. Distinct from `snapshotAt`
     *  (per-row insert time): all rows in the same vintage cut
     *  share this timestamp, allowing replication queries to
     *  group rows by cut without joining `vintage_label`. NULL on
     *  legacy pre-R.22 rows. See
     *  `~/civica/plan/vintage-cadence-resolution-v1.md` § 2f. */
    cutAtTimestamp: timestamp("cut_at_timestamp"),
    /** R.22 — SHA-256 hash of the canonical row's reproducibility-
     *  relevant fields: `(source_id, value_text, value_numeric,
     *  as_of, methodology_version)`. Lets a downstream replication
     *  script detect content drift between identical-label
     *  re-cuts. NULL on legacy pre-R.22 rows. */
    contentHash: text("content_hash"),
    /** R.22 — frozen-at-cut copy of `ResolverOutput.isDisputed`.
     *  The dispute itself stays in `data_disputes` and may resolve
     *  post-cut; this column records the cut-time state so a
     *  replication reader knows whether the canonical pick was
     *  contested when frozen. NULL on legacy pre-R.22 rows. */
    isDisputedAtCut: boolean("is_disputed_at_cut"),
  },
  (table) => [
    uniqueIndex("idx_fact_vintage_unique").on(
      table.jurisdictionId,
      table.factKey,
      table.vintageLabel
    ),
    index("idx_fact_vintage_label").on(table.vintageLabel),
    index("idx_fact_vintage_jurisdiction").on(
      table.jurisdictionId,
      table.vintageLabel
    ),
  ]
);

/**
 * Phase F — operator dispute queue.
 *
 * Mirrors `pulse_corrections` and `correction_log`. Triggered when
 * the resolver hits material-error guards, plausibility envelope
 * rejections, would silently override a Group A/C value, or
 * receives a public correction.
 *
 * Methodology §7. Schema doc §3.
 */
export const dataDisputes = pgTable(
  "data_disputes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jurisdictionId: uuid("jurisdiction_id")
      .references(() => jurisdictions.id)
      .notNull(),
    factKey: text("fact_key").notNull(),
    factGroup: text("fact_group").notNull(),
    /** 'material_error' | 'group_a_override' | 'group_c_override'
     *  | 'plausibility_envelope' | 'rank_demoted' |
     *  'public_correction' | 'other' */
    disputeKind: text("dispute_kind").notNull(),
    factIdA: uuid("fact_id_a").references(() => countryFacts.id),
    factIdB: uuid("fact_id_b").references(() => countryFacts.id),
    /** 'prefer_a' | 'prefer_b' | 'hold' */
    proposedAction: text("proposed_action"),
    /** 'open' | 'in_review' | 'resolved_a_wins' | 'resolved_b_wins'
     *  | 'resolved_held' | 'rejected_invalid' */
    status: text("status").notNull().default("open"),
    description: text("description"),
    reviewerId: text("reviewer_id"),
    reviewerNotes: text("reviewer_notes"),
    resolvedAt: timestamp("resolved_at"),
    resolutionAction: text("resolution_action"),
    submitterName: text("submitter_name"),
    submitterEmail: text("submitter_email"),
    submitterAffiliation: text("submitter_affiliation"),
    isPublic: boolean("is_public").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_disputes_status_kind").on(
      table.status,
      table.disputeKind
    ),
    index("idx_disputes_jurisdiction").on(table.jurisdictionId),
    index("idx_disputes_factkey").on(table.factKey),
  ]
);

/**
 * Phase F — immutable upstream payload snapshots.
 *
 * Stores the raw payload from each upstream sync call, hashed for
 * de-dup. Lets us replay the resolver against any historical
 * vintage.
 *
 * Methodology §5.1. Schema doc §4.
 */
export const factSnapshots = pgTable(
  "fact_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: text("source_id")
      .references(() => sources.id)
      .notNull(),
    /** Upstream URL or query that produced the payload. */
    upstreamRef: text("upstream_ref").notNull(),
    /** Stable hash — primary de-dup key. */
    payloadHash: text("payload_hash").notNull(),
    payload: jsonb("payload").notNull(),
    upstreamVintageLabel: text("upstream_vintage_label"),
    fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_fact_snapshots_unique").on(
      table.sourceId,
      table.payloadHash
    ),
    index("idx_fact_snapshots_ref").on(
      table.upstreamRef,
      table.fetchedAt
    ),
  ]
);

/**
 * Phase F — fact reconciliation audit log.
 *
 * Every reviewer decision and every resolver override (e.g. on a
 * methodology version bump) writes a row. Mirrors
 * `pulse_review_audit_log`.
 *
 * Methodology §7.4. Schema doc §5.
 */
export const dataFactsAuditLog = pgTable(
  "data_facts_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jurisdictionId: uuid("jurisdiction_id").references(
      () => jurisdictions.id
    ),
    factKey: text("fact_key"),
    disputeId: uuid("dispute_id").references(() => dataDisputes.id),
    /** 'reviewer_decision' | 'resolver_recompute' |
     *  'methodology_version_bump' | 'sync_rejected' |
     *  'sync_admitted' */
    action: text("action").notNull(),
    actorId: text("actor_id").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_facts_audit_dispute").on(table.disputeId),
    index("idx_facts_audit_jurisdiction_factkey").on(
      table.jurisdictionId,
      table.factKey
    ),
    index("idx_facts_audit_actor_date").on(
      table.actorId,
      table.createdAt
    ),
  ]
);

export const statements = pgTable("statements", {
  id: uuid("id").primaryKey().defaultRandom(),
  subjectTable: text("subject_table").notNull(),
  subjectId: uuid("subject_id").notNull(),
  predicate: text("predicate").notNull(),
  objectValue: text("object_value"),
  objectEntityId: uuid("object_entity_id"),
  sourceId: text("source_id").notNull(),
  sourceUrl: text("source_url"),
  sourceLicense: text("source_license"),
  retrievedAt: timestamp("retrieved_at").notNull(),
  sourceHash: text("source_hash"),
  validFrom: date("valid_from"),
  validTo: date("valid_to"),
  confidence: real("confidence").default(1.0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const sources = pgTable("sources", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  baseUrl: text("base_url"),
  license: text("license").notNull(),
  isCommercialUseAllowed: boolean("is_commercial_use_allowed").notNull(),
  lastSyncAt: timestamp("last_sync_at"),
});

export const governmentTaxonomies = pgTable(
  "government_taxonomies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jurisdictionId: uuid("jurisdiction_id")
      .references(() => jurisdictions.id)
      .notNull(),
    taxonomyVersion: text("taxonomy_version").notNull(),
    regimeTypeCgv: text("regime_type_cgv"),
    regimeDatasetVersion: text("regime_dataset_version"),
    regimeYear: integer("regime_year"),
    structuralFamily: text("structural_family"),
    structuralSubtype: text("structural_subtype"),
    isFederal: boolean("is_federal"),
    isMonarchy: boolean("is_monarchy"),
    executiveStructure: text("executive_structure"),
    governmentDependency: text("government_dependency"),
    overrideNote: text("override_note"),
    provenance: jsonb("provenance"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_government_taxonomies_unique").on(
      table.jurisdictionId,
      table.taxonomyVersion
    ),
    index("idx_government_taxonomies_version").on(table.taxonomyVersion),
    index("idx_government_taxonomies_regime").on(
      table.taxonomyVersion,
      table.regimeTypeCgv
    ),
    index("idx_government_taxonomies_structural").on(
      table.taxonomyVersion,
      table.structuralFamily
    ),
  ]
);

export const contactSubmissions = pgTable("contact_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  ipAddress: text("ip_address"),
  /**
   * Triage lifecycle for the admin Messages surface: new → read → archived.
   * Additive column (default 'new') so existing rows and the public contact
   * POST path are unaffected — the insert never sets it. Mirrors the
   * advisory_applications.status pattern; flipped only via the authed
   * /api/admin/messages/[id] route.
   */
  status: text("status").notNull().default("new"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Cache AI-generated one-sentence bill summaries to avoid re-calling Claude on every page load
export const billSummaryCache = pgTable(
  "bill_summary_cache",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Stable key: ISO2 country code + bill title hash
    cacheKey: text("cache_key").notNull(),
    summary: text("summary").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("bill_summary_cache_key_idx").on(t.cacheKey)]
);

// Phase H — persisted bills, populated by per-jurisdiction sync scripts.
// Replaces the request-time live-fetch path that used to live in
// `src/app/api/countries/[slug]/bills/route.ts`. Stage column is the
// 0–4 normalised value the BillsTab UI already consumes (see
// `src/components/atlas/data.ts:36-45`); raw status text is preserved
// for citation honesty.
export const bills = pgTable(
  "bills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jurisdictionId: uuid("jurisdiction_id")
      .references(() => jurisdictions.id)
      .notNull(),
    bodyId: uuid("body_id").references(() => governmentBodies.id),
    sourceId: text("source_id")
      .references(() => sources.id)
      .notNull(),
    /** Source-side identifier (e.g. "hr-1234-119" or "uk-3782"). Combined
     *  with sourceId, uniquely identifies the bill across re-syncs. */
    externalId: text("external_id").notNull(),
    /** Display title — original language for non-English jurisdictions. */
    title: text("title").notNull(),
    longTitle: text("long_title"),
    /** Plain-English summary, generated via Claude Haiku per `summarize.ts`. */
    summary: text("summary"),
    /** 0=draft, 1=committee, 2=floor, 3=passed, 4=enacted. */
    stage: integer("stage").notNull().default(0),
    /** The raw status string from the source — kept verbatim for citation. */
    rawStatus: text("raw_status"),
    introducedDate: date("introduced_date"),
    lastActionDate: date("last_action_date").notNull(),
    lastActionText: text("last_action_text"),
    sponsorName: text("sponsor_name"),
    sponsorParty: text("sponsor_party"),
    /** Human-readable URL on the parliament's site. */
    url: text("url").notNull(),
    /** Direct link to the bill text PDF / HTML if the source exposes one. */
    textUrl: text("text_url"),
    voteYes: integer("vote_yes"),
    voteNo: integer("vote_no"),
    voteAbstain: integer("vote_abstain"),
    /** Full source-side response, preserved for future field extraction
     *  without re-syncing. */
    raw: jsonb("raw"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    // Drives the 10-most-recent-bills query.
    index("bills_jurisdiction_last_action_idx").on(
      t.jurisdictionId,
      t.lastActionDate
    ),
    // Idempotent upserts.
    uniqueIndex("bills_source_external_idx").on(t.sourceId, t.externalId),
  ]
);

export const metricDefinitions = pgTable("metric_definitions", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  unit: text("unit"),
  higherIsBetter: boolean("higher_is_better").notNull(),
  valueMin: real("value_min"),
  valueMax: real("value_max"),
  defaultSourceId: text("default_source_id").references(() => sources.id),
});

export const countryMetrics = pgTable(
  "country_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jurisdictionId: uuid("jurisdiction_id")
      .references(() => jurisdictions.id)
      .notNull(),
    metricId: text("metric_id")
      .references(() => metricDefinitions.id)
      .notNull(),
    year: integer("year").notNull(),
    value: real("value").notNull(),
    rank: integer("rank"),
    totalRanked: integer("total_ranked"),
    sourceId: text("source_id")
      .references(() => sources.id)
      .notNull(),
    sourceUrl: text("source_url"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_country_metrics_unique").on(
      table.jurisdictionId,
      table.metricId,
      table.year
    ),
    index("idx_country_metrics_type_year").on(table.metricId, table.year),
    index("idx_country_metrics_jurisdiction").on(table.jurisdictionId),
  ]
);

// --- Civica Index & Pulse tables ---

export const ciMethodologyVersions = pgTable("ci_methodology_versions", {
  id: text("id").primaryKey(),
  publishedAt: timestamp("published_at").notNull(),
  weights: jsonb("weights").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const ciSourceIngestions = pgTable(
  "ci_source_ingestions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: text("source_id")
      .references(() => sources.id)
      .notNull(),
    dimension: text("dimension").notNull(),
    datasetYear: integer("dataset_year").notNull(),
    nativeScaleMin: real("native_scale_min").notNull(),
    nativeScaleMax: real("native_scale_max").notNull(),
    isInverted: boolean("is_inverted").notNull().default(false),
    globalMinObserved: real("global_min_observed"),
    globalMaxObserved: real("global_max_observed"),
    countriesCovered: integer("countries_covered"),
    ingestedAt: timestamp("ingested_at").defaultNow().notNull(),
    status: text("status").notNull().default("completed"),
    errorMessage: text("error_message"),
  },
  (table) => [
    uniqueIndex("idx_ci_source_ingestions_unique").on(
      table.sourceId,
      table.dimension,
      table.datasetYear
    ),
  ]
);

export const ciDimensionScores = pgTable(
  "ci_dimension_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jurisdictionId: uuid("jurisdiction_id")
      .references(() => jurisdictions.id)
      .notNull(),
    dimension: text("dimension").notNull(),
    quarter: text("quarter").notNull(),
    normalizedScore: real("normalized_score").notNull(),
    rawValue: real("raw_value"),
    sourceId: text("source_id")
      .references(() => sources.id)
      .notNull(),
    ingestionId: uuid("ingestion_id").references(() => ciSourceIngestions.id),
    // NOTE: methodology_version's FK is declared as an explicit named
    // foreignKey() below (not inline .references()) because Drizzle's
    // auto-generated inline name exceeds Postgres's 63-byte identifier
    // limit and gets silently truncated at creation time — which made
    // `drizzle-kit push` perpetually propose a "rename" that is actually
    // a no-op (the truncated new name == the existing DB name). Pinning
    // the name here matches the live DB and keeps `push` clean.
    methodologyVersion: text("methodology_version").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_ci_dimension_scores_unique").on(
      table.jurisdictionId,
      table.dimension,
      table.quarter,
      table.methodologyVersion
    ),
    index("idx_ci_dimension_scores_quarter").on(table.quarter),
    index("idx_ci_dimension_scores_jurisdiction").on(table.jurisdictionId),
    foreignKey({
      name: "ci_dimension_scores_methodology_version_ci_methodology_versions",
      columns: [table.methodologyVersion],
      foreignColumns: [ciMethodologyVersions.id],
    }),
  ]
);

/**
 * Long-run source-indicator history — one row per
 * (jurisdiction, indicator, year). Backs the multi-series historical
 * trend charts on the country page's Civica Data tab (audit
 * Recommendation 4: "trend evidence is what governance scholars
 * actually cite").
 *
 * The CI pipeline (`ci_dimension_scores`) intentionally keeps only the
 * latest vintage per quarter; this table is the parallel, append-only
 * archive of the FULL published series for each source indicator
 * (V-Dem back to 1789, Freedom House 2003+, WGI 1996+, HDI 1990+,
 * CPI 2012+). It is read-only evidence for the chart — it does NOT feed
 * CI scoring.
 *
 * Values are stored in each source's NATIVE published scale (with the
 * scale bounds + orientation captured per row) rather than pre-normalised
 * to 0–100, so the archive stays faithful to the citable source and the
 * chart owns display normalisation. Backfilled + refreshed by
 * `scripts/ingest-indicator-history.ts` (idempotent upsert on the
 * uniqueness key); freshness stamped via `markSourcesSynced()`.
 */
export const indicatorHistory = pgTable(
  "indicator_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jurisdictionId: uuid("jurisdiction_id")
      .references(() => jurisdictions.id)
      .notNull(),
    /** CI dimension this indicator informs (mirrors `ci_dimension_scores.dimension`). */
    dimension: text("dimension").notNull(),
    /** Source-native indicator key, e.g. "v2x_libdem", "rl.est", "hdi". */
    indicator: text("indicator").notNull(),
    /** Calendar year of the observation. */
    year: integer("year").notNull(),
    /** Observation in the source's native published scale. */
    value: real("value").notNull(),
    /** Native scale bounds + orientation, so consumers can normalise for display. */
    nativeMin: real("native_min").notNull(),
    nativeMax: real("native_max").notNull(),
    /** true when a LOWER native value is BETTER (e.g. GPI, FH 1–7 rating). */
    isInverted: boolean("is_inverted").notNull().default(false),
    /** Provenance: sources.id (e.g. "vdem", "worldbank_wgi"). */
    sourceId: text("source_id")
      .references(() => sources.id)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_indicator_history_unique").on(
      table.jurisdictionId,
      table.indicator,
      table.year
    ),
    // Hot path: "give me every year of every indicator for this country".
    index("idx_indicator_history_jur_dim").on(
      table.jurisdictionId,
      table.dimension
    ),
    index("idx_indicator_history_indicator").on(table.indicator),
  ]
);

export const ciCompositeScores = pgTable(
  "ci_composite_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jurisdictionId: uuid("jurisdiction_id")
      .references(() => jurisdictions.id)
      .notNull(),
    quarter: text("quarter").notNull(),
    score: real("score").notNull(),
    /**
     * Phase 5.2 — Beta methodology additions.
     *
     * `score_lower` and `score_upper` are the 5th and 95th percentile
     * of the Monte Carlo simulation (10,000 sims) per spec §2.5,
     * giving a 90% confidence interval. NULL on legacy v1.0 rows.
     *
     * `band` is the A–F rank band per spec §2.6. Derived from `score`.
     *
     * `completeness_flag` is the explicit successor to `is_partial`.
     * Possible values: 'full' | 'partial' | 'insufficient'. The Beta
     * methodology will not insert 'insufficient' rows (those are
     * skipped entirely); the column allows the value for forward
     * compatibility.
     *
     * `vintage_label` is the human-readable cite handle, e.g.
     * "Civica Index 2026 Q3 (Beta)". NULL until the row becomes a
     * frozen vintage at quarterly publication.
     */
    scoreLower: real("score_lower"),
    scoreUpper: real("score_upper"),
    band: text("band"),
    completenessFlag: text("completeness_flag"),
    vintageLabel: text("vintage_label"),
    rank: integer("rank"),
    totalRanked: integer("total_ranked"),
    isPartial: boolean("is_partial").notNull().default(false),
    dimensionsAvailable: integer("dimensions_available").notNull().default(6),
    missingDimensions: text("missing_dimensions").array(),
    // See the identical note on ciDimensionScores.methodologyVersion above:
    // explicit named foreignKey() below, not inline .references(), because
    // Drizzle's auto-generated name truncates past Postgres's 63-byte limit.
    methodologyVersion: text("methodology_version").notNull(),
    calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_ci_composite_unique").on(
      table.jurisdictionId,
      table.quarter,
      table.methodologyVersion
    ),
    index("idx_ci_composite_quarter_rank").on(table.quarter, table.rank),
    index("idx_ci_composite_jurisdiction").on(table.jurisdictionId),
    foreignKey({
      name: "ci_composite_scores_methodology_version_ci_methodology_versions",
      columns: [table.methodologyVersion],
      foreignColumns: [ciMethodologyVersions.id],
    }),
  ]
);

export const pulseEvents = pgTable(
  "pulse_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jurisdictionId: uuid("jurisdiction_id")
      .references(() => jurisdictions.id)
      .notNull(),
    eventDate: date("event_date").notNull(),
    category: text("category").notNull(),
    severity: real("severity").notNull(),
    confidence: real("confidence").notNull(),
    justification: text("justification").notNull(),
    headline: text("headline").notNull(),
    sourceUrl: text("source_url"),
    sourceName: text("source_name"),
    llmModel: text("llm_model").notNull(),
    llmRequestId: text("llm_request_id"),
    rawEventData: jsonb("raw_event_data"),
    isActive: boolean("is_active").notNull().default(true),
    expiresAt: date("expires_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_pulse_events_jurisdiction_date").on(
      table.jurisdictionId,
      table.eventDate
    ),
    index("idx_pulse_events_active").on(
      table.jurisdictionId,
      table.isActive,
      table.eventDate
    ),
    index("idx_pulse_events_category").on(table.category),
  ]
);

export const pulseDailyScores = pgTable(
  "pulse_daily_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jurisdictionId: uuid("jurisdiction_id")
      .references(() => jurisdictions.id)
      .notNull(),
    scoreDate: date("score_date").notNull(),
    ciBaseline: real("ci_baseline").notNull(),
    eventImpact: real("event_impact").notNull(),
    pulseScore: real("pulse_score").notNull(),
    activeEvents: integer("active_events").notNull(),
    isLowConfidence: boolean("is_low_confidence").notNull().default(false),
    // See the identical note on ciDimensionScores.methodologyVersion above:
    // explicit named foreignKey() below, not inline .references(), because
    // Drizzle's auto-generated name truncates past Postgres's 63-byte limit.
    methodologyVersion: text("methodology_version").notNull(),
    calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_pulse_daily_unique").on(
      table.jurisdictionId,
      table.scoreDate
    ),
    index("idx_pulse_daily_date").on(table.scoreDate),
    index("idx_pulse_daily_jurisdiction").on(table.jurisdictionId),
    foreignKey({
      name: "pulse_daily_scores_methodology_version_ci_methodology_versions_",
      columns: [table.methodologyVersion],
      foreignColumns: [ciMethodologyVersions.id],
    }),
  ]
);

export const pulseChangelog = pgTable(
  "pulse_changelog",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jurisdictionId: uuid("jurisdiction_id")
      .references(() => jurisdictions.id)
      .notNull(),
    scoreDate: date("score_date").notNull(),
    eventId: uuid("event_id")
      .references(() => pulseEvents.id)
      .notNull(),
    decayedImpact: real("decayed_impact").notNull(),
    daysSinceEvent: integer("days_since_event").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_pulse_changelog_jurisdiction_date").on(
      table.jurisdictionId,
      table.scoreDate
    ),
    index("idx_pulse_changelog_event").on(table.eventId),
  ]
);

// --- International organizations (CIV-163) ---

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").unique().notNull(),
  name: text("name").notNull(),
  fullName: text("full_name").notNull(),
  type: text("type").notNull(),
  foundedYear: integer("founded_year"),
  hqCountry: text("hq_country"),
  memberCount: integer("member_count"),
  wikidataQid: text("wikidata_qid"),
  extra: jsonb("extra"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const organizationMemberships = pgTable(
  "organization_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .references(() => organizations.id)
      .notNull(),
    jurisdictionId: uuid("jurisdiction_id")
      .references(() => jurisdictions.id)
      .notNull(),
    joinDate: date("join_date"),
    role: text("role"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_org_memberships_unique").on(
      table.orgId,
      table.jurisdictionId
    ),
    index("idx_org_memberships_jurisdiction").on(table.jurisdictionId),
    index("idx_org_memberships_org").on(table.orgId),
  ]
);

// --- Phase 5.2 — Civica Conditions companion layer ---

/**
 * Civica Conditions scores — material conditions companion to the CI.
 * Three dimensions, each surfaced separately on country pages; never merged
 * into a headline number and never combined with the CI composite.
 *
 * Dimensions: human_development | peace_security | economic_stability
 */
export const civicaConditionsScores = pgTable(
  "civica_conditions_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jurisdictionId: uuid("jurisdiction_id")
      .references(() => jurisdictions.id)
      .notNull(),
    /** human_development | peace_security | economic_stability */
    dimension: text("dimension").notNull(),
    /** Quarter string matching ci_dimension_scores.quarter, e.g. "2026-Q3" */
    quarter: text("quarter").notNull(),
    /** Normalized 0–100 score (higher = better) */
    normalizedScore: real("normalized_score").notNull(),
    /** Original native-scale value, kept for transparency */
    rawValue: real("raw_value"),
    sourceId: text("source_id")
      .references(() => sources.id)
      .notNull(),
    /** Vintage of the upstream dataset (calendar year) */
    datasetYear: integer("dataset_year").notNull(),
    /** Methodology version tag — "beta" during the v2 rebuild */
    methodologyVersion: text("methodology_version").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_conditions_unique").on(
      table.jurisdictionId,
      table.dimension,
      table.quarter,
      table.methodologyVersion
    ),
    index("idx_conditions_quarter").on(table.quarter),
    index("idx_conditions_jurisdiction").on(table.jurisdictionId),
  ]
);

// --- Phase 5.1 — CI v2 credibility infrastructure ---

/**
 * Public log of data-error disputes, methodology disagreements, and
 * Pulse misclassification reports. Backs the /civica-index/corrections page.
 * Rows where is_public=false are hidden from the public log (PII redaction).
 */
export const correctionLog = pgTable("correction_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
  /** FK to jurisdictions.id — nullable for methodology-wide disputes */
  countryId: uuid("country_id").references(() => jurisdictions.id),
  /**
   * ci_data_error | ci_methodology | pulse_misclassification |
   * pulse_severity | pulse_false_positive | pulse_missing_event |
   * pulse_duplicate | other
   */
  category: text("category").notNull(),
  /** Optional CI dimension the dispute pertains to */
  dimension: text("dimension"),
  submitterName: text("submitter_name"),
  submitterEmail: text("submitter_email"),
  submitterAffiliation: text("submitter_affiliation"),
  description: text("description").notNull(),
  /**
   * open | in_review | resolved_corrected | resolved_no_change | rejected
   */
  status: text("status").notNull().default("open"),
  /** Public-facing response from Civica, set when resolved */
  disposition: text("disposition"),
  resolvedAt: timestamp("resolved_at"),
  /** false = row is hidden from the public log (PII redaction toggle) */
  isPublic: boolean("is_public").notNull().default(true),
  /** Internal team notes — never shown publicly */
  internalNotes: text("internal_notes"),
});

/**
 * Placeholder schema for the academic advisory board described in
 * v2 methodology spec §3.1. Table ships empty; rows arrive via
 * manual INSERT once recruitment happens.
 */
export const advisoryBoardMembers = pgTable("advisory_board_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  affiliation: text("affiliation").notNull(),
  /** Comma-separated expertise tags or a short paragraph */
  expertise: text("expertise").notNull(),
  /** Optional markdown bio */
  bioMd: text("bio_md"),
  photoUrl: text("photo_url"),
  displayOrder: integer("display_order").notNull().default(100),
  joinedAt: date("joined_at").notNull().defaultNow(),
  isActive: boolean("is_active").notNull().default(true),
});

/**
 * Inbound applications to join the academic advisory board
 * (v2 methodology spec §3.1). Populated by the public
 * `/about/advisory-board/apply` form, which POSTs to the
 * `/api/advisory-applications` route handler. The owner reads new
 * applications through the authed admin surface at
 * `/admin/advisory-applications` (mirrors how contact submissions
 * arrive — DB row + bearer/session-gated admin read; no email
 * provider is wired for either).
 *
 * `cvUrl` holds an applicant-supplied CV link (Google Scholar,
 * personal site, institutional page, or a hosted PDF). Server file
 * uploads are not wired (the Vercel Blob SDK isn't a dependency), so
 * the form is intentionally links-only rather than half-shipping a
 * broken upload.
 */
export const advisoryApplications = pgTable("advisory_applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  institution: text("institution").notNull(),
  /** Role / title, e.g. "Associate Professor of Political Science" */
  role: text("role").notNull(),
  /** Primary area of expertise (governance measurement, comparative politics, …) */
  expertiseArea: text("expertise_area").notNull(),
  /** Free-text statement of relevant experience (the "why me") */
  experience: text("experience").notNull(),
  /** Relevant links: publications, Google Scholar, LinkedIn, ORCID, etc. */
  links: text("links"),
  /** Applicant-supplied CV link (scholar page / personal site / hosted PDF) */
  cvUrl: text("cv_url"),
  ipAddress: text("ip_address"),
  /** Triage lifecycle: new → reviewed → contacted → archived */
  status: text("status").notNull().default("new"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// --- Phase 5.5 — Pulse Beta foundation (dimensional deltas) ---

/**
 * Staging table for raw events ingested from specialist + news feeds.
 * One row per source-record. Drained by the clustering step which
 * groups near-duplicate records into governance-event clusters.
 *
 * Rows are retained for 7 days post-clustering then garbage-collected.
 */
export const rawEvents = pgTable(
  "raw_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** sources.id — e.g. "acled", "civicus_monitor", "gdelt" */
    sourceId: text("source_id")
      .references(() => sources.id)
      .notNull(),
    /** Source-native id where available, for upsert idempotency */
    externalId: text("external_id"),
    sourceUrl: text("source_url"),
    /** 'specialist' | 'news' */
    sourceType: text("source_type").notNull(),
    /** Nullable — country resolution can fail */
    jurisdictionId: uuid("jurisdiction_id").references(() => jurisdictions.id),
    /** Pre-resolution country name from the source for diagnostics */
    rawCountryName: text("raw_country_name"),
    eventDate: date("event_date"),
    retrievedAt: timestamp("retrieved_at").defaultNow().notNull(),
    title: text("title").notNull(),
    body: text("body"),
    /** Full source payload for re-extraction without re-fetching */
    raw: jsonb("raw").notNull(),
    /** 384-dim sentence-transformer embedding for clustering */
    embedding: real("embedding").array(),
    /** Set when row joins a cluster; null until then */
    clusterId: uuid("cluster_id"),
    clusteredAt: timestamp("clustered_at"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_raw_events_jurisdiction_date").on(
      table.jurisdictionId,
      table.eventDate
    ),
    index("idx_raw_events_unclustered").on(table.clusteredAt),
    index("idx_raw_events_cluster").on(table.clusterId),
    uniqueIndex("idx_raw_events_external")
      .on(table.sourceId, table.externalId)
      .where(dsql`${table.externalId} IS NOT NULL`),
  ]
);

/**
 * Pulse Beta v2 events — one row per clustered governance event.
 *
 * Replaces v1's per-source-record `pulse_events` table. Each row
 * represents a single real-world event (e.g. "Niger 2023 coup")
 * regardless of how many source records describe it.
 *
 * Unpublished rows (`published=false`) are pending human review per
 * spec §5.1. Reviewer UI lands in Phase 5.7.
 */
export const pulseEventsV2 = pgTable(
  "pulse_events_v2",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jurisdictionId: uuid("jurisdiction_id")
      .references(() => jurisdictions.id)
      .notNull(),
    eventDate: date("event_date").notNull(),
    /** Taxonomy category from spec §3.2 (e.g. "judicial_purge") */
    category: text("category").notNull(),
    /** dq | rol | fnr | cc | stability */
    dimension: text("dimension").notNull(),
    /**
     * low_pos | moderate_pos | high_pos |
     * low_neg | moderate_neg | severe_neg | catastrophic_neg
     */
    severityTier: text("severity_tier").notNull(),
    /** Numeric severity within the tier's range, signed */
    severityValue: real("severity_value").notNull(),
    /** Computed by the corroboration step, range [0, 1] */
    corroborationConfidence: real("corroboration_confidence").notNull(),
    /** Reasoning passes preserved for audit. The classify→verify
     *  classifier records two (classify + verify); the subscription path
     *  records one agent pass; legacy rows may hold three. Shape:
     *  [{run, temp, model, category, dimension, severity, confidence, raw}, ...] */
    classifierRuns: jsonb("classifier_runs").notNull(),
    /** 'all' | 'two_of_three' | 'none' — drives confidence boost/penalty.
     *  The published classify→verify confidence maps onto it: high→'all',
     *  medium→'two_of_three', low→'none'. */
    classifierAgreement: text("classifier_agreement").notNull(),
    humanReviewed: boolean("human_reviewed").notNull().default(false),
    reviewerId: text("reviewer_id"),
    reviewNotes: text("review_notes"),
    /** pending | approved | rejected | edited */
    reviewStatus: text("review_status").notNull().default("pending"),
    /** True only when verify confidence is not low AND the severity tier
     *  is not review-gated, OR a human reviewer has approved it.
     *  Score-driving. */
    published: boolean("published").notNull().default(false),
    headline: text("headline").notNull(),
    description: text("description").notNull(),
    /** Plain-English 2-3 sentence summary generated via Claude Haiku
     *  for the review queue. Lazily populated on first view of the
     *  review-detail page; null until then. See
     *  `src/lib/pulse/v2/summarize.ts`. */
    aiSummary: text("ai_summary"),
    /** RSF press freedom score for the country at classification time —
     *  pinned for reproducibility per spec §3.5 */
    pressFreedomScoreAtClassification: real(
      "press_freedom_score_at_classification"
    ),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_pulse_v2_jurisdiction_date").on(
      table.jurisdictionId,
      table.eventDate
    ),
    index("idx_pulse_v2_published").on(table.published, table.reviewStatus),
    index("idx_pulse_v2_dimension").on(table.dimension, table.eventDate),
  ]
);

/**
 * Per-event source attribution. Many rows per `pulse_events_v2.id` —
 * one for each source that contributed to the cluster. Source diversity
 * here drives corroboration confidence per spec §2.4.
 */
export const pulseSources = pgTable(
  "pulse_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .references(() => pulseEventsV2.id, { onDelete: "cascade" })
      .notNull(),
    sourceId: text("source_id")
      .references(() => sources.id)
      .notNull(),
    /** 'specialist' | 'news' — denormalized for fast aggregation */
    sourceType: text("source_type").notNull(),
    sourceName: text("source_name").notNull(),
    sourceUrl: text("source_url"),
    /** Breadcrumb back to the staging row that contributed */
    rawEventId: uuid("raw_event_id").references(() => rawEvents.id),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_pulse_sources_event").on(table.eventId),
    index("idx_pulse_sources_source").on(table.sourceId),
  ]
);

/**
 * Current dimensional delta state per (country, dimension).
 *
 * Recomputed daily from all `pulse_events_v2` rows where `published=true`
 * within the trailing 365-day window, applying category-specific decay
 * per spec §4.1, then clamped to [-15, +10] per §4.3.
 *
 * One row per (jurisdictionId, dimension). Daily score script upserts.
 */
export const pulseDimensionalDeltas = pgTable(
  "pulse_dimensional_deltas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jurisdictionId: uuid("jurisdiction_id")
      .references(() => jurisdictions.id)
      .notNull(),
    /** dq | rol | fnr | cc | stability */
    dimension: text("dimension").notNull(),
    /** Clamped [-15, +10] per spec §4.3 */
    deltaValue: real("delta_value").notNull(),
    /** Event ids contributing non-trivially (≥0.1 abs decayed impact) */
    contributingEventIds: uuid("contributing_event_ids").array().notNull(),
    lastComputedAt: timestamp("last_computed_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_pulse_dim_unique").on(
      table.jurisdictionId,
      table.dimension
    ),
    index("idx_pulse_dim_jurisdiction").on(table.jurisdictionId),
  ]
);

/**
 * Phase 5.7 — internal Pulse review audit log.
 *
 * Every reviewer decision (approve / edit / reject) writes a row
 * here with the before/after event snapshot. Lets us reconstruct
 * who decided what when, and surfaces the trail to disputes raised
 * via the corrections form.
 */
export const pulseReviewAuditLog = pgTable(
  "pulse_review_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .references(() => pulseEventsV2.id, { onDelete: "cascade" })
      .notNull(),
    /** Operator name supplied at sign-in. Initially the user types
     *  their own name; multi-operator support comes later. */
    reviewerId: text("reviewer_id").notNull(),
    /** 'approve' | 'edit' | 'reject' */
    action: text("action").notNull(),
    /** Pre-decision snapshot of the event row (relevant fields). */
    before: jsonb("before").notNull(),
    /** Post-decision snapshot. For 'reject', after === before with
     *  review_status flipped. */
    after: jsonb("after").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_pulse_review_audit_event").on(table.eventId),
    index("idx_pulse_review_audit_reviewer").on(
      table.reviewerId,
      table.createdAt
    ),
  ]
);

/**
 * Phase 5.8 — backtest cases.
 *
 * One row per named historical governance shock from the spec §5.3
 * test list (Myanmar 2021, Niger 2023, etc.). The `expected` column
 * holds the spec's expected-direction definition as JSON:
 *   [{dimension, direction, magnitude}, ...]
 * where direction ∈ {'positive','negative','mixed'} and
 * magnitude ∈ {'moderate','severe','catastrophic'}.
 */
export const backtestCases = pgTable("backtest_cases", {
  id: text("id").primaryKey(),
  countryName: text("country_name").notNull(),
  countryIso3: text("country_iso3"),
  eventDate: date("event_date").notNull(),
  description: text("description").notNull(),
  expected: jsonb("expected").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Hand-curated representative events for each backtest case. Fed
 * to the v2 classifier during a backtest run instead of pulling
 * from raw_events. Hint columns let the curator preflight what the
 * classifier should output without forcing the harness to use them.
 */
export const backtestEvents = pgTable(
  "backtest_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: text("case_id")
      .references(() => backtestCases.id, { onDelete: "cascade" })
      .notNull(),
    eventDate: date("event_date").notNull(),
    sourceId: text("source_id").notNull(),
    sourceType: text("source_type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    hintCategory: text("hint_category"),
    hintDimension: text("hint_dimension"),
    hintSeverityTier: text("hint_severity_tier"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("idx_backtest_events_case").on(table.caseId)]
);

/**
 * One row per backtest run per case. Stores the per-dimension
 * trajectory the harness produced and the pass/fail verdict.
 * Append-only — re-running creates new rows.
 */
export const backtestRuns = pgTable(
  "backtest_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: text("case_id")
      .references(() => backtestCases.id, { onDelete: "cascade" })
      .notNull(),
    ranAt: timestamp("ran_at").defaultNow().notNull(),
    /** Snapshot of the v2 pipeline parameters at run time. */
    paramSnapshot: jsonb("param_snapshot").notNull(),
    /** Array of {dayOffset, dimension, delta} sample points. */
    trajectory: jsonb("trajectory").notNull(),
    /** 'pass' | 'fail' | 'partial' */
    verdict: text("verdict").notNull(),
    /** Per-expected-row verdicts + divergence notes. */
    detail: jsonb("detail").notNull(),
  },
  (table) => [
    index("idx_backtest_runs_case_ran").on(table.caseId, table.ranAt),
  ]
);

/**
 * Public corrections log specific to Pulse events. Sister of
 * `correction_log`. Disputes track event misclassification, severity
 * miscalibration, false positives, missing events, duplicates per
 * spec §5.4.
 */
export const pulseCorrections = pgTable("pulse_corrections", {
  id: uuid("id").primaryKey().defaultRandom(),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
  /** Event under dispute — nullable if the report is "missing event" */
  eventId: uuid("event_id").references(() => pulseEventsV2.id),
  countryId: uuid("country_id").references(() => jurisdictions.id),
  /**
   * misclassification | severity | false_positive |
   * missing_event | duplicate | other
   */
  category: text("category").notNull(),
  submitterName: text("submitter_name"),
  submitterEmail: text("submitter_email"),
  submitterAffiliation: text("submitter_affiliation"),
  description: text("description").notNull(),
  /** open | in_review | resolved_corrected | resolved_no_change | rejected */
  status: text("status").notNull().default("open"),
  disposition: text("disposition"),
  resolvedAt: timestamp("resolved_at"),
  isPublic: boolean("is_public").notNull().default(true),
  internalNotes: text("internal_notes"),
});

// --- Durable (cross-instance) rate limiter ---

/**
 * Fixed-window rate-limit counters, backed by the existing Neon
 * Postgres so a per-IP limit survives serverless cold starts and
 * coordinates across instances (the in-memory limiter in
 * `src/lib/api/rate-limit.ts` cannot — audit 2026-06-07 Security #9).
 *
 * One row per (scope, key, window-start). The window start is baked
 * into the primary `key` (e.g. `chat-durable:1.2.3.4:1717848000000`)
 * so a new window opens a fresh row at count 1; the previous row goes
 * stale and is reaped opportunistically via the `expires_at` index.
 * No row is ever read to decide allow/deny — the count is incremented
 * and returned atomically by a single `INSERT … ON CONFLICT DO UPDATE
 * … RETURNING count`.
 *
 * Purely operational/ephemeral: holds no provenance and no user data
 * beyond the request IP for the duration of one window. Safe to
 * truncate at any time (worst case: counters reset for the current
 * window). Written ONLY by `checkDurableRateLimit()`.
 */
export const rateLimits = pgTable(
  "rate_limits",
  {
    /** `${scope}:${key}:${windowStartMs}` — encodes the window. */
    key: text("key").primaryKey(),
    /** Requests seen in this window so far. */
    count: integer("count").notNull().default(0),
    /** Wall-clock end of the window (windowStart + windowMs). Only
     *  used by the lazy reaper; never consulted on the hot path. */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("idx_rate_limits_expires_at").on(table.expiresAt)]
);
