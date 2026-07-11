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

### APR-D028 — Public metadata is an all-route executable contract

**Decision:** `src/lib/site.ts` owns the hardcoded production apex and the checked-in metadata content release date; metadata must never derive its public host from a preview environment. `src/lib/seo/metadata-contract.ts` defines canonical, Open Graph, Twitter, research-posture, JSON-LD, and Dataset validity. `npm run validate:metadata` is the DB-free build guard, while `npm run crawl:metadata` must fetch every generated sitemap location and enforce exactly one route-real apex canonical and `og:url`. Sitemap `lastModified` values come only from stored jurisdiction timestamps, blog publication dates, comparison-member maxima, or the checked-in release date—never the request clock. Index metadata states research-Beta posture and Pulse metadata states experimental or archived-diagnostic posture.
**Why:** Search and scholarly discovery surfaces are part of the publication artifact. Correct page prose is insufficient if crawlers receive duplicate/off-domain canonicals, fabricated modification dates, unqualified research claims, or malformed Dataset metadata. An all-route crawl makes those failures observable before release.

### APR-D029 — Editorial engravings are disclosed illustrations, not evidence

**Decision:** Country and territory engravings are AI-assisted, non-documentary editorial illustrations with no evidentiary role. `/licensing#imagery` is the canonical policy; About stays link-only; every engraving masthead renders a restrained structural disclosure link whether or not a landmark caption exists. The policy must state the incomplete launch-corpus generation-record and QA posture, a contact-based correction path, and that no separate third-party reuse license is granted pending provenance/legal review. A filename cannot prove manifest completeness: the build guard remains fail-closed until per-asset coverage is validated. Captions occupy their own final masthead row so map/image tiles cannot obscure them.
**Why:** Attractive generated art should never be mistaken for documentary source material, and absent prompts/references/rights cannot be papered over with a fictional manifest. Point-of-display disclosure plus one honest policy gives readers useful context without turning every country hero into a warning banner.

### APR-D030 — Research terms are executable publication contracts

**Decision:** `src/lib/research-terminology.ts` is the canonical source for Civica's definitions of source, observation, fact, reconciliation, estimate, indicator, index, signal, event, confidence, uncertainty, validation, replication, and peer review. `/glossary` imports those definitions rather than copying them. Registered research surfaces must link to the glossary or pass the narrow, sentence-aware terminology lint. Civica may not affirm that its own outputs are validated, peer reviewed, calibrated confidence intervals, or independently replicated until the corresponding evidence gate is actually satisfied; negated status, external scholarship, implementation discussion, and explicitly qualified language remain allowed.
**Why:** Academic vocabulary carries methodological commitments. A shared public definition plus targeted fail-closed fixtures prevents casual wording from upgrading a Beta estimate or internal check into a stronger scholarly claim, while avoiding a blunt ban on ordinary research discussion.

### APR-D031 — Publication policy separates current capability from frozen-release rules

**Decision:** `content/policies.md` is the single canonical correction, retraction, supersession, versioning, known-limitations, API/data-correction, preservation, and notification policy. Six research artifacts form a closed registry and carry link-only mirrors. The current site is explicitly a mutable, pre-G2, single-maintainer service: public correction intake/logging exists, but automated release-note publication, universal historical addressability, a versioned historical API, frozen release archives, and email/subscriber notification do not. Best-effort targets come only from `disputeSla`. A pure, clock/DB/network-free simulator defines and tests the changelog, supersession-marker, and release-note records that a future frozen release must produce.
**Why:** A serious correction policy must be both operationally honest today and precise enough to govern later releases. Treating policy requirements or a test simulator as already-shipped archive infrastructure would recreate the exact documentation overclaim the academic-readiness program is meant to remove.

### APR-D032 — Claims and documentation ship through one fail-closed gate

**Decision:** `npm run validate:claims-docs` is the canonical DB-free claims/documentation gate for local builds and GitHub push/pull-request checks. Its typed manifest must cover registry completeness, mutable numeric templates, routes/anchors, API examples, methodology fixtures, experimental labels, and prohibited terminology/policy language. Existing specialist validators remain the semantic authorities; per-category seeded orchestration fixtures prove that a failed or missing child result cannot be swallowed. The production build calls the aggregate gate once, while non-claims guards remain explicit outside it.
**Why:** A collection of independently useful validators is not a release contract if contributors can omit one, CI runs a different subset, or the wrapper reports success after a child failure. One manifest, one documented command, and two layers of negative fixtures make drift visible without duplicating each validator's logic.

### APR-D033 — Free access and reuse permission are separate contracts

**Decision:** `/licensing#reuse`, generated from `src/lib/claims/reuse-rights.ts`, is Civica's canonical interim current-rights registry. Free/no-account access, download, citation, and permission to display a hosted embed do not grant blanket permission to redistribute, republish, or derive from the underlying data. Upstream rights remain source-specific; Dataset JSON-LD pairs `isAccessibleForFree: true` with the explicit access-vs-reuse boundary and canonical rights URL. The public repository is source-visible but has no root license file and must not be called open-source or MIT-licensed. This interim artifact must identify itself as incomplete: DAT-003 owns the future source/field/product/release manifest, while BRD-007/008 own the code-license choice.
**Why:** Civica combines public-domain, CC0, non-commercial, publisher-restricted, derived, hosted, and not-yet-released artifacts. Treating reachability as permission would misstate those rights; pretending the interim table is the complete DAT-003 manifest would create a different false assurance. A typed, visibly incomplete registry gives readers an honest rule now while leaving the release-level legal and technical work explicit.

### APR-D034 — Provenance coverage is measured by compact renderer class until DAT-005

**Decision:** CLM-019 measures ten distinct compact empirical renderer classes across home, Atlas, rankings, and embeds. A class counts as complete only when source, date/vintage, and rights linkage are accessible on that compact surface; a downstream page link alone does not count. The generated current result is 4/10 (40%): rankings metric cells and the three fixed embed presets pass, while the homepage jurisdiction count, homepage country cards, homepage Index teaser, Atlas choropleth layers, Atlas hover card, and custom selected-fact embeds are named exceptions. Machine-readable source attribution derived from the canonical Index normalization table and machine-readable rights metadata satisfy the fixed-embed contract; vintage remains visible. This percentage describes renderer classes, not database facts or statement rows; DAT-005 owns dataset-wide fact-key coverage.
**Why:** Counting database rows would answer a different question from CLM-019's surface-level promise, while treating a generic downstream link as point-of-use provenance would inflate the result. A small, closed renderer registry makes the public limitation reproducible now and prevents a UI coverage statistic from masquerading as scholarly statement-level provenance.

### APR-D035 — Reproduce the current Index faithfully before judging its design

