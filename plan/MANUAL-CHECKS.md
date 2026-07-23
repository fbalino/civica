# Civica Academic Publication Readiness — Manual and External Checks

This queue contains checks an agent cannot honestly complete. Preparing the material is agent work; obtaining the external result is not. Add the originating task ID, exact question, responsible person, required artifact, and result when known.

## Legal and brand

- **BRD-003 · Owner/counsel:** review
  `plan/research/brand-confusion-landscape-2026-07-23.md`,
  `plan/evidence/BRD-002/official-registry-records-2026-07-23.md`, and the
  BRD-004 decision rubric before broad launch. First confirm the intended
  geography, legal owner/entity, first-use evidence, current and planned
  services, commercial posture, exact verbal/visual marks, and migration cost.
  Counsel must validate the incomplete US/EU/Uruguay searches and the national
  effect of WIPO designations; assess the registered UK `CIVICA` word mark and
  other common-law/registry rights; determine whether adding `Atlas`, the
  non-commercial posture, disclaimers, or coexistence options change the
  analysis; and give a written recommendation or privileged decision summary.
  The owner then records keep/constraint/rename disposition. No namesake
  contact, filing, domain purchase, or rename is authorized by this queue item.
- **BRD-007 · Owner/counsel:** review the root `LICENSE`, `NOTICE`, APR-D169,
  `data/research/authorship-and-contributions-v1.json`,
  `data/research/ai-use-disclosure-v1.json`, Git contributor history, the
  current direct-dependency license inventory, and any generated/file-level
  notices before broad launch. Confirm the legal copyright holder and year
  wording, whether the single differently named Git contributor created
  protectable work or assigned it, whether a contributor agreement is needed,
  how AI-assisted/generated code should be treated in the launch
  jurisdictions, and whether Mapbox/MPL/other package obligations are
  satisfied in deployed and distributed forms. Record written advice or a
  privileged decision summary and any required corrections. Until then the
  repository remains non-open; this queue item does not authorize an
  open-source grant or third-party reuse.
- **BRD-010 · Owner/counsel — pending:** review
  `data/EDITORIAL-ILLUSTRATION-RIGHTS.md`,
  `civica-editorial-illustration-rights/v1`, the checked illustration
  manifest, the historical missing-session posture, the AI-use disclosure,
  BRD-011 asset inventory, and BRD-015 complaint flow. Confirm the intended
  launch jurisdictions; generation-provider output terms; the scope of any
  human copyright claim; reference-image/derivative-work evidence;
  architecture/freedom-of-panorama, trademark/insignia, and
  personality/likeness screening; manifest/evidence retention; complaint and
  containment procedure; and no-separate-reuse-license wording. Record written
  advice or a privileged decision summary plus Fernando's
  accept/change/withhold disposition. Uncommitted image trials remain outside
  the checked release manifest and are not cleared by this queue item.
- **BRD-012 · Owner/privacy professional — pending:** review
  `data/PRIVACY-DATA-HANDLING.md`, the public `/privacy` notice, and
  `civica-privacy-data-handling/v1` for operator identity, applicable
  jurisdictions/lawful bases, contextual consent, rights-request handling,
  retention, security, subprocessors, and cross-border transfers. First run
  `npm run plan:legacy-private-identifiers`; only after Fernando explicitly
  authorizes the production mutation, rerun it with `--apply` and the exact
  confirmation flag and record aggregate before/after counts only. Both legacy
  IP counts must become zero. Separately verify the actual Vercel log
  plan/settings, Anthropic organization retention arrangement, configured
  PMTiles host, and current FlagCDN/OpenFreeMap/Mapbox boundaries. No
  production purge, provider-setting change, agreement, or professional
  clearance is claimed by the local preparation.
- Professional review of database rights, source-specific redistribution
  terms, AI-assisted illustration disclosure, privacy, and terms before the
  DOI release.

## Academic review

- Independent governance-measurement review of the Index tournament protocol before results are interpreted.
- Independent political event-data review of the Pulse codebook, sampling design, annotation protocol, observability model, and validation results.
- Research-data librarian or data-curation review of the frozen release, rights manifest, metadata, citation, DOI deposit, checksums, and reproducibility instructions.
- Accessibility review by a qualified human using keyboard and assistive technology after automated and browser checks pass.

## Owner judgment

