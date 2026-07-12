1. Tables and critical columns/constraints

Use a dedicated evaluation model separate from `raw_events`/`pulse_events_v2` to avoid contaminating runtime labels.

- `pulse_evaluation_runs` (study run header)
  - `id uuid pk`
  - `run_slug text unique` (e.g., `pul017-country-day-v1`)
  - `protocol_version text not null` (link to `PULSE_INDEPENDENT_CODING_PROTOCOL`)
  - `codebook_version text not null` (`pulse-independent-coding/v1`)
  - `ontology_version text not null` (`pulse-event-ontology/v3.0`)
  - `sample_set_sha256 text not null` (packet manifest fingerprint)
  - `trace_set_sha256 text not null` (search trace manifest fingerprint)
  - `status enum(draft|ready|closed|retired)`
  - `created_by text not null`, timestamps
  - Unique constraint on `(protocol_version, sample_set_sha256)` for idempotent reruns.

- `pulse_evaluation_packets` (one frozen unit)
  - `id uuid pk`, `run_id fk`
  - `packet_id text not null unique` (sample row ID)
  - `unit_type enum('country_day')` (+ optional extension)
  - `country_day date`, `sovereign_jurisdiction_id fk`
  - `packet_version text not null` (frozen frame version for this row)
  - `evidence_set_sha256 text not null`, `search_trace_sha256 text not null`
  - `codebook_version text not null`, `ontology_version text not null`
  - `payload jsonb not null` containing packet evidence IDs/trace refs (no prohibited actor content)
  - CHECK: fingerprints + versions non-empty.

- `pulse_evaluation_participants`
  - `id uuid pk`
  - `email text not null unique`
  - `role enum('coder','adjudicator','owner_proxy')`
  - `display_name text not null`
  - `auth_secret_hash text not null` (bcrypt/scrypt/argon)
  - `status enum('invited','active','revoked')`
  - `is_owner_proxy boolean not null default false` (owner ops only)
  - `created_at`, `revoked_at`.

- `pulse_evaluation_invitations`
  - `id uuid pk`
  - `participant_id fk nullable` (optional pre-created user)
  - `email text`
  - `secret_token_hash text unique not null` (one-time/short-lived)
  - `allowed_roles text[] not null` + `run_id`
  - `consumed_at`, `expires_at`, `revoked_at`
  - Unique `(email, run_id)`.

- `pulse_evaluation_assignments`
  - `id uuid pk`
  - `packet_id fk`, `participant_id fk`
  - `assignment_slot enum('coder_a','coder_b','adjudicator')`
  - `run_id fk`
  - `assigned_at`, `status enum('active','reassigned','revoked')`
  - UNIQUE `(packet_id, assignment_slot)` to enforce exactly two coder slots and one adjudicator slot.
  - CHECK: for coder slots, `participant_id` must reference role=coder.

- `pulse_coder_submissions`
  - `id uuid pk`
  - `packet_id fk`, `assignment_id fk`
  - `participant_id fk`
  - `schema_version text` / `pilot_version text` / `coder_protocol_version text`
  - `codebook_version text`, `ontology_version text`, `packet_version text`, `packet_snapshot_sha256 text`
  - `submission_json jsonb not null` (validated against `PulseCoderSubmission`; must pass no-forbidden-fields)
  - `locked boolean not null default false`
  - `locked_at timestamptz`, `payload_hash text not null`
  - `use_status enum('evaluation_candidate','dry_run_not_gold')`
  - `created_at/updated_at`
  - UNIQUE `(packet_id, participant_id)` and/or `(assignment_id)`
  - Trigger: deny UPDATE once `locked=true` (and DELETE always).
  - CHECK: `payload` must contain no `productionLabel`, `modelVote`, `ownerApproval`, etc. (enforced in app + optional DB check for forbidden keys).

- `pulse_packet_comparisons`
  - `id uuid pk`, `packet_id unique fk`
  - `submission_a_id fk`, `submission_b_id fk` (not-null)
  - `axes jsonb not null` (ordered diff axes per protocol)
  - `reason_codes text[] not null`
  - `needs_adjudication boolean not null`
  - `generated_at timestamptz not null`
  - CHECK `submission_a_id != submission_b_id`.

- `pulse_adjudications`
  - `id uuid pk`
  - `packet_id unique fk`, `run_id fk`
  - `adjudicator_id fk` (must not be either assigned coder IDs)
  - `status enum('resolved','unresolved','codebook_gap')`
  - `outcome jsonb` (one of: select a supported submission, write new adjudicated answer, or `null` for unresolved)
  - `reason text[]` and `resolution_basis text[]` (e.g., `insufficient_context`, etc.)
  - `created_at`, `updated_at`
  - `adjudication_version text not null` + packet/version snapshot columns
  - immutable semantics via “no overwrite” policy: only supersession (new row) or status update to terminal allowed, depending on needs.

- `pulse_evaluation_audit_log`
  - append-only audit for all actions above
  - `id uuid pk`, `packet_id fk`, `participant_id fk`, `actor_role`
  - `action text` (`submit`, `lock`, `compare`, `adjudicate`, `revoke_invite`, `assign`, `export`)
  - `entity text`, `entity_id text`, `request_id text`
  - `before jsonb`, `after jsonb`, `ip_hash text`, `created_at`
  - indices on `(packet_id, created_at)`, `(participant_id, created_at)`.

