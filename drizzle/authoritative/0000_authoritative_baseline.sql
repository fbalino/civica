-- Civica authoritative baseline. Generated; do not hand-edit.
-- Empty databases only. Existing production adopts only after exact fingerprint verification.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

--
-- PostgreSQL database dump
--


-- Generated from the reviewed production-shaped PostgreSQL 17 public schema.

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


--
-- Name: civica_capture_research_evidence_history(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.civica_capture_research_evidence_history() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  before_row jsonb := to_jsonb(OLD);
  after_row jsonb := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(NEW) ELSE NULL END;
  evidence_id text;
  evidence_actor text;
  evidence_reason text;
BEGIN
  evidence_id := COALESCE(after_row->>'id', before_row->>'id', md5(before_row::text));
  evidence_actor := COALESCE(
    NULLIF(after_row->>'reviewer_id', ''),
    NULLIF(after_row->>'actor_id', ''),
    NULLIF(before_row->>'reviewer_id', ''),
    current_user
  );
  evidence_reason := COALESCE(
    NULLIF(after_row->>'status_reason', ''),
    NULLIF(after_row->>'review_notes', ''),
    NULLIF(after_row->>'disposition', ''),
    NULLIF(after_row->>'classification_reason', ''),
    NULLIF(before_row->>'status_reason', ''),
    lower(TG_OP) || '_retained_by_dat_016'
  );

  INSERT INTO research_evidence_history (
    entity_table, entity_id, operation, before, after, reason, actor_id
  ) VALUES (
    TG_TABLE_NAME, evidence_id, lower(TG_OP), before_row, after_row,
    evidence_reason, evidence_actor
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;


--
-- Name: civica_reject_frozen_vintage_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.civica_reject_frozen_vintage_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_TABLE_NAME = 'country_fact_vintages' OR OLD.vintage_label IS NOT NULL THEN
    RAISE EXCEPTION 'frozen vintage % is immutable; publish a new superseding version', OLD.vintage_label;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;


--
-- Name: civica_reject_research_evidence_history_mutation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.civica_reject_research_evidence_history_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  RAISE EXCEPTION 'research_evidence_history is append-only';
END;
$$;


--
-- Name: civica_validate_frozen_vintage_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.civica_validate_frozen_vintage_insert() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
  parsed text[];
  published_period text;
  prior_label text;
BEGIN
  IF TG_TABLE_NAME = 'country_fact_vintages' THEN
    parsed := regexp_match(NEW.vintage_label, '^Civica Atlas Reconciled (v[^[:space:]]+) — vintage ([0-9]{4}-Q[1-4])$');
    IF parsed IS NULL OR NEW.methodology_version <> parsed[1] THEN
      RAISE EXCEPTION 'Atlas vintage label and methodology_version disagree';
    END IF;
    published_period := parsed[2];
    SELECT vintage_label INTO prior_label FROM country_fact_vintages
      WHERE vintage_label <> NEW.vintage_label
        AND vintage_label LIKE '%vintage ' || published_period LIMIT 1;
    IF prior_label IS NOT NULL AND NEW.supersedes_vintage_label IS NULL THEN
      RAISE EXCEPTION 'corrected Atlas vintage must name supersedes_vintage_label';
    END IF;
  ELSE
    IF NEW.vintage_label IS NULL THEN RETURN NEW; END IF;
    parsed := regexp_match(NEW.vintage_label, '^Civica Index ([0-9]{4}) Q([1-4]) \(([^)]+)\)$');
    IF parsed IS NULL OR NEW.quarter <> parsed[1] || '-Q' || parsed[2]
       OR lower(NEW.methodology_version) <> lower(parsed[3]) THEN
      RAISE EXCEPTION 'Civica Index vintage label, quarter, and methodology_version disagree';
    END IF;
    SELECT vintage_label INTO prior_label FROM ci_composite_scores
      WHERE quarter = NEW.quarter AND vintage_label IS NOT NULL
        AND vintage_label <> NEW.vintage_label LIMIT 1;
    IF prior_label IS NOT NULL AND NEW.supersedes_vintage_label IS NULL THEN
      RAISE EXCEPTION 'corrected Civica Index vintage must name supersedes_vintage_label';
    END IF;
  END IF;

  IF NEW.supersedes_vintage_label IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM (
      SELECT vintage_label FROM country_fact_vintages WHERE TG_TABLE_NAME = 'country_fact_vintages'
      UNION ALL
      SELECT vintage_label FROM ci_composite_scores WHERE TG_TABLE_NAME = 'ci_composite_scores'
    ) prior WHERE prior.vintage_label = NEW.supersedes_vintage_label
  ) THEN
    RAISE EXCEPTION 'supersedes_vintage_label does not identify an existing frozen vintage';
  END IF;
  RETURN NEW;
END;
$_$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: advisory_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.advisory_applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    institution text NOT NULL,
    role text NOT NULL,
    expertise_area text NOT NULL,
    experience text NOT NULL,
    links text,
    cv_url text,
    ip_address text,
    status text DEFAULT 'new'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: advisory_board_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.advisory_board_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    affiliation text NOT NULL,
    expertise text NOT NULL,
    bio_md text,
    photo_url text,
    display_order integer DEFAULT 100 NOT NULL,
    joined_at date DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: backtest_cases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backtest_cases (
    id text NOT NULL,
    country_name text NOT NULL,
    country_iso3 text,
    event_date date NOT NULL,
    description text NOT NULL,
    expected jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: backtest_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backtest_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    case_id text NOT NULL,
    event_date date NOT NULL,
    source_id text NOT NULL,
    source_type text NOT NULL,
    title text NOT NULL,
    body text,
    hint_category text,
    hint_dimension text,
    hint_severity_tier text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: backtest_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backtest_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    case_id text NOT NULL,
    ran_at timestamp without time zone DEFAULT now() NOT NULL,
    param_snapshot jsonb NOT NULL,
    trajectory jsonb NOT NULL,
    verdict text NOT NULL,
    detail jsonb NOT NULL
);


--
-- Name: bill_summary_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bill_summary_cache (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cache_key text NOT NULL,
    summary text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: bills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bills (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    jurisdiction_id uuid NOT NULL,
    body_id uuid,
    source_id text NOT NULL,
    external_id text NOT NULL,
    title text NOT NULL,
    long_title text,
    summary text,
    stage integer DEFAULT 0 NOT NULL,
    raw_status text,
    introduced_date date,
    last_action_date date NOT NULL,
    last_action_text text,
    sponsor_name text,
    sponsor_party text,
    url text NOT NULL,
    text_url text,
    vote_yes integer,
    vote_no integer,
    vote_abstain integer,
    raw jsonb,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: ci_composite_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ci_composite_scores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    jurisdiction_id uuid NOT NULL,
    quarter text NOT NULL,
    score real NOT NULL,
    rank integer,
    total_ranked integer,
    is_partial boolean DEFAULT false NOT NULL,
    dimensions_available integer DEFAULT 6 NOT NULL,
    missing_dimensions text[],
    methodology_version text NOT NULL,
    calculated_at timestamp without time zone DEFAULT now() NOT NULL,
    score_lower real,
    score_upper real,
    band text,
    completeness_flag text,
    vintage_label text,
    derivation_version_key text NOT NULL,
    derivation_versions jsonb NOT NULL,
    supersedes_vintage_label text,
    content_hash text
);


--
-- Name: ci_dimension_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ci_dimension_scores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    jurisdiction_id uuid NOT NULL,
    dimension text NOT NULL,
    quarter text NOT NULL,
    normalized_score real NOT NULL,
    raw_value real,
    source_id text NOT NULL,
    ingestion_id uuid,
    methodology_version text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    derivation_version_key text NOT NULL,
    derivation_versions jsonb NOT NULL
);


--
-- Name: ci_methodology_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ci_methodology_versions (
    id text NOT NULL,
    published_at timestamp without time zone NOT NULL,
    weights jsonb NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: ci_source_ingestions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ci_source_ingestions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_id text NOT NULL,
    dimension text NOT NULL,
    dataset_year integer NOT NULL,
    native_scale_min real NOT NULL,
    native_scale_max real NOT NULL,
    is_inverted boolean DEFAULT false NOT NULL,
    global_min_observed real,
    global_max_observed real,
    countries_covered integer,
    ingested_at timestamp without time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'completed'::text NOT NULL,
    error_message text
);


--
-- Name: civica_conditions_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.civica_conditions_scores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    jurisdiction_id uuid NOT NULL,
    dimension text NOT NULL,
    quarter text NOT NULL,
    normalized_score real NOT NULL,
    raw_value real,
    source_id text NOT NULL,
    dataset_year integer NOT NULL,
    methodology_version text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: constitution_topic_excerpts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.constitution_topic_excerpts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    jurisdiction_id uuid NOT NULL,
    constitution_id uuid NOT NULL,
    topic_key text NOT NULL,
    topic_label text NOT NULL,
    section_id text,
    excerpt_html text NOT NULL,
    article_label text
);


--
-- Name: constitutions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.constitutions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    jurisdiction_id uuid NOT NULL,
    constitute_project_id text,
    year integer,
    year_updated integer,
    full_text_html text,
    last_fetched timestamp without time zone,
    structured_articles jsonb
);


