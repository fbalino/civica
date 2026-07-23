# QA-019 — Rollback/forward-fix and correction evidence

Status: agent-executable protocol and evidence contract complete; actual
staging recovery drill pending owner/platform authority and QA-018.

`data/ROLLBACK-FORWARD-FIX-REHEARSAL.md` constrains the deliberately bad release
to a harmless staging-only fixture. The JSON record requires detection,
quiescence, containment, compatible rollback or forward fix, application/data/
cache/artifact/version verification, correction/status/changelog evidence, and
dated owner sign-off before it can become complete.

The record is `pending_external_authority`; every check is `not_run` and every
provider/recovery/correction identity is empty. No defective release was
deployed and no external state changed.

Verification:

```sh
npm run validate:external-release-rehearsal
```
