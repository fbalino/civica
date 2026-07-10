# Civica Academic Publication Readiness — Decisions

This is the durable decision log for the active master plan. New entries append; existing entries are revised only through an explicit superseding decision.

## 2026-07-09

### APR-D001 — Atlas-first product identity

**Decision:** Civica Atlas is primarily a trusted, provenance-first comparative reference to how every country is governed. The atlas, structured data, source trail, and reconciliation are the flagship.
**Why:** This is the project's strongest existing scholarly contribution and the clearest defensible public position.

### APR-D002 — Original scores are secondary experiments

**Decision:** The Civica Index and Pulse are not required to remain headline products. Their UI, API, metadata, and prose must reflect experimental standing until they clear explicit validation gates.
**Why:** Product investment and visual polish cannot substitute for construct validity, reproducibility, calibration, or external review.

### APR-D003 — Index tournament, not predetermined retirement

**Decision:** The current Index competes against simple baselines and materially different candidate designs. The process must permit redesign, demotion, or retirement, but it must also search creatively for a measurement product that exploits Civica's distinctive data.
**Why:** High redundancy is a serious warning but not, by itself, proof that every possible composite or original measurement is valueless.

### APR-D004 — Pulse becomes an event ledger first

**Decision:** Pulse's academically plausible near-term product is a versioned, provenance-rich governance-event ledger. Public numeric governance deltas may return only after prospective, representative, human-anchored validation.
**Why:** Documented-event incidence can be evaluated directly; a latent daily governance score requires evidence the current system does not yet provide.

### APR-D005 — Retire judgmental country grades

**Decision:** A–F grading and labels that classify countries as “failed” are removed from the target product. Future presentation uses source-native indicators, distributions, uncertainty, and neutral descriptive language.
**Why:** Grade cutoffs create unsupported categorical and normative claims and invite misuse.

### APR-D006 — Agent work precedes external review

**Decision:** Codex, bounded Claude/Fable work, automated analysis, blind audits, reproducibility work, and browser QA should complete all feasible internal preparation before reviewers are approached.
**Why:** Reviewer attention should be spent on real scholarly judgment rather than defects agents and tests can resolve first.

### APR-D007 — Human review remains a publication gate

**Decision:** Qualified independent human review cannot be replaced by model panels. It occurs after the agent-complete gate and before authoritative measurement claims or broad academic outreach.
**Why:** External domain expertise, accountability, independence, and reputational judgment are part of scholarly legitimacy.

### APR-D008 — Canonical positioning sentence

**Decision:** The working positioning is: “Civica Atlas is a provenance-first comparative reference to how every country is governed.”
**Why:** It is clear, distinctive, and supportable without leaning on experimental scores.

### APR-D009 — Outreach follows a citable release candidate

**Decision:** Reviewer discovery and outreach preparation belong in the plan, but contact and broad marketing wait for their readiness gates. The first flagship should be a frozen, reproducible atlas dataset/release with DOI, rights manifest, codebook, citation, and case studies.
**Why:** Academic adoption begins with a usable scholarly artifact, not a generic awareness campaign.

### APR-D010 — Name is open to evidence-based change

**Decision:** Civica Atlas may be renamed if trademark/confusion research or professional advice shows material risk or if a stronger distinctive identity emerges. No rename is assumed in advance.
**Why:** The owner prefers avoiding future disputes but does not want an unnecessary brand migration.

### APR-D011 — Subscription-only orchestration

**Decision:** Use Codex and Claude subscription authentication. No paid model API is authorized for this effort.
**Why:** Existing subscriptions can perform the work; cost-bearing fallbacks require separate approval and a hard cap.

### APR-D012 — One active academic-readiness checklist

**Decision:** `plan/MASTER-CHECKLIST.md` becomes the single execution source of truth for this effort once validated. Existing dated plans are preserved as historical inputs; still-relevant open work is imported, and superseded work is documented.
**Why:** Civica currently has many overlapping plans, which makes progress and authority difficult to establish.

### APR-D013 — Behavior and public methodology change together

**Decision:** Any change to scoring, classification, sources, cadence, uncertainty, missingness, routes, or release status must update all public and operational documentation in the same task.
**Why:** A research reference cannot tolerate code, data, and published methodology describing different systems.

### APR-D014 — Credit-aware worker routing

