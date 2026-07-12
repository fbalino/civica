import { sql as dsql } from "drizzle-orm";
import type { DerivationVersionEnvelope } from "@/lib/research/derivation-version";
import type { PulseStageVersionEnvelope } from "@/lib/pulse/v2/pipeline-version";
import type {
  PulseDecisionActor,
  PulseDecisionKind,
  PulseDecisionPayloads,
  PulseDecisionVerdict,
} from "@/lib/pulse/v2/decision-ledger";
import type {
  PulseEvidenceAttributionSnapshot,
  PulseEvidencePublisherSnapshot,
  PulseEvidenceRetentionSnapshot,
  PulseEvidenceRightsSnapshot,
} from "@/lib/pulse/v2/evidence-identity";
import type { JurisdictionEntitySnapshot } from "@/lib/pulse/v2/jurisdiction-entities";
import type {
  PulseCandidateKind,
  PulseCandidateOutcome,
} from "@/lib/pulse/v2/candidate-outcome";
import type {
  PulseCodingAdjudicationInput,
  PulseCodingPacketSnapshot,
  PulseCodingSubmissionEnvelope,
} from "@/lib/pulse/v2/coding-workspace";
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
  check,
  primaryKey,
  customType,
} from "drizzle-orm/pg-core";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const jurisdictions = pgTable("jurisdictions", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").unique().notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  statusSourceIds: jsonb("status_source_ids").$type<string[]>().notNull(),
  statusReviewedAt: date("status_reviewed_at").notNull(),
  statusNote: text("status_note").notNull(),
  administeringJurisdictionIso3: text("administering_jurisdiction_iso3"),
  statusDisputed: boolean("status_disputed").notNull().default(false),
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

/**
 * Expert-coded ideology positions for the cross-country party browser +
 * ideology compass, matched from V-Dem's **V-Party v2** dataset (source id
 * `vparty`). See `plan/party-ideology-sourcing-resolution-v1.md` (§4) — the
 * adopted contract for this table.
 *
 * Keyed 1:1 to a specific Civica `legislature_parties` row (unique on
 * `legislature_party_id`) so the ideology attaches to that party and travels
 * with it. A separate table (not columns on `legislature_parties`) because:
 * (a) `legislature_parties` is a seat-snapshot refreshed by legislature syncs,
 * a different vintage + cadence from the frozen 2022 V-Party release;
 * (b) it lets us carry the match provenance (which V-Party party, what year,
 * what method) and swap in a future V-Party vintage without touching seats.
 *
 * Provenance is load-bearing: a party with **no** V-Party match gets no row
 * here at all — the UI renders an honest "ideology not recorded" state, never
 * a fabricated position (resolution §5).
 *
 * Two axis values, per the adopted compass (resolution §2.5):
 *   - `economicLeftRight` = `v2pariglef` interval point estimate (X axis;
 *     ≈ −4 far-left … +4 far-right). `economicLrOrd` is the 0–6 ordinal bucket
 *     for labelling.
 *   - `antiPluralism` = `v2xpa_antiplural` Anti-Pluralism Index, 0 (pluralist)
 *     … 1 (anti-pluralist) (Y axis).
 */
export const partyPositions = pgTable(
  "party_positions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** The Civica `legislature_parties` row this position attaches to. */
    legislaturePartyId: uuid("legislature_party_id")
      .references(() => legislatureParties.id)
      .notNull(),
    /** Provenance: always `vparty` today. */
    sourceId: text("source_id")
      .references(() => sources.id)
      .notNull(),
    /** V-Party numeric party id (`v2paid` = Party Facts core-party id). */
    vpartyId: integer("vparty_id").notNull(),
    /** Harmonized English V-Party name kept for auditability of the match. */
    vpartyNameEn: text("vparty_name_en"),
    /** X axis — `v2pariglef` economic left–right interval point estimate. */
    economicLeftRight: real("economic_left_right").notNull(),
    /** `v2pariglef_ord` 0–6 ordinal bucket (0 Far-left … 6 Far-right). */
    economicLrOrd: integer("economic_lr_ord"),
    /** Y axis — `v2xpa_antiplural` Anti-Pluralism Index, 0–1. */
    antiPluralism: real("anti_pluralism").notNull(),
    /** `v2xpa_popul` Populism Index, 0–1 (optional third lens). */
    populism: real("populism"),
    /** The V-Party election year the stored position is coded for. */
    codedYear: integer("coded_year").notNull(),
    /** How the Civica row was matched: 'exact' | 'abbrev' | 'token' | 'manual'. */
    matchMethod: text("match_method").notNull(),
    /**
     * Match trust (resolution §4.2): 'high' for exact / abbrev matches,
     * 'review' for the fuzzy token matches that await a curation pass. The
     * read layer only surfaces a displayable `position` for 'high' rows — a
     * wrong ideology is worse than an honest "not recorded". Raw rows of every
     * confidence are kept in the table for that future curation pass.
     */
    matchConfidence: text("match_confidence").notNull().default("high"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    // One ideology position per Civica party row — the upsert conflict target.
    uniqueIndex("idx_party_positions_legislature_party").on(
      table.legislaturePartyId,
    ),
    index("idx_party_positions_source").on(table.sourceId),
  ],
);

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

/**
 * Version-bound, passage-grain search and citation index for Constitute's
 * English-language service representation. Superseded rows remain resolvable;
 * only `is_current` rows enter public search.
 */
export const constitutionPassages = pgTable(
  "constitution_passages",
  {
    passageId: text("passage_id").primaryKey(),
    schemaVersion: text("schema_version").notNull(),
    searchIndexVersion: text("search_index_version").notNull(),
    constitutionId: uuid("constitution_id")
      .references(() => constitutions.id, { onDelete: "restrict" })
      .notNull(),
    jurisdictionId: uuid("jurisdiction_id")
      .references(() => jurisdictions.id, { onDelete: "restrict" })
      .notNull(),
    sourceDocumentId: text("source_document_id").notNull(),
    sourceSectionId: text("source_section_id").notNull(),
    sectionOrder: integer("section_order").notNull(),
    anchorId: text("anchor_id").notNull(),
    headingLabel: text("heading_label"),
    topicKeys: jsonb("topic_keys").$type<string[]>().notNull(),
    plainText: text("plain_text").notNull(),
    contentSha256: text("content_sha256").notNull(),
    languageCode: text("language_code").notNull(),
    languageBasis: text("language_basis").notNull(),
    translationStatus: text("translation_status").notNull(),
    originalLanguageCode: text("original_language_code"),
    translator: text("translator"),
    sourceId: text("source_id")
      .references(() => sources.id, { onDelete: "restrict" })
      .notNull(),
    sourceUrl: text("source_url").notNull(),
    retrievalUrl: text("retrieval_url").notNull(),
    retrievedAt: timestamp("retrieved_at").notNull(),
    isCurrent: boolean("is_current").notNull().default(true),
    supersededAt: timestamp("superseded_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    searchVector: tsvector("search_vector")
      .generatedAlwaysAs(
        dsql`setweight(to_tsvector('english'::regconfig, coalesce("heading_label", '')), 'A') || setweight(to_tsvector('english'::regconfig, coalesce("plain_text", '')), 'B')`,
      )
      .notNull(),
  },
  (table) => [
    uniqueIndex("idx_constitution_passages_current_section")
      .on(table.constitutionId, table.sourceSectionId)
      .where(dsql`${table.isCurrent} = true`),
    index("idx_constitution_passages_search")
      .using("gin", table.searchVector)
      .where(dsql`${table.isCurrent} = true`),
    index("idx_constitution_passages_topics")
      .using("gin", table.topicKeys)
      .where(dsql`${table.isCurrent} = true`),
    index("idx_constitution_passages_jurisdiction").on(
      table.jurisdictionId,
      table.isCurrent,
    ),
    index("idx_constitution_passages_document_order").on(
      table.constitutionId,
      table.isCurrent,
      table.sectionOrder,
    ),
    check(
      "constitution_passages_contract_check",
      dsql`${table.schemaVersion} = 'constitution-passage/v1' AND ${table.searchIndexVersion} = 'constitution-search-index/english-v1' AND ${table.passageId} ~ '^constitution-passage/sha256:[a-f0-9]{64}$' AND btrim(${table.sourceDocumentId}) <> '' AND btrim(${table.sourceSectionId}) <> '' AND ${table.sectionOrder} >= 0 AND ${table.anchorId} ~ '^sec-[A-Za-z0-9-]+$' AND jsonb_typeof(${table.topicKeys}) = 'array' AND btrim(${table.plainText}) <> '' AND ${table.contentSha256} ~ '^[a-f0-9]{64}$' AND ${table.languageCode} = 'en' AND ${table.languageBasis} = 'constitute-service-lang-parameter' AND ${table.translationStatus} = 'publisher-supplied-language-version-translation-status-unknown' AND ${table.originalLanguageCode} IS NULL AND ${table.translator} IS NULL AND ${table.sourceId} = 'constitute_project' AND ${table.sourceUrl} ~ '^https://www[.]constituteproject[.]org/constitution/' AND ${table.retrievalUrl} ~ '^https://www[.]constituteproject[.]org/service/html[?]' AND ((${table.isCurrent} = true AND ${table.supersededAt} IS NULL) OR (${table.isCurrent} = false AND ${table.supersededAt} IS NOT NULL))`,
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
      table.sectionName,
    ),
  ],
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
    /** Closed availability semantics. Values are present only for observed or
     * disputed rows; every other state records why no public value exists. */
    valueStatus: text("value_status").notNull().default("observed"),
    valueStatusReason: text("value_status_reason"),

    // ── Vintaging / freshness (Phase F additions) ──
    /** Full date the upstream assigned, where finer than year. */
    asOf: date("as_of"),
    /**
     * Real underlying MEASUREMENT year, when it differs from the
     * publisher's prose-vintage stamp (`factYear` / `asOf`).
     *
     * CIA Factbook stamps a republication / projection year on its
     * demographic estimates — e.g. `Population: 338,016,259 (2025 est.)`
     * is a current-year estimate CIA constructs from the prior year's
     * UN World Population Prospects reference data, not a 2025
     * measurement. For those rows the measurement vintage is one year
     * older than the stamp. Recording the true year here lets the
     * resolver's freshness comparator rank a primary publisher's actual
     * measurement ahead of CIA's republication stamp without mutating
     * CIA's original `factYear` / `as_of` provenance.
     *
     * NULL for every row whose stamp already equals its measurement
     * year (the common case) — the resolver falls back to the existing
     * `asOf || factYear || retrievedAt` ladder. No false precision:
     * a null means "the stamp IS the measurement year, as far as we
     * assert." Populated ONLY by the CIA seed script and the scoped CIA
     * backfill, for the five demographic fact-keys where CIA's
     * projection methodology is documented.
     *
     * Contract: `~/civica/plan/cia-stale-vintage-resolution-v1.md`
     * (Option A, owner-confirmed).
     */
    dataVintageYear: integer("data_vintage_year"),
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

    /**
     * Growth-methodology discriminator — the HOW behind a growth-rate
     * figure. Different publishers report GDP growth on different bases
     * (annual year-on-year, four-quarter accumulated, quarter-on-quarter
     * seasonally adjusted, annualized quarterly), and the raw numbers are
     * NOT directly comparable across bases. This column labels each source
     * row with the measurement style so the resolver can prefer the
     * comparable annual-YoY publisher, and the UI can disclose the basis.
     *
     * Controlled vocabulary (see `src/lib/data/growth-methodology.ts`):
     *   'annual_yoy'                   — annual real growth, year-on-year
     *                                    (World Bank, IMF, Eurostat, and
     *                                    most NSOs; the comparable default).
     *   'four_quarter_accumulated_yoy' — four-quarter cumulative rate vs.
     *                                    the same period a year earlier
     *                                    (IBGE / Brazil's headline print).
     *   'qoq_seasonally_adjusted'      — quarter-on-quarter, seasonally
     *                                    adjusted (Stats SA's P0441 print).
     *   'annualized_qoq'               — quarter-on-quarter annualized
     *                                    (US BEA-style headline).
     *   'unspecified'                  — publisher's basis is unknown /
     *                                    not asserted.
     *
     * NULL for every non-growth fact-key (the column is meaningful ONLY on
     * `gdp_real_growth_rate` / the `gdp_growth_rate` legacy alias). Set at
     * write time by each growth-emitting sync script and backfilled for
     * existing rows by `scripts/backfill-growth-methodology.ts`.
     *
     * Contract: `~/civica/plan/gdp-growth-methodology-mix-resolution-v1.md`
     * (Option E, owner-adopted).
     */
    growthMethodology: text("growth_methodology"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    /** Phase F: identity is now (jurisdiction, fact_key, source). */
    uniqueIndex("idx_country_facts_jurisdiction_factkey_source").on(
      table.jurisdictionId,
      table.factKey,
      table.sourceId,
    ),
    index("idx_country_facts_key").on(table.factKey),
    index("idx_country_facts_category").on(table.category),
    index("idx_country_facts_status").on(table.status),
    index("idx_country_facts_factgroup").on(table.factGroup),
    index("idx_country_facts_jurisdiction").on(table.jurisdictionId),
    index("idx_country_facts_numeric").on(
      table.factKey,
      table.factValueNumeric,
    ),
    /** Bug-1 — supports the resolver's "any measured row exists?"
     *  partition probe and the replication CSV's value-type filter. */
    index("idx_country_facts_factkey_valuetype").on(
      table.factKey,
      table.valueType,
    ),
  ],
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
 * `country_facts.growth_methodology` controlled vocabulary.
 *
 * The measurement basis behind a growth-rate figure. Meaningful only on
 * `gdp_real_growth_rate` (and its `gdp_growth_rate` legacy alias); NULL
 * everywhere else.
 *
 * - `annual_yoy` — annual real growth, year-on-year (World Bank, IMF,
 *   Eurostat, and most NSOs). The comparable default.
 * - `four_quarter_accumulated_yoy` — four-quarter cumulative rate vs. the
 *   same period a year earlier (IBGE / Brazil's headline print).
 * - `qoq_seasonally_adjusted` — quarter-on-quarter, seasonally adjusted
 *   (Stats SA's P0441 print).
 * - `annualized_qoq` — quarter-on-quarter annualized (US BEA-style).
 * - `unspecified` — publisher's basis is unknown / not asserted.
 *
 * Human-readable labels + resolver preference logic live in
 * `src/lib/data/growth-methodology.ts`.
 * Contract: `~/civica/plan/gdp-growth-methodology-mix-resolution-v1.md`.
 */
export type GrowthMethodology =
  | "annual_yoy"
  | "four_quarter_accumulated_yoy"
  | "qoq_seasonally_adjusted"
  | "annualized_qoq"
  | "unspecified";

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
    /** Required on corrected cuts of an already-published period. */
    supersedesVintageLabel: text("supersedes_vintage_label"),
    /** Observation/reference year of the frozen source value. */
    observationReferenceYear: integer("observation_reference_year"),
    /** Publisher/distributor dataset release captured for this row. */
    upstreamDatasetRelease: text("upstream_dataset_release"),
    /** Retrieval time of the selected source row, when known at/before cut. */
    sourceRetrievedAt: timestamp("source_retrieved_at"),
    /** Civica's named publication handle, distinct from source release. */
    civicaPublicationVersion: text("civica_publication_version"),
    /** The country_facts.id that won the resolver at vintage time. */
    canonicalFactId: uuid("canonical_fact_id")
      .references(() => countryFacts.id)
      .notNull(),
    /** Immutable candidate-snapshot row that won. Required for complete
     * candidate releases; null only on disclosed canonical-only legacy cuts. */
    canonicalCandidateId: uuid("canonical_candidate_id"),
    /** Frozen-at-vintage copy of the value fields, queryable
     *  without joining country_facts. */
    valueText: text("value_text"),
    valueNumeric: real("value_numeric"),
    valueUnit: text("value_unit"),
    valueJson: jsonb("value_json"),
    asOf: date("as_of"),
    sourceId: text("source_id").notNull(),
    methodologyVersion: text("methodology_version").notNull(),
    derivationVersionKey: text("derivation_version_key").notNull(),
    derivationVersions: jsonb("derivation_versions")
      .$type<DerivationVersionEnvelope>()
      .notNull(),
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
      table.vintageLabel,
    ),
    index("idx_fact_vintage_label").on(table.vintageLabel),
    index("idx_fact_vintage_derivation_version").on(table.derivationVersionKey),
    index("idx_fact_vintage_jurisdiction").on(
      table.jurisdictionId,
      table.vintageLabel,
    ),
  ],
);

/** One release-level closure record for a reconciliation cut. */
export const countryFactVintageReleases = pgTable(
  "country_fact_vintage_releases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vintageLabel: text("vintage_label").notNull().unique(),
    cutAtTimestamp: timestamp("cut_at_timestamp").notNull(),
    methodologyVersion: text("methodology_version").notNull(),
    resolverVersionHash: text("resolver_version_hash").notNull(),
    completenessStatus: text("completeness_status").notNull(),
    candidateCount: integer("candidate_count"),
    winnerCount: integer("winner_count").notNull(),
    candidateSetChecksum: text("candidate_set_checksum"),
    winnerSetChecksum: text("winner_set_checksum").notNull(),
    inputManifest: jsonb("input_manifest").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_fact_vintage_release_status").on(table.completenessStatus),
  ],
);

/** Complete immutable resolver input for one candidate at one release cut. */
export const countryFactVintageCandidates = pgTable(
  "country_fact_vintage_candidates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vintageLabel: text("vintage_label")
      .references(() => countryFactVintageReleases.vintageLabel)
      .notNull(),
    cutAtTimestamp: timestamp("cut_at_timestamp").notNull(),
    jurisdictionId: uuid("jurisdiction_id")
      .references(() => jurisdictions.id)
      .notNull(),
    factKey: text("fact_key").notNull(),
    sourceId: text("source_id")
      .references(() => sources.id)
      .notNull(),
    sourceRowId: uuid("source_row_id").notNull(),
    sourceHash: text("source_hash"),
    sourceSnapshotId: uuid("source_snapshot_id"),
    inputEvidenceKind: text("input_evidence_kind").notNull(),
    inputEvidenceHash: text("input_evidence_hash").notNull(),
    adapterVersionHash: text("adapter_version_hash").notNull(),
    candidateContentHash: text("candidate_content_hash").notNull(),
    candidateStatus: text("candidate_status").notNull(),
    candidatePayload: jsonb("candidate_payload")
      .$type<import("../factbook/reconcile/types").FactRow>()
      .notNull(),
    isCanonicalAtCut: boolean("is_canonical_at_cut").notNull().default(false),
    decisionReason: text("decision_reason"),
    decisionTrace: jsonb("decision_trace"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_fact_vintage_candidate_identity").on(
      table.vintageLabel,
      table.jurisdictionId,
      table.factKey,
      table.sourceId,
    ),
    uniqueIndex("idx_fact_vintage_candidate_id_label").on(
      table.id,
      table.vintageLabel,
    ),
    index("idx_fact_vintage_candidate_pair").on(
      table.vintageLabel,
      table.jurisdictionId,
      table.factKey,
    ),
    index("idx_fact_vintage_candidate_source").on(
      table.vintageLabel,
      table.sourceId,
    ),
  ],
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
    index("idx_disputes_status_kind").on(table.status, table.disputeKind),
    index("idx_disputes_jurisdiction").on(table.jurisdictionId),
    index("idx_disputes_factkey").on(table.factKey),
  ],
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
      table.payloadHash,
    ),
    index("idx_fact_snapshots_ref").on(table.upstreamRef, table.fetchedAt),
  ],
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
    jurisdictionId: uuid("jurisdiction_id").references(() => jurisdictions.id),
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
      table.factKey,
    ),
    index("idx_facts_audit_actor_date").on(table.actorId, table.createdAt),
  ],
);

