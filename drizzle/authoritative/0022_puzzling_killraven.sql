CREATE TABLE "pulse_coding_comparisons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"packet_id" uuid NOT NULL,
	"coder_assignment_a_id" uuid NOT NULL,
	"coder_assignment_b_id" uuid NOT NULL,
	"comparison" jsonb NOT NULL,
	"comparison_sha256" text NOT NULL,
	"disagreement_axes" text[] NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pulse_coding_comparisons_packet_id_unique" UNIQUE("packet_id"),
	CONSTRAINT "pulse_coding_comparisons_contract_check" CHECK ("pulse_coding_comparisons"."coder_assignment_a_id" <> "pulse_coding_comparisons"."coder_assignment_b_id" AND "pulse_coding_comparisons"."comparison_sha256" ~ '^[a-f0-9]{64}$' AND jsonb_typeof("pulse_coding_comparisons"."comparison") = 'object')
);
--> statement-breakpoint
ALTER TABLE "pulse_coding_adjudications" DROP CONSTRAINT "pulse_coding_adjudications_packet_id_unique";--> statement-breakpoint
ALTER TABLE "pulse_coding_adjudications" DROP CONSTRAINT "pulse_coding_adjudications_contract_check";--> statement-breakpoint
ALTER TABLE "pulse_coding_adjudications" DROP CONSTRAINT "pulse_coding_adjudications_blind_payload_check";--> statement-breakpoint
DROP TRIGGER "pulse_coding_adjudicator_guard" ON "pulse_coding_adjudications";--> statement-breakpoint
ALTER TABLE "pulse_coding_adjudications" DROP CONSTRAINT "pulse_coding_adjudications_packet_id_pulse_coding_packets_id_fk";
--> statement-breakpoint
ALTER TABLE "pulse_coding_adjudications" ADD COLUMN "comparison_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "pulse_coding_comparisons" ADD CONSTRAINT "pulse_coding_comparisons_packet_id_pulse_coding_packets_id_fk" FOREIGN KEY ("packet_id") REFERENCES "public"."pulse_coding_packets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_coding_comparisons" ADD CONSTRAINT "pulse_coding_comparisons_coder_assignment_a_id_pulse_coding_assignments_id_fk" FOREIGN KEY ("coder_assignment_a_id") REFERENCES "public"."pulse_coding_assignments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_coding_comparisons" ADD CONSTRAINT "pulse_coding_comparisons_coder_assignment_b_id_pulse_coding_assignments_id_fk" FOREIGN KEY ("coder_assignment_b_id") REFERENCES "public"."pulse_coding_assignments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_pulse_coding_comparison_disagreements" ON "pulse_coding_comparisons" USING btree ("generated_at");--> statement-breakpoint
ALTER TABLE "pulse_coding_adjudications" ADD CONSTRAINT "pulse_coding_adjudications_comparison_id_pulse_coding_comparisons_id_fk" FOREIGN KEY ("comparison_id") REFERENCES "public"."pulse_coding_comparisons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulse_coding_adjudications" DROP COLUMN "packet_id";--> statement-breakpoint
ALTER TABLE "pulse_coding_adjudications" DROP COLUMN "comparison";--> statement-breakpoint
ALTER TABLE "pulse_coding_adjudications" DROP COLUMN "comparison_sha256";--> statement-breakpoint
ALTER TABLE "pulse_coding_adjudications" ADD CONSTRAINT "pulse_coding_adjudications_comparison_id_unique" UNIQUE("comparison_id");--> statement-breakpoint
ALTER TABLE "pulse_coding_adjudications" ADD CONSTRAINT "pulse_coding_adjudications_contract_check" CHECK ("pulse_coding_adjudications"."status" IN ('pending','resolved','unresolved') AND (("pulse_coding_adjudications"."status" = 'pending' AND "pulse_coding_adjudications"."resolution" IS NULL AND "pulse_coding_adjudications"."resolution_sha256" IS NULL AND "pulse_coding_adjudications"."resolved_at" IS NULL) OR ("pulse_coding_adjudications"."status" IN ('resolved','unresolved') AND "pulse_coding_adjudications"."resolution" IS NOT NULL AND "pulse_coding_adjudications"."resolution_sha256" ~ '^[a-f0-9]{64}$' AND "pulse_coding_adjudications"."resolved_at" IS NOT NULL AND cardinality("pulse_coding_adjudications"."reason_codes") > 0)));
--> statement-breakpoint
ALTER TABLE "pulse_coding_comparisons"
ADD CONSTRAINT "pulse_coding_comparisons_blind_payload_check"
CHECK (NOT civica_pulse_coding_has_forbidden_field("comparison"));
--> statement-breakpoint
ALTER TABLE "pulse_coding_adjudications"
ADD CONSTRAINT "pulse_coding_adjudications_blind_payload_check"
CHECK (NOT civica_pulse_coding_has_forbidden_field("resolution"));
--> statement-breakpoint
CREATE OR REPLACE FUNCTION civica_validate_pulse_coding_comparison()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  assignment_a_packet uuid;
  assignment_a_slot text;
  assignment_a_status text;
  assignment_b_packet uuid;
  assignment_b_slot text;
  assignment_b_status text;
BEGIN
  SELECT packet_id, slot, status
  INTO assignment_a_packet, assignment_a_slot, assignment_a_status
  FROM pulse_coding_assignments
  WHERE id = NEW.coder_assignment_a_id;

  SELECT packet_id, slot, status
  INTO assignment_b_packet, assignment_b_slot, assignment_b_status
  FROM pulse_coding_assignments
  WHERE id = NEW.coder_assignment_b_id;

  IF assignment_a_packet IS DISTINCT FROM NEW.packet_id
     OR assignment_b_packet IS DISTINCT FROM NEW.packet_id
     OR assignment_a_slot <> 'coder_a'
     OR assignment_b_slot <> 'coder_b'
     OR assignment_a_status <> 'locked'
     OR assignment_b_status <> 'locked' THEN
    RAISE EXCEPTION 'Pulse coding comparison requires both locked coder assignments for one packet';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER pulse_coding_comparison_assignment_guard
BEFORE INSERT ON "pulse_coding_comparisons"
FOR EACH ROW EXECUTE FUNCTION civica_validate_pulse_coding_comparison();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION civica_validate_pulse_coding_adjudication()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  comparison_packet uuid;
  assignment_packet uuid;
  assignment_slot text;
BEGIN
  SELECT packet_id
  INTO comparison_packet
  FROM pulse_coding_comparisons
  WHERE id = NEW.comparison_id;

  SELECT packet_id, slot
  INTO assignment_packet, assignment_slot
  FROM pulse_coding_assignments
  WHERE id = NEW.adjudicator_assignment_id;

  IF assignment_packet IS DISTINCT FROM comparison_packet
     OR assignment_slot <> 'adjudicator' THEN
    RAISE EXCEPTION 'Pulse coding adjudication requires the comparison packet adjudicator assignment';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER pulse_coding_adjudicator_guard
BEFORE INSERT OR UPDATE OF comparison_id, adjudicator_assignment_id
ON "pulse_coding_adjudications"
FOR EACH ROW EXECUTE FUNCTION civica_validate_pulse_coding_adjudication();
--> statement-breakpoint
CREATE TRIGGER pulse_coding_comparisons_append_only
BEFORE UPDATE OR DELETE ON "pulse_coding_comparisons"
FOR EACH ROW EXECUTE FUNCTION civica_reject_pulse_coding_evidence_mutation();