Why this shape? It preserves raw coder rows forever, keeps packet/evidence/version pins on every meaningful row, and gives a clean audit trail without touching production event projection tables until gold promotion.

References used:
[coder-protocol.ts](/Users/fernandobalino/Projects/civica/src/lib/pulse/v2/coder-protocol.ts), [admin/session.ts](/Users/fernandobalino/Projects/civica/src/lib/admin/session.ts), [schema.ts](/Users/fernandobalino/Projects/civica/src/lib/db/schema.ts), [plan/05](/Users/fernandobalino/Projects/civica/plan/05-pulse-event-ledger-and-validation.md), [research/codebook](/Users/fernandobalino/Projects/civica/plan/research/pulse-independent-coding-codebook-v1.md), [authoritative manifest](/Users/fernandobalino/Projects/civica/src/lib/db/authoritative-migration-manifest.ts)

2. Session/invitation approach

- Keep existing owner admin session (`/api/admin/session`) unchanged for pipeline/risk controls.
- Add a **separate evaluator auth domain** (`/api/pulse-eval/session`, cookie e.g. `civica_pulse_eval_session`) backed by:
  - server-side `pulse_evaluation_participants` + signed session row/token in `sessionStore` table (or signed cookie with nonce+HMAC + short TTL + db revocation list).
- Invitation flow: owner creates invitation in `pulse_evaluation_invitations`; token is delivered out-of-band and can only activate a dedicated evaluator session.
- Roles:
  - coders: two slots per packet
  - adjudicator: one slot per packet, independent of coders
  - owner_proxy: can create runs, assign packets, and export
- Enforce role checks per route, no owner account sharing required.

3. Server-side authorization rules (action-level)

- Owner/admin (`owner_proxy`):
  - CRUD runs/packets/assignments; create invites; export all artifacts.
  - Can read every submission/comparison/adjudication for QA.
- Coder (`coder`):
  - Can only access own assignment by `assignment_id`.
  - Can create/update own `submission_json` while unlocked.
  - Can lock own submission exactly once.
  - Cannot read other coder submissions or any adjudication rows.
- Adjudicator (`adjudicator`):
  - Cannot read any submission unless its own assignment context resolves to the packet.
  - Can read packet + both submissions only when both locked.
  - Can create/update adjudication row; may set `status='unresolved'`.
  - Must not act if `adjudicator_id` equals either coder id.
- General:
  - Block `use_status='dry_run_not_gold'` from any finalization/export path.
  - Block forbidden-field payloads at API boundary using existing forbidden list (`PULSE_CODER_FORBIDDEN_FIELDS`).

4. Dangerous races / integrity controls

- Use transaction + row locks (`FOR UPDATE`) for:
  - submission lock transitions
  - compare materialization
  - adjudication insertion
- Add uniqueness and checks:
  - `(packet_id, participant_id)` unique on submissions
  - `(packet_id, assignment_slot)` unique on assignments
  - `packet_id` unique on adjudication row (one active queue decision)
  - composite hash columns + check constraints for pinned versions (codebook/ontology/evidence/packet)
- Idempotency:
  - client sends `request_id`/`idempotency_key`; duplicate posts are safely deduped.
- Concurrency race guardrails:
  - lock transition must be `UPDATE ... WHERE locked = false` and verify `rowcount=1`
  - compare action must re-read both submissions inside same txn and verify `locked=true`
  - adjudication action must verify `comparison.needs_adjudication = true OR unresolved` and that no newer comparison exists without invalidating adjudication.
- Make `pulse_coder_submissions` updates blocked after lock; immutable raw rows preserve auditability.

5. Minimum adversarial test matrix

- Blinding:
  - Coder B cannot retrieve any fields from Coder A before either lock completes.
- Locking:
  - Duplicate lock attempts by same coder are idempotent or 409-safe; payload locked immutable after first lock.
- Mutation-after-lock:
  - Any payload update on locked submission is rejected.
- Role collision:
  - Adjudicator action with `actor_id` equal to either coder slot is denied.
- Version drift:
  - Submission with mismatched packet/codebook/ontology/evidence hash is rejected.
- Forbidden fields:
  - `productionLabel`, `ownerApproval`, `modelVote`, `goldLabel`, `truth` in coder/adjudication payload causes rejection.
- Concurrency:
  - Simultaneous coder submits and packet compare/adjudicate attempts cannot create partial state.
- Replay:
  - repeated POSTs with same request-id do not produce duplicate compare/adjudication/audit rows.
- Escalation:
  - `dry_run_not_gold` / pilot packet cannot flow to export or gold adjudication.
- Audit/export completeness:
  - export includes submission rows + hash chain + adjudication + audit events; compare can be recomputed from stored rows.

6. Explicitly out of PUL-017 scope

- Do **not** write adjudication decisions into `pulse_events_v2`/`pulse_event_decisions` directly as “truth” (except via a separate gold-promotion task with explicit gate).
- Do **not** claim coded adjudication is validated ground truth or a production signal.
- Do **not** use paid APIs in coding/adjudication workflow.
- Do **not** treat `agent_dry_pilot` as production labels.
- Do **not** change existing `/api/admin/pulse-review` semantics or owner-only review UI as the canonical gold path.
- Do **not** delete or mutate source evidence rows; retain append-only records and supersession-only audit trail.