/**
 * DAT-016 append-only row history for research and reference evidence.
 * Database triggers write the complete pre-mutation row for every UPDATE or
 * DELETE on the closed protected-table registry. Application code may query
 * this ledger but may never update or delete it.
 */
export const researchEvidenceHistory = pgTable(
  "research_evidence_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityTable: text("entity_table").notNull(),
    entityId: text("entity_id").notNull(),
    operation: text("operation").notNull(),
    before: jsonb("before").notNull(),
    after: jsonb("after"),
    reason: text("reason").notNull(),
    actorId: text("actor_id").notNull(),
    recordedAt: timestamp("recorded_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_research_evidence_entity").on(
      table.entityTable,
      table.entityId,
      table.recordedAt,
    ),
    index("idx_research_evidence_operation").on(
      table.operation,
      table.recordedAt,
    ),
  ],
);

export const statements = pgTable(
  "statements",
  {
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
  },
  (table) => [
    uniqueIndex("idx_statements_subject_predicate_source").on(
      table.subjectTable,
      table.subjectId,
      table.predicate,
      table.sourceId,
    ),
    check(
      "statements_subject_table_closed",
      dsql`${table.subjectTable} IN ('constitutions', 'elections', 'government_bodies', 'jurisdictions', 'terms')`,
    ),
  ],
);

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
    derivationVersionKey: text("derivation_version_key").notNull(),
    derivationVersions: jsonb("derivation_versions")
      .$type<DerivationVersionEnvelope>()
      .notNull(),
    regimeTypeCgv: text("regime_type_cgv"),
    regimeDatasetVersion: text("regime_dataset_version"),
    /** Original BR dataset release, distinct from the QoG distribution. */
    regimeSourceDatasetVersion: text("regime_source_dataset_version"),
    regimeYear: integer("regime_year"),
    /** When Civica retrieved/ingested the distributed dataset. */
    regimeRetrievedAt: timestamp("regime_retrieved_at"),
    /** Civica taxonomy publication/version, not an observation year. */
    civicaPublicationVersion: text("civica_publication_version"),
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
      table.taxonomyVersion,
    ),
    index("idx_government_taxonomies_version").on(table.taxonomyVersion),
    index("idx_government_taxonomies_derivation_version").on(
      table.derivationVersionKey,
    ),
    index("idx_government_taxonomies_regime").on(
      table.taxonomyVersion,
      table.regimeTypeCgv,
    ),
    index("idx_government_taxonomies_structural").on(
      table.taxonomyVersion,
      table.structuralFamily,
    ),
  ],
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
  (t) => [uniqueIndex("bill_summary_cache_key_idx").on(t.cacheKey)],
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
      t.lastActionDate,
    ),
    // Idempotent upserts.
    uniqueIndex("bills_source_external_idx").on(t.sourceId, t.externalId),
  ],
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
    value: real("value"),
    /** observed | missing | unknown | not_applicable | not_observed |
     * disputed | withheld — see src/lib/data/value-state.ts. */
    valueStatus: text("value_status").notNull().default("observed"),
    valueStatusReason: text("value_status_reason"),
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
      table.year,
    ),
    index("idx_country_metrics_type_year").on(table.metricId, table.year),
    index("idx_country_metrics_jurisdiction").on(table.jurisdictionId),
  ],
);

// --- Civica Index & Pulse tables ---

