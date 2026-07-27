# QA-019 local correction changelog

## 2026-07-27 — isolated Preview release-marker mismatch

- Scope: a protected Vercel Preview backed only by the disposable QA-018 Neon child branch.
- Detection: the retained marker expected `recovered` and returned `bad`.
- Containment: the deployment had no Civica production alias and the child database had zero active cron leases.
- Recovery: forward-fix commit `9db1f5c82699de42487fdfbc7646eeb914cbd418` received a fresh full build and distinct Ready Preview.
- Data impact: none. Migration head, schema fingerprint, Conditions, Index, Pulse, and source freshness remained unchanged.
- Correction record: `7e914c77-1727-4f85-bd41-38a2e43f43e8` is synthetic, non-public, contains no personal data, and resolved as `resolved_no_change`.
- Monitoring event: `9c1a6d6c-654a-4f0f-a7ed-9f9644c997ce` is linked to the correction and resolved.
- External status: not created. No subscriber notice is claimed.
- Owner review: not supplied. QA-019 remains open pending the external status record and Fernando's dated disposition.