**Decision:** The frozen `2024-Q4` Beta release is reconstructed from four publisher artifacts through canonical pure parsers and a checked-in coverage manifest. Democratic Quality contains 170 V-Dem rows plus a separately attributed 20-row World Bank WGI Voice & Accountability fallback where no V-Dem release row exists. The fallback is a disclosed construct substitution, not an equivalent V-Dem measure and not a new source disguised as V-Dem. Its presence is preserved for exact release reproduction; the later preregistered Index tournament decides whether it remains, is redesigned, or loses to another candidate. HDI and GPI remain Conditions inputs rather than being described as dimensions of the current four-dimension Index.
**Why:** DAT-001 must make the deployed artifact reproducible without silently redesigning it. Hiding the fallback would make the methodology false, while deleting it during adapter recovery would change coverage before comparative validation. Exact input hashes, release exclusions, row counts, and semantic checksums separate faithful reconstruction from the later question of scholarly value.

### APR-D036 — Source specifications and captured release inputs are different records

**Decision:** `source-input-manifest/v1` separates a closed specification for every deployed pipeline/source from a captured input admitted to a named release. A captured input must carry its exact access URL, retrieval timestamp, SHA-256 of the retrieved bytes, upstream version and vintage, format, expected coverage, redistribution posture, and a SHA-256 adapter version derived from the implementation files. `last_sync_at`, output-table hashes, estimates, and reconstructed timestamps cannot substitute for missing input captures. The frozen Index has four valid captures. The pre-G2 Atlas is not a frozen release and remains unpublishable while its required captures are absent; generation must fail rather than emit a partial manifest.
**Why:** Stable source metadata explains how an adapter is meant to work, but it cannot prove which bytes produced a release. Conversely, requiring historical inputs that were never retained would tempt fabricated provenance. Keeping the two layers explicit gives current released artifacts exact evidence and makes the remaining Atlas capture debt mechanically visible for DAT-011, DAT-019, and G2.

### APR-D037 — Unverified reuse rights fail closed at the export boundary

**Decision:** `src/lib/rights/manifest.ts` and `/api/rights-manifest` are the canonical source, field-class, product, and release-artifact rights contract. A source may permit public export only after its terms have been verified; guessed or inherited posture labels never become permission. Restricted, non-commercial, and pending records remain visible but blocked. The frozen Index input manifest distributes metadata and hashes only, with publisher payloads explicitly excluded. The legacy mixed-source country JSON/CSV route is withheld with HTTP 503 because it cannot prove allowed terms for every emitted field; DAT-017 and DAT-027 own the rights-filtered replacement.
**Why:** A manifest that lists licenses but still emits ambiguous or unverified fields would document the risk without controlling it. Keeping uncertain terms explicit and mechanically blocking incompatible output makes rights provenance part of the release contract instead of a reader warning.

### APR-D038 — Jurisdiction inclusion never implies sovereignty

**Decision:** `jurisdiction-status/v1` is the canonical entity-status taxonomy. Its five classes are `sovereign_state`, `associated_state`, `dependency_or_territory`, `disputed_or_limited_recognition`, and `aggregate_or_special_area`. Only the first class enters sovereign-state totals. The sovereign inventory is closed to the 193 current UN members plus a separate sourced Holy See rule; Cook Islands and Niue remain associated states; statistical codes, Atlas inclusion, profile availability, and an unknown ISO code never confer sovereign status. Every row stores source IDs, review date, a neutral note, administering relationship where applicable, and a dispute flag. Unknown rows abort ingestion and migration rather than inheriting the old default. ATL-006 owns the Fable-led presentation of these already-adopted data rules across every surface.
**Why:** Civica's 253 reference entries mix states, territories, associated states, contested entities, geographic areas, and one grouped island record. Treating a page inventory or ISO-like identifier as a political-status judgment produced incorrect counts and erased important distinctions. A closed classification with conservative public wording makes the scope measurable without pretending Civica can adjudicate sovereignty disputes.

### APR-D039 — Fact provenance and UI provenance are separate denominators

**Decision:** `fact-provenance-coverage/v1` measures active database evidence as jurisdiction/fact-key groups and measures statement-ledger rows separately. A fact is source-linked only when every active observation in its group resolves to a source registry row, license, and row- or source-level URL. Single-source means one distinct source ID. The provisional two-plus-independent count uses a conservative native-publisher screen: CIA Factbook, Wikidata, and UN Data are compilations/aggregators; when a native publisher is present they do not add an independent family, and secondary-only evidence counts as one family. A live row is operationally stale after 180 days since retrieval; registered frozen archives are excluded. The checked report and `/api/provenance-coverage` publish full country and fact-key breakdowns. The earlier compact-renderer 4/10 audit remains a distinct presentation metric. DAT-006 must replace the provisional family screen with claim-level origin and republication mapping before Civica treats source independence as final.
**Why:** Database lineage and point-of-use disclosure answer different questions, and counting raw rows or source IDs would inflate both. A closed fact-group denominator makes coverage reproducible now, while the conservative family rule avoids calling two repackagings independent evidence before the deeper audit exists.

### APR-D040 — Source independence is a claim-lineage property

**Decision:** `reconciliation-coverage/v1` assigns every canonical fact key exactly one operating policy: `single_source_passthrough`, `multi_source_resolver`, `manual_review`, or `unsupported`. Independence is counted only across measured observations whose claim-level lineage resolves to distinct producing families. A republisher shares the upstream family's ID; a projection does not corroborate a measurement; CIA Factbook and Wikidata compilations do not establish independent origin; unknown mappings collapse into one ineligible family until reviewed. The checked audit is published at `/api/reconciliation-audit`, and the fact coverage report imports the same lineage function rather than maintaining a second approximation.
**Why:** Two database rows can be copies of one estimate. Counting publisher labels without tracing the producer overstated independent support, especially for World Bank/UN demographic data, World Bank/ILO labour data, UNDP/UNESCO education data, and Eurostat/NSO handoffs. One executable lineage registry makes the conservative rule inspectable, testable, and shared by the audit and public coverage metric.

### APR-D041 — Canonical selection is deterministic and self-explaining

**Decision:** `source-precedence/v1` is the adopted resolver contract. Active measured rows outrank projections; projections win only as a disclosed fallback. Group A/C retain the CIA incumbent subject to review, while Group B uses effective data vintage, material-error and reference guards, and the fact-key-specific growth-comparability exception. Equal-vintage ties prefer the country's NSO, then producing institutions or the registered UN direct-access path, downstream republishers, compilations, referenced Wikidata, and the frozen CIA archive; a final source-ID comparison removes row-order dependence. Every selection emits six ordered trace categories and public API provenance returns the trace.
**Why:** A label such as `fresher_winner` cannot show which rows were eligible, whether a projection was excluded, whether the selected publisher republished another family, which guard fired, or which vintage actually decided the value. The prior same-tier tie also allowed query order to choose between identical UN and World Bank population rows. A versioned rule and trace make the selection reproducible and reviewable.

### APR-D042 — Source freshness is evidence of a successful committed write