- **EXP-001 · Qualified visual reviewer:** use the checked
  `data/rendered-module-ledger.v1.json` and
  `data/rendered-module-evidence.v1.json` registry to locate each exact source
  module in desktop/mobile and light/dark browser evidence. Record an exact
  module-source disposition as clean, finding, or not observed; route-wide
  QA-013 candidate context cannot be promoted automatically. Use safe fixtures
  for private admin/reviewer routes and never retain credentials or personal
  data in screenshots.
- Approve the representative engraving color-grade pilot before any corpus-wide transformation.
- **EXP-009 · Qualified visual reviewer:** inspect the four hash-pinned
  France/United Kingdom candidates in `plan/evidence/EXP-009/` against the
  adopted engraving contract, intended desktop/mobile hero crops, landmark
  sources, and light/dark relationship. Record approve/reject/revise for each
  pair with reviewer, date, exact hashes, and reason. Approval authorizes only
  a later checked asset replacement; it is not itself a production change or
  a source-evidence claim.
- Select one of three design-system-compliant Explore navigation concepts before new artwork or final implementation; review `plan/EXP-014-explore-navigation-concepts-2026-07-18.md` and its dated browser mockups first.
- Approve any shortlist of replacement names before legal clearance or migration work.
- Approve reviewer identities, conflict disclosures, honoraria, contact copy, and outreach sequencing before contact.
- **GOV-010 · Owner:** review `plan/research/reviewer-ranking-v1.md`, approve or revise the proposed ordering with a recorded rubric-based reason, and confirm which alternates remain contact-ready. This is not authorization to contact; GOV-016 must still pass first.
- **GOV-003 · Owner:** complete the seven factual fields in `plan/research/project-disclosure-owner-confirmation-v1.md`: funding/payer, grants or sponsorship, material in-kind support, relevant affiliations/interests, vendor/source relationships, third-party control rights, and approval to publish/update the resulting disclosure. The repo cannot prove a no-funding or no-conflict state from silence.
- **GOV-012 · Owner:** choose and sign the compensation posture in `plan/research/reviewer-honorarium-decision-brief-v1.md`. The recommendation is fixed honoraria of $1,000 for each 8–12-hour Atlas/Index review and $1,500 for each 12–16-hour Pulse review, with a $12,075 first-wave ceiling for nine primaries including a 15% logistics reserve. Also identify the paying person/entity and jurisdiction so accounting can confirm forms, withholding, currency, fees, and institutional-payment handling. This approval does not authorize contact; GOV-016 and G4 still apply, and Pulse also waits for GOV-015.
- **EXP-038 · Owner:** review
  `plan/EXP-038-english-copy-review-2026-07-23.md` and approve, revise, or
  reject each proposed English copy item. Confirm whether the home independence
  label is supported by the completed GOV-003 facts, whether contact carries a
  monitored three-business-day response target, and whether ATL-024 is active
  before selecting its dedicated correction CTA. Record the approved item IDs,
  decision date, and source commit. Approval authorizes only the listed English
  copy edits; it does not authorize translation, a production deployment, a
  legal claim, or an external message.
- Approve the final public disposition of each experimental measurement after its resolution and external review are complete.
- **EXP-030 / EXP-031 · Owner decision — embed disposition (found 2026-07-12):** the Civica Index score embed (`/embed/[slug]`) is retired (HTTP 410 stub) under the atlas-first decision, so there are no live size presets to repair, and the old preset builder (`src/components/widget/WidgetBuilder.tsx` + `WidgetCopyButton.tsx`) is **orphaned dead code — mounted in no route** and still points its generated iframes at the 410 endpoint. Hardening the retired stub's HTML (add `<h1>`, `robots noindex`) is blocked because the route is an Index-change-control **protected presentation file**, so any edit requires the full methodology-change ceremony (version advance + all six evidence roles) — disproportionate for a cosmetic fix to a retired page. Decide the structural path: (a) formally **de-protect** the retired embed route from `INDEX_PROTECTED_FILES` via a proper change-control record, then harden its document, or (b) fold EXP-030 into **EXP-031** (source-native embed redesign), which will rebuild or remove the route and the orphaned builder through the same ceremony. Until then EXP-030 stays open.
- **PUL-039 · Owner:** approve the independent-coder recruitment plan — candidate pool, compensation posture and budget ceiling, blinding/independence terms, and start timing — before any candidate is contacted. Allow six to eight weeks after contact authorization to recruit, screen, contract, train, and qualify the panel. PUL-041's packet prerequisite is complete; external contact remains blocked until G4 and this approval.
- **PUL-040 · Owner/platform:** deploy the locked `pulse-v2.15-beta` branch before the prospective clock can start, then allow one complete scheduled ingest → cluster → classify → corroborate/score cycle to finish under that exact method. Production currently serves `pulse-v2.8-beta`; the live ledger has no successful v2.15 ingest, cluster, or classify run and the classification queue contains 746 eligible clusters. Do not backdate the window. A manual paid classifier run requires separate approval naming providers/models, a maximum cluster/call count, and a hard USD cap; otherwise wait for the first post-deployment cron cycle.