--
-- Name: contact_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    subject text NOT NULL,
    message text NOT NULL,
    ip_address text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'new'::text NOT NULL
);


--
-- Name: correction_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.correction_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    submitted_at timestamp without time zone DEFAULT now() NOT NULL,
    country_id uuid,
    category text NOT NULL,
    dimension text,
    submitter_name text,
    submitter_email text,
    submitter_affiliation text,
    description text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    disposition text,
    resolved_at timestamp without time zone,
    is_public boolean DEFAULT true NOT NULL,
    internal_notes text
);


--
-- Name: country_fact_vintages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.country_fact_vintages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    jurisdiction_id uuid NOT NULL,
    fact_key text NOT NULL,
    vintage_label text NOT NULL,
    canonical_fact_id uuid NOT NULL,
    value_text text,
    value_numeric real,
    value_unit text,
    value_json jsonb,
    as_of date,
    source_id text NOT NULL,
    methodology_version text NOT NULL,
    snapshot_at timestamp without time zone DEFAULT now() NOT NULL,
    cut_at_timestamp timestamp without time zone,
    content_hash text,
    is_disputed_at_cut boolean,
    derivation_version_key text NOT NULL,
    derivation_versions jsonb NOT NULL,
    supersedes_vintage_label text,
    observation_reference_year integer,
    upstream_dataset_release text,
    source_retrieved_at timestamp without time zone,
    civica_publication_version text,
    CONSTRAINT country_fact_vintages_publication_matches_label CHECK ((civica_publication_version = vintage_label))
);


--
-- Name: country_factbook_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.country_factbook_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    jurisdiction_id uuid NOT NULL,
    section_name text NOT NULL,
    section_data jsonb NOT NULL,
    display_order integer,
    import_phase integer DEFAULT 1,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: country_facts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.country_facts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    jurisdiction_id uuid NOT NULL,
    category text NOT NULL,
    fact_key text NOT NULL,
    fact_value text,
    fact_value_numeric real,
    fact_unit text,
    fact_year integer,
    source_note text,
    created_at timestamp without time zone DEFAULT now(),
    fact_group text DEFAULT 'B'::text NOT NULL,
    source_id text DEFAULT 'cia_factbook'::text NOT NULL,
    source_url text,
    wikidata_qid text,
    wikidata_pid text,
    wikidata_rank text,
    "references" jsonb,
    source_hash text,
    value_json jsonb,
    as_of date,
    retrieved_at timestamp without time zone DEFAULT now() NOT NULL,
    upstream_vintage_label text,
    methodology_version text DEFAULT 'v0.2-beta'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    status_reason text,
    snapshot_id uuid,
    updated_at timestamp without time zone DEFAULT now(),
    value_type text DEFAULT 'measured'::text NOT NULL,
    data_vintage_year integer,
    growth_methodology text,
    value_status text DEFAULT 'observed'::text NOT NULL,
    value_status_reason text,
    CONSTRAINT country_facts_value_status_allowed CHECK ((value_status = ANY (ARRAY['observed'::text, 'missing'::text, 'unknown'::text, 'not_applicable'::text, 'not_observed'::text, 'disputed'::text, 'withheld'::text]))),
    CONSTRAINT country_facts_value_status_reason CHECK ((((value_status = 'observed'::text) AND (value_status_reason IS NULL)) OR ((value_status <> 'observed'::text) AND (length(btrim(value_status_reason)) > 0)))),
    CONSTRAINT country_facts_value_status_shape CHECK ((((value_status = ANY (ARRAY['observed'::text, 'disputed'::text])) AND ((fact_value IS NOT NULL) OR (fact_value_numeric IS NOT NULL) OR (value_json IS NOT NULL))) OR ((value_status = ANY (ARRAY['missing'::text, 'unknown'::text, 'not_applicable'::text, 'not_observed'::text, 'withheld'::text])) AND (fact_value IS NULL) AND (fact_value_numeric IS NULL) AND (value_json IS NULL))))
);


--
-- Name: country_metrics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.country_metrics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    jurisdiction_id uuid NOT NULL,
    metric_id text NOT NULL,
    year integer NOT NULL,
    value real,
    rank integer,
    total_ranked integer,
    source_id text NOT NULL,
    source_url text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    value_status text DEFAULT 'observed'::text NOT NULL,
    value_status_reason text,
    CONSTRAINT country_metrics_value_status_allowed CHECK ((value_status = ANY (ARRAY['observed'::text, 'missing'::text, 'unknown'::text, 'not_applicable'::text, 'not_observed'::text, 'disputed'::text, 'withheld'::text]))),
    CONSTRAINT country_metrics_value_status_reason CHECK ((((value_status = 'observed'::text) AND (value_status_reason IS NULL)) OR ((value_status <> 'observed'::text) AND (length(btrim(value_status_reason)) > 0)))),
    CONSTRAINT country_metrics_value_status_shape CHECK ((((value_status = ANY (ARRAY['observed'::text, 'disputed'::text])) AND (value IS NOT NULL)) OR ((value_status = ANY (ARRAY['missing'::text, 'unknown'::text, 'not_applicable'::text, 'not_observed'::text, 'withheld'::text])) AND (value IS NULL))))
);


--
-- Name: data_disputes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_disputes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    jurisdiction_id uuid NOT NULL,
    fact_key text NOT NULL,
    fact_group text NOT NULL,
    dispute_kind text NOT NULL,
    fact_id_a uuid,
    fact_id_b uuid,
    proposed_action text,
    status text DEFAULT 'open'::text NOT NULL,
    description text,
    reviewer_id text,
    reviewer_notes text,
    resolved_at timestamp without time zone,
    resolution_action text,
    submitter_name text,
    submitter_email text,
    submitter_affiliation text,
    is_public boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: data_facts_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_facts_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    jurisdiction_id uuid,
    fact_key text,
    dispute_id uuid,
    action text NOT NULL,
    actor_id text NOT NULL,
    before jsonb,
    after jsonb,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: election_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.election_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    election_id uuid NOT NULL,
    party_name text,
    party_color text,
    party_wikidata_qid text,
    candidate_name text,
    votes_count integer,
    votes_percent real,
    seats_won integer,
    is_winner boolean DEFAULT false
);


--
-- Name: elections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.elections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    jurisdiction_id uuid NOT NULL,
    election_date date,
    election_type text,
    body_id uuid,
    turnout_percent real,
    wikidata_qid text,
    election_name text,
    electoral_system text,
    registered_voters integer,
    total_valid_votes integer,
    created_at timestamp without time zone DEFAULT now(),
    date_confidence text
);


--
-- Name: fact_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fact_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_id text NOT NULL,
    upstream_ref text NOT NULL,
    payload_hash text NOT NULL,
    payload jsonb NOT NULL,
    upstream_vintage_label text,
    fetched_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: government_bodies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.government_bodies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    jurisdiction_id uuid NOT NULL,
    name text NOT NULL,
    body_type text NOT NULL,
    chamber_type text,
    total_seats integer,
    branch text,
    wikidata_qid text,
    ipu_parline_id text,
    hierarchy_level integer,
    parent_body_id uuid,
    electoral_system_family text,
    electoral_subsystem text
);


--
-- Name: government_taxonomies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.government_taxonomies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    jurisdiction_id uuid NOT NULL,
    taxonomy_version text NOT NULL,
    regime_type_cgv text,
    regime_dataset_version text,
    regime_year integer,
    structural_family text,
    structural_subtype text,
    is_federal boolean,
    is_monarchy boolean,
    executive_structure text,
    government_dependency text,
    override_note text,
    provenance jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    derivation_version_key text NOT NULL,
    derivation_versions jsonb NOT NULL,
    regime_source_dataset_version text,
    regime_retrieved_at timestamp without time zone,
    civica_publication_version text,
    CONSTRAINT government_taxonomies_regime_temporal_complete CHECK (((regime_type_cgv IS NULL) OR ((regime_year IS NOT NULL) AND (regime_dataset_version IS NOT NULL) AND (regime_source_dataset_version IS NOT NULL) AND (regime_retrieved_at IS NOT NULL) AND (civica_publication_version IS NOT NULL))))
);


--
-- Name: indicator_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.indicator_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    jurisdiction_id uuid NOT NULL,
    dimension text NOT NULL,
    indicator text NOT NULL,
    year integer NOT NULL,
    value real,
    native_min real NOT NULL,
    native_max real NOT NULL,
    is_inverted boolean DEFAULT false NOT NULL,
    source_id text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    value_status text DEFAULT 'observed'::text NOT NULL,
    value_status_reason text,
    CONSTRAINT indicator_history_value_status_allowed CHECK ((value_status = ANY (ARRAY['observed'::text, 'missing'::text, 'unknown'::text, 'not_applicable'::text, 'not_observed'::text, 'disputed'::text, 'withheld'::text]))),
    CONSTRAINT indicator_history_value_status_reason CHECK ((((value_status = 'observed'::text) AND (value_status_reason IS NULL)) OR ((value_status <> 'observed'::text) AND (length(btrim(value_status_reason)) > 0)))),
    CONSTRAINT indicator_history_value_status_shape CHECK ((((value_status = ANY (ARRAY['observed'::text, 'disputed'::text])) AND (value IS NOT NULL)) OR ((value_status = ANY (ARRAY['missing'::text, 'unknown'::text, 'not_applicable'::text, 'not_observed'::text, 'withheld'::text])) AND (value IS NULL))))
);