**Decision:** `markSourcesSynced()` is the only sanctioned path for changing `sources.last_sync_at`. It stamps only after a non-dry run reports a positive safe-integer row count, at least one normalized source ID, and a valid timestamp. It issues one update for the deduplicated source set and returns stamped IDs only after that update succeeds. Dry, empty, invalid-count, blank-source, invalid-time, and failed-executor paths cannot report freshness. The repository validator scans every production source file and self-tests its detection rules against seeded direct-set, upsert, and raw-SQL violations plus safe read/insert/comment controls.
**Why:** Freshness is a claim about data actually written, not that a job started, reached an upstream endpoint, or attempted an update. One fail-closed helper and a self-testing whole-source scanner prevent empty, partial, dry, or failed runs from making stale inputs appear current.

### APR-D043 — The schema dictionary is generated, reviewed policy plus exact structure

**Decision:** `schema-data-dictionary/v1` covers the full 49-table Drizzle schema, including internal and private tables so release boundaries remain explicit. Drizzle supplies names, exact SQL types, nullability, defaults, primary/unique/index groups, and foreign keys. A reviewed table-policy registry supplies row grain, release scope, source or derivation, cadence, vintage semantics, rights, and deprecation. The generator materializes those dimensions on every one of the 558 columns. The checked artifact carries a structural SHA-256 fingerprint, and the production build compares the whole generated result byte-for-byte with the checked JSON.
**Why:** Hand-maintaining hundreds of structural entries would drift, while deriving research meaning from column names would produce a technically complete but unreliable codebook. Separating exact schema introspection from reviewed semantic policy gives reviewers a usable field map and makes every schema or policy change visible in code review. Current SQL nulls still collapse several absence states; the dictionary says so, and DAT-015 owns the storage/API repair.

### APR-D044 — Derived rows carry a complete version envelope

**Decision:** `derivation-version-envelope/v1` records methodology, algorithm, prompt, taxonomy, source basket, and normalized source IDs on every named DAT-010 research output. Each axis is explicitly `versioned`, `not_applicable`, or `legacy_unversioned`; blank or implicit states fail. A content-derived `derivation_version_key` supports indexed filtering and stable rebuild selection. Index dimension/composite writers, Pulse v2 classification/delta writers, reconciliation snapshots, government-taxonomy writers, and release contracts all use the same typed envelope. Existing production rows were migrated transactionally with honest legacy markers rather than reconstructed guesses.
**Why:** A broad label such as `beta` cannot identify which transform, prompt, category system, or input set produced a value. Guessing those details for historical rows would create false provenance. A shared envelope makes applicable versions comparable across products, preserves explicit non-applicability for deterministic work, and lets later immutable-release tasks distinguish legacy records from fully reproducible rows.

### APR-D045 — Restricted release inputs are retained as fail-closed reconstruction records

**Decision:** `raw-input-retention/v1` is the current release-to-input archive contract. For the named `ci-beta-2024-Q4` release it records the exact publisher-byte SHA-256, retrieval time, access URL, upstream version/vintage, adapter hash, redistribution posture, rights record, and reacquisition instructions for each of four captures. Publisher payloads are excluded. Five released dimension groups map to those captures with row counts and semantic SHA-256 checksums; the composite declares its dependency on all five. Reacquired bytes that differ from the recorded hash are a different input and must stop reconstruction. Atlas G2 and Pulse v2 are not frozen releases and receive no retrospective capture records.
**Why:** Mutable download URLs cannot identify historical bytes, and storing restricted publisher files in a public repository would violate the rights posture. Exact hashes plus dated acquisition and semantic-output records preserve a verifiable reconstruction path without redistributing source payloads or pretending that currently available upstream bytes are the release input.

### APR-D046 — Migration history is declared, planned, and never inferred from `db:push`

**Decision:** `src/lib/db/migration-registry.ts` closes every checked SQL migration and operational production-data change with its real journal status, forward artifact, restore-or-forward-compensation posture, read-only live row-count plan, invariant command, and release-note linkage. The incomplete legacy journal remains explicitly incomplete until DAT-026 replaces it with an authoritative baseline and ordered history. `npm run db:push` refuses; only an explicit local-only wrapper may push to a disposable non-production database.
**Why:** An unordered set of files, sequence collisions, one-off repair scripts, and schema diff pushes cannot establish what changed in production or how to assess and recover it. Recording the historical gaps is more reliable than rewriting them, while a live zero-write plan and fail-closed registry make every future change reviewable now.

### APR-D047 — Release quality can be implemented before the data is clean

**Decision:** `npm run validate:release-quality` is the strict live gate across nine closed invariant families and exits nonzero on any current blocker. Its checked JSON report may therefore carry `status: fail`; the DB-free build guard verifies that the report, policy, category counts, and remediation fields are internally honest without converting a failed audit into a pass. Equivalent unit labels are normalized semantically, and explicit fact-key plausibility bounds outrank generic percentage fallbacks. Existing repairs remain with their named tasks: DAT-028 owns statement-subject orphans and DAT-029 owns active numeric-envelope corruption.
**Why:** A quality system that can only be merged after all historical defects are repaired hides the very evidence needed to plan those repairs. Allowing the checked report to fail, while making the release command strict and the report-integrity command tamper-evident, gives the build a truthful baseline and prevents publication until the named anomalies are cleared.

### APR-D048 — Data absence is typed state, not a substitute value

**Decision:** `data-value-state/v1` is the closed availability contract for country facts, indicator history, and country metrics. `observed` and `disputed` require a real value; `missing`, `unknown`, `not_applicable`, `not_observed`, and `withheld` forbid a value and require an explanatory reason. Observed rows have no reason. Database constraints enforce the same shapes, APIs publish an explicit status envelope, shared UI renders each state distinctly, and future export schemas retain status and reason. Rights-based withholding takes precedence over other public states, while an unresolved factual dispute takes precedence over an otherwise observed status. Zero remains an observed number, and empty strings never encode absence.
**Why:** A null, zero, blank, dash, or omitted field cannot tell a researcher whether Civica searched and found nothing, cannot interpret the concept, considers it inapplicable, has not observed it yet, disputes it, or cannot publish it. One contract across persistence and presentation preserves the distinction for analysis, citation, review, and later releases.

### APR-D049 — Research evidence mutations retain their prior state

**Decision:** `research-evidence-retention/v1` uses synchronous database triggers to capture every update and deletion across a closed registry of 29 evidence-bearing relations. Each history row contains the full prior state, resulting state for updates, relation and row identity, operation, reason, actor, and database time. The history table rejects updates and deletions. Pulse raw inputs retain terminal event, non-governance, or invalid dispositions with the classifier decision and reason; only pending rows return to classification. Pulse source and review-audit foreign keys are restrictive. Internal Pulse and reconciliation views provide stable error-study queries. Rate-limit counters are the sole registered deletion exemption because they contain no research or source evidence.
**Why:** Current-state tables cannot support false-positive, false-negative, or historical replay studies after an upsert or cleanup erases the prior row. Application-only audit calls also leave gaps when a writer forgets them or an audit insert fails after the mutation. Database triggers close those paths centrally. The contract starts at migration `0024`; it does not claim to recover evidence deleted earlier.

### APR-D050 — The first Atlas export is a frozen canonical-snapshot package