## External systems

- **PLT-001 · Owner/platform:** push the canonical CI branch, confirm the first hosted `verify` job succeeds on both a pull request and `main`, then enable branch protection or a repository ruleset that requires `verify`. Record the run URLs and ruleset screenshot/export under `plan/evidence/PLT-001/`; no hosted run or protection setting is claimed by the local implementation.
- **PLT-009 · Owner/platform:** after the deployment applies `0033_flat_hardball`, sign in on staging/production, copy the signed cookie into an isolated browser profile, log out in the first profile, and confirm the copied cookie receives `401` without reaching a harmless admin validation path. Confirm the matching hashed tombstone plus attempted/succeeded logout audit rows and one ordinary admin mutation attempt/outcome pair exist, without recording or sharing the raw cookie. This is a post-deploy smoke check; the credential-free local revocation and audit tests are already complete.
- **PLT-010 · Owner/platform — pending:** after deployment applies `0034_superb_the_fallen` and `0035_equal_marvex`, run one safe non-model cron dry run with a unique stable `Idempotency-Key`, record the redacted HTTP status, repeat the identical request, and confirm `200 duplicate_suppressed`, one terminal execution, one completed attempt, and no `sources.last_sync_at` change. Confirm only hashed request/key identities appear in the ledger. After the next ordinary scheduled Pulse classify run, verify read-only that any classify delivery binding points to the expected persisted classify run; do not start a paid manual classifier run solely for this check. Store bounded/redacted output under `plan/evidence/PLT-010/`.
- **PLT-011 · Owner/platform — pending:** after the branch exists remotely, configure the independent `RATE_LIMIT_KEY_SECRET` for Preview without printing or retaining it, then deploy an isolated Preview against a test database. Confirm spoofed and chained forwarding headers cannot mint fresh identities; concurrent requests through at least two function instances allow exactly the configured budget and then return `429`; a deliberately unavailable counter/key returns fail-closed `503` without protected work; recovery succeeds after restoring configuration; Pulse sign-out still clears its browser cookie during a counter outage; and the checked Vercel all-path 600/60-second/IP Challenge rule remains active with no draft. Production already has the encrypted key, but no PLT-011 application deployment or destructive production exhaustion test is claimed. Store only redacted counts, deployment IDs, and timestamps under `plan/evidence/PLT-011/`.
- **PLT-018 · Owner/platform — pending:** before setting `VERCEL_PROTECTED_SOURCEMAPS=true`, enable **Protected Source Maps** in Vercel Project Settings → Deployment Protection. Apply `0039_living_clea` only through PLT-019's staged procedure, deploy an isolated protected Preview/staging build, and verify while authenticated to Vercel that its browser map is protected. Trigger one safe seeded monitoring event, confirm the durable record has only the closed release/route-or-job/source-map fields, confirm the owned Runtime Logs alert, link an opaque correction or status record ID, and resolve it. Record only deployment IDs, timestamps, bounded fields, and redacted result counts under `plan/evidence/PLT-018/`; do not retain a map, stack, digest, exception message, request content, or credential.
- **PLT-019 · Owner/platform — pending:** perform the recorded staging rehearsal in `data/DEPLOYMENT-REHEARSAL.md` using a disposable Neon child branch with a separate Vercel staging environment. Manually disable staging Cron Jobs, run the explicit zero-write plan and authoritative migration through `0042_grey_sally_floyd`, run the Conditions ingestion only against the isolated branch using explicit release IDs, validate decomposable aligned/missing/mixed-year rows plus frozen per-period reference populations and parameters, then stage/check/publish only verified release metadata, deploy the validation-only candidate, and record bounded reader/cache/cron-dry-run smoke outcomes. Delete the branch after recording evidence. A separate production promotion requires the same order and Fernando's release authority; no production migration, Conditions ingestion, or deployment is claimed locally.
- **PLT-020 · Owner/provider — pending:** in Incident.io, confirm the existing public page at `statuspage.incident.io/civica-atlas` has exactly these publishable components: `Website`, `Atlas data`, `Atlas map`, and `Ask Civica`. Configure an independent 15-minute check of deployed `GET /api/health` only if it can retain no response body, headers, credentials, or user data. Run the safe drill by recording an **Investigating** test incident and resolving it without notifying subscribers unless Fernando explicitly authorizes notification. Retain only timestamps, deployment ID, selected component labels, and redacted result under `plan/evidence/PLT-020/`; do not retain provider credentials, monitoring URLs beyond the public endpoint, or incident text that exposes internal diagnostics.
- **PLT-021 · Owner/provider — pending:** before any production claim about Anthropic retention, confirm the actual Civica API organization/workspace arrangement and whether zero-data retention is enabled. The published disclosure intentionally makes no such claim today. Retain only the date, reviewer role, and yes/no outcome under `plan/evidence/PLT-021/`; never retain a credential, account/workspace identifier, console screenshot, prompt, or chat content.
- **PLT-022 · Owner/provider — pending:** before enabling or rotating any paid model key, create or confirm the matching provider workspace/project scope and set the hard monthly cap and owner alert in `data/MODEL-OPERATIONS.md` (Ask Civica $25/$20; Pulse classify/verify/subject $50/$40; Pulse review $5/$4; backtest/evaluation $10/$8; bills $10/$8; Stats SA $10/$8). Confirm each Vercel secret is present only in its named feature scope, no generic inference key or provider admin/analytics key is deployed, and the provider console can attribute usage to the scoped key/workspace. Retain only date, owner role, scope label, cap/alert confirmation, and redacted result under `plan/evidence/PLT-022/`; never retain credentials, workspace/project IDs, screenshots, prompts, provider exception text, or model payloads.
- **ATL-010 · Owner/platform — pending:** authorize a production
  `sync:wikidata` run under a new named Atlas release only after reviewing
  `plan/evidence/ATL-010/production-refresh-plan.json`. The zero-write audit
  found 89 retained-versus-ranked-source roster discrepancies and one
  unresolved multiple-normal-rank role. Run the hardened full-set resolver,
  inspect the append-only government-entity history, recapture the release and
  refresh-plan artifacts, require `releaseReady=true`, run
  `validate:leaders-directory:live`, repeat populated desktop/mobile/dark
  browser QA, then explicitly mark the release ready and add `/leaders` to
  navigation, footer, and sitemap. Do not publish the current 314-row retained
  roster as current; it remains safely blocked.