export const ciMethodologyVersions = pgTable("ci_methodology_versions", {
  id: text("id").primaryKey(),
  publishedAt: timestamp("published_at").notNull(),
  weights: jsonb("weights").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

/** One fail-closed orchestration record per multi-source Index refresh. The
 * visible score tables change only in the transaction that marks this run
 * completed; failed staging runs retain their adapter results and error. */
export const ciIngestionRuns = pgTable(
  "ci_ingestion_runs",
  {
    id: uuid("id").primaryKey(),
    datasetYear: integer("dataset_year").notNull(),
    quarter: text("quarter").notNull(),
    methodologyVersion: text("methodology_version").notNull(),
    releaseLabel: text("release_label").notNull(),
    status: text("status").notNull().default("staging"),
    requiredAdapters: jsonb("required_adapters").$type<string[]>().notNull(),
    adapterResults: jsonb("adapter_results").notNull(),
    stagedChecksum: text("staged_checksum"),
    previousVisibleRelease: jsonb("previous_visible_release"),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("idx_ci_ingestion_runs_status_started").on(
      table.status,
      table.startedAt,
    ),
    uniqueIndex("idx_ci_ingestion_runs_release_label").on(table.releaseLabel),
    check(
      "ci_ingestion_runs_status_closed",
      dsql`${table.status} IN ('staging', 'failed', 'completed')`,
    ),
    check(
      "ci_ingestion_runs_terminal_shape",
      dsql`
      (${table.status} = 'staging' AND ${table.completedAt} IS NULL)
      OR (${table.status} = 'failed' AND ${table.completedAt} IS NOT NULL AND ${table.errorMessage} IS NOT NULL)
      OR (${table.status} = 'completed' AND ${table.completedAt} IS NOT NULL AND ${table.stagedChecksum} IS NOT NULL AND ${table.errorMessage} IS NULL)
    `,
    ),
  ],
);

export const ciSourceIngestions = pgTable(
  "ci_source_ingestions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: text("source_id")
      .references(() => sources.id)
      .notNull(),
    dimension: text("dimension").notNull(),
    indicatorId: text("indicator_id").notNull(),
    upstreamRelease: text("upstream_release").notNull(),
    artifactHash: text("artifact_hash").notNull(),
    artifactKind: text("artifact_kind").notNull(),
    temporalCoverage: text("temporal_coverage").notNull(),
    licenseUrl: text("license_url").notNull(),
    transformationId: text("transformation_id").notNull(),
    substitutionReason: text("substitution_reason"),
    methodVersion: text("method_version").notNull(),
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
      table.datasetYear,
      table.indicatorId,
    ),
    check(
      "ci_source_ingestions_lineage_check",
      dsql`${table.artifactHash} ~ '^[a-f0-9]{64}$' AND ${table.artifactKind} IN ('publisher_bytes','normalized_batch') AND ${table.licenseUrl} LIKE 'https://%'`,
    ),
  ],
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
    indicatorId: text("indicator_id").notNull(),
    upstreamRelease: text("upstream_release").notNull(),
    artifactHash: text("artifact_hash").notNull(),
    artifactKind: text("artifact_kind").notNull(),
    temporalCoverage: text("temporal_coverage").notNull(),
    licenseUrl: text("license_url").notNull(),
    transformationId: text("transformation_id").notNull(),
    substitutionReason: text("substitution_reason"),
    methodVersion: text("method_version").notNull(),
    ingestionId: uuid("ingestion_id").references(() => ciSourceIngestions.id),
    // NOTE: methodology_version's FK is declared as an explicit named
    // foreignKey() below (not inline .references()) because Drizzle's
    // auto-generated inline name exceeds Postgres's 63-byte identifier
    // limit and gets silently truncated at creation time — which made
    // `drizzle-kit push` perpetually propose a "rename" that is actually
    // a no-op (the truncated new name == the existing DB name). Pinning
    // the name here matches the live DB and keeps `push` clean.
    methodologyVersion: text("methodology_version").notNull(),
    derivationVersionKey: text("derivation_version_key").notNull(),
    derivationVersions: jsonb("derivation_versions")
      .$type<DerivationVersionEnvelope>()
      .notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_ci_dimension_scores_unique").on(
      table.jurisdictionId,
      table.dimension,
      table.quarter,
      table.methodologyVersion,
      table.sourceId,
      table.indicatorId,
    ),
    index("idx_ci_dimension_scores_quarter").on(table.quarter),
    index("idx_ci_dimension_scores_jurisdiction").on(table.jurisdictionId),
    index("idx_ci_dimension_scores_derivation_version").on(
      table.derivationVersionKey,
    ),
    foreignKey({
      name: "ci_dimension_scores_methodology_version_ci_methodology_versions",
      columns: [table.methodologyVersion],
      foreignColumns: [ciMethodologyVersions.id],
    }),
    check(
      "ci_dimension_scores_lineage_check",
      dsql`${table.artifactHash} ~ '^[a-f0-9]{64}$' AND ${table.artifactKind} IN ('publisher_bytes','normalized_batch') AND ${table.licenseUrl} LIKE 'https://%'`,
    ),
  ],
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
    value: real("value"),
    /** observed | missing | unknown | not_applicable | not_observed |
     * disputed | withheld — see src/lib/data/value-state.ts. */
    valueStatus: text("value_status").notNull().default("observed"),
    valueStatusReason: text("value_status_reason"),
    /** Native scale bounds + orientation, so consumers can normalise for display. */
    nativeMin: real("native_min").notNull(),
    nativeMax: real("native_max").notNull(),
    /** true when a LOWER native value is BETTER (e.g. GPI, FH 1–7 rating). */
    isInverted: boolean("is_inverted").notNull().default(false),
    /** Provenance: sources.id (e.g. "vdem", "worldbank_wgi"). */
    sourceId: text("source_id")
      .references(() => sources.id)
      .notNull(),
    upstreamRelease: text("upstream_release").notNull(),
    artifactHash: text("artifact_hash").notNull(),
    artifactKind: text("artifact_kind").notNull(),
    temporalCoverage: text("temporal_coverage").notNull(),
    licenseUrl: text("license_url").notNull(),
    transformationId: text("transformation_id").notNull(),
    substitutionReason: text("substitution_reason"),
    methodVersion: text("method_version").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_indicator_history_unique").on(
      table.jurisdictionId,
      table.indicator,
      table.year,
      table.sourceId,
    ),
    // Hot path: "give me every year of every indicator for this country".
    index("idx_indicator_history_jur_dim").on(
      table.jurisdictionId,
      table.dimension,
    ),
    index("idx_indicator_history_indicator").on(table.indicator),
    check(
      "indicator_history_lineage_check",
      dsql`${table.artifactHash} ~ '^[a-f0-9]{64}$' AND ${table.artifactKind} IN ('publisher_bytes','normalized_batch') AND ${table.licenseUrl} LIKE 'https://%'`,
    ),
  ],
);

/**
 * Private, immutable research-panel releases. These rows are not a public
 * download surface: several upstream series have redistribution limits. The
 * checked repository manifest exposes hashes and coverage only; exact values
 * stay in the database for reproducible internal research runs.
 */
export const ciResearchPanelReleases = pgTable(
  "ci_research_panel_releases",
  {
    id: text("id").primaryKey(),
    schemaVersion: text("schema_version").notNull(),
    status: text("status").notNull().default("staging"),
    periodStart: integer("period_start").notNull(),
    periodEnd: integer("period_end").notNull(),
    jurisdictionCount: integer("jurisdiction_count").notNull(),
    indicatorCount: integer("indicator_count").notNull(),
    expectedRows: integer("expected_rows").notNull(),
    observedRows: integer("observed_rows").notNull(),
    missingRows: integer("missing_rows").notNull(),
    rowSha256: text("row_sha256").notNull(),
    coverageSha256: text("coverage_sha256").notNull(),
    temporalBreaksSha256: text("temporal_breaks_sha256").notNull(),
    generatorVersion: text("generator_version").notNull(),
    sourceSnapshot: jsonb("source_snapshot").notNull(),
    rightsPosture: text("rights_posture").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    check(
      "ci_research_panel_release_status",
      dsql`${table.status} IN ('staging','complete')`,
    ),
    check(
      "ci_research_panel_release_period",
      dsql`${table.periodStart} <= ${table.periodEnd}`,
    ),
    check(
      "ci_research_panel_release_counts",
      dsql`${table.expectedRows} = ${table.observedRows} + ${table.missingRows} AND ${table.expectedRows} = ${table.jurisdictionCount} * ${table.indicatorCount} * (${table.periodEnd} - ${table.periodStart} + 1)`,
    ),
    check(
      "ci_research_panel_release_hashes",
      dsql`${table.rowSha256} ~ '^[a-f0-9]{64}$' AND ${table.coverageSha256} ~ '^[a-f0-9]{64}$' AND ${table.temporalBreaksSha256} ~ '^[a-f0-9]{64}$'`,
    ),
  ],
);

export const ciResearchPanelRows = pgTable(
  "ci_research_panel_rows",
  {
    releaseId: text("release_id")
      .references(() => ciResearchPanelReleases.id)
      .notNull(),
    jurisdictionId: uuid("jurisdiction_id")
      .references(() => jurisdictions.id)
      .notNull(),
    periodYear: integer("period_year").notNull(),
    dimension: text("dimension").notNull(),
    indicatorId: text("indicator_id").notNull(),
    sourceId: text("source_id")
      .references(() => sources.id)
      .notNull(),
    sourceOwner: text("source_owner").notNull(),
    retrievalPath: text("retrieval_path").notNull(),
    value: real("value"),
    availabilityStatus: text("value_status").notNull(),
    missingReason: text("missing_reason"),
    nativeUnit: text("native_unit").notNull(),
    nativeMin: real("native_min").notNull(),
    nativeMax: real("native_max").notNull(),
    isInverted: boolean("is_inverted").notNull(),
    transformId: text("transform_id").notNull(),
    sourceVintage: text("source_vintage").notNull(),
    sourceVintageStatus: text("source_vintage_status").notNull(),
    artifactHash: text("artifact_hash").notNull(),
    uncertaintyStatus: text("uncertainty_status").notNull(),
    uncertaintyLower: real("uncertainty_lower"),
    uncertaintyUpper: real("uncertainty_upper"),
    revisionStatus: text("revision_status").notNull(),
    seriesType: text("series_type").notNull(),
    contentHash: text("content_hash").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [
        table.releaseId,
        table.jurisdictionId,
        table.indicatorId,
        table.sourceId,
        table.periodYear,
      ],
    }),
    index("idx_ci_research_panel_release_year").on(
      table.releaseId,
      table.periodYear,
    ),
    index("idx_ci_research_panel_release_indicator").on(
      table.releaseId,
      table.indicatorId,
    ),
    check(
      "ci_research_panel_value_state",
      dsql`(${table.availabilityStatus} = 'observed' AND ${table.value} IS NOT NULL AND ${table.missingReason} IS NULL) OR (${table.availabilityStatus} = 'missing' AND ${table.value} IS NULL AND ${table.missingReason} IS NOT NULL)`,
    ),
    check(
      "ci_research_panel_uncertainty_shape",
      dsql`(${table.uncertaintyLower} IS NULL AND ${table.uncertaintyUpper} IS NULL) OR (${table.uncertaintyLower} IS NOT NULL AND ${table.uncertaintyUpper} IS NOT NULL AND ${table.uncertaintyLower} <= ${table.uncertaintyUpper})`,
    ),
    check(
      "ci_research_panel_content_hash",
      dsql`${table.contentHash} ~ '^[a-f0-9]{64}$' AND ${table.artifactHash} ~ '^[a-f0-9]{64}$'`,
    ),
  ],
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
     * Historical Beta through Beta-R3 stored a central input-variation range.
     * Current releases leave these fields NULL until source-specific
     * uncertainty and dependence are retained and validated. NULL on
     * legacy v1.0 rows.
     *
     * `band` is a deprecated historical presentation field, retired
     * 2026-07-09. Existing values are retained for private audit/replay only;
     * current writers set NULL and public readers must never expose it.
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
    /** Required when a corrected named release replaces an earlier vintage. */
    supersedesVintageLabel: text("supersedes_vintage_label"),
    /** SHA-256 of all score fields that define the named release row. */
    contentHash: text("content_hash"),
    rank: integer("rank"),
    totalRanked: integer("total_ranked"),
    isPartial: boolean("is_partial").notNull().default(false),
    dimensionsAvailable: integer("dimensions_available").notNull().default(6),
    missingDimensions: text("missing_dimensions").array(),
    // See the identical note on ciDimensionScores.methodologyVersion above:
    // explicit named foreignKey() below, not inline .references(), because
    // Drizzle's auto-generated name truncates past Postgres's 63-byte limit.
    methodologyVersion: text("methodology_version").notNull(),
    derivationVersionKey: text("derivation_version_key").notNull(),
    derivationVersions: jsonb("derivation_versions")
      .$type<DerivationVersionEnvelope>()
      .notNull(),
    calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_ci_composite_unique").on(
      table.jurisdictionId,
      table.quarter,
      table.methodologyVersion,
    ),
    index("idx_ci_composite_quarter_rank").on(table.quarter, table.rank),
    index("idx_ci_composite_jurisdiction").on(table.jurisdictionId),
    index("idx_ci_composite_derivation_version").on(table.derivationVersionKey),
    foreignKey({
      name: "ci_composite_scores_methodology_version_ci_methodology_versions",
      columns: [table.methodologyVersion],
      foreignColumns: [ciMethodologyVersions.id],
    }),
  ],
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
      table.eventDate,
    ),
    index("idx_pulse_events_active").on(
      table.jurisdictionId,
      table.isActive,
      table.eventDate,
    ),
    index("idx_pulse_events_category").on(table.category),
  ],
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
      table.jurisdictionId,
    ),
    index("idx_org_memberships_jurisdiction").on(table.jurisdictionId),
    index("idx_org_memberships_org").on(table.orgId),
  ],
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
    indicatorId: text("indicator_id").notNull(),
    upstreamRelease: text("upstream_release").notNull(),
    artifactHash: text("artifact_hash").notNull(),
    artifactKind: text("artifact_kind").notNull(),
    temporalCoverage: text("temporal_coverage").notNull(),
    licenseUrl: text("license_url").notNull(),
    transformationId: text("transformation_id").notNull(),
    substitutionReason: text("substitution_reason"),
    methodVersion: text("method_version").notNull(),
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
      table.methodologyVersion,
      table.sourceId,
      table.indicatorId,
    ),
    index("idx_conditions_quarter").on(table.quarter),
    index("idx_conditions_jurisdiction").on(table.jurisdictionId),
    check(
      "civica_conditions_scores_lineage_check",
      dsql`${table.artifactHash} ~ '^[a-f0-9]{64}$' AND ${table.artifactKind} IN ('publisher_bytes','normalized_batch') AND ${table.licenseUrl} LIKE 'https://%'`,
    ),
  ],
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
 * Consented public profiles for appointed advisory-board members. The table
 * ships empty; an application never creates a member row automatically.
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
 * Private expressions of interest in the advisory board. Populated by the public
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
  /** Legacy nullable column. New submissions do not retain applicant IPs. */
  ipAddress: text("ip_address"),
  /** Triage lifecycle: new → reviewed → contacted → archived */
  status: text("status").notNull().default("new"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// --- Phase 5.5 — Pulse Beta foundation (dimensional deltas) ---

/**
 * Immutable identity for one execution of a Pulse pipeline stage. Status and
 * outcome counts may close after the run, but the recorded method, ontology,
 * prompt, provider/model, source-basket, algorithm, pipeline, and upstream-run
 * identities cannot be changed after insertion (enforced by migration trigger).
 */
export const pulsePipelineRuns = pgTable(
  "pulse_pipeline_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** ingest | cluster | classify | corroborate | review | score */
    stage: text("stage").notNull(),
    /** running | completed | partial | failed | legacy */
    status: text("status").notNull(),
    versionKey: text("version_key").notNull(),
    versions: jsonb("versions").$type<PulseStageVersionEnvelope>().notNull(),
    counts: jsonb("counts")
      .$type<Record<string, number>>()
      .notNull()
      .default({}),
    failures: jsonb("failures")
      .$type<Array<{ component: string; message: string }>>()
      .notNull()
      .default([]),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("idx_pulse_pipeline_runs_stage_time").on(
      table.stage,
      table.startedAt,
    ),
    index("idx_pulse_pipeline_runs_version").on(table.versionKey),
    check(
      "pulse_pipeline_runs_stage_check",
      dsql`${table.stage} IN ('ingest','cluster','classify','corroborate','review','score')`,
    ),
    check(
      "pulse_pipeline_runs_status_check",
      dsql`${table.status} IN ('running','completed','partial','failed','legacy')`,
    ),
    check(
      "pulse_pipeline_runs_completion_check",
      dsql`(${table.status} = 'running' AND ${table.completedAt} IS NULL) OR (${table.status} <> 'running' AND ${table.completedAt} IS NOT NULL)`,
    ),
    check(
      "pulse_pipeline_runs_version_shape_check",
      dsql`${table.versions}->>'schemaVersion' = 'pulse-stage-version-envelope/v1' AND ${table.versions}->>'stage' = ${table.stage} AND ${table.versionKey} ~ '^pulse-stage/sha256:[a-f0-9]{64}$'`,
    ),
  ],
);

