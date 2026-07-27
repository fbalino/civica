# Civica Atlas — operational runbooks (PLT-024)

Accountable owner for every runbook: **Fernando Baliño** (GOV-001/002). Status
page: https://statuspage.incident.io/civica-atlas. Each runbook names
detection, containment, rollback/correction, user communication, evidence
preservation, and recovery verification. A tabletop review of each is recorded
at the end.

---

## 1. Upstream data-source breakage

- **Detection:** a scheduled sync fails, returns zero rows, or an anomalous
  delta. Job observability (PLT-017 target) and `markSourcesSynced()` — which
  stamps `last_sync_at` only on a successful row-writing run — mean a broken
  sync does **not** advance freshness. `SourceDot` shows the stale/frozen state
  to readers.
- **Containment:** the adapter fails closed (DAT-012) and leaves the prior
  canonical values intact; nothing partial is published. No action degrades
  the rest of the atlas.
- **Owner:** Fernando (may reassign a specific adapter).
- **Rollback/correction:** re-run the adapter once upstream recovers
  (idempotent; reruns converge). If upstream changed schema, patch the adapter,
  add a fixture, and rerun.
- **User communication:** if a source is stale beyond its cadence, the reader
  provenance dot already shows it; post to the status page only if a whole
  domain is affected.
- **Evidence preservation:** the failed run's error summary and the unchanged
  `last_sync_at` are the record; do not fake freshness.
- **Recovery verification:** `npm run validate:sync-freshness`; confirm the
  source's `last_sync_at` advanced and row counts are plausible
  (`validate:release-quality`).

## 2. Bad release (data or code)

- **Detection:** post-deploy smoke/browser checks fail, a release-quality
  anomaly appears, or a reader/owner reports broken output.
- **Containment:** frozen vintages are immutable (DAT-023), so a bad recompute
  cannot overwrite a published vintage. Code: Vercel keeps prior deployments.
- **Owner:** Fernando.
- **Rollback/correction:** `vercel redeploy <prior-good-prod-url>` (or promote
  the previous deployment). For data, publish a new superseding vintage
  (never mutate the old one); the migrator runs before build so schema is
  compatible.
- **User communication:** a correction/retraction follows the `/policies`
  contract (CLM-016) with a changelog entry and supersession marker.
- **Evidence preservation:** keep the bad deployment URL, the diff, and the
  release-quality report.
- **Recovery verification:** `npm run build` green on the restored commit;
  critical browser journeys pass; `validate:release-quality` clean.

## 3. Compromised or leaked credential

- **Detection:** `npm run validate:secrets` / `validate:secrets:history`
  (PLT-007) flags a key in the tree or history; or a provider alerts.
  **A live Neon `DATABASE_URL` is currently flagged in git history** (see
  `plan/MANUAL-CHECKS.md`, PLT-007).
- **Containment:** treat the credential as burned immediately.
- **Owner:** Fernando.
- **Rollback/correction:** rotate at the source — Neon (reset the role
  password), Anthropic/DeepSeek/GLM/OpenAI (revoke + reissue the key),
  `ADMIN_SESSION_SECRET`/`ADMIN_PASSWORD_HASH` (`npm run admin:set-password`,
  new `openssl rand -hex 32` — this signs out all admin sessions),
  `CRON_SECRET`. Update the value in Vercel (REST or CLI) and `.env.local`, then
  `vercel redeploy` (env changes only affect new deployments). If the secret is
  in git history, decide on a history purge (`git filter-repo`/BFG — a
  force-push that rewrites shared history).
- **User communication:** internal unless data was exfiltrated; a data breach
  triggers the correction/notification policy.
- **Evidence preservation:** the scanner's non-reversible hash record in
  `scripts/secret-scan-allowlist.json`; never re-commit the plaintext.
- **Recovery verification:** the old credential is rejected by the provider;
  `validate:secrets` clean on the current tree; app functions on the new value.

## 4. Model/provider outage

- **Detection:** Pulse classify/verify or `/api/chat` returns provider errors;
  the env contract's `degrades` set (PLT-006) documents which features depend on
  which keys.
- **Containment:** by design, degradation is graceful — a missing/erroring
  provider key makes the Pulse classify cron **no-op** (it never fakes results),
  and Ask Civica degrades safely. No reader data surface breaks.
