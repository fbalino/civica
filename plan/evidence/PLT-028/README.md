# PLT-028 — bounded public research feeds

`plan/PLT-028-research-feed-server-pagination-2026-07-18.md` is the complete
acceptance record. It documents the server-side Pulse and disputes boundaries,
the declared query/response ceilings, response measurements, fixture guards,
and the isolated real-browser run.

The implementation is guarded by:

- `src/app/(reader)/civica-index/pulse-changelog/query.test.ts`
- `src/app/(reader)/country/methodology/reconciliation/disputes/query.test.ts`
- `e2e/plt-028-server-pagination.spec.ts`
- `e2e/plt-028-disputes-server-pagination.spec.ts`
- `npm run validate:query-budgets`