--
-- Name: jurisdictions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jurisdictions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    iso2 text,
    iso3 text,
    wikidata_qid text,
    continent text,
    government_type text,
    government_type_detail text,
    capital text,
    population integer,
    gdp_billions real,
    area_sq_km integer,
    languages text,
    currency text,
    democracy_index real,
    flag_url text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    fact_cache_refreshed_at timestamp without time zone,
    status_source_ids jsonb NOT NULL,
    status_reviewed_at date NOT NULL,
    status_note text NOT NULL,
    administering_jurisdiction_iso3 text,
    status_disputed boolean DEFAULT false NOT NULL,
    CONSTRAINT jurisdictions_status_type_check CHECK ((type = ANY (ARRAY['sovereign_state'::text, 'associated_state'::text, 'dependency_or_territory'::text, 'disputed_or_limited_recognition'::text, 'aggregate_or_special_area'::text])))
);


--
-- Name: legislature_parties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.legislature_parties (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    body_id uuid NOT NULL,
    party_name text NOT NULL,
    party_color text,
    seat_count integer NOT NULL,
    is_ruling_coalition boolean DEFAULT false,
    wikidata_qid text
);


--
-- Name: metric_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.metric_definitions (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    category text NOT NULL,
    unit text,
    higher_is_better boolean NOT NULL,
    value_min real,
    value_max real,
    default_source_id text
);


--
-- Name: offices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.offices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    body_id uuid NOT NULL,
    name text NOT NULL,
    office_type text NOT NULL,
    is_elected boolean,
    wikidata_qid text,
    reports_to_office_id uuid,
    display_order integer
);


--
-- Name: organization_memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_memberships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid NOT NULL,
    jurisdiction_id uuid NOT NULL,
    join_date date,
    role text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    full_name text NOT NULL,
    type text NOT NULL,
    founded_year integer,
    hq_country text,
    member_count integer,
    wikidata_qid text,
    extra jsonb,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: party_positions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.party_positions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    legislature_party_id uuid NOT NULL,
    source_id text NOT NULL,
    vparty_id integer NOT NULL,
    vparty_name_en text,
    economic_left_right real NOT NULL,
    economic_lr_ord integer,
    anti_pluralism real NOT NULL,
    populism real,
    coded_year integer NOT NULL,
    match_method text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    match_confidence text DEFAULT 'high'::text NOT NULL
);


--
-- Name: persons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.persons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    date_of_birth date,
    wikidata_qid text,
    photo_url text,
    parline_person_code text,
    photo_license text,
    photo_credit text
);


--
-- Name: pulse_changelog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pulse_changelog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    jurisdiction_id uuid NOT NULL,
    score_date date NOT NULL,
    event_id uuid NOT NULL,
    decayed_impact real NOT NULL,
    days_since_event integer NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: pulse_corrections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pulse_corrections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    submitted_at timestamp without time zone DEFAULT now() NOT NULL,
    event_id uuid,
    country_id uuid,
    category text NOT NULL,
    submitter_name text,
    submitter_email text,
    submitter_affiliation text,
    description text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    disposition text,
    resolved_at timestamp without time zone,
    is_public boolean DEFAULT true NOT NULL,
    internal_notes text
);


--
-- Name: pulse_daily_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pulse_daily_scores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    jurisdiction_id uuid NOT NULL,
    score_date date NOT NULL,
    ci_baseline real NOT NULL,
    event_impact real NOT NULL,
    pulse_score real NOT NULL,
    active_events integer NOT NULL,
    is_low_confidence boolean DEFAULT false NOT NULL,
    methodology_version text NOT NULL,
    calculated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: pulse_dimensional_deltas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pulse_dimensional_deltas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    jurisdiction_id uuid NOT NULL,
    dimension text NOT NULL,
    delta_value real NOT NULL,
    contributing_event_ids uuid[] NOT NULL,
    last_computed_at timestamp without time zone DEFAULT now() NOT NULL,
    derivation_version_key text NOT NULL,
    derivation_versions jsonb NOT NULL
);


--
-- Name: pulse_events_v2; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pulse_events_v2 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    jurisdiction_id uuid NOT NULL,
    event_date date NOT NULL,
    category text NOT NULL,
    dimension text NOT NULL,
    severity_tier text NOT NULL,
    severity_value real NOT NULL,
    corroboration_confidence real NOT NULL,
    classifier_runs jsonb NOT NULL,
    classifier_agreement text NOT NULL,
    human_reviewed boolean DEFAULT false NOT NULL,
    reviewer_id text,
    review_notes text,
    review_status text DEFAULT 'pending'::text NOT NULL,
    published boolean DEFAULT false NOT NULL,
    headline text NOT NULL,
    description text NOT NULL,
    press_freedom_score_at_classification real,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    ai_summary text,
    derivation_version_key text NOT NULL,
    derivation_versions jsonb NOT NULL,
    cluster_id uuid NOT NULL
);


--
-- Name: raw_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.raw_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source_id text NOT NULL,
    external_id text,
    source_url text,
    source_type text NOT NULL,
    jurisdiction_id uuid,
    raw_country_name text,
    event_date date,
    retrieved_at timestamp without time zone DEFAULT now() NOT NULL,
    title text NOT NULL,
    body text,
    raw jsonb NOT NULL,
    embedding real[],
    cluster_id uuid,
    clustered_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    classification_disposition text DEFAULT 'pending'::text NOT NULL,
    classification_reason text,
    classification_decision jsonb,
    classified_at timestamp without time zone,
    CONSTRAINT raw_events_classification_disposition_allowed CHECK ((classification_disposition = ANY (ARRAY['pending'::text, 'event'::text, 'non_governance'::text, 'invalid'::text])))
);


--
-- Name: pulse_evaluation_evidence; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.pulse_evaluation_evidence AS
 SELECT 'classifier_disposition'::text AS evidence_kind,
    (re.id)::text AS evidence_id,
        CASE
            WHEN (re.classification_disposition = 'non_governance'::text) THEN 'false_negative_candidate'::text
            WHEN (re.classification_disposition = 'invalid'::text) THEN 'invalid_classification_candidate'::text
            ELSE re.classification_disposition
        END AS outcome,
    jsonb_build_object('raw_event', to_jsonb(re.*), 'decision', re.classification_decision, 'reason', re.classification_reason) AS payload,
    COALESCE(re.classified_at, re.created_at) AS recorded_at
   FROM public.raw_events re
  WHERE (re.classification_disposition <> 'pending'::text)
UNION ALL
 SELECT 'human_review'::text AS evidence_kind,
    (pe.id)::text AS evidence_id,
        CASE
            WHEN (pe.review_status = 'rejected'::text) THEN 'false_positive_candidate'::text
            ELSE 'reviewed_event'::text
        END AS outcome,
    to_jsonb(pe.*) AS payload,
    pe.updated_at AS recorded_at
   FROM public.pulse_events_v2 pe
  WHERE ((pe.human_reviewed = true) OR (pe.review_status = 'rejected'::text));


--
-- Name: pulse_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pulse_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    jurisdiction_id uuid NOT NULL,
    event_date date NOT NULL,
    category text NOT NULL,
    severity real NOT NULL,
    confidence real NOT NULL,
    justification text NOT NULL,
    headline text NOT NULL,
    source_url text,
    source_name text,
    llm_model text NOT NULL,
    llm_request_id text,
    raw_event_data jsonb,
    is_active boolean DEFAULT true NOT NULL,
    expires_at date,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: pulse_review_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pulse_review_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    reviewer_id text NOT NULL,
    action text NOT NULL,
    before jsonb NOT NULL,
    after jsonb NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: pulse_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pulse_sources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id uuid NOT NULL,
    source_id text NOT NULL,
    source_type text NOT NULL,
    source_name text NOT NULL,
    source_url text,
    raw_event_id uuid,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: rate_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rate_limits (
    key text NOT NULL,
    count integer DEFAULT 0 NOT NULL,
    expires_at timestamp with time zone NOT NULL
);


--
-- Name: reconciliation_evaluation_evidence; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.reconciliation_evaluation_evidence AS
 SELECT 'non_active_fact'::text AS evidence_kind,
    (cf.id)::text AS evidence_id,
    cf.status AS outcome,
    to_jsonb(cf.*) AS payload,
    cf.updated_at AS recorded_at
   FROM public.country_facts cf
  WHERE (cf.status <> 'active'::text)
UNION ALL
 SELECT 'dispute'::text AS evidence_kind,
    (dd.id)::text AS evidence_id,
    dd.status AS outcome,
    to_jsonb(dd.*) AS payload,
    COALESCE(dd.resolved_at, dd.created_at) AS recorded_at
   FROM public.data_disputes dd;


--
-- Name: research_evidence_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.research_evidence_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_table text NOT NULL,
    entity_id text NOT NULL,
    operation text NOT NULL,
    before jsonb NOT NULL,
    after jsonb,
    reason text NOT NULL,
    actor_id text NOT NULL,
    recorded_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT research_evidence_history_actor_nonempty CHECK ((length(btrim(actor_id)) > 0)),
    CONSTRAINT research_evidence_history_operation_allowed CHECK ((operation = ANY (ARRAY['update'::text, 'delete'::text]))),
    CONSTRAINT research_evidence_history_reason_nonempty CHECK ((length(btrim(reason)) > 0))
);