- **Owner:** Fernando.
- **Rollback/correction:** wait out a transient outage; for a durable one,
  switch provider via `PULSE_CLASSIFY_ENSEMBLE`/`PULSE_ENSEMBLE_VERIFY`
  (a provider/model substitution creates a new methodology version).
- **User communication:** Pulse copy already distinguishes schedule from
  successful completion; no claim of a completed run is made when the cron
  no-ops.
- **Evidence preservation:** the run manifest records the failed provider.
- **Recovery verification:** a subsequent scheduled cycle completes; stored
  runs show the expected providers.

## 5. Stale map tiles / missing assets

- **Detection:** the country map renders blank, or portraits/engravings 404.
- **Containment:** the 2D map falls back from self-hosted PMTiles
  (`NEXT_PUBLIC_BASEMAP_PMTILES_URL`) to keyless OpenFreeMap automatically;
  country pages tolerate a missing engraving. Externally hosted Wikimedia
  Commons images are the fragile class (DAT-021 manual check).
- **Owner:** Fernando.
- **Rollback/correction:** re-upload the PMTiles archive / fix the URL; for a
  moved Wikimedia image, archive an owned copy or update the reference.
- **User communication:** status page only if the whole map is down.
- **Evidence preservation:** note which asset and source failed.
- **Recovery verification:** map loads tiles (network 200s); the asset renders
  in a real browser check.

## 6. Legal takedown / rights complaint

- **Detection:** a rights holder or authority contacts the published channel.
- **Containment:** identify the exact entity/field/asset/source; if credible,
  temporarily withhold the specific value (the rights manifest and value-state
  contract support withholding without deleting evidence).
- **Owner:** Fernando; escalate to counsel (BRD-003/010 manual queue) before a
  substantive rights conclusion.
- **Rollback/correction:** the complaint/correction flow (BRD-015) authenticates
  the claim, preserves evidence, applies containment, and records the final
  action and a public correction where warranted, without exposing personal
  data.
- **User communication:** a correction/version entry per `/policies`.
- **Evidence preservation:** the request, decision, and version history are
  retained immutably.
- **Recovery verification:** the affected surface reflects the decision; the
  rights manifest and any supersession are consistent.

## 7. Incorrect country fact

- **Detection:** a reader report (ATL-024 flow), a release-quality anomaly, or
  the DAT-034 fidelity audit.
- **Containment:** the reconciliation resolver already prefers the best-sourced
  value; a corrupt parse is quarantined as rejected evidence (DAT-029), not
  published.
- **Owner:** Fernando.
- **Rollback/correction:** fix at the source of truth — correct the adapter/
  parser or the canonical selection, add a regression fixture, and republish a
  new vintage. Never hand-edit a frozen vintage; supersede it.
- **User communication:** a correction entry with the old/new value, source,
  and reason (`/policies`, CLM-016).
- **Evidence preservation:** the prior value, source, and decision trace remain
  in history (research-evidence retention, DAT-016).
- **Recovery verification:** the fact resolves to the corrected value on the
  country page and export; `validate:release-quality` clean.

---

## Tabletop review (2026-07-12) — recorded gaps

Each runbook was walked through against the current implementation.

- **#3 compromised key — LIVE GAP:** a real leaked Neon credential is in git
  history and **not yet rotated** (queued in `plan/MANUAL-CHECKS.md`). This is
  the one runbook with an open, unresolved incident.
- **Detection depends on unbuilt monitoring:** #1/#4/#5 detection references
  job/error observability and alerts owned by PLT-017/018/020, which are not
  yet built — today detection is manual (a failed run, a reader report). Until
  then, add a manual weekly check of the status page and source freshness.
- **User communication is single-channel:** the status page and the `/policies`
  correction flow exist; there is no subscriber notification system (by design,
  APR-D031). Communication is pull, not push.
- **No automated rollback:** rollback is a manual `vercel redeploy` /
  supersede-vintage; no one-click rollback exists. Acceptable for a single-owner
  project; revisit if contributors are added.
- **Legal (#6):** substantive steps depend on counsel (BRD-003/010), which is a
  manual/external gate not yet engaged.