/**
 * Stable real-world incident identity for Pulse. Raw clustering can change as
 * new reports arrive; the incident UUID does not. A confirmed merge preserves
 * the losing row and points it at the surviving incident.
 */
export const pulseIncidents = pgTable(
  "pulse_incidents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    status: text("status").$type<"active" | "merged">().notNull(),
    mergedIntoIncidentId: uuid("merged_into_incident_id"),
    representativeTitle: text("representative_title").notNull(),
    eventDateStart: date("event_date_start"),
    eventDateEnd: date("event_date_end"),
    identityVersion: text("identity_version").notNull(),
    identityKey: text("identity_key").notNull(),
    identityTokens: text("identity_tokens").array().notNull(),
    identityAnchors: text("identity_anchors").array().notNull(),
    representativeEmbedding: real("representative_embedding").array(),
    createdRunId: uuid("created_run_id")
      .references(() => pulsePipelineRuns.id, { onDelete: "restrict" })
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      name: "pulse_incidents_merged_into_fk",
      columns: [table.mergedIntoIncidentId],
      foreignColumns: [table.id],
    }).onDelete("restrict"),
    index("idx_pulse_incidents_status_date").on(
      table.status,
      table.eventDateStart,
      table.eventDateEnd,
    ),
    index("idx_pulse_incidents_identity").on(table.identityKey),
    index("idx_pulse_incidents_created_run").on(table.createdRunId),
    check(
      "pulse_incidents_contract_check",
      dsql`${table.status} IN ('active','merged') AND btrim(${table.representativeTitle}) <> '' AND ${table.identityVersion} <> '' AND ${table.identityKey} ~ '^pulse-incident-identity/sha256:[a-f0-9]{64}$' AND ((${table.status} = 'active' AND ${table.mergedIntoIncidentId} IS NULL) OR (${table.status} = 'merged' AND ${table.mergedIntoIncidentId} IS NOT NULL AND ${table.mergedIntoIncidentId} <> ${table.id}))`,
    ),
  ],
);

/**
 * Staging table for raw events ingested from specialist + news feeds.
 * One row per source-record. Drained by the clustering step which
 * groups near-duplicate records into governance-event clusters.
 *
 * DAT-016 retains examined rows and their terminal classifier disposition for
 * false-positive/false-negative evaluation. Pending rows remain classifiable;
 * terminal rows leave the queue but are not deleted.
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
    sourceUrl: text("source_url").notNull(),
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
    /** PUL-005 immutable evidence identity over source payload, extracted
     * evidence, retrieval time, attribution, publisher, and rights state. */
    evidenceIdentityKey: text("evidence_identity_key").notNull(),
    evidenceContentHash: text("evidence_content_hash").notNull(),
    /** BCP 47 language code or `und` when the source did not declare one. */
    evidenceLanguage: text("evidence_language").notNull(),
    evidencePublisher: jsonb("evidence_publisher")
      .$type<PulseEvidencePublisherSnapshot>()
      .notNull(),
    evidenceAttribution: jsonb("evidence_attribution")
      .$type<PulseEvidenceAttributionSnapshot>()
      .notNull(),
    evidenceRights: jsonb("evidence_rights")
      .$type<PulseEvidenceRightsSnapshot>()
      .notNull(),
    evidenceRetention: jsonb("evidence_retention")
      .$type<PulseEvidenceRetentionSnapshot>()
      .notNull(),
    /** 384-dim sentence-transformer embedding for clustering */
    embedding: real("embedding").array(),
    /** Set when row joins a cluster; null until then */
    clusterId: uuid("cluster_id"),
    /** Stable real-world incident assigned by PUL-031 clustering. */
    incidentId: uuid("incident_id").references(() => pulseIncidents.id, {
      onDelete: "restrict",
    }),
    clusteredAt: timestamp("clustered_at"),
    /** pending | event | non_governance | invalid. Rejected classifier input
     * remains queryable for prospective false-negative studies. */
    classificationDisposition: text("classification_disposition")
      .notNull()
      .default("pending"),
    classificationReason: text("classification_reason"),
    classificationDecision: jsonb("classification_decision"),
    classifiedAt: timestamp("classified_at"),
    createdAt: timestamp("created_at").defaultNow(),
    /** PUL-004 immutable stage-run lineage. */
    ingestRunId: uuid("ingest_run_id")
      .references(() => pulsePipelineRuns.id, { onDelete: "restrict" })
      .notNull(),
    clusterRunId: uuid("cluster_run_id").references(
      () => pulsePipelineRuns.id,
      { onDelete: "restrict" },
    ),
    classificationRunId: uuid("classification_run_id").references(
      () => pulsePipelineRuns.id,
      { onDelete: "restrict" },
    ),
  },
  (table) => [
    index("idx_raw_events_jurisdiction_date").on(
      table.jurisdictionId,
      table.eventDate,
    ),
    index("idx_raw_events_unclustered").on(table.clusteredAt),
    index("idx_raw_events_cluster").on(table.clusterId),
    index("idx_raw_events_incident").on(table.incidentId),
    index("idx_raw_events_ingest_run").on(table.ingestRunId),
    index("idx_raw_events_cluster_run").on(table.clusterRunId),
    index("idx_raw_events_classification_run").on(table.classificationRunId),
    uniqueIndex("idx_raw_events_evidence_identity").on(
      table.evidenceIdentityKey,
    ),
    uniqueIndex("idx_raw_events_external")
      .on(table.sourceId, table.externalId)
      .where(dsql`${table.externalId} IS NOT NULL`),
    check(
      "raw_events_evidence_identity_check",
      dsql`${table.evidenceIdentityKey} ~ '^pulse-evidence/sha256:[a-f0-9]{64}$' AND ${table.evidenceContentHash} ~ '^[a-f0-9]{64}$' AND ${table.evidenceLanguage} <> '' AND ${table.evidencePublisher}->>'schemaVersion' = 'pulse-raw-evidence/v1' AND ${table.evidenceAttribution}->>'schemaVersion' = 'pulse-raw-evidence/v1' AND ${table.evidenceRights}->>'schemaVersion' = 'pulse-raw-evidence/v1' AND ${table.evidenceRetention}->>'schemaVersion' = 'pulse-raw-evidence/v1' AND ${table.evidenceRetention}->>'publicPayloadDistribution' = 'blocked'`,
    ),
  ],
);

/** Append-only evidence for assigning one retained report to an incident. */
export const pulseIncidentAssignments = pgTable(
  "pulse_incident_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schemaVersion: text("schema_version").notNull(),
    assignmentKey: text("assignment_key").notNull(),
    incidentId: uuid("incident_id")
      .references(() => pulseIncidents.id, { onDelete: "restrict" })
      .notNull(),
    rawEventId: uuid("raw_event_id")
      .references(() => rawEvents.id, { onDelete: "restrict" })
      .notNull(),
    rawClusterId: uuid("raw_cluster_id").notNull(),
    matchKind: text("match_kind")
      .$type<
        "new" | "persisted_match" | "post_classification_merge" | "backfill"
      >()
      .notNull(),
    semanticSimilarity: real("semantic_similarity"),
    tokenSimilarity: real("token_similarity").notNull(),
    anchorOverlap: real("anchor_overlap").notNull(),
    exactNormalizedMatch: boolean("exact_normalized_match").notNull(),
    algorithmVersion: text("algorithm_version").notNull(),
    embeddingModel: text("embedding_model"),
    fallbackMode: text("fallback_mode").notNull(),
    stageRunId: uuid("stage_run_id")
      .references(() => pulsePipelineRuns.id, { onDelete: "restrict" })
      .notNull(),
    actor: jsonb("actor").$type<Record<string, unknown>>().notNull(),
    rationale: text("rationale").notNull(),
    assignedAt: timestamp("assigned_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_pulse_incident_assignments_key").on(table.assignmentKey),
    uniqueIndex("idx_pulse_incident_assignments_raw").on(table.rawEventId),
    index("idx_pulse_incident_assignments_incident").on(table.incidentId),
    index("idx_pulse_incident_assignments_run").on(table.stageRunId),
    check(
      "pulse_incident_assignments_contract_check",
      dsql`${table.schemaVersion} = 'pulse-incident-assignment/v1' AND ${table.assignmentKey} ~ '^pulse-incident-assignment/sha256:[a-f0-9]{64}$' AND ${table.matchKind} IN ('new','persisted_match','post_classification_merge','backfill') AND ${table.tokenSimilarity} BETWEEN 0 AND 1 AND ${table.anchorOverlap} BETWEEN 0 AND 1 AND (${table.semanticSimilarity} IS NULL OR ${table.semanticSimilarity} BETWEEN -1 AND 1) AND ${table.algorithmVersion} <> '' AND ${table.fallbackMode} IN ('semantic','conservative_lexical','historical_backfill') AND jsonb_typeof(${table.actor}) = 'object' AND btrim(${table.rationale}) <> ''`,
    ),
  ],
);

/**
 * Pulse Beta v2 events — one row per clustered governance event.
 *
 * Replaces v1's per-source-record `pulse_events` table. Each row
 * represents a single real-world event (e.g. "Niger 2023 coup")
 * regardless of how many source records describe it.
 *
 * Unpublished rows (`published=false`) are either queued for review or
 * rejected. The review state and origin must be read alongside `published`.
 */
export const pulseEventsV2 = pgTable(
  "pulse_events_v2",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Stable idempotency key from raw_events.cluster_id. Legacy rows are
     * backfilled to their event id by migration 0022. */
    clusterId: uuid("cluster_id").notNull(),
    /** Stable incident identity; unlike a raw cluster, it survives new reports. */
    incidentId: uuid("incident_id")
      .references(() => pulseIncidents.id, { onDelete: "restrict" })
      .notNull(),
    projectionStatus: text("projection_status")
      .$type<"current" | "superseded_duplicate" | "quarantined_invalid">()
      .notNull()
      .default("current"),
    jurisdictionId: uuid("jurisdiction_id")
      .references(() => jurisdictions.id)
      .notNull(),
    eventDate: date("event_date").notNull(),
    /** Taxonomy category from spec §3.2 (e.g. "judicial_purge") */
    category: text("category").notNull(),
    /** democratic_quality | rule_of_law | freedom_rights | corruption_control | stability */
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
    /** Reasoning passes preserved for audit. Current ensemble rows contain
     *  one provider/model/prompt/method/config-versioned entry per successful
     *  classify voter plus the verify entry;
     *  retained single-engine rows contain classify + verify; older agent and
     *  temperature-variant rows use other unversioned shapes. Shape:
     *  [{run, temp, model, category, dimension, severity, confidence, raw}, ...] */
    classifierRuns: jsonb("classifier_runs").notNull(),
    /** 'all' | 'two_of_three' | 'none' — drives confidence boost/penalty.
     *  Current rows derive this only from stored provider-distinct,
     *  prompt-versioned classify runs. Unsupported legacy labels are cleared
     *  to none without rewriting the retained run evidence. */
    classifierAgreement: text("classifier_agreement").notNull(),
    derivationVersionKey: text("derivation_version_key").notNull(),
    derivationVersions: jsonb("derivation_versions")
      .$type<DerivationVersionEnvelope>()
      .notNull(),
    classificationRunId: uuid("classification_run_id")
      .references(() => pulsePipelineRuns.id, { onDelete: "restrict" })
      .notNull(),
    /** Auto-publication points to the classification run; human decisions
     * point to the review run. Null means the event is not public. */
    publicationRunId: uuid("publication_run_id").references(
      () => pulsePipelineRuns.id,
      { onDelete: "restrict" },
    ),
    corroborationRunId: uuid("corroboration_run_id").references(
      () => pulsePipelineRuns.id,
      { onDelete: "restrict" },
    ),
    humanReviewed: boolean("human_reviewed").notNull().default(false),
    reviewerId: text("reviewer_id"),
    reviewNotes: text("review_notes"),
    /** pending | approved | rejected | edited */
    reviewStatus: text("review_status").notNull().default("pending"),
    /** Public/scoring eligibility flag. Automatic publication follows the
     *  current ensemble and review-gate policy; a human may approve a valid
     *  queued classification. See `pulse/v2/runtime-contract.ts` for the
     *  exact versioned policy rather than inferring it from this column. */
    published: boolean("published").notNull().default(false),
    headline: text("headline").notNull(),
    description: text("description").notNull(),
    /** Plain-English 2-3 sentence summary generated via Claude Haiku
     *  for the review queue. Lazily populated on first view of the
     *  review-detail page; null until then. See
     *  `src/lib/pulse/v2/summarize.ts`. */
    aiSummary: text("ai_summary"),
    /** Latest provisional press-freedom context score applied by the
     *  corroboration pass. Scheduled recomputation may overwrite it; this is
     *  not an immutable at-classification snapshot. */
    pressFreedomScoreAtClassification: real(
      "press_freedom_score_at_classification",
    ),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_pulse_v2_jurisdiction_date").on(
      table.jurisdictionId,
      table.eventDate,
    ),
    index("idx_pulse_v2_published").on(table.published, table.reviewStatus),
    index("idx_pulse_v2_dimension").on(table.dimension, table.eventDate),
    index("idx_pulse_v2_derivation_version").on(table.derivationVersionKey),
    index("idx_pulse_v2_classification_run").on(table.classificationRunId),
    index("idx_pulse_v2_publication_run").on(table.publicationRunId),
    index("idx_pulse_v2_corroboration_run").on(table.corroborationRunId),
    uniqueIndex("idx_pulse_v2_cluster_unique").on(table.clusterId),
    uniqueIndex("idx_pulse_v2_one_current_projection")
      .on(table.incidentId)
      .where(dsql`${table.projectionStatus} = 'current'`),
    index("idx_pulse_v2_incident").on(table.incidentId),
    check(
      "pulse_events_v2_projection_check",
      dsql`${table.projectionStatus} IN ('current','superseded_duplicate','quarantined_invalid') AND ((${table.projectionStatus} = 'quarantined_invalid' AND ${table.published} = false) OR (${table.projectionStatus} <> 'quarantined_invalid' AND btrim(${table.headline}) <> '')) AND ((${table.projectionStatus} = 'current') OR (${table.published} = false))`,
    ),
  ],
);

