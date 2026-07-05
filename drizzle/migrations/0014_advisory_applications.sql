-- Advisory-board applications — inbound "apply to join the academic advisory
-- board" submissions (v2 methodology spec §3.1).
--
-- Backs the public `/about/advisory-board/apply` form (a fetch() POST to
-- `/api/advisory-applications`). The owner triages new applications through the
-- bearer/session-gated admin surface at `/admin/advisory-applications`
-- (new → reviewed → contacted → archived), mirroring how contact submissions
-- arrive — DB row + authed admin read, no email provider wired.
--
-- Hand-authored (idempotent, `IF NOT EXISTS`) rather than drizzle-kit-generated
-- because the repo's drizzle snapshot baseline is out of sync with the live DB
-- (a pre-existing Phase F state issue, not in this change's scope — see the
-- matching notes in 0012_bug1_value_type.sql and 0013_electoral_systems.sql).
-- Applied to the live DB via `drizzle-kit push`; this file records the change
-- idempotently so the migration history stays complete.

CREATE TABLE IF NOT EXISTS "advisory_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"institution" text NOT NULL,
	"role" text NOT NULL,
	"expertise_area" text NOT NULL,
	"experience" text NOT NULL,
	"links" text,
	"cv_url" text,
	"ip_address" text,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