--
-- Name: sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sources (
    id text NOT NULL,
    name text NOT NULL,
    base_url text,
    license text NOT NULL,
    is_commercial_use_allowed boolean NOT NULL,
    last_sync_at timestamp without time zone
);


--
-- Name: statements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.statements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    subject_table text NOT NULL,
    subject_id uuid NOT NULL,
    predicate text NOT NULL,
    object_value text,
    object_entity_id uuid,
    source_id text NOT NULL,
    source_url text,
    source_license text,
    retrieved_at timestamp without time zone NOT NULL,
    source_hash text,
    valid_from date,
    valid_to date,
    confidence real DEFAULT 1,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: terms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.terms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    office_id uuid NOT NULL,
    person_id uuid NOT NULL,
    party_name text,
    party_color text,
    start_date date,
    end_date date,
    is_current boolean DEFAULT true
);


--
-- Name: advisory_applications advisory_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.advisory_applications
    ADD CONSTRAINT advisory_applications_pkey PRIMARY KEY (id);


--
-- Name: advisory_board_members advisory_board_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.advisory_board_members
    ADD CONSTRAINT advisory_board_members_pkey PRIMARY KEY (id);


--
-- Name: backtest_cases backtest_cases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backtest_cases
    ADD CONSTRAINT backtest_cases_pkey PRIMARY KEY (id);


--
-- Name: backtest_events backtest_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backtest_events
    ADD CONSTRAINT backtest_events_pkey PRIMARY KEY (id);


--
-- Name: backtest_runs backtest_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backtest_runs
    ADD CONSTRAINT backtest_runs_pkey PRIMARY KEY (id);


--
-- Name: bill_summary_cache bill_summary_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bill_summary_cache
    ADD CONSTRAINT bill_summary_cache_pkey PRIMARY KEY (id);


--
-- Name: bills bills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bills
    ADD CONSTRAINT bills_pkey PRIMARY KEY (id);


--
-- Name: ci_composite_scores ci_composite_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ci_composite_scores
    ADD CONSTRAINT ci_composite_scores_pkey PRIMARY KEY (id);


--
-- Name: ci_dimension_scores ci_dimension_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ci_dimension_scores
    ADD CONSTRAINT ci_dimension_scores_pkey PRIMARY KEY (id);


--
-- Name: ci_methodology_versions ci_methodology_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ci_methodology_versions
    ADD CONSTRAINT ci_methodology_versions_pkey PRIMARY KEY (id);


--
-- Name: ci_source_ingestions ci_source_ingestions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ci_source_ingestions
    ADD CONSTRAINT ci_source_ingestions_pkey PRIMARY KEY (id);


--
-- Name: civica_conditions_scores civica_conditions_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.civica_conditions_scores
    ADD CONSTRAINT civica_conditions_scores_pkey PRIMARY KEY (id);


--
-- Name: constitution_topic_excerpts constitution_topic_excerpts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.constitution_topic_excerpts
    ADD CONSTRAINT constitution_topic_excerpts_pkey PRIMARY KEY (id);


--
-- Name: constitutions constitutions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.constitutions
    ADD CONSTRAINT constitutions_pkey PRIMARY KEY (id);


--
-- Name: contact_submissions contact_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_submissions
    ADD CONSTRAINT contact_submissions_pkey PRIMARY KEY (id);


--
-- Name: correction_log correction_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.correction_log
    ADD CONSTRAINT correction_log_pkey PRIMARY KEY (id);


--
-- Name: country_fact_vintages country_fact_vintages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.country_fact_vintages
    ADD CONSTRAINT country_fact_vintages_pkey PRIMARY KEY (id);


--
-- Name: country_factbook_sections country_factbook_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.country_factbook_sections
    ADD CONSTRAINT country_factbook_sections_pkey PRIMARY KEY (id);


--
-- Name: country_facts country_facts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.country_facts
    ADD CONSTRAINT country_facts_pkey PRIMARY KEY (id);


--
-- Name: country_metrics country_metrics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.country_metrics
    ADD CONSTRAINT country_metrics_pkey PRIMARY KEY (id);


--
-- Name: data_disputes data_disputes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_disputes
    ADD CONSTRAINT data_disputes_pkey PRIMARY KEY (id);


--
-- Name: data_facts_audit_log data_facts_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_facts_audit_log
    ADD CONSTRAINT data_facts_audit_log_pkey PRIMARY KEY (id);


--
-- Name: election_results election_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.election_results
    ADD CONSTRAINT election_results_pkey PRIMARY KEY (id);


--
-- Name: elections elections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.elections
    ADD CONSTRAINT elections_pkey PRIMARY KEY (id);


--
-- Name: fact_snapshots fact_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fact_snapshots
    ADD CONSTRAINT fact_snapshots_pkey PRIMARY KEY (id);


--
-- Name: government_bodies government_bodies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.government_bodies
    ADD CONSTRAINT government_bodies_pkey PRIMARY KEY (id);


--
-- Name: government_taxonomies government_taxonomies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.government_taxonomies
    ADD CONSTRAINT government_taxonomies_pkey PRIMARY KEY (id);


--
-- Name: indicator_history indicator_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indicator_history
    ADD CONSTRAINT indicator_history_pkey PRIMARY KEY (id);


--
-- Name: jurisdictions jurisdictions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jurisdictions
    ADD CONSTRAINT jurisdictions_pkey PRIMARY KEY (id);


--
-- Name: jurisdictions jurisdictions_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jurisdictions
    ADD CONSTRAINT jurisdictions_slug_unique UNIQUE (slug);


--
-- Name: legislature_parties legislature_parties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legislature_parties
    ADD CONSTRAINT legislature_parties_pkey PRIMARY KEY (id);


--
-- Name: metric_definitions metric_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metric_definitions
    ADD CONSTRAINT metric_definitions_pkey PRIMARY KEY (id);


--
-- Name: offices offices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offices
    ADD CONSTRAINT offices_pkey PRIMARY KEY (id);


--
-- Name: organization_memberships organization_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_memberships
    ADD CONSTRAINT organization_memberships_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_slug_unique UNIQUE (slug);


--
-- Name: party_positions party_positions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.party_positions
    ADD CONSTRAINT party_positions_pkey PRIMARY KEY (id);


--
-- Name: persons persons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.persons
    ADD CONSTRAINT persons_pkey PRIMARY KEY (id);


--
-- Name: pulse_changelog pulse_changelog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pulse_changelog
    ADD CONSTRAINT pulse_changelog_pkey PRIMARY KEY (id);


--
-- Name: pulse_corrections pulse_corrections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pulse_corrections
    ADD CONSTRAINT pulse_corrections_pkey PRIMARY KEY (id);


--
-- Name: pulse_daily_scores pulse_daily_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pulse_daily_scores
    ADD CONSTRAINT pulse_daily_scores_pkey PRIMARY KEY (id);


--
-- Name: pulse_dimensional_deltas pulse_dimensional_deltas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pulse_dimensional_deltas
    ADD CONSTRAINT pulse_dimensional_deltas_pkey PRIMARY KEY (id);


--
-- Name: pulse_events pulse_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pulse_events
    ADD CONSTRAINT pulse_events_pkey PRIMARY KEY (id);


--
-- Name: pulse_events_v2 pulse_events_v2_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pulse_events_v2
    ADD CONSTRAINT pulse_events_v2_pkey PRIMARY KEY (id);


--
-- Name: pulse_review_audit_log pulse_review_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pulse_review_audit_log
    ADD CONSTRAINT pulse_review_audit_log_pkey PRIMARY KEY (id);


--
-- Name: pulse_sources pulse_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pulse_sources
    ADD CONSTRAINT pulse_sources_pkey PRIMARY KEY (id);


--
-- Name: rate_limits rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rate_limits
    ADD CONSTRAINT rate_limits_pkey PRIMARY KEY (key);


--
-- Name: raw_events raw_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raw_events
    ADD CONSTRAINT raw_events_pkey PRIMARY KEY (id);


--
-- Name: research_evidence_history research_evidence_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.research_evidence_history
    ADD CONSTRAINT research_evidence_history_pkey PRIMARY KEY (id);


--
-- Name: sources sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sources
    ADD CONSTRAINT sources_pkey PRIMARY KEY (id);


--
-- Name: statements statements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.statements
    ADD CONSTRAINT statements_pkey PRIMARY KEY (id);


--
-- Name: terms terms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.terms
    ADD CONSTRAINT terms_pkey PRIMARY KEY (id);


--
-- Name: bill_summary_cache_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX bill_summary_cache_key_idx ON public.bill_summary_cache USING btree (cache_key);


--
-- Name: bills_jurisdiction_last_action_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bills_jurisdiction_last_action_idx ON public.bills USING btree (jurisdiction_id, last_action_date);


--
-- Name: bills_source_external_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX bills_source_external_idx ON public.bills USING btree (source_id, external_id);


--
-- Name: idx_backtest_events_case; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_backtest_events_case ON public.backtest_events USING btree (case_id);


--
-- Name: idx_backtest_runs_case_ran; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_backtest_runs_case_ran ON public.backtest_runs USING btree (case_id, ran_at);


