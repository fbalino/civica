# QA-018 owner sign-off — 2026-08-09

Decision: **confirmed.** Fernando reviewed the runbook summary of the
completed isolated run and authorized it in writing in the 2026-08-09 working
session ("i authorize five", enumerated as the runbook's Phase 3 items
excluding the Pulse wave). The confirmed run is attempt 06
(`attempt-06-isolated-preview-smoke-2026-07-26.md`, bounded machine record
`run-06-preview-smoke.v1.json`), which passed the isolated Neon/Vercel
Preview migration, release, API, cache, protected-route, idempotent-dry-run,
and responsive-browser checks through migration head
`0050_index_release_header_contract`.

Scope boundary preserved: this sign-off confirms the staging protocol and its
completed isolated run only. It is not production promotion. The same
2026-08-09 authorization separately covers, as distinct operator runs still
to be executed under their own packets:

- the Conditions production batch (ATL-026/ATL-027 authority granted);
- the ATL-020/ATL-024 additive migrations 0046/0047;
- the ATL-010 / DAT-036 / EXP-029 named-release Wikidata refresh and
  migration 0048; and
- the QA-019 staging rollback/forward-fix rehearsal.

The Pulse wave (PUL-043/024/027 → PUL-040) was explicitly **not** authorized
pending an operating-cost decision; no Pulse clock is started by this record.