/** Immutable metadata for one captured official information-environment release. */
export const pulseInformationEnvironmentReleases = pgTable(
  "pulse_information_environment_releases",
  {
    releaseId: text("release_id").primaryKey(),
    schemaVersion: text("schema_version").notNull(),
    sourceId: text("source_id").notNull(),
    sourceUrl: text("source_url").notNull(),
    methodologyUrl: text("methodology_url").notNull(),
    termsUrl: text("terms_url").notNull(),
    upstreamRelease: text("upstream_release").notNull(),
    observationYear: integer("observation_year").notNull(),
    retrievedAt: timestamp("retrieved_at").notNull(),
    contentSha256: text("content_sha256").notNull(),
    publisherRows: integer("publisher_rows").notNull(),
    matchedJurisdictions: integer("matched_jurisdictions").notNull(),
    supportedJurisdictions: integer("supported_jurisdictions").notNull(),
    redistributionPosture: text("redistribution_posture").notNull(),
    rightsStatus: text("rights_status").notNull(),
    useStatus: text("use_status").notNull(),
    adoptedAt: timestamp("adopted_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_pulse_information_release_hash").on(table.contentSha256),
    check(
      "pulse_information_environment_releases_contract_check",
      dsql`${table.schemaVersion} = 'pulse-information-environment-release/v1' AND btrim(${table.releaseId}) <> '' AND btrim(${table.sourceId}) <> '' AND ${table.sourceUrl} ~ '^https://' AND ${table.methodologyUrl} ~ '^https://' AND ${table.termsUrl} ~ '^https://' AND btrim(${table.upstreamRelease}) <> '' AND ${table.observationYear} >= 1900 AND ${table.contentSha256} ~ '^[a-f0-9]{64}$' AND ${table.publisherRows} > 0 AND ${table.matchedJurisdictions} >= 0 AND ${table.supportedJurisdictions} > 0 AND ${table.matchedJurisdictions} <= ${table.supportedJurisdictions} AND ${table.matchedJurisdictions} <= ${table.publisherRows} AND ${table.rightsStatus} IN ('verified','pending') AND ${table.useStatus} IN ('active_unvalidated_heuristic','disabled_pending_rights_and_validation')`,
    ),
  ],
);

/** Complete observed-or-missing coverage for every supported jurisdiction in a release. */
export const pulseInformationEnvironmentValues = pgTable(
  "pulse_information_environment_values",
  {
    releaseId: text("release_id")
      .references(() => pulseInformationEnvironmentReleases.releaseId, {
        onDelete: "restrict",
      })
      .notNull(),
    jurisdictionId: uuid("jurisdiction_id")
      .references(() => jurisdictions.id, { onDelete: "restrict" })
      .notNull(),
    iso3: text("iso3"),
    valueStatus: text("value_status").$type<"observed" | "missing">().notNull(),
    score: real("score"),
    tier: text("tier").$type<"free" | "partial" | "restricted">(),
    missingReason: text("missing_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      name: "pulse_information_environment_values_pk",
      columns: [table.releaseId, table.jurisdictionId],
    }),
    index("idx_pulse_information_values_jurisdiction").on(table.jurisdictionId),
    check(
      "pulse_information_environment_values_contract_check",
      dsql`${table.valueStatus} IN ('observed','missing') AND ((${table.valueStatus} = 'observed' AND ${table.score} BETWEEN 0 AND 100 AND ${table.score} <> 'NaN'::real AND ${table.tier} IN ('free','partial','restricted') AND ${table.missingReason} IS NULL) OR (${table.valueStatus} = 'missing' AND ${table.score} IS NULL AND ${table.tier} IS NULL AND btrim(${table.missingReason}) <> ''))`,
    ),
  ],
);

/** One immutable classification-time context pin per Pulse event projection. */
export const pulseEventInformationEnvironmentPins = pgTable(
  "pulse_event_information_environment_pins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schemaVersion: text("schema_version").notNull(),
    contextSchemaVersion: text("context_schema_version").notNull(),
    pinKey: text("pin_key").notNull().unique(),
    eventId: uuid("event_id")
      .references(() => pulseEventsV2.id, { onDelete: "restrict" })
      .notNull()
      .unique(),
    jurisdictionId: uuid("jurisdiction_id")
      .references(() => jurisdictions.id, { onDelete: "restrict" })
      .notNull(),
    classificationRunId: uuid("classification_run_id")
      .references(() => pulsePipelineRuns.id, { onDelete: "restrict" })
      .notNull(),
    releaseId: text("release_id").references(
      () => pulseInformationEnvironmentReleases.releaseId,
      { onDelete: "restrict" },
    ),
    valueStatus: text("value_status").$type<"observed" | "missing">().notNull(),
    score: real("score"),
    tier: text("tier").$type<"free" | "partial" | "restricted">(),
    sourceId: text("source_id"),
    sourceUrl: text("source_url"),
    upstreamRelease: text("upstream_release"),
    observationYear: integer("observation_year"),
    retrievedAt: timestamp("retrieved_at"),
    contentSha256: text("content_sha256"),
    rightsStatus: text("rights_status").notNull(),
    useStatus: text("use_status").notNull(),
    missingReason: text("missing_reason"),
    methodVersion: text("method_version").notNull(),
    classifiedAt: timestamp("classified_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_pulse_information_pins_jurisdiction_time").on(
      table.jurisdictionId,
      table.classifiedAt,
    ),
    index("idx_pulse_information_pins_release").on(table.releaseId),
    check(
      "pulse_event_information_environment_pins_contract_check",
      dsql`${table.schemaVersion} = 'pulse-information-environment-pin/v1' AND ${table.contextSchemaVersion} = 'pulse-information-environment-context/v1' AND ${table.pinKey} ~ '^pulse-information-environment-pin/sha256:[a-f0-9]{64}$' AND ${table.methodVersion} = 'pulse-information-environment/classification-pin-v1' AND ${table.valueStatus} IN ('observed','missing') AND ${table.rightsStatus} IN ('verified','pending','not_registered') AND ${table.useStatus} IN ('active_unvalidated_heuristic','disabled_pending_rights_and_validation','not_available') AND ((${table.valueStatus} = 'observed' AND ${table.releaseId} IS NOT NULL AND ${table.score} BETWEEN 0 AND 100 AND ${table.score} <> 'NaN'::real AND ${table.tier} IN ('free','partial','restricted') AND btrim(${table.sourceId}) <> '' AND ${table.sourceUrl} ~ '^https://' AND btrim(${table.upstreamRelease}) <> '' AND ${table.observationYear} >= 1900 AND ${table.retrievedAt} IS NOT NULL AND ${table.contentSha256} ~ '^[a-f0-9]{64}$' AND ${table.missingReason} IS NULL) OR (${table.valueStatus} = 'missing' AND ${table.score} IS NULL AND ${table.tier} IS NULL AND btrim(${table.missingReason}) <> ''))`,
    ),
  ],
);

/**
 * Current classifier state for one raw cluster under one stable classifier
 * configuration. The row is a mutable projection; research-evidence history
 * retains every prior value while `pulse_classification_attempts` preserves
 * the attempt ledger directly.
 */
export const pulseClusterClassificationStates = pgTable(
  "pulse_cluster_classification_states",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schemaVersion: text("schema_version").notNull(),
    clusterId: uuid("cluster_id").notNull(),
    incidentId: uuid("incident_id").references(() => pulseIncidents.id, {
      onDelete: "restrict",
    }),
    configHash: text("config_hash").notNull(),
    config: jsonb("config").$type<Record<string, unknown>>().notNull(),
    status: text("status")
      .$type<"classified" | "none" | "retryable_failure" | "terminal_failure">()
      .notNull(),
    attemptCount: integer("attempt_count").notNull(),
    maxAttempts: integer("max_attempts").notNull(),
    firstAttemptAt: timestamp("first_attempt_at").notNull(),
    lastAttemptAt: timestamp("last_attempt_at").notNull(),
    nextRetryAt: timestamp("next_retry_at"),
    terminalAt: timestamp("terminal_at"),
    leaseExpiresAt: timestamp("lease_expires_at"),
    lastErrorCode: text("last_error_code"),
    lastErrorMessage: text("last_error_message"),
    lastRunId: uuid("last_run_id")
      .references(() => pulsePipelineRuns.id, { onDelete: "restrict" })
      .notNull(),
    eventId: uuid("event_id").references(() => pulseEventsV2.id, {
      onDelete: "restrict",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_pulse_classification_state_cluster_config").on(
      table.clusterId,
      table.configHash,
    ),
    index("idx_pulse_classification_state_queue").on(
      table.configHash,
      table.status,
      table.nextRetryAt,
    ),
    index("idx_pulse_classification_state_incident").on(table.incidentId),
    index("idx_pulse_classification_state_run").on(table.lastRunId),
    check(
      "pulse_classification_state_contract_check",
      dsql`${table.schemaVersion} = 'pulse-classification-state/v1' AND ${table.configHash} ~ '^pulse-classification-config/v1/sha256:[a-f0-9]{64}$' AND jsonb_typeof(${table.config}) = 'object' AND ${table.status} IN ('classified','none','retryable_failure','terminal_failure') AND ${table.attemptCount} BETWEEN 1 AND ${table.maxAttempts} AND ${table.maxAttempts} BETWEEN 1 AND 10 AND ${table.lastAttemptAt} >= ${table.firstAttemptAt} AND ((${table.status} = 'retryable_failure' AND ${table.nextRetryAt} IS NOT NULL AND ${table.terminalAt} IS NULL AND ${table.eventId} IS NULL AND ${table.lastErrorCode} IS NOT NULL AND ${table.lastErrorMessage} IS NOT NULL) OR (${table.status} = 'terminal_failure' AND ${table.nextRetryAt} IS NULL AND ${table.terminalAt} IS NOT NULL AND ${table.eventId} IS NULL AND ${table.lastErrorCode} IS NOT NULL AND ${table.lastErrorMessage} IS NOT NULL) OR (${table.status} = 'none' AND ${table.nextRetryAt} IS NULL AND ${table.terminalAt} IS NOT NULL AND ${table.eventId} IS NULL AND ${table.lastErrorCode} IS NULL AND ${table.lastErrorMessage} IS NULL) OR (${table.status} = 'classified' AND ${table.nextRetryAt} IS NULL AND ${table.terminalAt} IS NOT NULL AND ${table.eventId} IS NOT NULL AND ${table.lastErrorCode} IS NULL AND ${table.lastErrorMessage} IS NULL))`,
    ),
  ],
);