**Decision:** Primary Codex performs routine implementation and verification locally. Do not spawn Sol-class Codex subagents for ordinary work. Use Luna/Terra only for bounded, low-context lanes when the available tool can actually guarantee that model choice; otherwise do the work in the primary session. Fable 5 remains the key decision-maker for consequential visual/product design choices. Claude Sonnet or Opus may handle bounded routine critique or research. No paid API fallback is authorized.
**Why:** The planning audit consumed roughly 60% of the owner's available OpenAI session credits; uncontrolled high-reasoning fan-out is unsustainable and unnecessary for sequential implementation.

### APR-D015 — One epistemic tier per public claim

**Decision:** Every registered headline claim receives exactly one of seven canonical tiers: institutional posture, source-reported fact, reconciled fact, derived descriptive metric, research-beta estimate, experimental heuristic, or retired/deprecated output. The full allowed-language and disclosure contract lives in `plan/decisions/claim-tier-v1.md` and the machine-readable definitions live in `src/lib/claims/claim-tiers.ts`.
**Why:** Readers and future agents need a stable way to distinguish upstream facts, Civica transformations, estimates, prototypes, retired outputs, and project-status promises. One tier per atomic claim prevents mixed sentences from borrowing stronger standing than their evidence allows.

### APR-D016 — Monte Carlo bounds are input-variation ranges

**Decision:** The current Civica Index Monte Carlo output is described as a central input-variation range under declared perturbation assumptions, not a confidence interval or estimated location of a latent true country score.
**Why:** The implementation varies normalized inputs with fixed heuristics; it does not specify or estimate a sampling model that supports confidence-interval interpretation.

### APR-D017 — Pulse schedule, completion, and measurement are distinct claims

**Decision:** Public Pulse copy may state that the v2 pipeline is scheduled daily, but it must separately expose the most recent completed computation and must not describe the output as a live, real-time, or continuous governance measure.
**Why:** Cron configuration proves intended cadence, not successful execution or observability of governance change. The public event ledger is the evidence-bearing artifact.

### APR-D018 — Removing grades does not retire the Index

**Decision:** The current 0–100 Civica Index, its dimensions, histories, rankings, pipeline, and APIs remain an active research-beta system while they enter the benchmark and validation tournament. Removing A–F and qualitative score bands removes an unsupported presentation layer; it is not a decision to retire the composite.
**Why:** The Index may be hardenable or may inspire a more valuable construction. That question must be answered by construct, redundancy, sensitivity, temporal, predictive, and out-of-sample evidence rather than by the fate of its old grade labels.

### APR-D019 — Bounded delegation is encouraged

**Decision:** Superseding APR-D014's temporary scarcity constraint, the primary Codex agent should use bounded subagents and subscription-authenticated Claude workers when parallelism materially improves speed or audit quality. Keep task boundaries narrow, avoid redundant high-reasoning fan-out, and retain Fable 5 as the key decision-maker for consequential design choices. No paid API fallback is authorized.
**Why:** The owner's OpenAI and Anthropic/Fable allowances have reset, and two Anthropic accounts are available. Cost discipline still matters, but useful delegation should not be artificially suppressed.

### APR-D020 — Prelaunch public documentation states current truth

**Decision:** Because Civica has no current user or API migration burden, public pages and methodology describe only the best current system in the present tense. Implementation history, superseded designs, field deprecations, and dates remain in internal plans, schema/audit notes, and version control unless a reader needs them to interpret a released dataset.
**Why:** Public migration pages and “we used to do A, then changed to B” prose add complexity without serving a real compatibility or scholarly need. A clean prelaunch reference should explain what Civica is, not narrate its private build history.

### APR-D021 — Mutable public counts are generated or frozen

**Decision:** A public claim about Civica's current coverage, row count, source count, or dataset scope resolves from registered runtime state and has a nonnumeric outage fallback. A historical value is allowed only when the same visible passage identifies its frozen release or date. Limits, targets, and sample payloads must identify themselves as such. The explicit registry and validator live in `src/lib/claims/public-numeric-claims.ts`.
**Why:** Undated literals silently become false as the database changes. Runtime values keep current surfaces aligned; visibly frozen facts remain reproducible; explicit illustrative labels prevent example payloads from masquerading as measured coverage.

## 2026-07-10

### APR-D022 — Pulse ledger primary; dimensional effects remain public experiments

