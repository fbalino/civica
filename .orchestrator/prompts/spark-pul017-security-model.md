# SP PUL017 security model

You are a bounded, read-only architecture reviewer. Do not edit files and do not delegate.

Project root: `/Users/fernandobalino/Projects/civica`

Task: propose the smallest defensible persistence and authorization model for PUL-017, an independent double-coding and adjudication tool for Civica Pulse.

Read:

- project AGENTS/CLAUDE instructions and `DESIGN.md`
- PUL-017 in `plan/05-pulse-event-ledger-and-validation.md`
- `plan/research/pulse-independent-coding-codebook-v1.md`
- `src/lib/pulse/v2/coder-protocol.ts`
- `src/lib/admin/session.ts`
- existing admin route handlers and `src/lib/db/schema.ts` Pulse tables
- authoritative migration conventions in `drizzle/authoritative/` and `src/lib/db/authoritative-migration-manifest.ts`

Requirements:

- two assigned coders cannot read the other's labels before their own submission locks;
- locked raw submissions are immutable;
- comparison becomes visible only when both submissions lock;
- adjudicator is a distinct participant and cannot be either coder;
- adjudication never overwrites raw labels and may remain unresolved;
- packet/evidence/codebook versions are pinned;
- every meaningful action is exportable and audited;
- production/model/owner labels never enter coder or adjudicator payloads;
- access can later be granted to real external humans without sharing the owner admin account;
- no paid APIs and no claim that agent pilots are gold.

Return:

1. tables and critical columns/constraints;
2. session/invitation approach;
3. server-side authorization rules per route/action;
4. dangerous race conditions and transaction/unique-index controls;
5. minimum adversarial test matrix;
6. anything that should explicitly remain out of PUL-017.

Be concise and implementation-ready. No code changes.