--
-- Name: idx_ci_composite_derivation_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ci_composite_derivation_version ON public.ci_composite_scores USING btree (derivation_version_key);


--
-- Name: idx_ci_composite_jurisdiction; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ci_composite_jurisdiction ON public.ci_composite_scores USING btree (jurisdiction_id);


--
-- Name: idx_ci_composite_quarter_rank; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ci_composite_quarter_rank ON public.ci_composite_scores USING btree (quarter, rank);


--
-- Name: idx_ci_composite_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_ci_composite_unique ON public.ci_composite_scores USING btree (jurisdiction_id, quarter, methodology_version);


--
-- Name: idx_ci_dimension_scores_derivation_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ci_dimension_scores_derivation_version ON public.ci_dimension_scores USING btree (derivation_version_key);


--
-- Name: idx_ci_dimension_scores_jurisdiction; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ci_dimension_scores_jurisdiction ON public.ci_dimension_scores USING btree (jurisdiction_id);


--
-- Name: idx_ci_dimension_scores_quarter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ci_dimension_scores_quarter ON public.ci_dimension_scores USING btree (quarter);


--
-- Name: idx_ci_dimension_scores_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_ci_dimension_scores_unique ON public.ci_dimension_scores USING btree (jurisdiction_id, dimension, quarter, methodology_version);


--
-- Name: idx_ci_source_ingestions_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_ci_source_ingestions_unique ON public.ci_source_ingestions USING btree (source_id, dimension, dataset_year);


--
-- Name: idx_conditions_jurisdiction; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conditions_jurisdiction ON public.civica_conditions_scores USING btree (jurisdiction_id);


--
-- Name: idx_conditions_quarter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conditions_quarter ON public.civica_conditions_scores USING btree (quarter);


--
-- Name: idx_conditions_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_conditions_unique ON public.civica_conditions_scores USING btree (jurisdiction_id, dimension, quarter, methodology_version);


--
-- Name: idx_constitution_topic_excerpts_jurisdiction; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_constitution_topic_excerpts_jurisdiction ON public.constitution_topic_excerpts USING btree (jurisdiction_id);


--
-- Name: idx_constitution_topic_excerpts_topic; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_constitution_topic_excerpts_topic ON public.constitution_topic_excerpts USING btree (topic_key);


--
-- Name: idx_country_facts_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_country_facts_category ON public.country_facts USING btree (category);


--
-- Name: idx_country_facts_factgroup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_country_facts_factgroup ON public.country_facts USING btree (fact_group);


--
-- Name: idx_country_facts_factkey_valuetype; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_country_facts_factkey_valuetype ON public.country_facts USING btree (fact_key, value_type);


--
-- Name: idx_country_facts_jurisdiction; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_country_facts_jurisdiction ON public.country_facts USING btree (jurisdiction_id);


--
-- Name: idx_country_facts_jurisdiction_factkey_source; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_country_facts_jurisdiction_factkey_source ON public.country_facts USING btree (jurisdiction_id, fact_key, source_id);


--
-- Name: idx_country_facts_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_country_facts_key ON public.country_facts USING btree (fact_key);


--
-- Name: idx_country_facts_numeric; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_country_facts_numeric ON public.country_facts USING btree (fact_key, fact_value_numeric);


--
-- Name: idx_country_facts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_country_facts_status ON public.country_facts USING btree (status);


--
-- Name: idx_country_metrics_jurisdiction; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_country_metrics_jurisdiction ON public.country_metrics USING btree (jurisdiction_id);


--
-- Name: idx_country_metrics_type_year; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_country_metrics_type_year ON public.country_metrics USING btree (metric_id, year);


--
-- Name: idx_country_metrics_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_country_metrics_unique ON public.country_metrics USING btree (jurisdiction_id, metric_id, year);


--
-- Name: idx_disputes_factkey; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_disputes_factkey ON public.data_disputes USING btree (fact_key);


--
-- Name: idx_disputes_jurisdiction; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_disputes_jurisdiction ON public.data_disputes USING btree (jurisdiction_id);


--
-- Name: idx_disputes_status_kind; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_disputes_status_kind ON public.data_disputes USING btree (status, dispute_kind);


--
-- Name: idx_fact_snapshots_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fact_snapshots_ref ON public.fact_snapshots USING btree (upstream_ref, fetched_at);


--
-- Name: idx_fact_snapshots_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_fact_snapshots_unique ON public.fact_snapshots USING btree (source_id, payload_hash);


--
-- Name: idx_fact_vintage_derivation_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fact_vintage_derivation_version ON public.country_fact_vintages USING btree (derivation_version_key);


--
-- Name: idx_fact_vintage_jurisdiction; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fact_vintage_jurisdiction ON public.country_fact_vintages USING btree (jurisdiction_id, vintage_label);


--
-- Name: idx_fact_vintage_label; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fact_vintage_label ON public.country_fact_vintages USING btree (vintage_label);


--
-- Name: idx_fact_vintage_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_fact_vintage_unique ON public.country_fact_vintages USING btree (jurisdiction_id, fact_key, vintage_label);


--
-- Name: idx_factbook_sections_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_factbook_sections_unique ON public.country_factbook_sections USING btree (jurisdiction_id, section_name);


--
-- Name: idx_facts_audit_actor_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_facts_audit_actor_date ON public.data_facts_audit_log USING btree (actor_id, created_at);


--
-- Name: idx_facts_audit_dispute; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_facts_audit_dispute ON public.data_facts_audit_log USING btree (dispute_id);


--
-- Name: idx_facts_audit_jurisdiction_factkey; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_facts_audit_jurisdiction_factkey ON public.data_facts_audit_log USING btree (jurisdiction_id, fact_key);


--
-- Name: idx_government_taxonomies_derivation_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_government_taxonomies_derivation_version ON public.government_taxonomies USING btree (derivation_version_key);


--
-- Name: idx_government_taxonomies_regime; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_government_taxonomies_regime ON public.government_taxonomies USING btree (taxonomy_version, regime_type_cgv);


--
-- Name: idx_government_taxonomies_structural; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_government_taxonomies_structural ON public.government_taxonomies USING btree (taxonomy_version, structural_family);


--
-- Name: idx_government_taxonomies_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_government_taxonomies_unique ON public.government_taxonomies USING btree (jurisdiction_id, taxonomy_version);


--
-- Name: idx_government_taxonomies_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_government_taxonomies_version ON public.government_taxonomies USING btree (taxonomy_version);


--
-- Name: idx_indicator_history_indicator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_indicator_history_indicator ON public.indicator_history USING btree (indicator);


--
-- Name: idx_indicator_history_jur_dim; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_indicator_history_jur_dim ON public.indicator_history USING btree (jurisdiction_id, dimension);


--
-- Name: idx_indicator_history_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_indicator_history_unique ON public.indicator_history USING btree (jurisdiction_id, indicator, year);


--
-- Name: idx_org_memberships_jurisdiction; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_memberships_jurisdiction ON public.organization_memberships USING btree (jurisdiction_id);


--
-- Name: idx_org_memberships_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_memberships_org ON public.organization_memberships USING btree (org_id);


--
-- Name: idx_org_memberships_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_org_memberships_unique ON public.organization_memberships USING btree (org_id, jurisdiction_id);


--
-- Name: idx_party_positions_legislature_party; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_party_positions_legislature_party ON public.party_positions USING btree (legislature_party_id);


--
-- Name: idx_party_positions_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_party_positions_source ON public.party_positions USING btree (source_id);


--
-- Name: idx_pulse_changelog_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pulse_changelog_event ON public.pulse_changelog USING btree (event_id);


--
-- Name: idx_pulse_changelog_jurisdiction_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pulse_changelog_jurisdiction_date ON public.pulse_changelog USING btree (jurisdiction_id, score_date);


--
-- Name: idx_pulse_daily_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pulse_daily_date ON public.pulse_daily_scores USING btree (score_date);


--
-- Name: idx_pulse_daily_jurisdiction; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pulse_daily_jurisdiction ON public.pulse_daily_scores USING btree (jurisdiction_id);


--
-- Name: idx_pulse_daily_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_pulse_daily_unique ON public.pulse_daily_scores USING btree (jurisdiction_id, score_date);


--
-- Name: idx_pulse_dim_derivation_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pulse_dim_derivation_version ON public.pulse_dimensional_deltas USING btree (derivation_version_key);


--
-- Name: idx_pulse_dim_jurisdiction; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pulse_dim_jurisdiction ON public.pulse_dimensional_deltas USING btree (jurisdiction_id);


--
-- Name: idx_pulse_dim_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_pulse_dim_unique ON public.pulse_dimensional_deltas USING btree (jurisdiction_id, dimension);


--
-- Name: idx_pulse_events_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pulse_events_active ON public.pulse_events USING btree (jurisdiction_id, is_active, event_date);


--
-- Name: idx_pulse_events_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pulse_events_category ON public.pulse_events USING btree (category);


--
-- Name: idx_pulse_events_jurisdiction_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pulse_events_jurisdiction_date ON public.pulse_events USING btree (jurisdiction_id, event_date);


--
-- Name: idx_pulse_review_audit_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pulse_review_audit_event ON public.pulse_review_audit_log USING btree (event_id);


--
-- Name: idx_pulse_review_audit_reviewer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pulse_review_audit_reviewer ON public.pulse_review_audit_log USING btree (reviewer_id, created_at);