**Decision:** Pulse's evidence-bearing product is the event ledger. Civica may keep the five named per-dimension effects visible during validation only as explicitly versioned public experimental heuristics with no merged Pulse score, rank, grade, or claim of established measurement. This clarifies and supersedes APR-D004's implication that every numeric effect must disappear until validation: promotion to a research measurement still requires the representative, human-anchored gates in Area 05. The current runtime method is `pulse-v2.1-beta`, the taxonomy remains `v2.0`, older rows remain explicitly mixed and unversioned rather than receiving a fictitious migration version, and the April 2026 ten-case result remains an archived diagnostic for an earlier architecture.
**Why:** Readers can inspect provisional behavior without confusing it with a validated governance measure, while the provenance-rich ledger remains primary and “no public numeric signal” stays an allowed outcome of the later tournament.

### APR-D023 — The current Index is a transparent Beta aggregation, not a validated verdict

**Decision:** Keep the Civica Index active as a secondary research-Beta convenience aggregation of four externally attested governance indicators. The canonical live method is the Beta/v2 path: fixed-bound normalization of V-Dem Democratic Quality, World Bank WGI Rule of Law, Freedom House rights, and Transparency CPI; mandatory Democratic Quality and Rule of Law; re-proportioned available weights for partial estimates; and a rounded Monte Carlo median with a central input-variation range. Public presentation remains neutral and grade-free. Legacy v1 code and rows stay archived for reproducibility, not as the public default.
**Why:** The construction can be transparent and useful without claiming independent validation or a categorical country judgment. The later G3 tournament—not documentation drift—will decide whether the current aggregation, a redesigned Index, or no composite provides incremental value.

### APR-D024 — Every methodology/release concept has one canonical documentation source

**Decision:** A methodology or release concept is authored from exactly one named path/symbol. Other public or operational surfaces must consume it through generation, interpolation/import, a contract test, or a link-only reference declared in `src/lib/docs/doc-concepts.ts`. Generated reader blocks use invisible Markdown reference markers; code-owned rich tables use generated data rather than copied numeric arrays. New formula copies, stale registered routes, broken anchors, and generator drift fail `npm run validate:doc-sources`.
**Why:** Civica cannot become citable while formulas, route examples, and release claims can silently diverge across markdown, TSX, API examples, runbooks, memory, and README material. One canonical source plus executable mirrors keeps current truth legible without publishing private migration history.

### APR-D025 — The replication route is a fail-closed status ledger until its artifacts exist

**Decision:** Before publication, `/civica-index/replication` identifies itself as `Not published`, renders every required component from one typed status inventory, and exposes no artifact link. G2 owns the broader atlas release package; G3/IDX-028 decides whether the current Index is reproduced, redesigned, or retired; GOV-021 and QA-020 own archival/clean-room gates. The route may switch to `published` only when every required component is `available` with a valid path.
**Why:** A future-facing contents list can imply that a package is obtainable even when a warning says otherwise. A component ledger makes absence legible now and provides a mechanical, testable path to real links later without pre-committing the Index tournament outcome.

### APR-D026 — Operational documentation is executable current truth

**Decision:** `README.template.md` remains the authored README source; generated `README.md` carries independent template and rendered-body hashes. `npm run validate:doc-references` is the build gate for documented npm commands, direct routes, repo file pointers, schema-table count, CRON-secret scope, generated README freshness, the four required project-memory files, and sealed current-runtime memory claims. Reader methodology states the rules that apply now; pre-launch hot-fix and migration narratives remain in version control rather than public prose.
**Why:** Operational prose is part of the research artifact. A route, command, schema count, cron contract, or methodology rule that cannot be mechanically checked will drift again and undermine both reproducibility and reviewer trust.

### APR-D027 — Public API contracts are generated from strict runtime schemas

**Decision:** `src/lib/api/contract/` is the canonical contract layer for public API response schemas, route metadata, generated examples, and bulk-export CSV shape. Route shaping functions must call strict Zod `parse()` at runtime. `/api-docs` renders from the endpoint registry, and `npm run validate:api-docs` must close the set of live versioned GET routes, documented entries, schema-valid examples, parameters, error statuses, CORS/rate-limit claims, and deprecation behavior. Deprecated structural-family fields use only the constants and response helpers in `src/lib/api/deprecation.ts`; conditional taxonomy deprecation applies only when the legacy branch is requested.
**Why:** Hand-copied API prose and illustrative JSON can silently diverge from real responses. A single executable contract makes extra or missing fields fail locally, keeps documentation and fixtures synchronized, and preserves consistent machine-readable retirement signals without mislabeling unaffected responses.
