# PLT-017 source review — 2026-07-15

## Vercel official documentation

- [Cron Jobs](https://vercel.com/docs/cron-jobs) — consulted 2026-07-15. It
  documents UTC schedules, best-effort delivery, and the need for job code to
  tolerate missed or duplicate invocations.
- [Managing Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs) —
  consulted 2026-07-15. It documents cron delivery logs and that Vercel does
  not retry failed cron invocations on the application's behalf.

## Applied decision

Keep PLT-010's durable delivery lease and idempotency boundary. It derives a
stable logical execution key for each scheduled slot, and the observability
ledger reuses that row when the delivery boundary retries after a finalization
failure. A separate daily alert job compares the registered schedule with
retained runs after a two-hour grace period; Vercel delivery logs alone are not
treated as proof that a job started or completed.
