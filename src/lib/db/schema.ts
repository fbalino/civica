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
  capital: text("capital"),
  population: integer("population"),
  gdpBillions: real("gdp_billions"),
  areaSqKm: integer("area_sq_km"),
  languages: text("languages"),
  currency: text("currency"),
  democracyIndex: real("democracy_index"),
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
});

export const persons = pgTable("persons", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  dateOfBirth: date("date_of_birth"),
  wikidataQid: text("wikidata_qid"),
  photoUrl: text("photo_url"),
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
  lastFetched: timestamp("last_fetched"),
});

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

export const countryFacts = pgTable(
  "country_facts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jurisdictionId: uuid("jurisdiction_id")
      .references(() => jurisdictions.id)
      .notNull(),
    category: text("category").notNull(),
    factKey: text("fact_key").notNull(),
    factValue: text("fact_value"),
    factValueNumeric: real("fact_value_numeric"),
    factUnit: text("fact_unit"),
    factYear: integer("fact_year"),
    sourceNote: text("source_note"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_country_facts_unique").on(
      table.jurisdictionId,
      table.factKey
    ),
    index("idx_country_facts_key").on(table.factKey),
    index("idx_country_facts_category").on(table.category),
    index("idx_country_facts_numeric").on(
      table.factKey,
      table.factValueNumeric
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
    methodologyVersion: text("methodology_version")
      .references(() => ciMethodologyVersions.id)
      .notNull(),
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
    methodologyVersion: text("methodology_version")
      .references(() => ciMethodologyVersions.id)
      .notNull(),
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
    methodologyVersion: text("methodology_version")
      .references(() => ciMethodologyVersions.id)
      .notNull(),
    calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_pulse_daily_unique").on(
      table.jurisdictionId,
      table.scoreDate
    ),
    index("idx_pulse_daily_date").on(table.scoreDate),
    index("idx_pulse_daily_jurisdiction").on(table.jurisdictionId),
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
    /** All 3 classifier runs preserved for audit. Shape:
     *  [{run, temp, model, category, dimension, severity, confidence, raw}, ...] */
    classifierRuns: jsonb("classifier_runs").notNull(),
    /** 'all' | 'two_of_three' | 'none' — drives confidence boost/penalty */
    classifierAgreement: text("classifier_agreement").notNull(),
    humanReviewed: boolean("human_reviewed").notNull().default(false),
    reviewerId: text("reviewer_id"),
    reviewNotes: text("review_notes"),
    /** pending | approved | rejected | edited */
    reviewStatus: text("review_status").notNull().default("pending"),
    /** True only when classifier agreement is sufficient AND review is
     *  not required, OR human reviewer has approved it. Score-driving. */
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
