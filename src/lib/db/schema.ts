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
