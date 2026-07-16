/**
 * DAT-009 table-level research and release policy.
 *
 * Column structure comes from Drizzle. These entries supply the meaning that
 * cannot be inferred from SQL: row grain, origin, update cadence, temporal
 * interpretation, rights posture, release scope, and retirement status.
 */

export const DATA_DICTIONARY_VERSION = "schema-data-dictionary/v1";

export type ReleaseScope =
  | "atlas_public"
  | "research_beta"
  | "public_support"
  | "internal_operational"
  | "private_submission";

export type DeprecationStatus =
  | { status: "active" }
  | { status: "legacy"; replacement: string; note: string };

export interface TablePolicy {
  definition: string;
  rowGrain: string;
  releaseScope: ReleaseScope;
  sourceOrDerivation: string;
  cadence: string;
  vintageSemantics: string;
  rights: string;
  deprecation: DeprecationStatus;
}

const active = { status: "active" } as const;
const legacyPulse = (replacement: string): DeprecationStatus => ({
  status: "legacy",
  replacement,
  note: "Retained for historical Beta replay; not the current Pulse v2 production contract.",
});

export const TABLE_POLICIES: Readonly<Record<string, TablePolicy>> = {
  jurisdictions: {
    definition:
      "Canonical Civica registry of countries, territories, disputed entities, and statistical areas.",
    rowGrain: "One jurisdiction or special geographic entity.",
    releaseScope: "atlas_public",
    sourceOrDerivation:
      "Wikidata and CIA identity fields, Civica's sourced jurisdiction-status taxonomy, and resolver-derived display caches.",
    cadence: "Identity/status review plus nightly derived-cache refresh.",
    vintageSemantics:
      "Status review date is distinct from the fact-cache refresh timestamp and upstream fact vintages.",
    rights:
      "Mixed by field; identity and status source IDs must resolve through the rights manifest. Derived cache fields inherit the selected fact's rights.",
    deprecation: active,
  },
  government_bodies: {
    definition:
      "Government institutions and legislative chambers attached to a jurisdiction.",
    rowGrain: "One government body or chamber.",
    releaseScope: "atlas_public",
    sourceOrDerivation:
      "Wikidata, IPU Parline, and curated institutional records.",
    cadence: "Source sync and event-driven institutional correction.",
    vintageSemantics:
      "Current structural record; source freshness is carried by its source registry rather than a row-level vintage.",
    rights:
      "Mixed source terms; IPU-derived fields are non-commercial and must remain rights-filtered.",
    deprecation: active,
  },
  offices: {
    definition:
      "Named offices within government bodies, including reporting and display relationships.",
    rowGrain: "One office in one government body.",
    releaseScope: "atlas_public",
    sourceOrDerivation:
      "CIA World Leaders, Wikidata, and Civica structural derivation.",
    cadence: "Monthly and event-driven officeholder syncs.",
    vintageSemantics:
      "Current office structure; display order reflects the latest ingested publisher ordering.",
    rights:
      "Source-dependent; CIA fields are public-domain with attribution and seal restrictions, Wikidata fields are CC0.",
    deprecation: active,
  },
  persons: {
    definition: "People referenced as officeholders or institutional actors.",
    rowGrain: "One person identity.",
    releaseScope: "atlas_public",
    sourceOrDerivation:
      "Wikidata, IPU Parline, and source-attributed Wikimedia Commons portrait metadata.",
    cadence: "Monthly and event-driven identity enrichment.",
    vintageSemantics:
      "Current identity record; portrait credit and license describe the captured portrait file.",
    rights:
      "Identity metadata follows its source; each portrait retains its own Commons license and credit.",
    deprecation: active,
  },
  terms: {
    definition: "A person's tenure in an office.",
    rowGrain: "One person-office term interval.",
    releaseScope: "atlas_public",
    sourceOrDerivation:
      "Wikidata and officeholder source records, normalized by Civica.",
    cadence: "Monthly and event-driven officeholder syncs.",
    vintageSemantics:
      "Start/end dates describe the political term, while current status describes the latest sync state.",
    rights: "Inherited from the officeholder source record.",
    deprecation: active,
  },
  legislature_parties: {
    definition:
      "Current or retained party seat holdings for a legislative body, linked to a stable political-party identity and immutable composition run.",
    rowGrain: "One stable party participation row in one legislature.",
    releaseScope: "atlas_public",
    sourceOrDerivation:
      "IPU Parline with Wikidata fallback and Civica normalization.",
    cadence: "Scheduled legislature sync and post-election correction.",
    vintageSemantics:
      "composition_run_id identifies the exact source retrieval; is_current and retired_at preserve superseded chamber participation without deleting identity or ideology links.",
    rights:
      "Mixed; IPU-derived records remain subject to non-commercial share-alike terms.",
    deprecation: active,
  },
  political_parties: {
    definition:
      "Stable political-party identities independent of a seat snapshot or mutable display name.",
    rowGrain: "One political-party identity within one jurisdiction.",
    releaseScope: "atlas_public",
    sourceOrDerivation:
      "Source-native IPU or Wikidata identifiers when available; legacy rows remain explicitly provisional until a source identifier is observed.",
    cadence: "Updated when a legislature composition source is retrieved.",
    vintageSemantics:
      "identity_retrieved_at dates the source identifier observation; provisional_legacy identities make no historical continuity claim.",
    rights:
      "Identity provenance retains the source URL and license; source-specific reuse restrictions continue to apply.",
    deprecation: active,
  },
  party_composition_runs: {
    definition:
      "Immutable source retrievals that established a legislature composition.",
    rowGrain: "One body, source, payload, and writer-version run.",
    releaseScope: "atlas_public",
    sourceOrDerivation:
      "IPU Parline or Wikidata payload hash plus exact source URL, license, and retrieval time; legacy adoption runs may have unavailable source fields.",
    cadence: "One row for each materially new composition retrieval.",
    vintageSemantics:
      "source_retrieved_at is publisher retrieval time; recorded_at is the Civica ledger insertion time.",
    rights: "Inherited from the named source and recorded per run.",
    deprecation: active,
  },
  party_identity_events: {
    definition:
      "Append-only, source-bound party identity changes and lineage edges.",
    rowGrain:
      "One observed rename/retirement/reactivation or one sourced predecessor-successor edge within a grouped split, merge, or succession event.",
    releaseScope: "atlas_public",
    sourceOrDerivation:
      "Composition writers record observed identity lifecycle changes; split, merge, and succession edges require explicit source evidence and are never inferred from names.",
    cadence: "Event-driven.",
    vintageSemantics:
      "effective_date is the political event date when sourced; source_retrieved_at and recorded_at remain separate.",
    rights: "Inherited from the source recorded on each event.",
    deprecation: active,
  },
  party_positions: {
    definition:
      "V-Party ideology estimates matched to Civica legislature-party rows.",
    rowGrain: "One V-Party estimate matched to one legislature-party row.",
    releaseScope: "research_beta",
    sourceOrDerivation:
      "V-Party v2 variables and a recorded Civica match method/confidence.",
    cadence: "Per upstream V-Party release and manual match review.",
    vintageSemantics:
      "coded_year is the election year represented by the frozen V-Party release, not ingestion time.",
    rights:
      "V-Dem/V-Party academic non-commercial terms; public redistribution requires rights filtering.",
    deprecation: active,
  },
  elections: {
    definition: "National election records and high-level participation facts.",
    rowGrain: "One election event in one jurisdiction.",
    releaseScope: "atlas_public",
    sourceOrDerivation:
      "IPU Parline, Wikidata, and International IDEA, with confidence recorded for dates.",
    cadence: "Scheduled source sync and post-election updates.",
    vintageSemantics:
      "election_date is the event date; date_confidence distinguishes source-confirmed values from estimates.",
    rights:
      "Mixed by contributing source; IPU/IDEA records require source-specific export checks.",
    deprecation: active,
  },
  election_results: {
    definition: "Party or candidate outcomes for an election.",
    rowGrain: "One party/candidate result in one election.",
    releaseScope: "atlas_public",
    sourceOrDerivation: "Election-source result records normalized by Civica.",
    cadence: "Post-election source sync and correction.",
    vintageSemantics:
      "Inherits the linked election's event date and source release.",
    rights: "Inherited from the linked election's source lineage.",
    deprecation: active,
  },
  constitutions: {
    definition:
      "Constitution documents and parsed article structures by jurisdiction.",
    rowGrain: "One constitution document for one jurisdiction.",
    releaseScope: "atlas_public",
    sourceOrDerivation:
      "Constitute Project document and Civica HTML/article parsing.",
    cadence: "Source release or constitutional amendment refresh.",
    vintageSemantics:
      "year and year_updated describe the constitution; last_fetched is retrieval time.",
    rights:
      "Constitute Project non-commercial terms; document redistribution must remain rights-filtered.",
    deprecation: active,
  },
  constitution_passages: {
    definition:
      "Version-bound searchable and citable passages derived from Constitute's English-language service representation.",
    rowGrain:
      "One source document version, source section, language representation, and normalized content version.",
    releaseScope: "atlas_public",
    sourceOrDerivation:
      "Deterministically normalized from one parsed Constitute section; heading and body feed the English PostgreSQL full-text index.",
    cadence:
      "Current rows are replaced on successful source sync or local parser re-derivation; superseded rows remain resolvable.",
    vintageSemantics:
      "retrieved_at is the source retrieval time; passage identity binds source document, section, language, and content hash.",
    rights:
      "CC BY-NC 3.0 interactive non-commercial display only; public bulk constitution-text export remains blocked.",
    deprecation: active,
  },
  constitution_topic_excerpts: {
    definition: "Derived topic-to-passage index for constitution comparison.",
    rowGrain:
      "One Constitute topic assigned to one parsed constitution section.",
    releaseScope: "atlas_public",
    sourceOrDerivation:
      "Deterministically parsed from the linked Constitute document and ontology tags.",
    cadence: "Rebuilt when the linked constitution is ingested or reparsed.",
    vintageSemantics:
      "Inherits the linked constitution's document year, update year, and retrieval time.",
    rights: "Inherits Constitute Project non-commercial terms.",
    deprecation: active,
  },
  country_factbook_sections: {
    definition:
      "Raw section-shaped CIA Factbook payloads retained for source display and replay.",
    rowGrain: "One CIA Factbook section for one jurisdiction and import phase.",
    releaseScope: "public_support",
    sourceOrDerivation: "CIA World Factbook frozen source payload.",
    cadence:
      "Frozen source import; rebuilt only for a named new source capture.",
    vintageSemantics:
      "Tied to the captured Factbook release; created/updated timestamps are ingestion metadata.",
    rights:
      "CIA public-domain material with required source credit and restricted marks/seals.",
    deprecation: active,
  },
  country_facts: {
    definition:
      "Multi-source candidate observations used by the country-fact resolver.",
    rowGrain: "One jurisdiction, fact key, source, and observation candidate.",
    releaseScope: "atlas_public",
    sourceOrDerivation:
      "Source-row observation with explicit source ID, retrieval metadata, value type, and methodology version.",
    cadence:
      "Per-source scheduled sync; varies from daily to annual/source release.",
    vintageSemantics:
      "Separates upstream as-of/year, underlying measurement vintage, retrieval time, and Civica methodology version.",
    rights:
      "Resolved per source_id through the rights manifest; mixed-source bulk export is fail-closed.",
    deprecation: active,
  },
  country_fact_vintages: {
    definition: "Named frozen canonical country-fact selections.",
    rowGrain: "One canonical jurisdiction/fact selection in one named vintage.",
    releaseScope: "atlas_public",
    sourceOrDerivation:
      "Snapshot of a country_facts selection plus resolver decision metadata.",
    cadence: "Immutable per named release cut.",
    vintageSemantics:
      "vintage names the Civica release cut; data year and as-of fields retain upstream observation time.",
    rights:
      "Inherits the selected source row's rights and release-manifest restrictions.",
    deprecation: active,
  },
  country_fact_vintage_releases: {
    definition:
      "Release-level closure manifest for one named reconciliation cut.",
    rowGrain:
      "One immutable named reconciliation release or explicitly disclosed canonical-only legacy cut.",
    releaseScope: "public_support",
    sourceOrDerivation:
      "Generated from the complete frozen resolver candidate set, resolver code hash, adapter hashes, and winner replay.",
    cadence:
      "One append-only row per quarterly or explicitly corrected reconciliation release.",
    vintageSemantics:
      "cut_at_timestamp is the actual selection boundary; the vintage label is the Civica publication handle.",
    rights:
      "Civica-authored manifest metadata; candidate payload rights remain source-specific.",
    deprecation: active,
  },
  country_fact_vintage_candidates: {
    definition:
      "Immutable complete resolver inputs and source/input evidence for a named reconciliation release.",
    rowGrain:
      "One jurisdiction, fact key, source candidate, and named release cut.",
    releaseScope: "public_support",
    sourceOrDerivation:
      "Exact normalized country_facts resolver input with source payload or observation hash and producing adapter hash.",
    cadence: "Frozen once with each complete reconciliation release.",
    vintageSemantics:
      "The candidate payload retains observation, upstream release, retrieval, and method times; cut_at_timestamp binds release membership.",
    rights:
      "Payloads inherit source rights and are not automatically eligible for public bulk redistribution.",
    deprecation: active,
  },
  data_disputes: {
    definition:
      "Recorded disagreements and review outcomes among candidate country facts.",
    rowGrain: "One dispute for one jurisdiction/fact key and candidate set.",
    releaseScope: "public_support",
    sourceOrDerivation:
      "Resolver-detected disagreement plus automated or human review decision.",
    cadence: "Created during reconciliation and updated through review.",
    vintageSemantics:
      "Candidate timestamps describe source observations; detection/resolution timestamps describe Civica review history.",
    rights:
      "Candidate values inherit source rights; Civica decision metadata is Civica-authored.",
    deprecation: active,
  },
  fact_snapshots: {
    definition: "Metadata for named country-fact snapshot runs.",
    rowGrain: "One attempted or completed snapshot cut.",
    releaseScope: "public_support",
    sourceOrDerivation:
      "Civica snapshot orchestration metadata and aggregate counts.",
    cadence: "Per named release snapshot.",
    vintageSemantics:
      "snapshot_date is the release cut; creation/completion timestamps are execution time.",
    rights:
      "Civica-authored metadata; included source data remains governed separately.",
    deprecation: active,
  },
  data_facts_audit_log: {
    definition:
      "Append-only audit events for country-fact mutations and review actions.",
    rowGrain: "One mutation or review action.",
    releaseScope: "internal_operational",
    sourceOrDerivation:
      "Generated by Civica write paths from actor, action, before/after, and reason context.",
    cadence: "Event-driven on mutation.",
    vintageSemantics:
      "created_at is the audit event time; payloads preserve the state observed at that event.",
    rights:
      "Internal operational record; embedded source values retain upstream rights.",
    deprecation: active,
  },
  research_evidence_history: {
    definition:
      "Append-only pre-mutation history for protected Atlas and research evidence rows.",
    rowGrain:
      "One retained UPDATE or DELETE event for one protected database row.",
    releaseScope: "internal_operational",
    sourceOrDerivation:
      "Database-triggered capture of complete before/after row state plus actor, reason, operation, and time.",
    cadence:
      "Synchronously on every update or deletion of a registered protected relation.",
    vintageSemantics:
      "recorded_at is mutation time; embedded row timestamps retain their original source, observation, and derivation meanings.",
    rights:
      "Internal audit evidence; embedded values retain the rights and access restrictions of their source relation.",
    deprecation: active,
  },
  statements: {
    definition:
      "Statement-level provenance ledger linking subjects, predicates, values, and sources.",
    rowGrain: "One sourced assertion about one subject and predicate.",
    releaseScope: "atlas_public",
    sourceOrDerivation:
      "Generated by source adapters with subject linkage, value payload, source ID, retrieval time, and optional validity interval.",
    cadence: "Per-source ingestion or reconciliation write.",
    vintageSemantics:
      "valid_from/to describe assertion validity; retrieved_at describes capture; created_at describes ledger insertion.",
    rights:
      "Resolved per source_id; statement metadata alone does not override source reuse restrictions.",
    deprecation: active,
  },
  sources: {
    definition:
      "Canonical source registry used by provenance, freshness, and rights joins.",
    rowGrain: "One upstream source or dataset family.",
    releaseScope: "public_support",
    sourceOrDerivation:
      "Civica-maintained registry seeded from declared production source specifications.",
    cadence:
      "Manual specification review; last_sync_at changes only after successful row-writing syncs.",
    vintageSemantics:
      "last_sync_at is operational freshness, not an upstream observation or release vintage.",
    rights:
      "license is descriptive source metadata; authoritative reuse decisions come from the rights manifest.",
    deprecation: active,
  },
  government_taxonomies: {
    definition:
      "Source and derived government-system classifications by jurisdiction and reference year.",
    rowGrain: "One jurisdiction and taxonomy observation/derivation.",
    releaseScope: "atlas_public",
    sourceOrDerivation:
      "Bjørnskov-Rode/CGV source variables plus versioned Civica structural derivation.",
    cadence: "Per taxonomy release and derivation-version update.",
    vintageSemantics:
      "reference year belongs to the source classification; ingestion timestamps and derivation version are separate.",
    rights:
      "Source taxonomy terms apply to source variables; Civica derivations retain source attribution.",
    deprecation: active,
  },
  contact_submissions: {
    definition: "Private contact-form messages and processing state.",
    rowGrain: "One submitted contact message.",
    releaseScope: "private_submission",
    sourceOrDerivation:
      "Direct user submission plus Civica processing metadata.",
    cadence: "On form submission and administrative processing.",
    vintageSemantics:
      "created_at is submission time; processed_at is workflow time.",
    rights:
      "Private personal data; excluded from research releases and public exports.",
    deprecation: active,
  },
  bill_summary_cache: {
    definition: "Cached machine-generated summaries of legislative bills.",
    rowGrain: "One cached summary for one bill and summary version.",
    releaseScope: "public_support",
    sourceOrDerivation:
      "Civica/LLM-derived summary from the linked bill text or metadata.",
    cadence: "On demand or when bill input/version changes.",
    vintageSemantics:
      "generated_at is summary creation time; version identifies the summarization contract.",
    rights:
      "Derived text; underlying bill-source rights and attribution remain applicable.",
    deprecation: active,
  },
  bills: {
    definition:
      "Legislative bill records normalized across supported national sources.",
    rowGrain: "One bill in one jurisdiction and legislative source.",
    releaseScope: "atlas_public",
    sourceOrDerivation:
      "Official legislature APIs/pages normalized by country-specific adapters.",
    cadence: "Scheduled source sync, generally daily.",
    vintageSemantics:
      "introduced/updated/status dates describe the bill; last_synced_at is Civica retrieval time.",
    rights:
      "Source-specific government terms; export requires source-level rights resolution.",
    deprecation: active,
  },
  metric_definitions: {
    definition:
      "Definitions and display/interpretation contracts for country metrics.",
    rowGrain: "One metric definition and methodology version.",
    releaseScope: "public_support",
    sourceOrDerivation:
      "Civica-maintained metric registry with declared source and methodology.",
    cadence: "Manual methodology release.",
    vintageSemantics:
      "methodology version governs interpretation; source data vintages live in country_metrics.",
    rights:
      "Definition text is Civica-authored; source rights are linked separately.",
    deprecation: active,
  },
  country_metrics: {
    definition: "Country-level metric observations and derived metric values.",
    rowGrain:
      "One jurisdiction, metric, year, source, and methodology version.",
    releaseScope: "atlas_public",
    sourceOrDerivation:
      "Source observation or versioned Civica derivation linked to metric_definitions and sources.",
    cadence: "Per upstream source release or derivation refresh.",
    vintageSemantics:
      "year is the observation/reference year; fetched_at is retrieval time; methodology_version controls derivation.",
    rights:
      "Resolved per source_id and field class through the rights manifest.",
    deprecation: active,
  },
  ci_methodology_versions: {
    definition: "Named Civica Index methodology-version metadata.",
    rowGrain: "One Index methodology version.",
    releaseScope: "research_beta",
    sourceOrDerivation: "Civica-authored methodology registry.",
    cadence: "On adopted methodology change.",
    vintageSemantics:
      "effective_from/to bound the interpretation period; version is not a source-data vintage.",
    rights: "Civica-authored metadata; input-source rights remain separate.",
    deprecation: active,
  },
  ci_index_releases: {
    definition:
      "Immutable release headers for staged and published Civica Index research outputs.",
    rowGrain: "One exact Index release identity and reproduction contract.",
    releaseScope: "research_beta",
    sourceOrDerivation:
      "Civica-authored header binding methodology content, source artifacts, transforms, uncertainty policy, row counts, and checked row-set hashes.",
    cadence:
      "One staged row per candidate release; publication changes only status and publication time through the guarded publication function.",
    vintageSemantics:
      "quarter names the input reference period, vintage_label names the research artifact, and published_at records Civica publication time; none are interchangeable.",
    rights:
      "Header metadata is Civica-authored; released values remain constrained by every included source artifact's rights.",
    deprecation: active,
  },
  ci_index_release_pointers: {
    definition:
      "Atomic selector for the one complete Civica Index research release exposed by current-release readers.",
    rowGrain: "One product pointer to one validated published Index release.",
    releaseScope: "research_beta",
    sourceOrDerivation:
      "Written only by the database publication function after exact release reproduction and completeness checks.",
    cadence: "Changes only when a verified successor release is published.",
    vintageSemantics:
      "updated_at is pointer-switch time; the referenced release retains its own quarter, vintage, calculation, and publication times.",
    rights:
      "Operational selector metadata is Civica-authored; the selected release retains its source-specific rights contract.",
    deprecation: active,
  },
  ci_source_ingestions: {
    definition: "Run ledger for Civica Index source ingestion.",
    rowGrain:
      "One source ingestion run for one source, year, and methodology context.",
    releaseScope: "research_beta",
    sourceOrDerivation:
      "Generated by Index adapters from source retrieval and run results.",
    cadence: "Per Index source release or manual rebuild.",
    vintageSemantics:
      "data_year/upstream version identify source vintage; started/completed timestamps identify execution.",
    rights: "Source rights follow source_id; run metadata is Civica-authored.",
    deprecation: active,
  },
  ci_ingestion_runs: {
    definition:
      "Atomic multi-source Civica Index staging and publication ledger.",
    rowGrain: "One attempted complete Index source-basket refresh.",
    releaseScope: "internal_operational",
    sourceOrDerivation:
      "Generated by the Index orchestrator from the closed adapter inventory, validation results, and staged checksum.",
    cadence: "Per attempted full Index refresh.",
    vintageSemantics:
      "dataset_year and quarter identify the input period; release_label identifies the run; started/completed timestamps identify execution.",
    rights:
      "Run metadata is Civica-authored; source-data rights remain governed by each adapter source.",
    deprecation: active,
  },
  ci_dimension_scores: {
    definition: "Country scores for individual Civica Index dimensions.",
    rowGrain:
      "One jurisdiction, dimension, data year, and methodology version.",
    releaseScope: "research_beta",
    sourceOrDerivation:
      "Versioned transform of registered Index input observations with source metadata.",
    cadence: "Per named Index rebuild/release.",
    vintageSemantics:
      "data_year describes inputs; calculated_at describes computation; methodology_version controls interpretation.",
    rights:
      "Derived output remains constrained by included source rights and release manifest.",
    deprecation: active,
  },
  indicator_history: {
    definition:
      "Country-year panel of source indicators used for analysis and Index validation.",
    rowGrain: "One jurisdiction, indicator, and observation year.",
    releaseScope: "research_beta",
    sourceOrDerivation:
      "Normalized historical observations from registered Index/conditions publishers.",
    cadence: "Per upstream panel release.",
    vintageSemantics:
      "year is the observation year; source_version and fetched_at identify captured release/retrieval.",
    rights:
      "Resolved per source_id; several research inputs are non-commercial or redistribution-restricted.",
    deprecation: active,
  },
  ci_research_panel_releases: {
    definition:
      "Immutable private release ledger for frozen Civica Index research panels.",
    rowGrain: "One frozen research-panel release.",
    releaseScope: "internal_operational",
    sourceOrDerivation:
      "Generated from the closed indicator-history source registry and explicit country-period grid.",
    cadence:
      "Once per preregistered research-panel release; completed rows are immutable.",
    vintageSemantics:
      "The period bounds describe observations; source_snapshot records retained source-vintage labels and artifact hashes; completion time is Civica publication time.",
    rights:
      "Private internal research only while any included source terms remain pending or restrictive; public artifacts expose metadata and hashes, not values.",
    deprecation: active,
  },
  ci_research_panel_rows: {
    definition:
      "Complete country-year-indicator grid for one frozen private research-panel release.",
    rowGrain:
      "One release, jurisdiction, year, source, and indicator, including explicit missing cells.",
    releaseScope: "internal_operational",
    sourceOrDerivation:
      "Source-native-scale observations from indicator_history plus explicit structural and coverage missingness rows.",
    cadence: "Written during staging and immutable after release completion.",
    vintageSemantics:
      "period_year is observation time; source_vintage and its status disclose the retained capture label; series_type distinguishes current harmonized backcasts from as-published vintages.",
    rights:
      "Exact values remain private and inherit source-specific restrictions; no public bulk panel is implied.",
    deprecation: active,
  },
  ci_composite_scores: {
    definition:
      "Composite Civica Index Beta results and uncertainty summaries.",
    rowGrain: "One jurisdiction, data year, and methodology version.",
    releaseScope: "research_beta",
    sourceOrDerivation:
      "Versioned composite calculation from ci_dimension_scores.",
    cadence: "Per named Index rebuild/release.",
    vintageSemantics:
      "data_year describes inputs; calculated_at is computation time; methodology_version fixes interpretation.",
    rights: "Derived output subject to the combined rights of included inputs.",
    deprecation: active,
  },
  pulse_score_publication_pointers: {
    definition:
      "Atomic selector for the one complete Pulse dimensional score run exposed by the public dimensions reader.",
    rowGrain: "One product pointer to one completed five-dimension score run.",
    releaseScope: "research_beta",
    sourceOrDerivation:
      "Written in the same atomic score batch as immutable history rows and run completion after database completeness checks.",
    cadence: "Changes when a complete successor Pulse score run is published.",
    vintageSemantics:
      "score_as_of is the dimensional observation cut, published_at is pointer-switch time, and the referenced run retains its own execution/version identity.",
    rights:
      "Civica-authored publication metadata; linked event and source context retains publisher-specific rights and display limits.",
    deprecation: active,
  },
  pulse_events: {
    definition: "Legacy Pulse v1 classified governance events.",
    rowGrain: "One legacy classified article/event candidate.",
    releaseScope: "research_beta",
    sourceOrDerivation:
      "Legacy single-event classifier output from article metadata.",
    cadence: "Historical only; no longer the current production contract.",
    vintageSemantics:
      "published_at is article time; created/updated timestamps are pipeline time.",
    rights:
      "Article metadata and excerpts follow publisher terms; model output is experimental.",
    deprecation: legacyPulse("pulse_events_v2"),
  },
  organizations: {
    definition:
      "International and regional organization identities and descriptors.",
    rowGrain: "One organization.",
    releaseScope: "atlas_public",
    sourceOrDerivation:
      "Versioned Civica compilation of exact official organization pages, with Wikidata identifiers retained only where separately known.",
    cadence: "Versioned official-roster compilation and reviewed correction.",
    vintageSemantics:
      "source_retrieved_at dates the official organization page check; upstream_vintage identifies the immutable Civica compilation; founded year remains a separate organization event date.",
    rights:
      "Each identity retains its exact publisher URL and source-specific terms; publisher content is not redistributed.",
    deprecation: active,
  },
  organization_memberships: {
    definition: "Jurisdiction membership intervals in organizations.",
    rowGrain: "One jurisdiction-organization membership.",
    releaseScope: "atlas_public",
    sourceOrDerivation:
      "Versioned compilation of exact official organization membership pages; legacy blanket seeds remain explicitly unverified and are excluded from public reads.",
    cadence: "Versioned roster release and event-driven correction.",
    vintageSemantics:
      "join/end dates describe the relationship interval at their stored precision; source_retrieved_at dates evidence capture; upstream_vintage fixes the compilation; created/updated timestamps describe storage only.",
    rights:
      "Every public relationship retains the exact official source URL and publisher terms; underlying publisher content is not redistributed.",
    deprecation: active,
  },
  civica_conditions_scores: {
    definition:
      "Country-level descriptive Conditions indicators and display positions.",
    rowGrain:
      "One jurisdiction, metric, data year, source, and methodology version.",
    releaseScope: "research_beta",
    sourceOrDerivation:
      "Versioned transform of HDI, GPI, and World Bank economic inputs.",
    cadence: "Per upstream annual/source release.",
    vintageSemantics:
      "data_year is observation/reference year; calculated_at is computation time.",
    rights:
      "Resolved per source_id; derived display positions inherit input restrictions.",
    deprecation: active,
  },
  correction_log: {
    definition:
      "Public correction, clarification, retraction, and supersession records.",
    rowGrain: "One correction action for one affected artifact/record.",
    releaseScope: "public_support",
    sourceOrDerivation:
      "Civica editorial/governance action with before/after and notification metadata.",
    cadence: "Event-driven when a correction decision is recorded.",
    vintageSemantics:
      "created/published timestamps describe correction history; affected_version identifies the corrected release.",
    rights:
      "Civica-authored metadata; quoted or embedded source values retain source rights.",
    deprecation: active,
  },
  advisory_board_members: {
    definition: "Approved advisory-board member profiles and display state.",
    rowGrain: "One advisory-board member profile.",
    releaseScope: "public_support",
    sourceOrDerivation: "Member-supplied and Civica-approved profile metadata.",
    cadence: "Manual approval and profile update.",
    vintageSemantics:
      "created/updated timestamps describe profile administration, not scholarly review dates.",
    rights:
      "Published with member permission; private contact details must not be stored here.",
    deprecation: active,
  },
  advisory_applications: {
    definition: "Private applications to join the advisory board.",
    rowGrain: "One submitted application.",
    releaseScope: "private_submission",
    sourceOrDerivation:
      "Direct applicant submission plus administrative review fields.",
    cadence: "On submission and review action.",
    vintageSemantics:
      "created/updated timestamps describe application workflow.",
    rights:
      "Private personal/application data; excluded from public releases and exports.",
    deprecation: active,
  },
  pulse_pipeline_runs: {
    definition:
      "Immutable version identity and terminal outcome for one Pulse pipeline-stage execution.",
    rowGrain:
      "One ingest, cluster, classification, corroboration, review, or score run.",
    releaseScope: "research_beta",
    sourceOrDerivation:
      "Content-addressed Civica pipeline metadata covering method, ontology, prompt, provider/model, source basket, algorithm, upstream runs, and pipeline version.",
    cadence:
      "One row per attempted stage execution; the version payload is immutable and the status closes once.",
    vintageSemantics:
      "started_at and completed_at are processing clocks; upstream event and source dates remain on linked rows.",
    rights:
      "Civica-generated operational metadata; linked source evidence retains publisher-specific rights.",
    deprecation: active,
  },
  pulse_incidents: {
    definition:
      "Stable real-world Pulse incident identities that survive later reports and retain confirmed merge lineage.",
    rowGrain: "One active or merged real-world incident identity.",
    releaseScope: "research_beta",
    sourceOrDerivation:
      "Versioned normalized report identity, bounded date evidence, and retained incident-resolution decisions over raw Pulse reports.",
    cadence:
      "Created during clustering; updated only by a confirmed, append-only incident-resolution decision.",
    vintageSemantics:
      "event_date_start/end bound source-reported occurrence dates; created_at/updated_at are Civica processing clocks.",
    rights:
      "Civica-generated identity metadata; linked report evidence retains publisher-specific rights restrictions.",
    deprecation: active,
  },
  pulse_incident_assignments: {
    definition:
      "Append-only evidence explaining why one retained Pulse report was assigned to a stable incident.",
    rowGrain: "One assignment of one raw_event to one incident.",
    releaseScope: "research_beta",
    sourceOrDerivation:
      "Versioned semantic, normalized-token, anchor, exact-match, or explicitly scoreless historical-backfill evidence.",
    cadence:
      "Append-only when clustering assigns a newly retained report or the historical backfill is installed.",
    vintageSemantics:
      "assigned_at is the matching decision time; stage_run_id and algorithm_version identify the processing context.",
    rights:
      "Civica-generated matching metadata; referenced report content remains private or rights-filtered.",
    deprecation: active,
  },
  pulse_incident_resolutions: {
    definition:
      "Append-only candidate, confirmation, rejection, and unresolved decisions for possible duplicate Pulse incidents.",
    rowGrain: "One versioned decision about one ordered incident pair.",
    releaseScope: "research_beta",
    sourceOrDerivation:
      "Pre- and post-classification identity signals evaluated under the versioned incident-resolution method.",
    cadence:
      "Append-only whenever collision detection or qualified review issues a new pair decision.",
    vintageSemantics:
      "decided_at is the resolution decision time; created_at is storage time; evidence_refs preserve the evaluated inputs.",
    rights:
      "Civica-generated resolution metadata; referenced report evidence retains publisher-specific restrictions.",
    deprecation: active,
  },
  pulse_cluster_classification_states: {
    definition:
      "Current terminal or retryable classifier state for a Pulse cluster under one content-addressed configuration.",
    rowGrain: "One raw cluster and classifier-configuration pair.",
    releaseScope: "research_beta",
    sourceOrDerivation:
      "Civica classifier orchestration state covering the actual voter, verifier, subject-attribution, prompt, method, gate, and retry configuration.",
    cadence:
      "Claimed and updated once per bounded attempt; terminal states are immutable and every mutation is retained in research history.",
    vintageSemantics:
      "Attempt and retry timestamps are Civica processing clocks; event occurrence time remains on the linked raw and event rows.",
    rights:
      "Civica-generated operational research metadata; sanitized errors exclude credentials and linked publisher evidence retains its own restrictions.",
    deprecation: active,
  },
  pulse_classification_attempts: {
    definition:
      "Append-only start and terminal evidence for each claimed Pulse classifier attempt.",
    rowGrain:
      "One started or completed phase for one cluster, configuration, attempt ordinal, and run.",
    releaseScope: "research_beta",
    sourceOrDerivation:
      "Civica classifier orchestration evidence with run lineage, model-call count, sanitized error, and retry outcome.",
    cadence: "Append-only when an attempt is claimed and when it settles.",
    vintageSemantics:
      "started_at/completed_at record processing; next_retry_at is the scheduled eligibility boundary and carries no event-time meaning.",
    rights:
      "Civica-generated metadata; no credentials or publisher payloads may be stored in error or metadata fields.",
    deprecation: active,
  },
  raw_events: {
    definition:
      "Deduplicated raw Pulse v2 inputs plus retained terminal classification dispositions.",
    rowGrain: "One fetched publisher item or deduplicated article candidate.",
    releaseScope: "research_beta",
    sourceOrDerivation:
      "Pulse source connector payload sealed with exact URL, content and identity hashes, language state, publisher/source family, jurisdiction-attribution evidence, and captured rights metadata.",
    cadence:
      "Daily scheduled ingestion followed by retained classification/review disposition.",
    vintageSemantics:
      "event_date is publisher/event time; retrieved_at is Civica retrieval; classified_at is the decision time.",
    rights:
      "Publisher-specific. Payloads are private research evidence; public redistribution is blocked at capture even when access is free, and any later release requires a separate source-rights decision.",
    deprecation: active,
  },
  pulse_events_v2: {
    definition:
      "Pulse v2 clustered, classified, verified governance-event ledger.",
    rowGrain: "One deduplicated event cluster about one subject jurisdiction.",
    releaseScope: "research_beta",
    sourceOrDerivation:
      "Multi-provider classification, verification, subject attribution, and human review over raw_events.",
    cadence: "Daily pipeline with subsequent review/correction.",
    vintageSemantics:
      "event/published times come from sources; pipeline timestamps and model versions describe processing.",
    rights:
      "Evidence rows inherit publisher rights; classifications are experimental Civica derivations.",
    deprecation: active,
  },
  pulse_event_absorptions: {
    definition:
      "Append-only decisions about whether one explicitly linked Pulse event is already represented in a later comparable fixed-scale Index observation.",
    rowGrain:
      "One event, prior/current Index release pair, link method, and absorption outcome under pulse-event-absorption/v1.",
    releaseScope: "research_beta",
    sourceOrDerivation:
      "Civica assessment of a confirmed event-level link against exact closed-release dimension scores, scale identity, direction, and threshold rules.",
    cadence:
      "Only when a later closed Index release and a reviewed explicit event link are available; the current registry produces no rows.",
    vintageSemantics:
      "as_of is the Index comparison date; decided_at is the decision time; a reversal appends a row through supersedes_absorption_key.",
    rights:
      "Civica-generated research metadata; referenced event and source evidence retain their original rights restrictions.",
    deprecation: active,
  },
  pulse_information_environment_releases: {
    definition:
      "Immutable metadata for one exact official information-environment dataset capture adopted for classification-time context.",
    rowGrain: "One source release and content hash.",
    releaseScope: "internal_operational",
    sourceOrDerivation:
      "Publisher release metadata verified against the captured input SHA-256; raw publisher rows are not redistributed.",
    cadence: "Append-only when a new official release is reviewed and adopted.",
    vintageSemantics:
      "observation_year is the assessed period, retrieved_at is capture time, and adopted_at is the earliest classification time eligible to pin the release.",
    rights:
      "Release-level metadata is retained; publisher values remain internal while redistribution rights are pending.",
    deprecation: active,
  },
  pulse_information_environment_values: {
    definition:
      "Complete observed-or-explicit-missing jurisdiction coverage for one immutable information-environment release.",
    rowGrain: "One release and one supported jurisdiction.",
    releaseScope: "internal_operational",
    sourceOrDerivation:
      "Exact ISO3 match to the official release, or an explicit missing row when no match exists; no midpoint or other imputation is allowed.",
    cadence: "Append-only with its release.",
    vintageSemantics:
      "Inherits the release observation year, capture time, content hash, and adoption time.",
    rights:
      "Restricted publisher values are internal and excluded from public bulk export; missingness metadata is Civica-generated.",
    deprecation: active,
  },
  pulse_event_information_environment_pins: {
    definition:
      "Immutable snapshot of the exact information-environment value or missing state available when a Pulse event was classified.",
    rowGrain: "One Pulse event projection and classification run.",
    releaseScope: "research_beta",
    sourceOrDerivation:
      "Database-triggered copy of the then-adopted release row; historical events without a contemporaneous pin remain explicitly unrecoverable.",
    cadence: "Exactly once at event insertion.",
    vintageSemantics:
      "classified_at matches event creation; source release, observation year, retrieval time, and content hash never change on rerun.",
    rights:
      "Public products expose only permitted context metadata; restricted values remain internal and source rights continue to apply.",
    deprecation: active,
  },
  pulse_event_decisions: {
    definition:
      "Append-only, axis-specific Pulse decisions and refutations underlying the current event projection.",
    rowGrain:
      "One event-existence, subject-attribution, category, severity, corroboration, or publication judgment by one actor at one stage run.",
    releaseScope: "research_beta",
    sourceOrDerivation:
      "Versioned classifier, verifier, subject-attribution, corroboration, publication-gate, or human-review output over retained Pulse evidence; legacy projections are explicitly marked unresolved where independent history cannot be reconstructed.",
    cadence: "Append-only at classification, corroboration, and review time.",
    vintageSemantics:
      "decided_at is the judgment time; created_at is storage time; supersedes_decision_key replaces only the same decision axis.",
    rights:
      "Civica-generated research metadata; evidence references retain their publisher-specific rights restrictions.",
    deprecation: active,
  },
  pulse_candidate_outcomes: {
    definition:
      "Append-only negative-evidence ledger for Pulse candidates excluded by ingestion, classification, verification, or human review.",
    rowGrain:
      "One duplicate, non-event, insufficient-evidence, invalid, refuted, or rejected outcome for one candidate at one pipeline stage.",
    releaseScope: "research_beta",
    sourceOrDerivation:
      "Direct ingestion deduplication outcomes and database-trigger projections of versioned Pulse decisions, with retained legacy projections where the underlying evidence still exists.",
    cadence:
      "Append-only whenever a candidate is excluded or a decision axis is refuted.",
    vintageSemantics:
      "occurred_at is the exclusion or decision time; created_at is storage time; method_version and stage_run_id identify the processing context.",
    rights:
      "Civica-generated evaluation metadata; referenced source evidence remains private or rights-filtered under its publisher-specific terms.",
    deprecation: active,
  },
  pulse_event_jurisdictions: {
    definition:
      "Append-only, queryable primary and affected jurisdiction roles derived from versioned subject-attribution decisions.",
    rowGrain:
      "One jurisdiction role in one Pulse subject-attribution decision.",
    releaseScope: "research_beta",
    sourceOrDerivation:
      "Database-trigger projection of the typed subject-attribution decision payload, with a frozen entity snapshot, rationale, evidence references, and catalog/alias versions; retained rows use an explicit legacy projection identity.",
    cadence: "Append-only when a subject-attribution decision is stored.",
    vintageSemantics:
      "created_at is projection storage time; decision_key points to the authoritative decision and its decided_at time.",
    rights:
      "Civica-generated attribution metadata; referenced source evidence retains publisher-specific restrictions.",
    deprecation: active,
  },
  pulse_coding_studies: {
    definition:
      "Version-pinned independent-coding studies kept separate from production Pulse review and scoring.",
    rowGrain:
      "One coding study over one frozen packet set and method contract.",
    releaseScope: "internal_operational",
    sourceOrDerivation:
      "Created by an authorized study administrator from a label-blind packet manifest.",
    cadence: "On study setup, closure, or explicit new-version creation.",
    vintageSemantics:
      "created_at is setup time; dataset, packet-set, protocol, codebook, and ontology versions remain pinned for the study lifetime.",
    rights:
      "Civica-generated study metadata; packet evidence retains source-specific restrictions.",
    deprecation: active,
  },
  pulse_coding_packets: {
    definition:
      "Immutable country-day evidence snapshots assigned for blinded independent coding.",
    rowGrain: "One frozen packet in one coding study.",
    releaseScope: "internal_operational",
    sourceOrDerivation:
      "Generated from the preregistered evaluation sample and rights-safe evidence/search traces without labels or model output.",
    cadence: "Append-only during study setup.",
    vintageSemantics:
      "imported_at is storage time; packet_snapshot_sha256 fixes the exact evidence and method context shown to coders.",
    rights:
      "Internal research packet; each evidence item retains publisher and source-manifest restrictions.",
    deprecation: active,
  },
  pulse_coding_participants: {
    definition:
      "Pseudonymous role-bearing participants with hashed, revocable coding-workspace credentials.",
    rowGrain:
      "One coder, adjudicator, or study administrator identity in one study.",
    releaseScope: "internal_operational",
    sourceOrDerivation:
      "Issued by the study administrator; random access codes are stored only as SHA-256 hashes.",
    cadence: "On invitation, access, expiry, or revocation.",
    vintageSemantics:
      "created_at, last_access_at, expires_at, and revoked_at describe access lifecycle rather than research-event time.",
    rights:
      "Private access-control metadata; never part of a public research release.",
    deprecation: active,
  },
  pulse_coding_assignments: {
    definition:
      "Role-scoped packet assignments containing editable drafts and immutable locked raw coder submissions.",
    rowGrain: "One participant slot on one frozen packet.",
    releaseScope: "internal_operational",
    sourceOrDerivation:
      "Assigned by study administration; coder responses use the pinned independent-coding contract and runtime validators.",
    cadence: "Assigned once, optionally draft-saved, then locked once.",
    vintageSemantics:
      "assigned_at, draft_updated_at, and locked_at are workflow times; the embedded submission pins packet and method versions.",
    rights:
      "Civica-generated annotation plus restricted packet evidence references; raw submissions remain immutable.",
    deprecation: active,
  },
  pulse_coding_comparisons: {
    definition:
      "Immutable axis-by-axis comparisons generated only after both independent coder submissions lock.",
    rowGrain: "One two-coder comparison for one packet.",
    releaseScope: "internal_operational",
    sourceOrDerivation:
      "Deterministically recomputed from two locked raw submissions using comparePulseCoderSubmissions.",
    cadence:
      "Once when the second coder locks, with idempotent repair after interruption.",
    vintageSemantics:
      "generated_at is comparison time; comparison_sha256 binds both raw submission hashes.",
    rights:
      "Civica-generated research metadata; underlying evidence restrictions remain applicable.",
    deprecation: active,
  },
  pulse_coding_adjudications: {
    definition:
      "Separate terminal adjudication records that preserve rather than overwrite both raw coder submissions.",
    rowGrain:
      "One resolved or explicitly unresolved adjudication for one comparison.",
    releaseScope: "internal_operational",
    sourceOrDerivation:
      "Recorded by the independently assigned adjudicator with canonical reason codes, rationale, and evidence-grounded resolution.",
    cadence:
      "Once after both coder submissions lock; terminal rows are immutable.",
    vintageSemantics:
      "created_at is record creation and resolved_at is the terminal decision time under the pinned comparison.",
    rights:
      "Civica-generated adjudication metadata; selected or new annotations inherit packet evidence restrictions.",
    deprecation: active,
  },
  pulse_coding_audit_log: {
    definition:
      "Append-only access and state-transition history for independent coding studies.",
    rowGrain:
      "One access, assignment, save, lock, comparison, adjudication, export, or revocation action.",
    releaseScope: "internal_operational",
    sourceOrDerivation:
      "Generated by role-gated coding services and database-enforced workflow transitions.",
    cadence: "Append-only for every meaningful coding-workspace action.",
    vintageSemantics:
      "created_at is action time; before and after hashes identify affected immutable state without copying credentials.",
    rights:
      "Private operational audit metadata; exports omit credential hashes.",
    deprecation: active,
  },
  pulse_sources: {
    definition:
      "Evidence-source links between Pulse v2 events and raw publisher items.",
    rowGrain: "One raw source item linked to one Pulse v2 event cluster.",
    releaseScope: "research_beta",
    sourceOrDerivation:
      "Deterministic/heuristic cluster membership and corroboration metadata.",
    cadence: "During daily clustering and corroboration.",
    vintageSemantics:
      "Inherits raw item publication/ingestion time and event pipeline version.",
    rights: "Inherits the linked raw item's publisher terms.",
    deprecation: active,
  },
  pulse_dimensional_deltas: {
    definition:
      "Current experimental Pulse effect for one jurisdiction and Civica Index dimension.",
    rowGrain:
      "One current-state row per jurisdiction and Civica Index dimension.",
    releaseScope: "research_beta",
    sourceOrDerivation:
      "Versioned experimental scoring from verified Pulse v2 event classifications.",
    cadence: "Daily after classification/corroboration and on rescore.",
    vintageSemantics:
      "score_as_of and window_start bound the trailing 365-day lookback; computation_run_id and derivation_version_key fix the scoring interpretation.",
    rights:
      "Civica-derived experimental metadata; linked evidence restrictions remain applicable.",
    deprecation: active,
  },
  pulse_dimensional_delta_history: {
    definition:
      "Immutable, versioned history of every computed Pulse dimensional output, including zero-output clearing rows.",
    rowGrain:
      "One score run, jurisdiction, and Civica Index dimension under pulse-dimensional-delta-history/v1.",
    releaseScope: "research_beta",
    sourceOrDerivation:
      "Copied atomically from each versioned Pulse score computation with its contributing event IDs and derivation envelope.",
    cadence:
      "Append-only on every score run; existing current-state rows were copied at the PUL-035 migration boundary.",
    vintageSemantics:
      "score_as_of and window_start bound the trailing 365-day lookback; created_at records the original computation time for migrated rows and insertion time thereafter.",
    rights:
      "Civica-derived experimental metadata; linked evidence restrictions remain applicable.",
    deprecation: active,
  },
  pulse_review_audit_log: {
    definition: "Append-only history of Pulse review and status changes.",
    rowGrain: "One review action on one Pulse v2 event.",
    releaseScope: "internal_operational",
    sourceOrDerivation:
      "Generated from automated or human review actions with before/after state.",
    cadence: "Event-driven on review action.",
    vintageSemantics:
      "created_at is review-action time; payloads preserve the state at that time.",
    rights:
      "Internal review metadata; embedded source evidence retains publisher rights.",
    deprecation: active,
  },
  pulse_review_obligations: {
    definition:
      "Current operational human-review obligation under a versioned Pulse service-level contract.",
    rowGrain: "One Pulse event and review-SLA version.",
    releaseScope: "internal_operational",
    sourceOrDerivation:
      "Created by the database queue trigger from an unpublished current event; pre-contract rows are explicitly legacy quarantined.",
    cadence:
      "Created at queue entry and retained through claim or terminal disposition transitions.",
    vintageSemantics:
      "queued_at starts the operating clock; escalate_at and due_at are frozen from the SLA version and priority at entry.",
    rights:
      "Civica-generated operational metadata; linked event evidence retains publisher restrictions.",
    deprecation: active,
  },
  pulse_review_sla_events: {
    definition:
      "Append-only operational events for Pulse queue entry, escalation, bounded exceptions, disposition, and legacy quarantine.",
    rowGrain: "One content-addressed SLA event on one review obligation.",
    releaseScope: "internal_operational",
    sourceOrDerivation:
      "Generated by database queue transitions, authenticated reviewers, migration boundaries, and the scheduled SLA monitor.",
    cadence: "Append-only when a review obligation changes operational state.",
    vintageSemantics:
      "effective_at records the operational event time; exception expiry is prospective and never erases an earlier breach.",
    rights:
      "Internal operational metadata; explanatory notes must not copy restricted publisher evidence.",
    deprecation: active,
  },
  backtest_cases: {
    definition: "Versioned Pulse classifier evaluation cases.",
    rowGrain: "One labeled evaluation case.",
    releaseScope: "internal_operational",
    sourceOrDerivation:
      "Curated evaluation input and expected label/subject metadata.",
    cadence: "Manual evaluation-set curation.",
    vintageSemantics:
      "created_at is curation time; dataset version must be recorded by the consuming run.",
    rights:
      "Case text/evidence may inherit publisher restrictions and is not automatically releasable.",
    deprecation: active,
  },
  backtest_events: {
    definition: "Expected event annotations attached to Pulse backtest cases.",
    rowGrain: "One expected event annotation in one backtest case.",
    releaseScope: "internal_operational",
    sourceOrDerivation: "Curated labels and adjudication notes for evaluation.",
    cadence: "Manual evaluation-set curation.",
    vintageSemantics:
      "created_at is annotation time; interpretation follows the codebook used by the run.",
    rights:
      "Civica annotation metadata; embedded source material retains publisher restrictions.",
    deprecation: active,
  },
  backtest_runs: {
    definition: "Execution and result summaries for Pulse backtests.",
    rowGrain: "One evaluation run for one method/dataset configuration.",
    releaseScope: "internal_operational",
    sourceOrDerivation: "Generated by the Pulse evaluation runner.",
    cadence: "On demand for a model/method change.",
    vintageSemantics:
      "started/completed timestamps are execution time; configuration identifies model and dataset versions.",
    rights:
      "Civica-generated metrics; evaluation inputs remain separately governed.",
    deprecation: active,
  },
  pulse_corrections: {
    definition: "Corrections and supersessions applied to Pulse v2 events.",
    rowGrain: "One correction action for one Pulse event.",
    releaseScope: "public_support",
    sourceOrDerivation:
      "Human/editorial correction decision with previous and corrected values.",
    cadence: "Event-driven after review or reported error.",
    vintageSemantics:
      "created/published timestamps describe correction history; event version identifies affected interpretation.",
    rights:
      "Civica-authored correction metadata; linked evidence retains source restrictions.",
    deprecation: active,
  },
  admin_session_revocations: {
    definition:
      "Durable hashed tombstones that invalidate signed owner-admin sessions after logout.",
    rowGrain: "One revoked signed admin session.",
    releaseScope: "internal_operational",
    sourceOrDerivation:
      "Generated only by the shared admin logout boundary from a domain-separated hash of the signed random session ID.",
    cadence: "Append-only on authenticated logout.",
    vintageSemantics:
      "issued_at and expires_at reproduce the signed lifetime; revoked_at is the server-side invalidation time.",
    rights:
      "Private security metadata; raw session IDs and cookies are never stored or released.",
    deprecation: active,
  },
  admin_mutation_audit_log: {
    definition:
      "Append-only common security audit events for owner-admin authentication and mutations.",
    rowGrain: "One attempted or terminal admin request event.",
    releaseScope: "internal_operational",
    sourceOrDerivation:
      "Generated by shared admin auth/mutation boundaries from bounded route, actor, action, target, status, and result context.",
    cadence: "Append-only before and after authenticated mutations.",
    vintageSemantics:
      "created_at is the audit-event time; request_id correlates an attempt with its terminal outcome.",
    rights:
      "Private operational security evidence; request bodies, credentials, raw session IDs, IP addresses, and unbounded errors are excluded.",
    deprecation: active,
  },
  cron_job_executions: {
    definition:
      "Durable delivery-identity and terminal-outcome ledger for authenticated cron jobs.",
    rowGrain:
      "One logical scheduled or manual delivery for one registered cron job.",
    releaseScope: "internal_operational",
    sourceOrDerivation:
      "Generated by the shared cron boundary from the registered job and route, hashed request identity, schedule or hashed manual scope, retry counters, and terminal HTTP outcome; request bodies, credentials, raw idempotency keys, payloads, and error text are excluded.",
    cadence:
      "Created on first acquisition, advanced on a bounded retry, and finalized on success or failure; execution evidence is retained and cannot be deleted or truncated.",
    vintageSemantics:
      "schedule_slot is the logical scheduled-delivery time; first_started_at, last_started_at, completed_at, and updated_at describe the delivery lifecycle rather than source-data vintage.",
    rights:
      "Private internal operational evidence; excluded from public release and not a source-data rights grant.",
    deprecation: active,
  },
  pulse_classification_delivery_bindings: {
    definition:
      "Immutable handoff from one authenticated cron delivery to the Pulse classification run that owns its work.",
    rowGrain:
      "One logical cron delivery bound to exactly one Pulse classify run; multiple later deliveries may adopt the same still-running classify run.",
    releaseScope: "internal_operational",
    sourceOrDerivation:
      "Created by the Pulse classifier from the authenticated cron execution key and the exact existing, adopted, or newly started classify run; no request payload, credential, model content, or error text is retained.",
    cadence:
      "Inserted once before a delivery resumes or adopts classify work and retained without update, deletion, or truncation.",
    vintageSemantics:
      "created_at is the durable handoff time; the linked pipeline run retains its own processing clocks and frozen input identity.",
    rights:
      "Private internal coordination evidence; excluded from public release and not a source-data rights grant.",
    deprecation: active,
  },
  cron_job_leases: {
    definition:
      "Persistent job-wide mutex and monotonic fencing state for cron delivery control.",
    rowGrain: "One persistent lease state for one registered cron job.",
    releaseScope: "internal_operational",
    sourceOrDerivation:
      "Maintained by the database cron acquisition and finalization functions from opaque lease/attempt identifiers, hashed execution identity, expiry, and a monotonic fence; no request payload or credential is stored.",
    cadence:
      "Updated on acquisition, expiry takeover, and release; idle rows clear holder fields but are never deleted or truncated because resetting the fence could let a stale runner finalize newer work.",
    vintageSemantics:
      "lease_expires_at is the active lease deadline and updated_at is transition time; lease_fence is monotonic concurrency state, not a source-data vintage.",
    rights:
      "Private internal coordination metadata; excluded from public release.",
    deprecation: active,
  },
  cron_job_attempts: {
    definition:
      "Retained attempt-level execution evidence for authenticated cron deliveries, including expired attempts.",
    rowGrain: "One bounded attempt for one logical cron-job delivery.",
    releaseScope: "internal_operational",
    sourceOrDerivation:
      "Generated by the database cron acquisition and finalization functions from the execution identity, attempt ordinal, fence, lifecycle status, bounded result code, and HTTP status; request bodies, credentials, payloads, and error text are excluded.",
    cadence:
      "Created on lease acquisition and closed once as succeeded, failed, or expired; attempt evidence is retained and cannot be deleted or truncated.",
    vintageSemantics:
      "started_at and completed_at describe attempt execution; ordinal and fence preserve retry and takeover order rather than source-data vintage.",
    rights:
      "Private internal operational evidence; excluded from public release and contains no reusable source payload.",
    deprecation: active,
  },
  rate_limits: {
    definition:
      "Shared fixed-window request counters used for fail-closed rate-limit enforcement across application instances.",
    rowGrain:
      "One policy scope, opaque HMAC subject digest, and database-derived window start encoded together in the primary key.",
    releaseScope: "internal_operational",
    sourceOrDerivation:
      "Generated from protected request traffic after the trusted request identity is converted to an opaque HMAC digest; the database clock derives the window and expiry, so no raw request identity is stored.",
    cadence:
      "Each protected request atomically removes expired rows through the expires_at index and increments its current window, with the count saturated at the policy limit plus one.",
    vintageSemantics:
      "The database-derived window start is encoded in key and expires_at records its end; neither field represents source-data vintage.",
    rights:
      "Internal security/operations data containing no raw request identity; excluded from public release.",
    deprecation: active,
  },
};
