# Civica Academic Publication Readiness — Manual and External Checks

This queue contains checks an agent cannot honestly complete. Preparing the material is agent work; obtaining the external result is not. Add the originating task ID, exact question, responsible person, required artifact, and result when known.

## Legal and brand

- Professional trademark/confusion review of the final project name, marks, domains, and relevant jurisdictions/classes.
- Professional review of code licensing, database rights, source-specific redistribution terms, AI-assisted illustration disclosure, privacy, and terms before the DOI release.

## Academic review

- Independent governance-measurement review of the Index tournament protocol before results are interpreted.
- Independent political event-data review of the Pulse codebook, sampling design, annotation protocol, observability model, and validation results.
- Research-data librarian or data-curation review of the frozen release, rights manifest, metadata, citation, DOI deposit, checksums, and reproducibility instructions.
- Accessibility review by a qualified human using keyboard and assistive technology after automated and browser checks pass.

## Owner judgment

- Approve the representative engraving color-grade pilot before any corpus-wide transformation.
- Select one of three design-system-compliant Explore navigation concepts before new artwork or final implementation.
- Approve any shortlist of replacement names before legal clearance or migration work.
- Approve reviewer identities, conflict disclosures, honoraria, contact copy, and outreach sequencing before contact.
- **GOV-010 · Owner:** review `plan/research/reviewer-ranking-v1.md`, approve or revise the proposed ordering with a recorded rubric-based reason, and confirm which alternates remain contact-ready. This is not authorization to contact; GOV-016 must still pass first.
- **GOV-003 · Owner:** complete the seven factual fields in `plan/research/project-disclosure-owner-confirmation-v1.md`: funding/payer, grants or sponsorship, material in-kind support, relevant affiliations/interests, vendor/source relationships, third-party control rights, and approval to publish/update the resulting disclosure. The repo cannot prove a no-funding or no-conflict state from silence.
- **GOV-012 · Owner:** choose and sign the compensation posture in `plan/research/reviewer-honorarium-decision-brief-v1.md`. The recommendation is fixed honoraria of $1,000 for each 8–12-hour Atlas/Index review and $1,500 for each 12–16-hour Pulse review, with a $12,075 first-wave ceiling for nine primaries including a 15% logistics reserve. Also identify the paying person/entity and jurisdiction so accounting can confirm forms, withholding, currency, fees, and institutional-payment handling. This approval does not authorize contact; GOV-016 and G4 still apply, and Pulse also waits for GOV-015.
- Approve the final public disposition of each experimental measurement after its resolution and external review are complete.
- **PUL-039 · Owner:** approve the independent-coder recruitment plan — candidate pool, compensation posture and budget ceiling, blinding/independence terms, and start timing — before any candidate is contacted. Allow six to eight weeks after contact authorization to recruit, screen, contract, train, and qualify the panel. PUL-041's packet prerequisite is complete; external contact remains blocked until G4 and this approval.
- **PUL-040 · Owner/platform:** deploy the locked `pulse-v2.15-beta` branch before the prospective clock can start, then allow one complete scheduled ingest → cluster → classify → corroborate/score cycle to finish under that exact method. Production currently serves `pulse-v2.8-beta`; the live ledger has no successful v2.15 ingest, cluster, or classify run and the classification queue contains 746 eligible clusters. Do not backdate the window. A manual paid classifier run requires separate approval naming providers/models, a maximum cluster/call count, and a hard USD cap; otherwise wait for the first post-deployment cron cycle.

## External systems

- Confirm DOI registration and metadata display in the chosen repository.
- Confirm advisory-board and contact submissions arrive, retain required audit data, and produce the promised acknowledgement using real external delivery.
- **DAT-021 · Owner/platform:** run one provider-managed Neon PITR restore into a disposable branch after documenting the plan's retention window, RPO, cost, branch-deletion procedure, and management credential. Compare the DAT-021 schema/data hashes, then delete only the disposable branch. The local PostgreSQL 17 logical restore and named WAL recovery point are already verified; this remaining check is provider-specific.
- **DAT-021 · Owner/platform:** decide whether externally hosted Wikimedia Commons country/portrait images require a compliant independent archive or whether periodic URL/license availability checks are sufficient for the release recovery objective.
- Confirm search-engine recrawl, stale-preview removal, redirects, and social-card previews after release.
- **EXP-006 · Owner — RESOLVED 2026-07-12:** owner selected strength 60 on the interactive sheet; the corpus batch ran the same day (196 dark engravings graded; `gbr` excluded as a palette-outlier regeneration candidate). Remaining open items: regenerate France and the United Kingdom dark engravings (EXP-009 scope), and the owner's separate consideration of a full-color corpus redo.
- **PLT-007 · Owner — CRITICAL/SECURITY:** a real Neon `DATABASE_URL` (host `ep-bitter-night-*.neon.tech`) was committed to git history in commits `9332c4bc` and `b2bafdd2`. It is NOT in the current tree but is recoverable from history. **Rotate that Neon database password now** (Neon console → Roles → reset password; update `DATABASE_URL` in Vercel + `.env.local`), then decide whether to purge history (`git filter-repo`/BFG — a force-push that rewrites shared history, owner call). The scanner records this exposure by non-reversible hash in `scripts/secret-scan-allowlist.json` so `validate:secrets:history` still flags any OTHER leak; remove that entry after rotation.
- **BRD-014 · Owner:** confirm the monitored contact/security paths deliver end to end — submit a test message via /contact and a test security report to admin@civicaatlas.org, verify both arrive (admin message queue + inbox), and time a triage response. The statements and security.txt are published; only real external delivery + a triage dry-run remain.