--
-- Name: idx_pulse_sources_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pulse_sources_event ON public.pulse_sources USING btree (event_id);


--
-- Name: idx_pulse_sources_raw_event_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_pulse_sources_raw_event_unique ON public.pulse_sources USING btree (raw_event_id) WHERE (raw_event_id IS NOT NULL);


--
-- Name: idx_pulse_sources_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pulse_sources_source ON public.pulse_sources USING btree (source_id);


--
-- Name: idx_pulse_v2_cluster_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_pulse_v2_cluster_unique ON public.pulse_events_v2 USING btree (cluster_id);


--
-- Name: idx_pulse_v2_derivation_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pulse_v2_derivation_version ON public.pulse_events_v2 USING btree (derivation_version_key);


--
-- Name: idx_pulse_v2_dimension; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pulse_v2_dimension ON public.pulse_events_v2 USING btree (dimension, event_date);


--
-- Name: idx_pulse_v2_jurisdiction_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pulse_v2_jurisdiction_date ON public.pulse_events_v2 USING btree (jurisdiction_id, event_date);


--
-- Name: idx_pulse_v2_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pulse_v2_published ON public.pulse_events_v2 USING btree (published, review_status);


--
-- Name: idx_rate_limits_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rate_limits_expires_at ON public.rate_limits USING btree (expires_at);


--
-- Name: idx_raw_events_cluster; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_raw_events_cluster ON public.raw_events USING btree (cluster_id);


--
-- Name: idx_raw_events_external; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_raw_events_external ON public.raw_events USING btree (source_id, external_id) WHERE (external_id IS NOT NULL);


--
-- Name: idx_raw_events_jurisdiction_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_raw_events_jurisdiction_date ON public.raw_events USING btree (jurisdiction_id, event_date);


--
-- Name: idx_raw_events_unclustered; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_raw_events_unclustered ON public.raw_events USING btree (clustered_at);


--
-- Name: idx_research_evidence_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_research_evidence_entity ON public.research_evidence_history USING btree (entity_table, entity_id, recorded_at);


--
-- Name: idx_research_evidence_operation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_research_evidence_operation ON public.research_evidence_history USING btree (operation, recorded_at);


--
-- Name: backtest_cases dat_016_retain_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dat_016_retain_mutation BEFORE DELETE OR UPDATE ON public.backtest_cases FOR EACH ROW EXECUTE FUNCTION public.civica_capture_research_evidence_history();


--
-- Name: backtest_events dat_016_retain_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dat_016_retain_mutation BEFORE DELETE OR UPDATE ON public.backtest_events FOR EACH ROW EXECUTE FUNCTION public.civica_capture_research_evidence_history();


--
-- Name: backtest_runs dat_016_retain_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dat_016_retain_mutation BEFORE DELETE OR UPDATE ON public.backtest_runs FOR EACH ROW EXECUTE FUNCTION public.civica_capture_research_evidence_history();


--
-- Name: ci_composite_scores dat_016_retain_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dat_016_retain_mutation BEFORE DELETE OR UPDATE ON public.ci_composite_scores FOR EACH ROW EXECUTE FUNCTION public.civica_capture_research_evidence_history();


--
-- Name: ci_dimension_scores dat_016_retain_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dat_016_retain_mutation BEFORE DELETE OR UPDATE ON public.ci_dimension_scores FOR EACH ROW EXECUTE FUNCTION public.civica_capture_research_evidence_history();


--
-- Name: civica_conditions_scores dat_016_retain_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dat_016_retain_mutation BEFORE DELETE OR UPDATE ON public.civica_conditions_scores FOR EACH ROW EXECUTE FUNCTION public.civica_capture_research_evidence_history();


--
-- Name: constitution_topic_excerpts dat_016_retain_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dat_016_retain_mutation BEFORE DELETE OR UPDATE ON public.constitution_topic_excerpts FOR EACH ROW EXECUTE FUNCTION public.civica_capture_research_evidence_history();


--
-- Name: constitutions dat_016_retain_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dat_016_retain_mutation BEFORE DELETE OR UPDATE ON public.constitutions FOR EACH ROW EXECUTE FUNCTION public.civica_capture_research_evidence_history();


--
-- Name: correction_log dat_016_retain_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dat_016_retain_mutation BEFORE DELETE OR UPDATE ON public.correction_log FOR EACH ROW EXECUTE FUNCTION public.civica_capture_research_evidence_history();


--
-- Name: country_facts dat_016_retain_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dat_016_retain_mutation BEFORE DELETE OR UPDATE ON public.country_facts FOR EACH ROW EXECUTE FUNCTION public.civica_capture_research_evidence_history();


--
-- Name: country_metrics dat_016_retain_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dat_016_retain_mutation BEFORE DELETE OR UPDATE ON public.country_metrics FOR EACH ROW EXECUTE FUNCTION public.civica_capture_research_evidence_history();


--
-- Name: data_disputes dat_016_retain_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dat_016_retain_mutation BEFORE DELETE OR UPDATE ON public.data_disputes FOR EACH ROW EXECUTE FUNCTION public.civica_capture_research_evidence_history();


--
-- Name: data_facts_audit_log dat_016_retain_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dat_016_retain_mutation BEFORE DELETE OR UPDATE ON public.data_facts_audit_log FOR EACH ROW EXECUTE FUNCTION public.civica_capture_research_evidence_history();


--
-- Name: election_results dat_016_retain_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dat_016_retain_mutation BEFORE DELETE OR UPDATE ON public.election_results FOR EACH ROW EXECUTE FUNCTION public.civica_capture_research_evidence_history();


--
-- Name: elections dat_016_retain_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dat_016_retain_mutation BEFORE DELETE OR UPDATE ON public.elections FOR EACH ROW EXECUTE FUNCTION public.civica_capture_research_evidence_history();


--
-- Name: government_bodies dat_016_retain_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dat_016_retain_mutation BEFORE DELETE OR UPDATE ON public.government_bodies FOR EACH ROW EXECUTE FUNCTION public.civica_capture_research_evidence_history();


--
-- Name: government_taxonomies dat_016_retain_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dat_016_retain_mutation BEFORE DELETE OR UPDATE ON public.government_taxonomies FOR EACH ROW EXECUTE FUNCTION public.civica_capture_research_evidence_history();


--
-- Name: indicator_history dat_016_retain_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dat_016_retain_mutation BEFORE DELETE OR UPDATE ON public.indicator_history FOR EACH ROW EXECUTE FUNCTION public.civica_capture_research_evidence_history();


--
-- Name: legislature_parties dat_016_retain_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dat_016_retain_mutation BEFORE DELETE OR UPDATE ON public.legislature_parties FOR EACH ROW EXECUTE FUNCTION public.civica_capture_research_evidence_history();


--
-- Name: offices dat_016_retain_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dat_016_retain_mutation BEFORE DELETE OR UPDATE ON public.offices FOR EACH ROW EXECUTE FUNCTION public.civica_capture_research_evidence_history();


--
-- Name: organization_memberships dat_016_retain_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dat_016_retain_mutation BEFORE DELETE OR UPDATE ON public.organization_memberships FOR EACH ROW EXECUTE FUNCTION public.civica_capture_research_evidence_history();


--
-- Name: persons dat_016_retain_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dat_016_retain_mutation BEFORE DELETE OR UPDATE ON public.persons FOR EACH ROW EXECUTE FUNCTION public.civica_capture_research_evidence_history();


--
-- Name: pulse_dimensional_deltas dat_016_retain_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dat_016_retain_mutation BEFORE DELETE OR UPDATE ON public.pulse_dimensional_deltas FOR EACH ROW EXECUTE FUNCTION public.civica_capture_research_evidence_history();


--
-- Name: pulse_events_v2 dat_016_retain_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dat_016_retain_mutation BEFORE DELETE OR UPDATE ON public.pulse_events_v2 FOR EACH ROW EXECUTE FUNCTION public.civica_capture_research_evidence_history();


--
-- Name: pulse_review_audit_log dat_016_retain_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dat_016_retain_mutation BEFORE DELETE OR UPDATE ON public.pulse_review_audit_log FOR EACH ROW EXECUTE FUNCTION public.civica_capture_research_evidence_history();


--
-- Name: pulse_sources dat_016_retain_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dat_016_retain_mutation BEFORE DELETE OR UPDATE ON public.pulse_sources FOR EACH ROW EXECUTE FUNCTION public.civica_capture_research_evidence_history();


--
-- Name: raw_events dat_016_retain_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dat_016_retain_mutation BEFORE DELETE OR UPDATE ON public.raw_events FOR EACH ROW EXECUTE FUNCTION public.civica_capture_research_evidence_history();


--
-- Name: statements dat_016_retain_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dat_016_retain_mutation BEFORE DELETE OR UPDATE ON public.statements FOR EACH ROW EXECUTE FUNCTION public.civica_capture_research_evidence_history();


--
-- Name: terms dat_016_retain_mutation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dat_016_retain_mutation BEFORE DELETE OR UPDATE ON public.terms FOR EACH ROW EXECUTE FUNCTION public.civica_capture_research_evidence_history();


