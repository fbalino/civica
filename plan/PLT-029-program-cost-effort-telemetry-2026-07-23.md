# PLT-029 — Program cost and effort telemetry

## Status

Agent-executable preparation is complete. The append-only ledger is
`data/program-cost-effort-ledger.v1.json` under contract
`civica-program-cost-effort-ledger/v1`.

The ledger covers G0 through G6 and preserves two contiguous weekly snapshots
from the academic-readiness program start through 2026-07-23. It binds the
checked orchestrator's subscription-only, API-not-approved, USD 0 cap and uses
Git commit counts/active days only as activity proxies.

PLT-029 remains unchecked. The repository cannot prove Fernando's exact OpenAI
or Anthropic subscription tiers, actual provider billing, committed external
human spend, or reliable labor hours. Those fields are null and marked
`owner_required`; no zero has been invented.

## Accounting-estimate boundary

Seventeen retained worker/result records contain `costUSD` fields totalling
USD 34.811507. These are model accounting estimates, not invoices and not proof
of metered API use. They are reconciled as `non_billing_telemetry` while the
orchestrator budget remains subscription-only and paid API use remains
unauthorized.

## Future update procedure

1. Append a snapshot at every G-gate decision and no later than seven days
   after the last active snapshot.
2. Record subscription plans only after owner confirmation.
3. Reconcile paid API spend from owner/provider billing evidence against the
   checked `.orchestrator/state.json` cap.
4. Record external-human spend only after authorization; an explicit zero also
   requires owner confirmation.
5. Record hours only from a reliable time record. Git activity is never a
   substitute for labor hours.
6. Run `npm run validate:program-cost-effort`.

The checklist item may be checked only after every unresolved owner fact is
closed and the ledger status becomes `complete`.