**Decision:** `civica-atlas-export/v3` publishes one gzip-compressed JSON package for release `atlas-2026-07-11`. It contains stable jurisdiction identity/status rows and the rights-cleared canonical selections stored in the immutable Q1 vintage, limited to CIA Factbook, Wikidata, and World Bank. Every fact carries the label, cutoff, selected source-row ID, content hash, method, observation/reference year, upstream dataset release, retrieval time when retained, Civica publication version, and embedded source-rights record. Index, Pulse, alternates, restricted sources, images, constitution text, and raw publisher payloads are excluded. The legacy per-country mixed-source route stays blocked for DAT-027.
**Why:** Reading active `country_facts` allowed a regenerated historical release to absorb post-cut changes. Reading the immutable snapshot makes the package a real as-published citation surface. A narrow canonical release is useful now while DAT-027 retains ownership of the richer canonical-plus-alternates design.

### APR-D051 — Release identity includes semantic and file-level checksums

**Decision:** `civica-release-bom/v1` is the release bill-of-materials contract. The normalized Atlas JSON has a semantic SHA-256 and uncompressed size; its gzip artifact has an independent file SHA-256 and byte size. The BOM records row counts, governing schema versions, the source commit used to generate the export, tool versions, and one entry per included source with row count, upstream vintage labels, observation-year bounds, retrieval cut, and semantic row hash. The public manifest route serves the checked BOM with immutable caching. Live validation rebuilds the export and BOM from the database and requires exact equality while holding the recorded source commit and tool set fixed.
**Why:** A single archive checksum can prove file integrity but cannot explain which code, schemas, inputs, or tools produced it, nor distinguish harmless compression differences from changed normalized data. Recording both levels and the input inventory makes release comparison and later clean-room reproduction objective.

### APR-D052 — Clean-room evidence is narrow, public, and exact

**Decision:** `civica-clean-room-fixture/v2` is a legally shareable miniature release input containing three jurisdictions and one permitted frozen canonical row each from CIA Factbook, Wikidata, and World Bank. It runs through the production Atlas export builder, which fails on blocked source rights, missing jurisdiction joins, and invalid vintage/hash/method metadata. The checked contract requires exact fixture and canonical-export SHA-256 values, exact row counts, no runtime network request, and no database or model credential. This fixture does not claim to reproduce upstream publisher bytes that Civica never captured.
**Why:** A small public fixture can objectively prove that the released transformation, rights, join, validation, and build paths are portable without redistributing restricted publisher files or inventing historical inputs. Keeping that proof separate from full release reconstruction preserves an honest boundary until the source-input capture debt is closed.

### APR-D053 — Domain coverage is measured against one explicit denominator

**Decision:** `atlas-domain-coverage/v1` is the operational coverage contract for elections, constitutions, offices, people, parties, organizations, bills, indicators, and images. Jurisdiction coverage always uses the closed `jurisdiction-status/v1` `sovereign_state` class; every domain separately declares its record grain, completeness fields, source families, source and domain run timestamps, known gaps, and thresholds. Coverage or measured-field completeness below 80%, a successful run older than 180 days, or an unavailable run timestamp creates a visible warning. Per-source freshness is evaluated independently so a recent source cannot conceal a stale companion. A warning documents debt and does not block the checked report or imply release completeness.
**Why:** A single undifferentiated “country coverage” number hides that elections, party snapshots, bills, portraits, and indicator observations have different grains and optional fields. One generated contract makes those differences inspectable while preserving a shared denominator and a deterministic alert policy. Keeping the organization timestamp warning open is more accurate than inferring a successful run from row modification time.

### APR-D054 — Recovery proof separates database portability from provider controls

**Decision:** `backup-restore-drill/v1` requires a production-read-only logical snapshot through Neon's direct endpoint, a new loopback-only PostgreSQL 17 restore target, exact schema/count/critical-table hash comparison, a local physical base backup plus named WAL restore point, and independent restoration of the frozen Atlas archive against its BOM. Recovery time starts when a valid dump is available and ends after the restored database passes its count query. Database dumps, WAL, clusters, and credentials remain temporary and uncommitted. Provider-managed Neon retention and disposable-branch PITR remain a named external check until management credentials, cost, retention, and deletion policy are approved.
**Why:** A logical restore proves Civica's database can leave the managed service, while WAL replay proves the PostgreSQL recovery mechanics and verification procedure without mutating Neon. Neither result establishes the provider plan's retention promise or branch controls. Keeping that distinction explicit avoids calling a local engine test a hosted-service guarantee while still producing a real, safe recovery drill now.

### APR-D055 — G2 reproduces the released canonical snapshot, not lost upstream bytes

**Decision:** `atlas-2026-07-11-g2-rc1` treats the normalized, rights-cleared rows from the named immutable Civica vintage as the reproduction input for the Atlas release candidate. The bundle records per-source semantic hashes, vintages, retrieval cuts, rights, and exact export-builder source, then reconstructs the canonical snapshot export and verifies both semantic and compressed hashes offline. It states that unretained upstream publisher bytes cannot be replayed. The G2 checklist does not certify end-to-end historical publisher ingestion, alternate-observation coverage, Index/Pulse replication, DOI registration, or source accuracy.
**Why:** Retrospectively inventing raw input hashes or acquisition times would corrupt provenance. The immutable Civica snapshot provides a useful reproducible artifact while the missing upstream-capture and alternate-observation boundaries remain visible to reviewers.

### APR-D056 — A citation handle is append-only and corrections form explicit lineage

**Decision:** Every named Atlas or Civica Index vintage is immutable after insertion. Exact reruns compare deterministic content hashes and semantic fields and perform no write; changed content under the same label fails. The methodology version stored on every row must equal the version published by its label. A correction to an already-published period uses a new methodology/version label and names the existing release in `supersedes_vintage_label`. Application writers enforce the contract, while database triggers independently reject frozen updates/deletes and invalid version, period, or supersession inserts. Unnamed live Index rows remain mutable working state.
**Why:** A citation cannot identify evidence if a rerun silently changes the row behind it. A unique key prevented duplicates but the prior upsert still rewrote the cited content, and the Atlas label said `v0.2-beta` while all 17,506 rows stored `v0.1-beta`. Append-only releases, deterministic hashes, and explicit correction lineage make a cited version stable without freezing ordinary pre-publication computation.

### APR-D057 — As-published exports read the named snapshot

**Decision:** A frozen Atlas release selects rows from `country_fact_vintages` under one exact label and cutoff. Frozen value, numeric value, unit, structured value, as-of date, source ID, content hash, and method override every corresponding current source-row field. The release publishes that vintage identity and cutoff. The selected `country_facts` row may supply only descriptive fields not yet copied into the vintage table; DAT-025 owns eliminating that remaining temporal ambiguity. Alternate observations remain outside this narrow package until DAT-027.
**Why:** The earlier exporter queried active source observations, so regenerating a historical package could absorb later corrections while retaining the old release date. In the current data, 161 rights-cleared selected rows already differ from their Q1 snapshots. Joining from the immutable vintage and regression-testing a deliberately changed current row makes the as-published claim factual.