/** Append-only evidence for every claimed classifier attempt. */
export const pulseClassificationAttempts = pgTable(
  "pulse_classification_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schemaVersion: text("schema_version").notNull(),
    attemptKey: text("attempt_key").notNull(),
    clusterId: uuid("cluster_id").notNull(),
    incidentId: uuid("incident_id").references(() => pulseIncidents.id, {
      onDelete: "restrict",
    }),
    configHash: text("config_hash").notNull(),
    ordinal: integer("ordinal").notNull(),
    runId: uuid("run_id")
      .references(() => pulsePipelineRuns.id, { onDelete: "restrict" })
      .notNull(),
    outcome: text("outcome")
      .$type<
        | "started"
        | "classified"
        | "none"
        | "retryable_failure"
        | "terminal_failure"
      >()
      .notNull(),
    modelCallCount: integer("model_call_count").notNull(),
    startedAt: timestamp("started_at").notNull(),
    completedAt: timestamp("completed_at"),
    nextRetryAt: timestamp("next_retry_at"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_pulse_classification_attempt_key").on(table.attemptKey),
    uniqueIndex("idx_pulse_classification_attempt_phase").on(
      table.clusterId,
      table.configHash,
      table.ordinal,
      table.outcome,
    ),
    index("idx_pulse_classification_attempt_run").on(table.runId),
    index("idx_pulse_classification_attempt_cluster").on(
      table.clusterId,
      table.configHash,
      table.startedAt,
    ),
    check(
      "pulse_classification_attempt_contract_check",
      dsql`${table.schemaVersion} = 'pulse-classification-attempt/v1' AND ${table.attemptKey} ~ '^pulse-classification-attempt/sha256:[a-f0-9]{64}$' AND ${table.configHash} ~ '^pulse-classification-config/v1/sha256:[a-f0-9]{64}$' AND ${table.ordinal} BETWEEN 1 AND 10 AND ${table.outcome} IN ('started','classified','none','retryable_failure','terminal_failure') AND ${table.modelCallCount} >= 0 AND jsonb_typeof(${table.metadata}) = 'object' AND ((${table.outcome} = 'started' AND ${table.completedAt} IS NULL AND ${table.errorCode} IS NULL AND ${table.errorMessage} IS NULL) OR (${table.outcome} IN ('classified','none') AND ${table.completedAt} IS NOT NULL AND ${table.nextRetryAt} IS NULL AND ${table.errorCode} IS NULL AND ${table.errorMessage} IS NULL) OR (${table.outcome} = 'retryable_failure' AND ${table.completedAt} IS NOT NULL AND ${table.nextRetryAt} IS NOT NULL AND ${table.errorCode} IS NOT NULL AND ${table.errorMessage} IS NOT NULL) OR (${table.outcome} = 'terminal_failure' AND ${table.completedAt} IS NOT NULL AND ${table.nextRetryAt} IS NULL AND ${table.errorCode} IS NOT NULL AND ${table.errorMessage} IS NOT NULL))`,
    ),
  ],
);

/** Append-only candidate and confirmed resolution ledger for incident clashes. */
export const pulseIncidentResolutions = pgTable(
  "pulse_incident_resolutions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schemaVersion: text("schema_version").notNull(),
    resolutionKey: text("resolution_key").notNull(),
    leftIncidentId: uuid("left_incident_id")
      .references(() => pulseIncidents.id, { onDelete: "restrict" })
      .notNull(),
    rightIncidentId: uuid("right_incident_id")
      .references(() => pulseIncidents.id, { onDelete: "restrict" })
      .notNull(),
    outcome: text("outcome")
      .$type<"candidate" | "confirmed_merge" | "rejected" | "unresolved">()
      .notNull(),
    canonicalIncidentId: uuid("canonical_incident_id").references(
      () => pulseIncidents.id,
      { onDelete: "restrict" },
    ),
    signals: jsonb("signals").$type<Record<string, unknown>>().notNull(),
    methodVersion: text("method_version").notNull(),
    stageRunId: uuid("stage_run_id")
      .references(() => pulsePipelineRuns.id, { onDelete: "restrict" })
      .notNull(),
    actor: jsonb("actor").$type<Record<string, unknown>>().notNull(),
    rationale: text("rationale").notNull(),
    evidenceRefs: text("evidence_refs").array().notNull(),
    decidedAt: timestamp("decided_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_pulse_incident_resolutions_key").on(table.resolutionKey),
    index("idx_pulse_incident_resolutions_pair").on(
      table.leftIncidentId,
      table.rightIncidentId,
      table.decidedAt,
    ),
    index("idx_pulse_incident_resolutions_run").on(table.stageRunId),
    check(
      "pulse_incident_resolutions_contract_check",
      dsql`${table.schemaVersion} = 'pulse-incident-resolution/v1' AND ${table.resolutionKey} ~ '^pulse-incident-resolution/sha256:[a-f0-9]{64}$' AND ${table.leftIncidentId} <> ${table.rightIncidentId} AND ${table.outcome} IN ('candidate','confirmed_merge','rejected','unresolved') AND jsonb_typeof(${table.signals}) = 'object' AND jsonb_typeof(${table.actor}) = 'object' AND ${table.methodVersion} <> '' AND btrim(${table.rationale}) <> '' AND cardinality(${table.evidenceRefs}) > 0 AND ((${table.outcome} = 'confirmed_merge' AND ${table.canonicalIncidentId} IN (${table.leftIncidentId}, ${table.rightIncidentId})) OR (${table.outcome} <> 'confirmed_merge' AND ${table.canonicalIncidentId} IS NULL))`,
    ),
  ],
);

/**
 * Append-only evidence that an explicitly linked Pulse event is already
 * represented by a later, comparable fixed-scale Index observation. This
 * ledger never mutates corroboration confidence; scoring reads its latest
 * as-of decision separately.
 */
export const pulseEventAbsorptions = pgTable(
  "pulse_event_absorptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schemaVersion: text("schema_version").notNull(),
    absorptionKey: text("absorption_key").notNull().unique(),
    eventId: uuid("event_id")
      .references(() => pulseEventsV2.id, { onDelete: "restrict" })
      .notNull(),
    jurisdictionId: uuid("jurisdiction_id")
      .references(() => jurisdictions.id, { onDelete: "restrict" })
      .notNull(),
    dimension: text("dimension").notNull(),
    outcome: text("outcome").$type<"absorbed" | "not_absorbed">().notNull(),
    previousCiReleaseId: text("previous_ci_release_id").notNull(),
    currentCiReleaseId: text("current_ci_release_id").notNull(),
    previousScore: real("previous_score").notNull(),
    currentScore: real("current_score").notNull(),
    scoreDelta: real("score_delta").notNull(),
    threshold: real("threshold").notNull(),
    fixedScaleId: text("fixed_scale_id").notNull(),
    linkStanding: text("link_standing")
      .$type<"confirmed" | "candidate">()
      .notNull(),
    linkActorType: text("link_actor_type")
      .$type<
        "human_reviewer" | "source_native_exact_link" | "model_candidate"
      >()
      .notNull(),
    linkMethodVersion: text("link_method_version").notNull(),
    methodVersion: text("method_version").notNull(),
    asOf: date("as_of").notNull(),
    rationale: text("rationale").notNull(),
    evidenceRefs: text("evidence_refs").array().notNull(),
    reasons: text("reasons").array().notNull(),
    supersedesAbsorptionKey: text("supersedes_absorption_key"),
    decidedAt: timestamp("decided_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_pulse_event_absorptions_event_as_of").on(
      table.eventId,
      table.asOf,
      table.decidedAt,
    ),
    index("idx_pulse_event_absorptions_release").on(
      table.currentCiReleaseId,
      table.dimension,
    ),
    foreignKey({
      name: "pulse_event_absorptions_supersedes_key_fk",
      columns: [table.supersedesAbsorptionKey],
      foreignColumns: [table.absorptionKey],
    }).onDelete("restrict"),
    check(
      "pulse_event_absorptions_contract_check",
      dsql`${table.schemaVersion} = 'pulse-event-absorption/v1' AND ${table.absorptionKey} ~ '^pulse-absorption/sha256:[a-f0-9]{64}$' AND ${table.dimension} IN ('democratic_quality','rule_of_law','freedom_rights','corruption_control') AND ${table.outcome} IN ('absorbed','not_absorbed') AND ${table.previousCiReleaseId} <> ${table.currentCiReleaseId} AND ${table.previousScore} <> 'NaN'::real AND ${table.currentScore} <> 'NaN'::real AND ${table.scoreDelta} <> 'NaN'::real AND ${table.threshold} > 0 AND btrim(${table.fixedScaleId}) <> '' AND ${table.linkStanding} IN ('confirmed','candidate') AND ${table.linkActorType} IN ('human_reviewer','source_native_exact_link','model_candidate') AND btrim(${table.linkMethodVersion}) <> '' AND btrim(${table.methodVersion}) <> '' AND btrim(${table.rationale}) <> '' AND cardinality(${table.evidenceRefs}) >= 2 AND ((${table.outcome} = 'absorbed' AND ${table.linkStanding} = 'confirmed' AND ${table.linkActorType} IN ('human_reviewer','source_native_exact_link') AND cardinality(${table.reasons}) = 0) OR (${table.outcome} = 'not_absorbed' AND cardinality(${table.reasons}) > 0))`,
    ),
  ],
);

/**
 * Append-only, stage-specific Pulse decisions. `pulse_events_v2` remains the
 * current-state projection used by readers and scoring; this table preserves
 * the independent judgments that produced or later challenged that state.
 * Non-event clusters have no event row, so `event_id` is intentionally
 * nullable while `cluster_id` is always present.
 */
export const pulseEventDecisions = pgTable(
  "pulse_event_decisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schemaVersion: text("schema_version").notNull(),
    decisionKey: text("decision_key").notNull(),
    clusterId: uuid("cluster_id").notNull(),
    eventId: uuid("event_id").references(() => pulseEventsV2.id, {
      onDelete: "restrict",
    }),
    kind: text("kind").$type<PulseDecisionKind>().notNull(),
    verdict: text("verdict").$type<PulseDecisionVerdict>().notNull(),
    payload: jsonb("payload")
      .$type<PulseDecisionPayloads[PulseDecisionKind]>()
      .notNull(),
    actor: jsonb("actor").$type<PulseDecisionActor>().notNull(),
    stageRunId: uuid("stage_run_id")
      .references(() => pulsePipelineRuns.id, { onDelete: "restrict" })
      .notNull(),
    methodVersion: text("method_version").notNull(),
    rationale: text("rationale").notNull(),
    evidenceRefs: text("evidence_refs").array().notNull(),
    supersedesDecisionKey: text("supersedes_decision_key"),
    decidedAt: timestamp("decided_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_pulse_event_decisions_key").on(table.decisionKey),
    index("idx_pulse_event_decisions_event_kind_time").on(
      table.eventId,
      table.kind,
      table.decidedAt,
    ),
    index("idx_pulse_event_decisions_cluster_kind_time").on(
      table.clusterId,
      table.kind,
      table.decidedAt,
    ),
    index("idx_pulse_event_decisions_run").on(table.stageRunId),
    foreignKey({
      name: "pulse_event_decisions_supersedes_decision_key_fk",
      columns: [table.supersedesDecisionKey],
      foreignColumns: [table.decisionKey],
    }).onDelete("restrict"),
    check(
      "pulse_event_decisions_contract_check",
      dsql`${table.schemaVersion} = 'pulse-decision-ledger/v1' AND ${table.decisionKey} ~ '^pulse-decision/sha256:[a-f0-9]{64}$' AND ${table.kind} IN ('event_existence','subject_attribution','category_labels','severity','calibration','corroboration','publication') AND ${table.verdict} IN ('affirmed','refuted','abstained','unresolved') AND ${table.rationale} <> '' AND jsonb_typeof(${table.payload}) = 'object' AND NOT (${table.payload} ? 'confidence') AND ((${table.kind} = 'event_existence' AND ${table.payload} ? 'disposition') OR (${table.kind} = 'subject_attribution' AND ${table.payload} ?& ARRAY['status','primaryJurisdictionId','affectedJurisdictionIds']) OR (${table.kind} = 'category_labels' AND ${table.payload} ?& ARRAY['categoryIds','dimensionIds']) OR (${table.kind} = 'severity' AND ${table.payload} ?& ARRAY['tier','value','direction']) OR (${table.kind} = 'calibration' AND ${table.payload} ?& ARRAY['standing','signals','targetDecisionKinds','validationReleaseId'] AND ${table.payload}->>'standing' = 'not_calibrated') OR (${table.kind} = 'corroboration' AND ${table.payload} ?& ARRAY['independentEvidenceGroups','contributingReports','confidenceWeight','calibrationStanding'] AND ${table.payload}->>'calibrationStanding' = 'heuristic_not_probability') OR (${table.kind} = 'publication' AND ${table.payload} ?& ARRAY['eligible','origin','gateReasons'])) AND jsonb_typeof(${table.actor}) = 'object' AND ${table.actor}->>'type' IN ('classifier','verifier','subject_attributor','calibration_assessor','corroborator','publication_gate','human_reviewer','legacy_projection')`,
    ),
  ],
);

/** Append-only evaluation ledger for every candidate excluded from a Pulse
 * stage. Decision-derived rows preserve the decision key; ingest duplicates
 * are recorded directly because no raw-event row is created for them. */
