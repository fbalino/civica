-- Contact-message triage status — additive column for the admin Messages
-- surface.
--
-- The public contact form (`/contact` → `/api/contact`) inserts rows into
-- `contact_submissions` and never touches this column. The owner triages
-- messages through the session/bearer-gated admin surface at `/admin/messages`
-- (new → read → archived), mirroring how advisory applications work — DB row +
-- authed admin read, no email provider wired. The status is flipped only via
-- the authed `/api/admin/messages/[id]` route.
--
-- Hand-authored (idempotent, `IF NOT EXISTS`) rather than drizzle-kit-generated
-- because the repo's drizzle snapshot baseline is out of sync with the live DB
-- (a pre-existing state issue — see the matching notes in
-- 0014_advisory_applications.sql). Apply to the live DB via `drizzle-kit push`;
-- this file records the change idempotently so the migration history stays
-- complete. Existing rows backfill to 'new' via the column default.

ALTER TABLE "contact_submissions"
	ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'new' NOT NULL;