### APR-D058 — Temporal provenance has four independent clocks

**Decision:** `temporal-metadata/v1` distinguishes observation/reference year, upstream dataset release, Civica retrieval time, and Civica publication version. Writers, frozen rows, exports, APIs, codebooks, and reader labels must not substitute one for another. For the BR/CGV QoG Jan26 cross-section, the reference year is 2022, the original release is Bjørnskov-Rode regime data v6.1, the distributor release is QoG Standard Jan26, retrieval is the recorded 2026 timestamp, and Civica publication is taxonomy `2026_v1`. Historical metadata absent at the cut remains null if only a post-cut source row could supply it.
**Why:** The former BR ingest called 2025 the regime year because the original time series extended through 2025, even though every relevant Jan26 cross-section field is 2022. Release names and ingestion dates describe data handling, not the society being measured. Keeping four typed clocks prevents a 2026 download or publication from silently relabeling a 2022 political classification.

### APR-D059 — Deployments use one hash-pinned authoritative schema history

**Decision:** `drizzle/authoritative/` is the only deployable migration history. It begins with one reviewed baseline of the complete current public schema and a full catalog fingerprint. An empty database executes the baseline; an existing untracked database may adopt it only when its complete fingerprint matches exactly. A ledger outside `public` records each ordered, hash-pinned migration once. Unknown IDs, changed hashes, nonmatching adoption candidates, and post-migration fingerprint drift fail closed. The incomplete legacy history remains an archive and is never replayed. Deployment runs `db:migrate` before application build.
**Why:** The former journal could neither reconstruct the current database nor prove that production and a fresh install had the same schema. Exact adoption avoids replaying old DDL against a live schema, while the baseline, immutable hashes, ledger, fresh test, and production-shaped fingerprint make later upgrades reproducible and objectively checkable.

### APR-D060 — Country research exports preserve resolver meaning before applying rights

**Decision:** `country-research-export/v1` serializes the existing `source-precedence/v1` result rather than selecting values again. Every exported fact has one canonical row and separate alternate, projection, and rejected collections. JSON and CSV share one document builder and retain source URL/license, freshness and observation dates, upstream vintage, value and lifecycle status, method, decision trace, and dispute state. Rights filtering happens after resolution. Disallowed observations are omitted; when the selected canonical source cannot be distributed, the fact is withheld and no allowed alternate is promoted.
**Why:** Recomputing the winner from distributable sources would make a legal filter look like an empirical judgment and could give JSON and CSV different meanings. Preserving the resolver's choice, including explicit withholding, keeps the research record honest while preventing restricted source data from entering a public download.

### APR-D061 — Statement identity is closed, typed, and source-specific

**Decision:** Statement subjects use a closed registry of `constitutions`, `elections`, `government_bodies`, `jurisdictions`, and `terms`. Officeholder and cabinet claims attach to the term row, while aggregate legislature-composition claims attach to the government body. A statement identity is unique by subject type, subject ID, predicate, and source. Producers use that same source-aware identity on rerun; database checks, a polymorphic-subject trigger, and a unique index enforce the contract independently. The repair migration retained every changed or deleted prior row in `research_evidence_history`.
**Why:** Person IDs mislabeled as terms and body IDs mislabeled as party rows made provenance links look valid while pointing to the wrong entity class. Source-blind upserts also allowed one publisher to overwrite another or create rerun duplicates. Typed references and source-specific identities make statement provenance resolvable and repeatable.

### APR-D062 — Invalid numeric candidates remain evidence, not observations

**Decision:** Fact-key envelopes admit legitimate globally small values, including territory and microstate populations, areas, and GDPs. A numeric fact that cannot be parsed unambiguously or falls outside its registered envelope is persisted with `status='rejected'` and a machine-readable reason, excluded from canonical resolution, and retained with its original value and source. The CIA parser accepts only an attached leading quantity and never lets a scale word elsewhere in prose modify an unrelated year. Percentage prose with multiple or ranged values fails closed. A later valid candidate from the same source can reactivate the stable source/fact identity.
**Why:** A universal minimum would erase real small jurisdictions, while permissive parsing converted North Korea prose containing “2010” and “billion” into 2.01 trillion percent of GDP. Keeping rejected evidence preserves the diagnostic trail and supports correction without publishing nonsense or inventing a fallback.

### APR-D063 — Index source baskets publish as one atomic unit

**Decision:** The five required Index adapter paths write exclusive temporary stage documents rather than visible score rows during a full refresh. The orchestrator requires the exact adapter set, common dataset year/quarter/methodology, source-specific minimum coverage, nonoverlapping score identities, and one canonical SHA-256. Only then does one database transaction upsert ingestion metadata and dimension rows, remove stale rows within the staged dimensions, stamp every participating source, and mark the run completed. A failed adapter exits nonzero, records failed/not-run results, and performs no score mutation. Dry runs stage and validate without creating a run row or changing freshness.
**Why:** Sequential child processes previously exposed a mixture of old and new dimensions when a later adapter failed. A staging boundary and one publish transaction let readers see either the prior complete basket or the new complete basket, while the retained run ledger provides an exact operational record for both outcomes.

### APR-D064 — Fact readers must choose live state or one immutable vintage

**Decision:** Every public country fact API and research export requires `as_of=live` or the complete label of an existing immutable reconciliation vintage. Live mode reads current resolver rows, may use the current jurisdiction cache only for absent live facts, and always reports a null vintage and cutoff. Vintage mode reads only `country_fact_vintages`; missing frozen facts remain null, peer-lens fact filters use the same vintage rows, and current cache values cannot enter the response. Selection mode, label, cutoff, source retrieval horizon, and methodology versions are derived from the selected rows and travel with JSON and CSV. Shorthand, missing, malformed, and nonexistent labels fail closed.
**Why:** A static Q1 label attached to a current post-cut value creates a false citation even when both the live value and the historical snapshot are individually valid. Requiring an explicit selection makes the temporal question part of the request, while row-derived metadata and fail-closed frozen reads make the answer internally consistent and reproducible.

### APR-D065 — Reconciliation releases freeze resolver inputs before winners

**Decision:** `reconciliation-candidate-release/v1` is the release boundary from methodology v0.3-beta onward. Publication freezes every supported country-fact candidate as the exact normalized `FactRow` consumed by the resolver, with source identity, status, source payload hash when retained or an explicitly typed normalized-observation hash otherwise, adapter code hash, resolver code hash, and candidate content hash. One manifest commits candidate and winner counts and checksums. Candidates stage in resumable chunks but remain unavailable to public selectors until a database trigger verifies every candidate, winner flag, vintage row, and immutable candidate pointer, then permits one `staging` to `complete_candidates` transition. Completed candidates, releases, and winner rows are immutable. Q1 is recorded as `canonical_only_legacy`: its canonical values remain stable, but the missing historical alternate set is not reconstructed from current rows or described as replayable.
**Why:** A frozen winner does not preserve why it won. Current rows cannot recover Q1 honestly: thousands have post-cut retrieval state and many selected identities changed after the cut. Freezing the exact resolver inputs and code identities makes later replay independent of mutable source rows, while the legacy status preserves citation continuity without inventing evidence.