export const pulseCandidateOutcomes = pgTable(
  "pulse_candidate_outcomes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schemaVersion: text("schema_version").notNull(),
    outcomeKey: text("outcome_key").notNull(),
    candidateKind: text("candidate_kind").$type<PulseCandidateKind>().notNull(),
    candidateId: text("candidate_id").notNull(),
    outcome: text("outcome").$type<PulseCandidateOutcome>().notNull(),
    reasonCode: text("reason_code").notNull(),
    reason: text("reason").notNull(),
    actor: jsonb("actor").$type<PulseDecisionActor>().notNull(),
    methodVersion: text("method_version").notNull(),
    stageRunId: uuid("stage_run_id")
      .references(() => pulsePipelineRuns.id, { onDelete: "restrict" })
      .notNull(),
    decisionKey: text("decision_key").references(
      () => pulseEventDecisions.decisionKey,
      { onDelete: "restrict" },
    ),
    canonicalCandidateId: text("canonical_candidate_id"),
    evidenceRefs: text("evidence_refs").array().notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
    occurredAt: timestamp("occurred_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_pulse_candidate_outcomes_key").on(table.outcomeKey),
    index("idx_pulse_candidate_outcomes_sample").on(
      table.outcome,
      table.occurredAt,
    ),
    index("idx_pulse_candidate_outcomes_candidate").on(
      table.candidateKind,
      table.candidateId,
    ),
    index("idx_pulse_candidate_outcomes_run").on(table.stageRunId),
    check(
      "pulse_candidate_outcomes_contract_check",
      dsql`${table.schemaVersion} = 'pulse-candidate-outcome/v1' AND ${table.outcomeKey} ~ '^pulse-candidate-outcome/sha256:[a-f0-9]{64}$' AND ${table.candidateKind} IN ('raw_item','cluster','event','decision') AND ${table.outcome} IN ('duplicate','non_event','insufficient_evidence','invalid','refuted','rejected') AND ${table.reasonCode} <> '' AND ${table.reason} <> '' AND ${table.methodVersion} <> '' AND cardinality(${table.evidenceRefs}) > 0 AND jsonb_typeof(${table.actor}) = 'object' AND ${table.actor}->>'type' IN ('classifier','verifier','subject_attributor','calibration_assessor','corroborator','publication_gate','human_reviewer','legacy_projection') AND jsonb_typeof(${table.metadata}) = 'object' AND ((${table.outcome} = 'duplicate' AND ${table.canonicalCandidateId} IS NOT NULL) OR (${table.outcome} <> 'duplicate'))`,
    ),
  ],
);

/**
 * Queryable projection of every resolved jurisdiction named by a
 * subject-attribution decision. A database trigger derives these rows from
 * the decision payload in the same transaction; callers never maintain a
 * second competing attribution record.
 */
export const pulseEventJurisdictions = pgTable(
  "pulse_event_jurisdictions",
  {
    decisionKey: text("decision_key")
      .references(() => pulseEventDecisions.decisionKey, {
        onDelete: "restrict",
      })
      .notNull(),
    eventId: uuid("event_id")
      .references(() => pulseEventsV2.id, { onDelete: "restrict" })
      .notNull(),
    clusterId: uuid("cluster_id").notNull(),
    jurisdictionId: uuid("jurisdiction_id")
      .references(() => jurisdictions.id, { onDelete: "restrict" })
      .notNull(),
    role: text("role").$type<"primary" | "affected">().notNull(),
    rationale: text("rationale").notNull(),
    evidenceRefs: text("evidence_refs").array().notNull(),
    entitySnapshot: jsonb("entity_snapshot")
      .$type<JurisdictionEntitySnapshot>()
      .notNull(),
    attributionVersion: text("attribution_version").notNull(),
    entityCatalogVersion: text("entity_catalog_version").notNull(),
    entityCatalogHash: text("entity_catalog_hash").notNull(),
    aliasVersion: text("alias_version").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.decisionKey, table.jurisdictionId] }),
    uniqueIndex("idx_pulse_event_jurisdictions_one_primary")
      .on(table.decisionKey)
      .where(dsql`${table.role} = 'primary'`),
    index("idx_pulse_event_jurisdictions_event_role").on(
      table.eventId,
      table.role,
    ),
    index("idx_pulse_event_jurisdictions_jurisdiction_role").on(
      table.jurisdictionId,
      table.role,
    ),
    check(
      "pulse_event_jurisdictions_contract_check",
      dsql`${table.role} IN ('primary','affected') AND ${table.rationale} <> '' AND cardinality(${table.evidenceRefs}) > 0 AND jsonb_typeof(${table.entitySnapshot}) = 'object' AND ((${table.attributionVersion} = 'pulse-jurisdiction-attribution/v2' AND ${table.entityCatalogVersion} = 'pulse-jurisdiction-entities/v1' AND ${table.aliasVersion} = 'pulse-jurisdiction-aliases/v1' AND ${table.entityCatalogHash} ~ '^pulse-jurisdiction-entities/sha256:[a-f0-9]{64}$') OR (${table.attributionVersion} = 'pulse-jurisdiction-attribution/legacy-projection-v1' AND ${table.entityCatalogVersion} = 'legacy-unversioned' AND ${table.aliasVersion} = 'legacy-unversioned' AND ${table.entityCatalogHash} = 'legacy-unversioned'))`,
    ),
  ],
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
      .references(() => pulseEventsV2.id, { onDelete: "restrict" })
      .notNull(),
    sourceId: text("source_id")
      .references(() => sources.id)
      .notNull(),
    /** 'specialist' | 'news' — denormalized for fast aggregation */
    sourceType: text("source_type").notNull(),
    sourceName: text("source_name").notNull(),
    sourceUrl: text("source_url"),
    /** Breadcrumb back to the staging row that contributed */
    rawEventId: uuid("raw_event_id")
      .references(() => rawEvents.id, { onDelete: "restrict" })
      .notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_pulse_sources_event").on(table.eventId),
    index("idx_pulse_sources_source").on(table.sourceId),
    uniqueIndex("idx_pulse_sources_raw_event_unique")
      .on(table.rawEventId)
      .where(dsql`${table.rawEventId} IS NOT NULL`),
  ],
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
    derivationVersionKey: text("derivation_version_key").notNull(),
    derivationVersions: jsonb("derivation_versions")
      .$type<DerivationVersionEnvelope>()
      .notNull(),
    computationRunId: uuid("computation_run_id")
      .references(() => pulsePipelineRuns.id, { onDelete: "restrict" })
      .notNull(),
    /** Inclusive end date of the score window. */
    scoreAsOf: date("score_as_of").notNull(),
    /** Inclusive start date of the score window. */
    windowStart: date("window_start").notNull(),
    /** Closed production contract: trailing 365 calendar days. */
    windowDays: integer("window_days").notNull(),
    lastComputedAt: timestamp("last_computed_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_pulse_dim_unique").on(
      table.jurisdictionId,
      table.dimension,
    ),
    index("idx_pulse_dim_jurisdiction").on(table.jurisdictionId),
    index("idx_pulse_dim_derivation_version").on(table.derivationVersionKey),
    index("idx_pulse_dim_computation_run").on(table.computationRunId),
    check(
      "pulse_dimensional_deltas_dimension_check",
      dsql`${table.dimension} IN ('democratic_quality', 'rule_of_law', 'freedom_rights', 'corruption_control', 'stability')`,
    ),
    check(
      "pulse_dimensional_deltas_value_check",
      dsql`${table.deltaValue} <> 'NaN'::real AND ${table.deltaValue} >= -15 AND ${table.deltaValue} <= 10`,
    ),
    check(
      "pulse_dimensional_deltas_window_check",
      dsql`${table.windowDays} = 365 AND ${table.windowStart} = ${table.scoreAsOf} - ${table.windowDays}`,
    ),
  ],
);

/**
 * Immutable history of every versioned Pulse dimensional output.
 *
 * The mutable table above is the current-state projection. This relation is
 * the reproducibility ledger: each score run records exactly one row for every
 * jurisdiction/dimension output it computed, including zero-output clearing
 * rows. Database triggers reject UPDATE and DELETE.
 */
export const pulseDimensionalDeltaHistory = pgTable(
  "pulse_dimensional_delta_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schemaVersion: text("schema_version")
      .notNull()
      .default("pulse-dimensional-delta-history/v1"),
    jurisdictionId: uuid("jurisdiction_id")
      .references(() => jurisdictions.id, { onDelete: "restrict" })
      .notNull(),
    dimension: text("dimension").notNull(),
    deltaValue: real("delta_value").notNull(),
    contributingEventIds: uuid("contributing_event_ids").array().notNull(),
    derivationVersionKey: text("derivation_version_key").notNull(),
    derivationVersions: jsonb("derivation_versions")
      .$type<DerivationVersionEnvelope>()
      .notNull(),
    computationRunId: uuid("computation_run_id")
      .references(() => pulsePipelineRuns.id, { onDelete: "restrict" })
      .notNull(),
    scoreAsOf: date("score_as_of").notNull(),
    windowStart: date("window_start").notNull(),
    windowDays: integer("window_days").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_pulse_dim_history_run_jurisdiction_dimension").on(
      table.computationRunId,
      table.jurisdictionId,
      table.dimension,
    ),
    index("idx_pulse_dim_history_jurisdiction_as_of").on(
      table.jurisdictionId,
      table.scoreAsOf,
    ),
    index("idx_pulse_dim_history_derivation_version").on(
      table.derivationVersionKey,
    ),
    check(
      "pulse_dimensional_delta_history_schema_check",
      dsql`${table.schemaVersion} = 'pulse-dimensional-delta-history/v1'`,
    ),
    check(
      "pulse_dimensional_delta_history_dimension_check",
      dsql`${table.dimension} IN ('democratic_quality', 'rule_of_law', 'freedom_rights', 'corruption_control', 'stability')`,
    ),
    check(
      "pulse_dimensional_delta_history_value_check",
      dsql`${table.deltaValue} <> 'NaN'::real AND ${table.deltaValue} >= -15 AND ${table.deltaValue} <= 10`,
    ),
    check(
      "pulse_dimensional_delta_history_window_check",
      dsql`${table.windowDays} = 365 AND ${table.windowStart} = ${table.scoreAsOf} - ${table.windowDays}`,
    ),
  ],
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
      .references(() => pulseEventsV2.id, { onDelete: "restrict" })
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
    runId: uuid("run_id")
      .references(() => pulsePipelineRuns.id, { onDelete: "restrict" })
      .notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_pulse_review_audit_event").on(table.eventId),
    index("idx_pulse_review_audit_reviewer").on(
      table.reviewerId,
      table.createdAt,
    ),
    index("idx_pulse_review_audit_run").on(table.runId),
  ],
);

/**
 * PUL-033 — one operational human-review obligation for each event admitted
 * to the pending queue under a named SLA contract. Historic pre-contract work
 * is retained as `legacy_quarantined`; that state is not a human decision.
 */
export const pulseReviewObligations = pgTable(
  "pulse_review_obligations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schemaVersion: text("schema_version").notNull(),
    eventId: uuid("event_id")
      .references(() => pulseEventsV2.id, { onDelete: "restrict" })
      .notNull(),
    incidentId: uuid("incident_id")
      .references(() => pulseIncidents.id, { onDelete: "restrict" })
      .notNull(),
    slaVersion: text("sla_version").notNull(),
    priority: text("priority")
      .$type<"critical" | "urgent" | "standard">()
      .notNull(),
    triggerReason: text("trigger_reason").notNull(),
    queuedAt: timestamp("queued_at").notNull(),
    queuedAtBasis: text("queued_at_basis")
      .$type<"recorded" | "created_at_proxy">()
      .notNull(),
    escalateAt: timestamp("escalate_at").notNull(),
    dueAt: timestamp("due_at").notNull(),
    state: text("state")
      .$type<"open" | "claimed" | "dispositioned" | "legacy_quarantined">()
      .notNull(),
    claimedBy: text("claimed_by"),
    claimedAt: timestamp("claimed_at"),
    claimExpiresAt: timestamp("claim_expires_at"),
    disposition: text("disposition"),
    dispositionedBy: text("dispositioned_by"),
    dispositionedAt: timestamp("dispositioned_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_pulse_review_obligation_event_version").on(
      table.eventId,
      table.slaVersion,
    ),
    index("idx_pulse_review_obligation_active_due").on(
      table.state,
      table.dueAt,
    ),
    index("idx_pulse_review_obligation_priority_due").on(
      table.priority,
      table.dueAt,
    ),
    index("idx_pulse_review_obligation_incident").on(table.incidentId),
    check(
      "pulse_review_obligation_contract_check",
      dsql`${table.schemaVersion} = 'pulse-review-obligation/v1' AND ${table.slaVersion} = 'pulse-review-sla/v1' AND ${table.priority} IN ('critical','urgent','standard') AND ${table.queuedAtBasis} IN ('recorded','created_at_proxy') AND ${table.state} IN ('open','claimed','dispositioned','legacy_quarantined') AND btrim(${table.triggerReason}) <> '' AND ${table.queuedAt} <= ${table.escalateAt} AND ${table.escalateAt} <= ${table.dueAt} AND ((${table.state} = 'open' AND ${table.claimedBy} IS NULL AND ${table.claimedAt} IS NULL AND ${table.claimExpiresAt} IS NULL AND ${table.disposition} IS NULL AND ${table.dispositionedBy} IS NULL AND ${table.dispositionedAt} IS NULL) OR (${table.state} = 'claimed' AND btrim(${table.claimedBy}) <> '' AND ${table.claimedAt} IS NOT NULL AND ${table.claimExpiresAt} > ${table.claimedAt} AND ${table.disposition} IS NULL AND ${table.dispositionedBy} IS NULL AND ${table.dispositionedAt} IS NULL) OR (${table.state} IN ('dispositioned','legacy_quarantined') AND btrim(${table.disposition}) <> '' AND btrim(${table.dispositionedBy}) <> '' AND ${table.dispositionedAt} IS NOT NULL))`,
    ),
  ],
);

