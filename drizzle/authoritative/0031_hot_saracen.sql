CREATE TABLE "party_composition_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_key" text NOT NULL,
	"body_id" uuid NOT NULL,
	"source_id" text,
	"source_url" text,
	"source_license" text,
	"source_retrieved_at" timestamp,
	"payload_sha256" text NOT NULL,
	"party_count" integer NOT NULL,
	"writer_version" text NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "party_composition_runs_run_key_unique" UNIQUE("run_key"),
	CONSTRAINT "party_composition_runs_payload_sha256_check" CHECK ("party_composition_runs"."payload_sha256" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "party_composition_runs_party_count_check" CHECK ("party_composition_runs"."party_count" > 0)
);
--> statement-breakpoint
CREATE TABLE "party_identity_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_key" text NOT NULL,
	"event_group_key" text NOT NULL,
	"event_type" text NOT NULL,
	"predecessor_party_id" uuid,
	"successor_party_id" uuid,
	"legislature_party_id" uuid,
	"previous_name" text,
	"current_name" text,
	"effective_date" date,
	"evidence_status" text NOT NULL,
	"source_id" text,
	"source_url" text,
	"source_license" text,
	"source_retrieved_at" timestamp,
	"method_version" text NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "party_identity_events_event_key_unique" UNIQUE("event_key"),
	CONSTRAINT "party_identity_events_type_check" CHECK ("party_identity_events"."event_type" in ('identity_adopted', 'identity_created', 'identity_upgraded', 'name_change_observed', 'retired_from_chamber', 'reactivated_in_chamber', 'split_into', 'merged_into', 'succeeded_by')),
	CONSTRAINT "party_identity_events_evidence_status_check" CHECK ("party_identity_events"."evidence_status" in ('verified', 'provisional', 'disputed')),
	CONSTRAINT "party_identity_events_participant_check" CHECK ("party_identity_events"."predecessor_party_id" is not null or "party_identity_events"."successor_party_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "political_parties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"jurisdiction_id" uuid NOT NULL,
	"canonical_name" text NOT NULL,
	"identity_status" text DEFAULT 'provisional_legacy' NOT NULL,
	"identity_source_id" text,
	"identity_external_id" text,
	"identity_source_url" text,
	"identity_source_license" text,
	"identity_retrieved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "political_parties_identity_status_check" CHECK ("political_parties"."identity_status" in ('source_verified', 'provisional_legacy', 'disputed')),
	CONSTRAINT "political_parties_source_identity_pair_check" CHECK (("political_parties"."identity_source_id" is null and "political_parties"."identity_external_id" is null) or ("political_parties"."identity_source_id" is not null and "political_parties"."identity_external_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "legislature_parties" ADD COLUMN "party_id" uuid;--> statement-breakpoint
ALTER TABLE "legislature_parties" ADD COLUMN "composition_run_id" uuid;--> statement-breakpoint
ALTER TABLE "legislature_parties" ADD COLUMN "identity_key" text;--> statement-breakpoint
ALTER TABLE "legislature_parties" ADD COLUMN "is_current" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "legislature_parties" ADD COLUMN "first_recorded_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "legislature_parties" ADD COLUMN "last_recorded_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "legislature_parties" ADD COLUMN "retired_at" timestamp;--> statement-breakpoint
INSERT INTO "party_composition_runs" (
	"id",
	"run_key",
	"body_id",
	"source_id",
	"source_url",
	"source_license",
	"source_retrieved_at",
	"payload_sha256",
	"party_count",
	"writer_version",
	"recorded_at"
)
SELECT
	gen_random_uuid(),
	encode(digest('party-composition-adoption/v1:' || lp.body_id::text, 'sha256'), 'hex'),
	lp.body_id,
	s.source_id,
	s.source_url,
	s.source_license,
	s.retrieved_at,
	encode(
		digest(
			jsonb_agg(
				jsonb_build_object(
					'id', lp.id,
					'name', lp.party_name,
					'color', lp.party_color,
					'seats', lp.seat_count,
					'ruling', lp.is_ruling_coalition,
					'wikidataQid', lp.wikidata_qid
				)
				ORDER BY lp.id
			)::text,
			'sha256'
		),
		'hex'
	),
	count(*)::int,
	'party-composition-adoption/v1',
	now()
FROM legislature_parties lp
LEFT JOIN LATERAL (
	SELECT st.source_id, st.source_url, st.source_license, st.retrieved_at
	FROM statements st
	WHERE st.subject_table = 'government_bodies'
		AND st.subject_id = lp.body_id
		AND st.predicate = 'seats_per_parties'
	ORDER BY st.retrieved_at DESC, st.id
	LIMIT 1
) s ON true
GROUP BY lp.body_id, s.source_id, s.source_url, s.source_license, s.retrieved_at;--> statement-breakpoint
INSERT INTO "political_parties" (
	"id",
	"jurisdiction_id",
	"canonical_name",
	"identity_status",
	"created_at",
	"updated_at"
)
SELECT
	lp.id,
	gb.jurisdiction_id,
	lp.party_name,
	'provisional_legacy',
	now(),
	now()
FROM legislature_parties lp
JOIN government_bodies gb ON gb.id = lp.body_id;--> statement-breakpoint
UPDATE legislature_parties lp
SET
	party_id = lp.id,
	composition_run_id = run.id,
	identity_key = 'legacy:' || lp.id::text
FROM party_composition_runs run
WHERE run.body_id = lp.body_id
	AND run.writer_version = 'party-composition-adoption/v1';--> statement-breakpoint
INSERT INTO "party_identity_events" (
	"id",
	"event_key",
	"event_group_key",
	"event_type",
	"successor_party_id",
	"legislature_party_id",
	"current_name",
	"evidence_status",
	"source_id",
	"source_url",
	"source_license",
	"source_retrieved_at",
	"method_version",
	"recorded_at"
)
SELECT
	gen_random_uuid(),
	encode(digest('party-identity-adoption/v1:' || lp.id::text, 'sha256'), 'hex'),
	'identity-adoption:' || lp.id::text,
	'identity_adopted',
	lp.party_id,
	lp.id,
	lp.party_name,
	'provisional',
	run.source_id,
	run.source_url,
	run.source_license,
	run.source_retrieved_at,
	'party-identity/v1',
	now()
FROM legislature_parties lp
JOIN party_composition_runs run ON run.id = lp.composition_run_id;--> statement-breakpoint
ALTER TABLE "legislature_parties" ALTER COLUMN "party_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "legislature_parties" ALTER COLUMN "composition_run_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "legislature_parties" ALTER COLUMN "identity_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "party_composition_runs" ADD CONSTRAINT "party_composition_runs_body_id_government_bodies_id_fk" FOREIGN KEY ("body_id") REFERENCES "public"."government_bodies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_composition_runs" ADD CONSTRAINT "party_composition_runs_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_identity_events" ADD CONSTRAINT "party_identity_events_predecessor_party_id_political_parties_id_fk" FOREIGN KEY ("predecessor_party_id") REFERENCES "public"."political_parties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_identity_events" ADD CONSTRAINT "party_identity_events_successor_party_id_political_parties_id_fk" FOREIGN KEY ("successor_party_id") REFERENCES "public"."political_parties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_identity_events" ADD CONSTRAINT "party_identity_events_legislature_party_id_legislature_parties_id_fk" FOREIGN KEY ("legislature_party_id") REFERENCES "public"."legislature_parties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_identity_events" ADD CONSTRAINT "party_identity_events_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "political_parties" ADD CONSTRAINT "political_parties_jurisdiction_id_jurisdictions_id_fk" FOREIGN KEY ("jurisdiction_id") REFERENCES "public"."jurisdictions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "political_parties" ADD CONSTRAINT "political_parties_identity_source_id_sources_id_fk" FOREIGN KEY ("identity_source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "party_composition_runs_body_recorded_idx" ON "party_composition_runs" USING btree ("body_id","recorded_at");--> statement-breakpoint
CREATE INDEX "party_identity_events_group_idx" ON "party_identity_events" USING btree ("event_group_key");--> statement-breakpoint
CREATE INDEX "party_identity_events_predecessor_idx" ON "party_identity_events" USING btree ("predecessor_party_id");--> statement-breakpoint
CREATE INDEX "party_identity_events_successor_idx" ON "party_identity_events" USING btree ("successor_party_id");--> statement-breakpoint
CREATE UNIQUE INDEX "political_parties_source_external_idx" ON "political_parties" USING btree ("identity_source_id","identity_external_id");--> statement-breakpoint
CREATE INDEX "political_parties_jurisdiction_idx" ON "political_parties" USING btree ("jurisdiction_id");--> statement-breakpoint
ALTER TABLE "legislature_parties" ADD CONSTRAINT "legislature_parties_party_id_political_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."political_parties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legislature_parties" ADD CONSTRAINT "legislature_parties_composition_run_id_party_composition_runs_id_fk" FOREIGN KEY ("composition_run_id") REFERENCES "public"."party_composition_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "legislature_parties_body_identity_idx" ON "legislature_parties" USING btree ("body_id","identity_key");--> statement-breakpoint
CREATE INDEX "legislature_parties_party_idx" ON "legislature_parties" USING btree ("party_id");--> statement-breakpoint
CREATE INDEX "legislature_parties_current_body_idx" ON "legislature_parties" USING btree ("body_id","is_current");--> statement-breakpoint
ALTER TABLE "legislature_parties" ADD CONSTRAINT "legislature_parties_current_retired_check" CHECK (("legislature_parties"."is_current" = true and "legislature_parties"."retired_at" is null) or ("legislature_parties"."is_current" = false and "legislature_parties"."retired_at" is not null));--> statement-breakpoint
CREATE TRIGGER political_parties_research_evidence_history
BEFORE UPDATE OR DELETE ON political_parties
FOR EACH ROW EXECUTE FUNCTION civica_capture_research_evidence_history();--> statement-breakpoint
CREATE TRIGGER party_composition_runs_append_only
BEFORE UPDATE OR DELETE ON party_composition_runs
FOR EACH ROW EXECUTE FUNCTION civica_reject_research_evidence_history_mutation();--> statement-breakpoint
CREATE TRIGGER party_identity_events_append_only
BEFORE UPDATE OR DELETE ON party_identity_events
FOR EACH ROW EXECUTE FUNCTION civica_reject_research_evidence_history_mutation();--> statement-breakpoint
-- civica-affected-relations: political_parties,party_composition_runs,party_identity_events,legislature_parties,government_bodies,jurisdictions,sources,statements,research_evidence_history
-- ATL-011 adopts one provisional entity per legacy chamber row, preserves every existing legislature_parties UUID and party_positions FK, and never infers cross-chamber continuity or split/merge lineage.