### APR-D066 — Indicator lineage is part of observation identity

**Decision:** CI ingestion records, CI dimension observations, Conditions observations, and indicator-history observations store indicator ID, source, upstream release, artifact hash and kind, temporal coverage, license URL, transformation ID, substitution reason, and method version. Unique identities include source and indicator. Retained publisher files use their exact SHA-256; older or API-derived batches use a deterministic normalized-batch SHA-256 and say so. The WGI Voice and Accountability coverage substitution records its reason on every affected row.
**Why:** A dimension name such as `democratic_quality` does not identify the measurement that produced a value. The old keys allowed a later source to replace another source's row. Source-and-indicator identities preserve distinct observations and make substitutions, transformations, rights, and reproducibility limits inspectable.

### APR-D067 — The current Index has no standing beyond a secondary research experiment

**Decision:** The current Civica Index remains accessible for inspection, but every public surface identifies it as research beta. API methodology metadata reports `standing=secondary_research_experiment`, `independent_validation=false`, and `atlas_dependency=false`. Navigation marks the Index Beta, the public Atlas release excludes Index output, Index bulk release remains blocked, and every Atlas jurisdiction initializes without requiring a score row. Numeric estimates and ranks may be shown only with the registered research-beta limitations; categorical grades and authoritative verdicts remain prohibited.
**Why:** Keeping a provisional composite visible can support testing, corrections, and reproducibility. Giving it the same standing as the reference atlas would overstate its evidence and make country access appear conditional on an experimental score. An explicit machine-readable and reader-visible boundary preserves the research candidate without making it Civica's identity.

### APR-D068 — The current Index release crosses every production boundary deterministically

**Decision:** `ci-beta-r5-2024-Q4` is the current Index release. Its clean-room path starts from the four declared publisher snapshots and a checked jurisdiction spine, uses canonical adapters, reproduces PostgreSQL `real` storage and text-protocol round trips, orders every dimension deterministically, applies the versioned competition-rank policy, and compares the complete output with live rows. Public and operational readers pin this version rather than selecting an ambiguous latest or archived row. The original Beta through Beta-R4 remain immutable evidence of superseded calculation or rank semantics.
**Why:** Reproduction must remain independent of database row order and numeric storage. The current proof recreates all 745 dimensions and 190 deterministic composites, including completeness and rank, with zero differences or unexplained production rows. Preserving the earlier releases records the defects without rewriting cited data.

### APR-D069 — Current Index publication requires both mandatory dimensions and three of four overall

**Decision:** `ci-missingness/v1` requires Democratic Quality and Rule of Law plus at least one of Freedoms & Rights or Corruption Control. Four dimensions produce a full estimate. Exactly three, including both mandatory dimensions, produce a visibly partial estimate whose available weights are renormalized to one. Two dimensions, any missing mandatory dimension, or more than one missing optional dimension withhold the composite. Partial estimates retain their missing dimension and are not treated as directly comparable with full estimates under equal coverage. The old six-dimension calculator is sealed to `v1.0` and cannot write a current release. Beta-R4 publishes no generic range, so the earlier Beta-R3 range multiplier no longer applies.
**Why:** The public methodology and UI described one missing optional dimension, but the calculator's latent edge case would also have published the two mandatory dimensions alone. A closed policy removes that contradiction. All 15 current partial rows already contain three dimensions and miss only Corruption Control, so they conform without rewriting a frozen score.

### APR-D070 — The Index publishes no uncertainty band it cannot justify

**Decision:** Beta-R4 replaced the generic same-spread Monte Carlo calculation with a deterministic rounded weighted composite and null lower and upper bounds; Beta-R5 carries that posture forward. The checked current-release uncertainty audit records that V-Dem offers posterior intervals and WGI offers model-based standard errors, but current adapters retain neither; Freedom House offers no per-country probability distribution, and the CPI adapter retains no usable distribution. Current usable released uncertainty coverage is therefore 0 of 745 input rows, and no covariance model is available. A future range requires retained source-specific uncertainty, an explicit dependence model, calibration evidence where a target exists, and a new methodology version.
**Why:** Assigning every source the same invented spread and treating conceptually overlapping inputs as independent manufactured precision. Removing the range is more informative than displaying a reproducible but invalid interval. The Index remains an active research-beta candidate; this decision narrows its claims rather than retiring it.

### APR-D071 — Published score ties share competition rank

**Decision:** `ci-rank/competition-rounded-score-v1` ranks the published integer composite using competition ranking. Equal scores share rank, and the next rank skips the positions occupied by the tied group. Jurisdiction ID provides deterministic nonordinal display order within a tie and never breaks it. Beta-R5 stores this policy's ranks, the API identifies the ranked quantity and tie method, and reader surfaces say “Tied” or “Shared rank.” Rank intervals and instability remain explicitly not estimable while the current release lacks a valid score-uncertainty model.
**Why:** Beta-R4 assigned `i + 1` after an ID tiebreak, so countries with identical published estimates received different ordinal positions unsupported by the score's precision. In the current 190-score release, 61 score groups contain ties. Shared competition ranks remove the false distinction without inventing a rank-uncertainty interval.

### APR-D072 — Longitudinal Index research starts from an immutable native-scale panel

**Decision:** `ci-research-panel-2000-2024-v1` freezes a private 2000–2024 grid of 194 current sovereign jurisdictions, five source series, and 24,250 jurisdiction-year-indicator cells. Observations remain on their source-native scales with identity transforms; every cell records source, vintage, unit, uncertainty availability, revision posture, and explicit observed or missing status. Missing cells remain missing with typed reasons: no carry-forward, nearest-year fill, or freshest-value substitution is permitted. The panel uses the captured releases' currently harmonized historical series rather than claiming to reproduce every value as originally published. Completed release metadata and rows are database-immutable and committed by deterministic row, coverage, and temporal-break hashes. Exact values stay private because the source basket has mixed and pending redistribution rights; checked artifacts expose only metadata and aggregate coverage.
**Why:** A longitudinal evaluation is only meaningful when time, source identity, gaps, revisions, and comparability breaks are preserved. A rectangular grid with explicit absences prevents later analyses from silently selecting convenient years or current values. Freezing the research input before candidate selection also makes the coming tournament auditable without publishing data Civica may not redistribute.

### APR-D073 — Original Civica measurement must add provenance-native or meta-measurement information

**Decision:** `civica-original-measurement-charter/v1` governs the Index tournament. Eligible original work measures auditable institutional facts or the measurement ecosystem itself; relabeling, normalizing, weighting, or averaging established governance judgments is not original measurement. Each candidate declares one unit and evidence cadence, remains descriptive absent a separate preregistered causal design, competes against the strongest coherent simple baselines and the source-native dashboard/no-score option, and receives no incumbency advantage. It must pass both an information-novelty test and a preregistered user-task test. Overall country verdicts, grades, traffic lights, and overall ranks are prohibited. No winner is an acceptable tournament result. Required-gate failure twice consecutively retires a published measure; serious rights, verifiability, or harm failures can suspend it immediately.
**Why:** Better engineering cannot give derivative arithmetic new empirical content. Civica's distinctive evidence lies in provenance, institutional records, source disagreement, revisions, and coverage. Binding future candidates to those strengths permits creative measurement without recreating the same totalizing country score under a new name, while explicit failure rules prevent a favored idea from surviving by moving its thresholds.