--
-- Name: ci_composite_scores dat_023_immutable_vintage; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dat_023_immutable_vintage BEFORE DELETE OR UPDATE ON public.ci_composite_scores FOR EACH ROW WHEN ((old.vintage_label IS NOT NULL)) EXECUTE FUNCTION public.civica_reject_frozen_vintage_mutation();


--
-- Name: country_fact_vintages dat_023_immutable_vintage; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dat_023_immutable_vintage BEFORE DELETE OR UPDATE ON public.country_fact_vintages FOR EACH ROW EXECUTE FUNCTION public.civica_reject_frozen_vintage_mutation();


--
-- Name: ci_composite_scores dat_023_validate_vintage; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dat_023_validate_vintage BEFORE INSERT ON public.ci_composite_scores FOR EACH ROW WHEN ((new.vintage_label IS NOT NULL)) EXECUTE FUNCTION public.civica_validate_frozen_vintage_insert();


--
-- Name: country_fact_vintages dat_023_validate_vintage; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER dat_023_validate_vintage BEFORE INSERT ON public.country_fact_vintages FOR EACH ROW EXECUTE FUNCTION public.civica_validate_frozen_vintage_insert();


--
-- Name: research_evidence_history research_evidence_history_append_only; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER research_evidence_history_append_only BEFORE DELETE OR UPDATE ON public.research_evidence_history FOR EACH ROW EXECUTE FUNCTION public.civica_reject_research_evidence_history_mutation();


--
-- Name: backtest_events backtest_events_case_id_backtest_cases_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backtest_events
    ADD CONSTRAINT backtest_events_case_id_backtest_cases_id_fk FOREIGN KEY (case_id) REFERENCES public.backtest_cases(id) ON DELETE CASCADE;


--
-- Name: backtest_runs backtest_runs_case_id_backtest_cases_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backtest_runs
    ADD CONSTRAINT backtest_runs_case_id_backtest_cases_id_fk FOREIGN KEY (case_id) REFERENCES public.backtest_cases(id) ON DELETE CASCADE;


--
-- Name: bills bills_body_id_government_bodies_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bills
    ADD CONSTRAINT bills_body_id_government_bodies_id_fk FOREIGN KEY (body_id) REFERENCES public.government_bodies(id);


--
-- Name: bills bills_jurisdiction_id_jurisdictions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bills
    ADD CONSTRAINT bills_jurisdiction_id_jurisdictions_id_fk FOREIGN KEY (jurisdiction_id) REFERENCES public.jurisdictions(id);


--
-- Name: bills bills_source_id_sources_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bills
    ADD CONSTRAINT bills_source_id_sources_id_fk FOREIGN KEY (source_id) REFERENCES public.sources(id);


--
-- Name: ci_composite_scores ci_composite_scores_jurisdiction_id_jurisdictions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ci_composite_scores
    ADD CONSTRAINT ci_composite_scores_jurisdiction_id_jurisdictions_id_fk FOREIGN KEY (jurisdiction_id) REFERENCES public.jurisdictions(id);


--
-- Name: ci_composite_scores ci_composite_scores_methodology_version_ci_methodology_versions; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ci_composite_scores
    ADD CONSTRAINT ci_composite_scores_methodology_version_ci_methodology_versions FOREIGN KEY (methodology_version) REFERENCES public.ci_methodology_versions(id);


--
-- Name: ci_dimension_scores ci_dimension_scores_ingestion_id_ci_source_ingestions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ci_dimension_scores
    ADD CONSTRAINT ci_dimension_scores_ingestion_id_ci_source_ingestions_id_fk FOREIGN KEY (ingestion_id) REFERENCES public.ci_source_ingestions(id);


--
-- Name: ci_dimension_scores ci_dimension_scores_jurisdiction_id_jurisdictions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ci_dimension_scores
    ADD CONSTRAINT ci_dimension_scores_jurisdiction_id_jurisdictions_id_fk FOREIGN KEY (jurisdiction_id) REFERENCES public.jurisdictions(id);


--
-- Name: ci_dimension_scores ci_dimension_scores_methodology_version_ci_methodology_versions; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ci_dimension_scores
    ADD CONSTRAINT ci_dimension_scores_methodology_version_ci_methodology_versions FOREIGN KEY (methodology_version) REFERENCES public.ci_methodology_versions(id);


--
-- Name: ci_dimension_scores ci_dimension_scores_source_id_sources_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ci_dimension_scores
    ADD CONSTRAINT ci_dimension_scores_source_id_sources_id_fk FOREIGN KEY (source_id) REFERENCES public.sources(id);


--
-- Name: ci_source_ingestions ci_source_ingestions_source_id_sources_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ci_source_ingestions
    ADD CONSTRAINT ci_source_ingestions_source_id_sources_id_fk FOREIGN KEY (source_id) REFERENCES public.sources(id);


--
-- Name: civica_conditions_scores civica_conditions_scores_jurisdiction_id_jurisdictions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.civica_conditions_scores
    ADD CONSTRAINT civica_conditions_scores_jurisdiction_id_jurisdictions_id_fk FOREIGN KEY (jurisdiction_id) REFERENCES public.jurisdictions(id);


--
-- Name: civica_conditions_scores civica_conditions_scores_source_id_sources_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.civica_conditions_scores
    ADD CONSTRAINT civica_conditions_scores_source_id_sources_id_fk FOREIGN KEY (source_id) REFERENCES public.sources(id);


--
-- Name: constitution_topic_excerpts constitution_topic_excerpts_constitution_id_constitutions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.constitution_topic_excerpts
    ADD CONSTRAINT constitution_topic_excerpts_constitution_id_constitutions_id_fk FOREIGN KEY (constitution_id) REFERENCES public.constitutions(id);


--
-- Name: constitution_topic_excerpts constitution_topic_excerpts_jurisdiction_id_jurisdictions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.constitution_topic_excerpts
    ADD CONSTRAINT constitution_topic_excerpts_jurisdiction_id_jurisdictions_id_fk FOREIGN KEY (jurisdiction_id) REFERENCES public.jurisdictions(id);


--
-- Name: constitutions constitutions_jurisdiction_id_jurisdictions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.constitutions
    ADD CONSTRAINT constitutions_jurisdiction_id_jurisdictions_id_fk FOREIGN KEY (jurisdiction_id) REFERENCES public.jurisdictions(id);


--
-- Name: correction_log correction_log_country_id_jurisdictions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.correction_log
    ADD CONSTRAINT correction_log_country_id_jurisdictions_id_fk FOREIGN KEY (country_id) REFERENCES public.jurisdictions(id);


--
-- Name: country_fact_vintages country_fact_vintages_canonical_fact_id_country_facts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.country_fact_vintages
    ADD CONSTRAINT country_fact_vintages_canonical_fact_id_country_facts_id_fk FOREIGN KEY (canonical_fact_id) REFERENCES public.country_facts(id);


--
-- Name: country_fact_vintages country_fact_vintages_jurisdiction_id_jurisdictions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.country_fact_vintages
    ADD CONSTRAINT country_fact_vintages_jurisdiction_id_jurisdictions_id_fk FOREIGN KEY (jurisdiction_id) REFERENCES public.jurisdictions(id);


--
-- Name: country_factbook_sections country_factbook_sections_jurisdiction_id_jurisdictions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.country_factbook_sections
    ADD CONSTRAINT country_factbook_sections_jurisdiction_id_jurisdictions_id_fk FOREIGN KEY (jurisdiction_id) REFERENCES public.jurisdictions(id);


--
-- Name: country_facts country_facts_jurisdiction_id_jurisdictions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.country_facts
    ADD CONSTRAINT country_facts_jurisdiction_id_jurisdictions_id_fk FOREIGN KEY (jurisdiction_id) REFERENCES public.jurisdictions(id);


--
-- Name: country_facts country_facts_source_id_sources_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.country_facts
    ADD CONSTRAINT country_facts_source_id_sources_id_fk FOREIGN KEY (source_id) REFERENCES public.sources(id);


--
-- Name: country_metrics country_metrics_jurisdiction_id_jurisdictions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.country_metrics
    ADD CONSTRAINT country_metrics_jurisdiction_id_jurisdictions_id_fk FOREIGN KEY (jurisdiction_id) REFERENCES public.jurisdictions(id);


--
-- Name: country_metrics country_metrics_metric_id_metric_definitions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.country_metrics
    ADD CONSTRAINT country_metrics_metric_id_metric_definitions_id_fk FOREIGN KEY (metric_id) REFERENCES public.metric_definitions(id);


--
-- Name: country_metrics country_metrics_source_id_sources_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.country_metrics
    ADD CONSTRAINT country_metrics_source_id_sources_id_fk FOREIGN KEY (source_id) REFERENCES public.sources(id);


--
-- Name: data_disputes data_disputes_fact_id_a_country_facts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_disputes
    ADD CONSTRAINT data_disputes_fact_id_a_country_facts_id_fk FOREIGN KEY (fact_id_a) REFERENCES public.country_facts(id);


--
-- Name: data_disputes data_disputes_fact_id_b_country_facts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_disputes
    ADD CONSTRAINT data_disputes_fact_id_b_country_facts_id_fk FOREIGN KEY (fact_id_b) REFERENCES public.country_facts(id);


--
-- Name: data_disputes data_disputes_jurisdiction_id_jurisdictions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_disputes
    ADD CONSTRAINT data_disputes_jurisdiction_id_jurisdictions_id_fk FOREIGN KEY (jurisdiction_id) REFERENCES public.jurisdictions(id);


