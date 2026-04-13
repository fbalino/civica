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
  bodyId: uuid("body_id").references(() => governmentBodies.id),
  turnoutPercent: real("turnout_percent"),
  wikidataQid: text("wikidata_qid"),
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