### APR-D074 — Six materially distinct candidates enter specification, with dashboard/no-score as the floor

**Decision:** `civica-index-candidate-set/v2` defines six candidate kinds: K0 source-native dashboard, K1 hardened derivative composite, K2 measurement concordance, K3 power and transfer fact ledger, K4 constitution-to-practice evidence pairings, and K5 institutional constraint map. Each has a distinct construct and unit and declares inputs, transforms, missingness, uncertainty, versioning, normative choices, expected value, presentation, validation, and retirement. K0 is the reference floor rather than an original measurement claim. K1 receives a fair test but no incumbency advantage and uses the exact Freedom House PR+CL ratings input. K2–K5 cannot aggregate into a hidden country-quality grade.
**Why:** Competing only over weights would predetermine another derivative composite. This set tests six different propositions: whether presentation alone is enough, whether the existing summary adds utility, whether source disagreement is useful, whether living institutional facts are useful, whether paired evidence is useful, and whether formal power relations can be compared reliably. Keeping their units and claims separate makes a genuine no-winner decision possible.

### APR-D075 — Provenance and institutional structure are mandatory alternative families

**Decision:** The tournament candidate set fails validation unless it contains a provenance-native disagreement or fact candidate and a distinct institutional-structure candidate. K2 Measurement Concordance uses named-rater disagreement, common coverage, source dependence, and retained uncertainty; K3 Power and Transfer Ledger uses statement-level institutional facts. K5 Institutional Constraint Map uses sourced formal-power relations without assigning value to their number or arrangement. Each family must carry an explicit boundary against aggregation, ranking, scoring, or country-quality inference.
**Why:** Civica's strongest original assets are the evidence relationships that conventional composites flatten. Making these families mandatory prevents future revisions from quietly deleting the hard alternatives and returning the tournament to several versions of a governance-quality average. The anti-grade boundary ensures that a graph or disagreement statistic cannot become the same verdict under a less obvious label.

### APR-D076 — The Index tournament is locked before winner-selecting analysis

**Decision:** `civica-index-tournament-preregistration/v2`, registered at 2026-07-11T09:31:50Z before outcome inspection, pins the corrected candidate, charter, panel, and registration-base commits; the panel's three integrity hashes; six candidates and six baselines; 2000–2016 development, 2017–2020 validation, and 2021–2024 final temporal holdout; deterministic SHA-256 geographic folds; six noncompensating gates; candidate thresholds; subgroup and sensitivity plans; no-imputation missingness; exclusions; Holm-confirmatory and BH-exploratory multiplicity rules; a simplicity tie-break; and a valid no-winner outcome. V1 remains preserved. K1 cannot claim original information if its public inputs reproduce it, but may remain a bounded derivative beta if it demonstrates meaningful reader utility and clears every other applicable gate.
**Why:** Thresholds chosen after seeing results are descriptions, not tests. Pinning outcomes, code, inputs, splits, comparisons, and failure rules before analysis makes later null results credible and prevents a favored candidate from moving to a more convenient sample. Separating K1's originality and utility decisions keeps it in a fair contest without granting derivative arithmetic an originality claim it cannot earn.

### APR-D077 — Four common baselines share one split and output contract

**Decision:** `civica-index-baselines/v2` implements B0 source-native/no-score, B1 native V-Dem LDI, B2 equal-weight fixed common-scale mean, and B3 first correlation-matrix factor against corrected panel v2. B0 retains every one of the 4,850 jurisdiction-years, including fully missing rows. B1 emits only observed V-Dem values. B2 and B3 require all four declared governance sources and never impute. B3 fits means, standard deviations, and its deterministic positive-orientation loading vector on joint development rows only; validation and final holdouts cannot influence it. Every method emits the same unit, split, source, missingness, scale, and method-version envelope. Private outputs are represented in Git only by counts and SHA-256 values because the panel has mixed rights.
**Why:** Candidates cannot demonstrate added value against weak or inconsistently evaluated comparators. A shared interface prevents a baseline from receiving easier missingness or split rules. Keeping B0's empty country-years visible also prevents reference-product coverage from looking better by dropping the places with no available observation.

### APR-D078 — The tournament panel preserves every exact K1 source-indicator identity

**Decision:** `ci-research-panel-2000-2024-v3` supersedes but does not mutate v2 or v1. V2 replaced `fh_total_score` with the exact `pr_cl_total` input used by K1 from the captured Freedom House workbook at SHA-256 `d6ac861af6e7dcea7e870e39ddbcd2925730a653c1466f8992a7d0005f53be88`; v3 adds WGI Voice & Accountability from the captured WGI workbook at SHA-256 `25a2f9eabb90b0092973392c0b31571aa58b691cc5786292e504b52f693e1eb8`. Democratic Quality uses V-Dem LDI when observed, otherwise WGI VA, and never averages them. Freedom House 2000–2005 and WGI 2001 remain typed structural gaps. Candidate set, preregistration, and baselines advance to v3 before outcome analysis. All prior artifacts remain immutable evidence.
**Why:** Publisher identity alone is not a measurement identity. Freedom House total score differs from PR+CL ratings, and WGI Rule of Law differs from WGI Voice & Accountability. Conflating either pair changes the candidate while preserving plausible labels. Source-plus-indicator keys and an explicit primary/fallback rule prevent a silent overwrite and make K1's longitudinal calculation the same declared method as the current release.

### APR-D079 — K1 is the exact current composite under the common tournament contract

**Decision:** `k1-current-composite-tournament/v1` reuses production's fixed-bound scoring function, 0.27/0.26/0.23/0.24 weights, `ci-missingness/v1`, null score bounds, and competition ranking. Its five possible input identities include V-Dem first and WGI Voice only as fallback; WGI Rule of Law remains separate. Two explicit internal-to-publisher aliases reconcile `fh_pr_cl_sum` to `pr_cl_total` and `CPI_SCORE` to `score` without changing values. K1 reads panel v3, uses the same frozen splits as every baseline, receives no special threshold, and publishes no interval until source-specific uncertainty and dependence are retained. Its private 2000–2024 output is hash-frozen; its engine must reproduce every current Beta-R5 score and rank.
**Why:** A fair tournament needs the incumbent's strongest correct form, not a straw version and not a subtly different historical proxy. Sharing production functions prevents formula drift, while the isolated input and output contract prevents K1 from reading favorable labels or held-out results. Explicit aliases resolve storage vocabulary without pretending distinct measurements are interchangeable.

### APR-D080 — K2 remains a raw concordance research prototype after development fragility