- Confirm DOI registration and metadata display in the chosen repository.
- Confirm advisory-board and contact submissions arrive, retain required audit data, and produce the promised acknowledgement using real external delivery.
- **DAT-021 · Owner/platform:** run one provider-managed Neon PITR restore into a disposable branch after documenting the plan's retention window, RPO, cost, branch-deletion procedure, and management credential. Compare the DAT-021 schema/data hashes, then delete only the disposable branch. The local PostgreSQL 17 logical restore and named WAL recovery point are already verified; this remaining check is provider-specific.
- **DAT-021 · Owner/platform:** decide whether externally hosted Wikimedia Commons country/portrait images require a compliant independent archive or whether periodic URL/license availability checks are sufficient for the release recovery objective.
- Confirm search-engine recrawl, stale-preview removal, redirects, and social-card previews after release.
- **EXP-006 · Owner — RESOLVED 2026-07-12:** owner selected strength 60 on the interactive sheet; the corpus batch ran the same day (196 dark engravings graded; `gbr` excluded as a palette-outlier regeneration candidate). Remaining open items: regenerate France and the United Kingdom dark engravings (EXP-009 scope), and the owner's separate consideration of a full-color corpus redo.
- **PLT-007 · Owner — CRITICAL/SECURITY:** a real Neon `DATABASE_URL` (host `ep-bitter-night-*.neon.tech`) was committed to git history in commits `9332c4bc` and `b2bafdd2`. It is NOT in the current tree but is recoverable from history. **Rotate that Neon database password now** (Neon console → Roles → reset password; update `DATABASE_URL` in Vercel + `.env.local`), then decide whether to purge history (`git filter-repo`/BFG — a force-push that rewrites shared history, owner call). The scanner records this exposure by non-reversible hash in `scripts/secret-scan-allowlist.json` so `validate:secrets:history` still flags any OTHER leak; remove that entry after rotation.
- **BRD-014 · Owner:** confirm the monitored contact/security paths deliver end to end — submit a test message via /contact and a test security report to admin@civicaatlas.org, verify both arrive (admin message queue + inbox), and time a triage response. The statements and security.txt are published; only real external delivery + a triage dry-run remain.