--
-- Name: data_facts_audit_log data_facts_audit_log_dispute_id_data_disputes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_facts_audit_log
    ADD CONSTRAINT data_facts_audit_log_dispute_id_data_disputes_id_fk FOREIGN KEY (dispute_id) REFERENCES public.data_disputes(id);


--
-- Name: data_facts_audit_log data_facts_audit_log_jurisdiction_id_jurisdictions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_facts_audit_log
    ADD CONSTRAINT data_facts_audit_log_jurisdiction_id_jurisdictions_id_fk FOREIGN KEY (jurisdiction_id) REFERENCES public.jurisdictions(id);


--
-- Name: election_results election_results_election_id_elections_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.election_results
    ADD CONSTRAINT election_results_election_id_elections_id_fk FOREIGN KEY (election_id) REFERENCES public.elections(id);


--
-- Name: elections elections_body_id_government_bodies_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.elections
    ADD CONSTRAINT elections_body_id_government_bodies_id_fk FOREIGN KEY (body_id) REFERENCES public.government_bodies(id);


--
-- Name: elections elections_jurisdiction_id_jurisdictions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.elections
    ADD CONSTRAINT elections_jurisdiction_id_jurisdictions_id_fk FOREIGN KEY (jurisdiction_id) REFERENCES public.jurisdictions(id);


--
-- Name: fact_snapshots fact_snapshots_source_id_sources_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fact_snapshots
    ADD CONSTRAINT fact_snapshots_source_id_sources_id_fk FOREIGN KEY (source_id) REFERENCES public.sources(id);


--
-- Name: government_bodies government_bodies_jurisdiction_id_jurisdictions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.government_bodies
    ADD CONSTRAINT government_bodies_jurisdiction_id_jurisdictions_id_fk FOREIGN KEY (jurisdiction_id) REFERENCES public.jurisdictions(id);


--
-- Name: government_taxonomies government_taxonomies_jurisdiction_id_jurisdictions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.government_taxonomies
    ADD CONSTRAINT government_taxonomies_jurisdiction_id_jurisdictions_id_fk FOREIGN KEY (jurisdiction_id) REFERENCES public.jurisdictions(id);


--
-- Name: indicator_history indicator_history_jurisdiction_id_jurisdictions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indicator_history
    ADD CONSTRAINT indicator_history_jurisdiction_id_jurisdictions_id_fk FOREIGN KEY (jurisdiction_id) REFERENCES public.jurisdictions(id);


--
-- Name: indicator_history indicator_history_source_id_sources_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.indicator_history
    ADD CONSTRAINT indicator_history_source_id_sources_id_fk FOREIGN KEY (source_id) REFERENCES public.sources(id);


--
-- Name: legislature_parties legislature_parties_body_id_government_bodies_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.legislature_parties
    ADD CONSTRAINT legislature_parties_body_id_government_bodies_id_fk FOREIGN KEY (body_id) REFERENCES public.government_bodies(id);


--
-- Name: metric_definitions metric_definitions_default_source_id_sources_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metric_definitions
    ADD CONSTRAINT metric_definitions_default_source_id_sources_id_fk FOREIGN KEY (default_source_id) REFERENCES public.sources(id);


--
-- Name: offices offices_body_id_government_bodies_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offices
    ADD CONSTRAINT offices_body_id_government_bodies_id_fk FOREIGN KEY (body_id) REFERENCES public.government_bodies(id);


--
-- Name: organization_memberships organization_memberships_jurisdiction_id_jurisdictions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_memberships
    ADD CONSTRAINT organization_memberships_jurisdiction_id_jurisdictions_id_fk FOREIGN KEY (jurisdiction_id) REFERENCES public.jurisdictions(id);


--
-- Name: organization_memberships organization_memberships_org_id_organizations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_memberships
    ADD CONSTRAINT organization_memberships_org_id_organizations_id_fk FOREIGN KEY (org_id) REFERENCES public.organizations(id);


--
-- Name: party_positions party_positions_legislature_party_id_legislature_parties_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.party_positions
    ADD CONSTRAINT party_positions_legislature_party_id_legislature_parties_id_fk FOREIGN KEY (legislature_party_id) REFERENCES public.legislature_parties(id);


--
-- Name: party_positions party_positions_source_id_sources_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.party_positions
    ADD CONSTRAINT party_positions_source_id_sources_id_fk FOREIGN KEY (source_id) REFERENCES public.sources(id);


--
-- Name: pulse_changelog pulse_changelog_event_id_pulse_events_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pulse_changelog
    ADD CONSTRAINT pulse_changelog_event_id_pulse_events_id_fk FOREIGN KEY (event_id) REFERENCES public.pulse_events(id);


--
-- Name: pulse_changelog pulse_changelog_jurisdiction_id_jurisdictions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pulse_changelog
    ADD CONSTRAINT pulse_changelog_jurisdiction_id_jurisdictions_id_fk FOREIGN KEY (jurisdiction_id) REFERENCES public.jurisdictions(id);


--
-- Name: pulse_corrections pulse_corrections_country_id_jurisdictions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pulse_corrections
    ADD CONSTRAINT pulse_corrections_country_id_jurisdictions_id_fk FOREIGN KEY (country_id) REFERENCES public.jurisdictions(id);


--
-- Name: pulse_corrections pulse_corrections_event_id_pulse_events_v2_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pulse_corrections
    ADD CONSTRAINT pulse_corrections_event_id_pulse_events_v2_id_fk FOREIGN KEY (event_id) REFERENCES public.pulse_events_v2(id);


--
-- Name: pulse_daily_scores pulse_daily_scores_jurisdiction_id_jurisdictions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pulse_daily_scores
    ADD CONSTRAINT pulse_daily_scores_jurisdiction_id_jurisdictions_id_fk FOREIGN KEY (jurisdiction_id) REFERENCES public.jurisdictions(id);


--
-- Name: pulse_daily_scores pulse_daily_scores_methodology_version_ci_methodology_versions_; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pulse_daily_scores
    ADD CONSTRAINT pulse_daily_scores_methodology_version_ci_methodology_versions_ FOREIGN KEY (methodology_version) REFERENCES public.ci_methodology_versions(id);


--
-- Name: pulse_dimensional_deltas pulse_dimensional_deltas_jurisdiction_id_jurisdictions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pulse_dimensional_deltas
    ADD CONSTRAINT pulse_dimensional_deltas_jurisdiction_id_jurisdictions_id_fk FOREIGN KEY (jurisdiction_id) REFERENCES public.jurisdictions(id);


--
-- Name: pulse_events pulse_events_jurisdiction_id_jurisdictions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pulse_events
    ADD CONSTRAINT pulse_events_jurisdiction_id_jurisdictions_id_fk FOREIGN KEY (jurisdiction_id) REFERENCES public.jurisdictions(id);


--
-- Name: pulse_events_v2 pulse_events_v2_jurisdiction_id_jurisdictions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pulse_events_v2
    ADD CONSTRAINT pulse_events_v2_jurisdiction_id_jurisdictions_id_fk FOREIGN KEY (jurisdiction_id) REFERENCES public.jurisdictions(id);


--
-- Name: pulse_review_audit_log pulse_review_audit_log_event_id_pulse_events_v2_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pulse_review_audit_log
    ADD CONSTRAINT pulse_review_audit_log_event_id_pulse_events_v2_id_fk FOREIGN KEY (event_id) REFERENCES public.pulse_events_v2(id) ON DELETE RESTRICT;


--
-- Name: pulse_sources pulse_sources_event_id_pulse_events_v2_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pulse_sources
    ADD CONSTRAINT pulse_sources_event_id_pulse_events_v2_id_fk FOREIGN KEY (event_id) REFERENCES public.pulse_events_v2(id) ON DELETE RESTRICT;


--
-- Name: pulse_sources pulse_sources_raw_event_id_raw_events_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pulse_sources
    ADD CONSTRAINT pulse_sources_raw_event_id_raw_events_id_fk FOREIGN KEY (raw_event_id) REFERENCES public.raw_events(id);


--
-- Name: pulse_sources pulse_sources_source_id_sources_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pulse_sources
    ADD CONSTRAINT pulse_sources_source_id_sources_id_fk FOREIGN KEY (source_id) REFERENCES public.sources(id);


--
-- Name: raw_events raw_events_jurisdiction_id_jurisdictions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raw_events
    ADD CONSTRAINT raw_events_jurisdiction_id_jurisdictions_id_fk FOREIGN KEY (jurisdiction_id) REFERENCES public.jurisdictions(id);


--
-- Name: raw_events raw_events_source_id_sources_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raw_events
    ADD CONSTRAINT raw_events_source_id_sources_id_fk FOREIGN KEY (source_id) REFERENCES public.sources(id);


--
-- Name: terms terms_office_id_offices_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.terms
    ADD CONSTRAINT terms_office_id_offices_id_fk FOREIGN KEY (office_id) REFERENCES public.offices(id);


--
-- Name: terms terms_person_id_persons_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.terms
    ADD CONSTRAINT terms_person_id_persons_id_fk FOREIGN KEY (person_id) REFERENCES public.persons(id);


--
-- PostgreSQL database dump complete
--