**Decision:** `k2-measurement-concordance/v1` compares V-Dem LDI, WGI Voice & Accountability, and Freedom House PR+CL within exact annual common coverage for one broad democratic-accountability construct. It emits named within-year percentile placements, range, and IQR, requires all three raters, keeps within-source uncertainty absence separate from rater dispersion, and states that publisher separation is not evidentiary independence. Development-only diagnostics cover 1,208 outputs: midpoint distance explains 9.84% of spread, below the 70% artifact ceiling, but deleting one source changes the spread tercile for 65.65%, far above the 15% stability threshold. Validation and final holdouts remain sealed; external known-case labels remain pending. K2 cannot be promoted as a stable highlighted concordance classification on current evidence, though named placements may remain useful in the no-score dashboard.
**Why:** The prototype adds visible information that averaging removes, but a three-rater range is mechanically sensitive to which rater is omitted. Preserving the adverse development result prevents an attractive graphic from being mistaken for a reliable measure. Separating the raw dot strip from a categorical concordance summary leaves room for useful source comparison without relaxing a preregistered gate.

### APR-D081 — K3 publishes a rulebook before it publishes transfer claims

**Decision:** `k3-power-transfer-ledger/v1` currently derives only sourced current-executive tenure states at a fixed as-of date. The public rulebook defines chief-executive selection, electoral alternation, person and coalition continuity, indirect selection, interim and collective offices, disputed claims, tenure, term limits, missingness, and nonclaims. A prototype row exists only with a dated term and statement URL. Current data yield 168 private rows: 117 observed executive identities and 51 contested; 26 sovereign jurisdictions lack an eligible row. Historical transfers and term-limit states remain uncomputed because no ended predecessor chain, validated election-to-term link, or coded constitutional term history exists. No score or rank is permitted. Independent coding, citation, historical-overlap, and prospective freshness tests remain preregistered and unrun.
**Why:** A start date alone cannot prove how power changed hands, and a current officeholder cannot establish a term-limit count. Publishing those inferences now would turn data absence into political judgment. The bounded prototype tests source tracing and executive-identity rules while making the missing historical infrastructure visible enough to plan and review.

### APR-D082 — K4 pairs narrow constitutional topics only with practice-specific measures

**Decision:** `ci-k4-practice-panel-2000-2024-v1` freezes V-Dem v15 freedom of expression and alternative information, high-court independence, and clean-elections series before K4 outcomes are calculated. The release retains publisher credible bounds, explicit missingness, exact archive and embedded-codebook hashes, and current-harmonized-backcast status. It maps only expression/press/opinion, judicial independence, and free-election constitutional topics. LDI, Freedom House total, and WGI Rule of Law cannot substitute. Exact values remain private pending redistribution review. Clean-election values retain V-Dem's election-regime repetition and backfill caveat.
**Why:** A constitution-to-practice pairing is interpretable only when both sides address approximately the same construct. Broad governance composites would make the apparent gap depend on unrelated institutions. Freezing the narrow publisher inputs, uncertainty, and semantic limits before scoring prevents convenient remapping after results are visible.

### APR-D083 — K4 topic matches are blind-coding candidates, not constitutional findings

**Decision:** `k4-constitution-practice-pairings/v1` emits one nonaggregated row per sovereign jurisdiction and frozen construct. It preserves full tagged excerpt HTML and V-Dem v15 point estimates with credible bounds, but marks every tagged constitutional match as pending blinded coding. Topic presence alone never becomes a commitment-strength value. The engine has no gap, hypocrisy, score, grade, rank, tier, or traffic-light field. Two independent coders must reach alpha 0.80 before adjudication, after which a constitutional scholar must judge at least 90% of a stratified sample semantically fair. Until both gates pass, the output is a private coding packet rather than a public comparative finding.
**Why:** Constitute ontology tags identify relevant passages, including restrictions, exceptions, and structural references; they do not establish that a constitution makes the same substantive promise measured by the practice series. Keeping the machine join provisional prevents a convenient text tag from being mistaken for legal interpretation.

### APR-D084 — K5 ontology matches nominate coding work but assert zero graph edges

**Decision:** `k5-institutional-constraint-map/v1` uses a closed relation-candidate taxonomy over exact Constitution Explorer passages and the tournament's outcome-free geographic split. Topic semantics may nominate a relation class and obvious target institution, but an unspecified source or target stays unspecified. Every extracted row remains pending double-blind coding. Only post-agreement adjudicated rows with named endpoints may become directed graph edges. The current release publishes zero edges and no count, weighted total, score, rank, grade, or quality judgment.
**Why:** Constitutional topic metadata is useful for finding likely clauses but cannot identify every legal actor, condition, shared power, or exception. Treating those tags as completed edges would manufacture comparative-law data. A private coding packet preserves their retrieval value while making legal interpretation and external review explicit prerequisites.

### APR-D085 — Every candidate reports through one split-aware evaluation envelope

**Decision:** `civica-tournament-evaluation-interface/v1` is the common artifact-level contract for K0 through K5. Each implementation reports its unit and output kind, exact frozen inputs, possible/emitted/missing accounting where the universe is enumerable, development/validation/final-holdout coverage, evidence coverage, uncertainty posture, deterministic output hash, private-value location, label-access state, and validation state. K3 and K4 now carry the preregistered geographic split in every output row. The suite cannot compute held-out outcome metrics or select a winner.
**Why:** Isolated code is not a fair tournament if candidates silently use different folds, omit missing units, or describe uncertainty differently. A small shared envelope makes those differences explicit while allowing fundamentally different outputs—dashboards, estimates, ledgers, pairings, and coding candidates—to retain their native semantics.

### APR-D086 — The current dimensions share a level factor, not a single change factor

**Decision:** `civica-index-dimensionality/v1` finds that PC1 explains 87.3% of pooled country-year variance and 88.1% of between-country variance, compared with 52.5% of within-country variance and 35.9% of consecutive annual changes. The level structure is stable across annual and broad time slices, while region and current-regime strata differ in strength. K1 may be tested as a derivative summary of cross-country levels. Civica cannot cite the level PCA as evidence that annual Index movement measures one longitudinal construct.
**Why:** Persistent differences between countries dominate the pooled correlation structure. Removing country means or differencing consecutive years removes much of that common variation. Treating a strong pooled factor as proof of coherent change would confuse stable country ordering with synchronized institutional movement.

### APR-D087 — HDI is a limited external correlate, while Index inputs are mechanical diagnostics

**Decision:** `civica-index-validity-preregistration/v1` freezes five hypotheses before validity correlations are calculated. HDI supplies limited level, annual, change, and undesired-association checks for K1 and K2. An association that is too high can flag development confounding rather than stronger validity. Correlations with V-Dem, WGI, Freedom House, and CPI are reported as mathematically induced diagnostics and cannot pass a validity gate. K3–K5 remain insufficient until their construct-matched external labels exist.
**Why:** A composite cannot validate itself by correlating with its ingredients. HDI is independent of the formula but only adjacent to the governance construct, so both weak association and near-equivalence are informative problems. Declaring that boundary before calculation prevents favorable correlations from being relabelled after inspection.