/** Append-only operational record for queue entry, escalation and exceptions. */
export const pulseReviewSlaEvents = pgTable(
  "pulse_review_sla_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    schemaVersion: text("schema_version").notNull(),
    eventKey: text("event_key").notNull(),
    obligationId: uuid("obligation_id")
      .references(() => pulseReviewObligations.id, { onDelete: "restrict" })
      .notNull(),
    kind: text("kind")
      .$type<
        | "enqueued"
        | "claimed"
        | "released"
        | "escalated"
        | "exception_granted"
        | "exception_expired"
        | "dispositioned"
        | "legacy_quarantined"
      >()
      .notNull(),
    actor: jsonb("actor").$type<Record<string, unknown>>().notNull(),
    reasonCode: text("reason_code").notNull(),
    note: text("note").notNull(),
    effectiveAt: timestamp("effective_at").notNull(),
    expiresAt: timestamp("expires_at"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_pulse_review_sla_event_key").on(table.eventKey),
    index("idx_pulse_review_sla_event_obligation").on(
      table.obligationId,
      table.effectiveAt,
    ),
    index("idx_pulse_review_sla_event_kind").on(table.kind, table.effectiveAt),
    check(
      "pulse_review_sla_event_contract_check",
      dsql`${table.schemaVersion} = 'pulse-review-sla-event/v1' AND ${table.eventKey} ~ '^pulse-review-sla-event/sha256:[a-f0-9]{64}$' AND ${table.kind} IN ('enqueued','claimed','released','escalated','exception_granted','exception_expired','dispositioned','legacy_quarantined') AND jsonb_typeof(${table.actor}) = 'object' AND jsonb_typeof(${table.metadata}) = 'object' AND btrim(${table.reasonCode}) <> '' AND btrim(${table.note}) <> '' AND ((${table.kind} = 'exception_granted' AND ${table.expiresAt} > ${table.effectiveAt}) OR (${table.kind} <> 'exception_granted' AND ${table.expiresAt} IS NULL))`,
    ),
  ],
);

/**
 * PUL-017 — independent double-coding workspace.
 *
 * These tables are deliberately separate from production Pulse events and the
 * owner review queue. A coding study pins one unlabeled packet set and exact
 * method versions; no production label, model vote, or owner decision belongs
 * in this graph.
 */
export const pulseCodingStudies = pgTable(
  "pulse_coding_studies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    schemaVersion: text("schema_version").notNull(),
    title: text("title").notNull(),
    purpose: text("purpose").notNull(),
    protocolVersion: text("protocol_version").notNull(),
    codebookVersion: text("codebook_version").notNull(),
    ontologyVersion: text("ontology_version").notNull(),
    datasetVersion: text("dataset_version").notNull(),
    packetSetSha256: text("packet_set_sha256").notNull(),
    traceSetSha256: text("trace_set_sha256"),
    status: text("status").notNull().default("setup"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    closedAt: timestamp("closed_at"),
  },
  (table) => [
    check(
      "pulse_coding_studies_contract_check",
      dsql`${table.schemaVersion} = 'pulse-coding-workspace/v1' AND ${table.purpose} IN ('instruction_pilot','evaluation') AND ${table.status} IN ('setup','active','closed') AND ${table.protocolVersion} <> '' AND ${table.codebookVersion} <> '' AND ${table.ontologyVersion} <> '' AND ${table.datasetVersion} <> '' AND ${table.packetSetSha256} ~ '^[a-f0-9]{64}$' AND (${table.traceSetSha256} IS NULL OR ${table.traceSetSha256} ~ '^[a-f0-9]{64}$')`,
    ),
    uniqueIndex("idx_pulse_coding_study_identity").on(
      table.protocolVersion,
      table.packetSetSha256,
    ),
    index("idx_pulse_coding_study_status").on(table.status, table.createdAt),
  ],
);

export const pulseCodingPackets = pgTable(
  "pulse_coding_packets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studyId: uuid("study_id")
      .references(() => pulseCodingStudies.id, { onDelete: "restrict" })
      .notNull(),
    packetKey: text("packet_key").notNull(),
    analysisStatus: text("analysis_status").notNull(),
    packetSnapshot: jsonb("packet_snapshot")
      .$type<PulseCodingPacketSnapshot>()
      .notNull(),
    packetSnapshotSha256: text("packet_snapshot_sha256").notNull(),
    importedAt: timestamp("imported_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_pulse_coding_packet_key").on(
      table.studyId,
      table.packetKey,
    ),
    uniqueIndex("idx_pulse_coding_packet_hash").on(
      table.studyId,
      table.packetSnapshotSha256,
    ),
    index("idx_pulse_coding_packet_status").on(
      table.studyId,
      table.analysisStatus,
    ),
    check(
      "pulse_coding_packets_contract_check",
      dsql`${table.analysisStatus} IN ('analysis_candidate','reserve','pilot') AND ${table.packetSnapshotSha256} ~ '^[a-f0-9]{64}$' AND jsonb_typeof(${table.packetSnapshot}) = 'object'`,
    ),
  ],
);

export const pulseCodingParticipants = pgTable(
  "pulse_coding_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studyId: uuid("study_id")
      .references(() => pulseCodingStudies.id, { onDelete: "restrict" })
      .notNull(),
    pseudonym: text("pseudonym").notNull(),
    role: text("role").notNull(),
    actorType: text("actor_type").notNull(),
    useStatus: text("use_status").notNull(),
    credentialHash: text("credential_hash").notNull().unique(),
    status: text("status").notNull().default("active"),
    expiresAt: timestamp("expires_at"),
    lastAccessAt: timestamp("last_access_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    revokedAt: timestamp("revoked_at"),
  },
  (table) => [
    uniqueIndex("idx_pulse_coding_participant_pseudonym").on(
      table.studyId,
      table.pseudonym,
    ),
    index("idx_pulse_coding_participant_role").on(
      table.studyId,
      table.role,
      table.status,
    ),
    check(
      "pulse_coding_participants_contract_check",
      dsql`${table.role} IN ('coder','adjudicator','study_admin') AND ${table.actorType} IN ('qualified_human','agent_dry_pilot') AND ${table.useStatus} IN ('evaluation_candidate','dry_run_not_gold') AND ${table.status} IN ('active','revoked') AND ${table.credentialHash} ~ '^[a-f0-9]{64}$' AND (${table.actorType} <> 'agent_dry_pilot' OR ${table.useStatus} = 'dry_run_not_gold')`,
    ),
  ],
);

export const pulseCodingAssignments = pgTable(
  "pulse_coding_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    packetId: uuid("packet_id")
      .references(() => pulseCodingPackets.id, { onDelete: "restrict" })
      .notNull(),
    participantId: uuid("participant_id")
      .references(() => pulseCodingParticipants.id, { onDelete: "restrict" })
      .notNull(),
    slot: text("slot").notNull(),
    status: text("status").notNull().default("assigned"),
    draft: jsonb("draft").$type<PulseCodingSubmissionEnvelope>(),
    draftSha256: text("draft_sha256"),
    submission: jsonb("submission").$type<PulseCodingSubmissionEnvelope>(),
    submissionSha256: text("submission_sha256"),
    assignedAt: timestamp("assigned_at").defaultNow().notNull(),
    draftUpdatedAt: timestamp("draft_updated_at"),
    lockedAt: timestamp("locked_at"),
  },
  (table) => [
    uniqueIndex("idx_pulse_coding_assignment_slot").on(
      table.packetId,
      table.slot,
    ),
    uniqueIndex("idx_pulse_coding_assignment_participant").on(
      table.packetId,
      table.participantId,
    ),
    index("idx_pulse_coding_assignment_queue").on(
      table.participantId,
      table.status,
      table.assignedAt,
    ),
    check(
      "pulse_coding_assignments_contract_check",
      dsql`${table.slot} IN ('coder_a','coder_b','adjudicator') AND ${table.status} IN ('assigned','draft','locked') AND (${table.draftSha256} IS NULL OR ${table.draftSha256} ~ '^[a-f0-9]{64}$') AND (${table.submissionSha256} IS NULL OR ${table.submissionSha256} ~ '^[a-f0-9]{64}$') AND ((${table.status} = 'locked' AND ${table.submission} IS NOT NULL AND ${table.submissionSha256} IS NOT NULL AND ${table.lockedAt} IS NOT NULL) OR (${table.status} <> 'locked' AND ${table.submission} IS NULL AND ${table.submissionSha256} IS NULL AND ${table.lockedAt} IS NULL))`,
    ),
  ],
);

export const pulseCodingComparisons = pgTable(
  "pulse_coding_comparisons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    packetId: uuid("packet_id")
      .references(() => pulseCodingPackets.id, { onDelete: "restrict" })
      .notNull()
      .unique(),
    coderAssignmentAId: uuid("coder_assignment_a_id")
      .references(() => pulseCodingAssignments.id, { onDelete: "restrict" })
      .notNull(),
    coderAssignmentBId: uuid("coder_assignment_b_id")
      .references(() => pulseCodingAssignments.id, { onDelete: "restrict" })
      .notNull(),
    comparison: jsonb("comparison").notNull(),
    comparisonSha256: text("comparison_sha256").notNull(),
    disagreementAxes: text("disagreement_axes").array().notNull(),
    generatedAt: timestamp("generated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_pulse_coding_comparison_disagreements").on(table.generatedAt),
    check(
      "pulse_coding_comparisons_contract_check",
      dsql`${table.coderAssignmentAId} <> ${table.coderAssignmentBId} AND ${table.comparisonSha256} ~ '^[a-f0-9]{64}$' AND jsonb_typeof(${table.comparison}) = 'object'`,
    ),
  ],
);

export const pulseCodingAdjudications = pgTable(
  "pulse_coding_adjudications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    comparisonId: uuid("comparison_id")
      .references(() => pulseCodingComparisons.id, { onDelete: "restrict" })
      .notNull()
      .unique(),
    adjudicatorAssignmentId: uuid("adjudicator_assignment_id")
      .references(() => pulseCodingAssignments.id, { onDelete: "restrict" })
      .notNull(),
    status: text("status").notNull().default("pending"),
    resolution: jsonb("resolution").$type<PulseCodingAdjudicationInput>(),
    resolutionSha256: text("resolution_sha256"),
    reasonCodes: text("reason_codes").array().notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    resolvedAt: timestamp("resolved_at"),
  },
  (table) => [
    index("idx_pulse_coding_adjudication_status").on(
      table.status,
      table.createdAt,
    ),
    check(
      "pulse_coding_adjudications_contract_check",
      dsql`${table.status} IN ('pending','resolved','unresolved') AND ((${table.status} = 'pending' AND ${table.resolution} IS NULL AND ${table.resolutionSha256} IS NULL AND ${table.resolvedAt} IS NULL) OR (${table.status} IN ('resolved','unresolved') AND ${table.resolution} IS NOT NULL AND ${table.resolutionSha256} ~ '^[a-f0-9]{64}$' AND ${table.resolvedAt} IS NOT NULL AND cardinality(${table.reasonCodes}) > 0))`,
    ),
  ],
);

export const pulseCodingAuditLog = pgTable(
  "pulse_coding_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studyId: uuid("study_id").references(() => pulseCodingStudies.id, {
      onDelete: "restrict",
    }),
    packetId: uuid("packet_id").references(() => pulseCodingPackets.id, {
      onDelete: "restrict",
    }),
    participantId: uuid("participant_id").references(
      () => pulseCodingParticipants.id,
      { onDelete: "restrict" },
    ),
    actorId: text("actor_id").notNull(),
    actorRole: text("actor_role").notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    requestId: text("request_id").unique(),
    beforeSha256: text("before_sha256"),
    afterSha256: text("after_sha256"),
    details: jsonb("details").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_pulse_coding_audit_study").on(table.studyId, table.createdAt),
    index("idx_pulse_coding_audit_packet").on(table.packetId, table.createdAt),
    index("idx_pulse_coding_audit_actor").on(table.actorId, table.createdAt),
    check(
      "pulse_coding_audit_contract_check",
      dsql`${table.actorRole} IN ('coder','adjudicator','study_admin','system','anonymous') AND ${table.action} IN ('study_created','packet_imported','participant_issued','participant_revoked','assignment_created','draft_saved','submission_locked','comparison_generated','adjudication_recorded','export_generated','access_granted','access_denied') AND ${table.entityType} <> '' AND jsonb_typeof(${table.details}) = 'object' AND (${table.beforeSha256} IS NULL OR ${table.beforeSha256} ~ '^[a-f0-9]{64}$') AND (${table.afterSha256} IS NULL OR ${table.afterSha256} ~ '^[a-f0-9]{64}$')`,
    ),
  ],
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
  (table) => [index("idx_backtest_events_case").on(table.caseId)],
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
  ],
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
  (table) => [index("idx_rate_limits_expires_at").on(table.expiresAt)],
);
