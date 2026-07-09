# Civica Academic Publication Readiness — Current-State Audit

**Audit date:** 2026-07-09
**Repository:** `/Users/fernandobalino/Projects/civica`
**Branch/commit at baseline:** `main` / `c8cfb56`
**Method:** Direct code and content inspection, build/test/validator runs, read-only production-database queries, live-site browser measurements, three sealed blind audit lanes, and one independent Fable research-design lane. Existing plans and the owner's examples were withheld from blind finders and used only after findings were produced.

## Executive finding

Civica is a substantial, functioning comparative-government platform rather than a prototype. Its strongest defensible contribution is the atlas: structured institutions, country facts, constitutions, elections, organizations, indicator histories, source rows, and a real reconciliation architecture presented through an unusually coherent editorial interface.

Its central risk is a mismatch between that strong reference foundation and the stronger claims made for the Civica Index and Pulse. The current Index and Pulse contain serious reproducibility, construct-validity, calibration, versioning, and documentation gaps. They should remain secondary experiments while the atlas is prepared as the first frozen, citable release.

## Verification baseline

### Checks confirmed at the audit baseline

- `npm test` passed.
- `npm run test:db` passed, including all eight live reconciliation worked examples.
- `npm run validate:content-templates` passed.
- `npm run validate:sync-freshness` passed.
- `npm run validate:design-tokens` passed against the ratcheted baseline; 412 legacy violations remain baselined technical debt.
- `npm run build` passed and produced the production route set.
- The build emitted a Turbopack full-project tracing warning associated with the Markdown content/import path.
- The repository does not contain a canonical GitHub Actions workflow or a meaningful end-to-end browser test suite.
- `npm run lint` was not a trustworthy baseline run because ESLint traversed generated `.claude/worktrees/**/.next` output; lint configuration excludes the root `.next` but not generated worktrees.

### Live data snapshot

The read-only production snapshot contained:

- 253 jurisdiction rows;
- 2,889 factbook-section rows and 25,827 country-fact rows across 88 fact keys;
- 56 source records;
- 483 government bodies, 5,291 offices, 4,943 persons, and 1,548 legislature-party rows;
- 915 elections and 6,695 bills;
- 186 full constitutions and 30,537 topic excerpts;
- 19 organizations and 1,713 memberships;
- 46,215 indicator-history observations;
- 190 current `2024-Q4` Civica Index scores, 15 of them partial;
- 376 Pulse v2 events, of which 205 were published, 170 pending, 13 human-reviewed, and one rejected;
- 320 Pulse delta rows across 64 countries.

Counts are a dated audit snapshot, not evergreen copy. Public statistics must come from runtime/template state with documented fallbacks.

## What genuinely works

### Atlas and country reference

- Country routes, the three-tab country information architecture, country search, comparison, maps, organizations, parties, government structure, officeholders, legislatures, elections, conditions, source displays, and exports are real implemented surfaces.
- Provenance is structural rather than decorative: source rows, source freshness, resolver logic, disputes, canonical facts, and `SourceDot` are integrated.
- Source sync freshness has a single sanctioned path through `markSourcesSynced()` and a repository validator.
- Government taxonomy includes externally sourced regime classifications and a helper layer rather than relying solely on raw prose.
- Constitution ingestion and topic extraction are substantial and include full text for the available corpus.
- Indicator history has enough longitudinal observations to support source-native trend surfaces and serious panel analyses.

### Content and design infrastructure

- Reader prose for the designated pages is separated into `content/*.md`, rendered through a shared templating system, and checked for live-state interpolation.
- The editorial design system, shared primitives, theme tokens, and `/design-system` page form a real canonical system.
- The site has coherent light/dark support, canonical editorial layouts, navigation, footer, responsive behavior, and a large custom illustration corpus.
- Build-time design-token and content-template ratchets prevent some classes of new drift.

### Operational and product breadth

- The application has public APIs, embeds, scheduled jobs, admin review surfaces, source ingestion scripts, reconciliation tests, Pulse classification infrastructure, a Record/blog system, methodology pages, API documentation, licensing/contact/about surfaces, and an advisory-board route.
- Admin and cron routes include meaningful authentication and source-sync protections; these need broader systematic verification, not wholesale replacement.

## What is incomplete, contradictory, or not yet defensible

### Atlas provenance and release readiness

- Every fact can generally point to a source row, but cross-source reconciliation is not universal: 61 of 88 live fact keys had only one source represented, while 27 had two or more.
- All 253 jurisdiction rows currently share the same `sovereign_state` type, which is not an adequate public/legal/political-status taxonomy for territories and disputed entities.
- There is no frozen, checksummed bulk atlas release with a DOI, complete machine-readable codebook, clean-room reproduction path, release-specific rights manifest, and named accountable authorship.
- Source/data rights are mixed and include non-commercial restrictions. The root citation metadata correctly avoids pretending that one license governs every dataset, but the repository still needs an explicit code license and release-level rights manifest.
- The only populated frozen Factbook vintage is not truly immutable on rerun; its rows also carry a v0.1/v0.2 methodology-version mismatch. Frozen exports can attach an earlier-quarter label to values resolved after the cutoff.
- Temporal semantics are conflated in at least one research source: the BR/CGV 2022 cross-section is presented as 2025, confusing observation/reference year with ingestion or publication year.
- Existing active plans are numerous and largely untracked, so the repository lacks one committed source of execution truth.
- The checked-in Drizzle migration journal cannot create the 49-table live schema: SQL files are missing from the journal, a journaled migration alters a table that no prior journaled migration creates, and production has no recorded Drizzle migration history.
- Bulk country export currently returns raw duplicate source rows without enough provenance/rights/status to distinguish canonical values, projections, or alternates. Statement-level provenance also contains false subject pointers, orphans, and duplicate rows.
- Numeric validation simultaneously rejects valid microstate values and leaves at least one catastrophic parse error active, because resolver rejection is in-memory rather than a persisted quarantine state.

### Civica Index

- The live `2024-Q4` score coverage cannot be reproduced from `main`. The canonical branch's six ingestion adapters still contain small hardcoded reference tables, while full country-coverage adapters exist on the unmerged `codex/full-ci-country-coverage` branch.
- Adapter entrypoints catch/log top-level errors without setting a failing exit code, so the parent orchestrator can report a successful multi-source run after child failures; publication is not staged/atomic.
- Public missing-data prose says weights are not re-proportioned; the calculator explicitly re-proportions available dimensions. This affects partial scores.
- Calculation and API queries do not reliably pin dimension rows to one methodology/source release, so overlapping v1/Beta rows can mix; later backcasts are also labelled like original historical releases.
- The published “90% confidence interval” uses generic default standard deviations, independent sampling, and unseeded `Math.random()` rather than a complete source-uncertainty model. The wording implies more inferential meaning than the implementation earns.
- The public PCA/factor-analysis description claims a longitudinal panel and stronger factor-analysis procedure than the checked-in script, which selects each country's freshest cross-section; the recorded complete sample was 46 countries.
- Current components are highly correlated. This does not mechanically invalidate a composite, but it makes incremental-value tests against simple baselines mandatory.
- Current ranking assigns distinct ordinal positions to many equal displayed scores: 190 rows contained only 75 unique score values, with 115 tied rows split into different ranks.
- A–F country grading and labels such as “failed” make unsupported categorical and normative judgments.
- The replication page remains a coming-soon description rather than an independently executable package.

### Civica Conditions

- The economic Conditions adapter selects each component's newest available year, accepts partial component sets, and labels the result with the maximum year, obscuring temporal mismatch.
- Normalization parameters are recomputed from the mutable cross-section rather than stored with the release, and component values/years/missingness are not sufficiently queryable from the score row.
- “Economic stability” rewards higher GDP growth without demonstrating that rebound/boom growth is stability.
- The public Conditions explorer reads a generic metrics layer rather than the sparse versioned Conditions score table it claims to present.

### Civica Pulse

- The cross-vendor ensemble is a real improvement over repeat sampling of one model, but ensemble agreement is still a heuristic and not empirical calibration.
- Every one of the 376 live Pulse events had exactly one distinct source; the live system therefore has no genuinely corroborated multi-source event cluster.
- Batch-only clustering and widespread lexical fallback can publish and score multiple clusters for one real-world incident; confirmed live examples include the same France ruling contributing more than once and across dimensions.
- Specialist-source and general-news coverage is materially different from the public source basket. Some named feeds are absent or stubbed while live rows are dominated by GDELT, HRW, Amnesty, and CIVICUS.
- Press-freedom and agreement multipliers are hand-set editorial priors. News-only events in restricted-media environments can still contribute low-confidence numeric deltas rather than producing an explicit observability/insufficient-evidence state.
- The taxonomy forces one category/dimension per event and contains choices that cannot represent multi-dimensional or normatively ambiguous events.
- Subscription/application code can write a literal `two_of_three` agreement for one run, and current/legacy events coexist without enough strategy/prompt/taxonomy metadata to support “every event used the ensemble” claims.
- The historical backtest uses a separate single-model path, famous curated cases, simplified confidence, and dimension-direction checks. It does not test ingestion recall, representative no-event cases, false positives, multi-source clustering, regional/language bias, or the current ensemble end to end.
- The public 10/10 backtest standing comes from the retired pre-ensemble configuration, with no required current pipeline/config hash.
- Events and scores lack a sufficient methodology/prompt/taxonomy/version history for a stable longitudinal series; some current rows mix classifier generations.
- The decay scorer's one-year lookback conflicts with taxonomy half-lives that extend beyond one year.
- Classification does not persist terminal `none`/failure state, so old clusters can consume repeated paid calls; the review queue also has a material months-old backlog. Existing delta rows can remain stale when a country's last event ages out because cleanup iterates only countries seen inside the current window.
- A documented public `sort=cp` path still reads an empty abandoned scalar-Pulse table and returns null/arbitrary ordering despite current dimensional v2 rows.
- The public numeric delta is not presently validated as a measure of latent daily governance quality. A versioned event ledger is a defensible intermediate product.
- Current decoupling can zero earlier event confidence based on aggregate movement without an explicit event link, and later corroboration can overwrite the mutation; press-freedom context is mutable, incomplete, and defaults unknown countries to an invented midpoint.

### Peer groups and government taxonomy

- Governance scores can be shown through both governance and World Bank material peer lenses despite the documented domain separation.
- Global fallback cohorts can include the full 253-row jurisdiction universe rather than the metric-observed/scored population; documented special fallbacks, cohort sizes, and source vintages are not fully carried to UI.
- Claimed government-type trajectories reuse the current classification across a very short score history instead of joining historically valid classifications.

### Public claims and institutional trust

- `CITATION.cff` describes Civica as academically citable and centers the Index/Pulse while the replication package, external review, release version, DOI, and named human accountability are incomplete.
- High-visibility footer/about copy says all data is open/free to use even though the detailed legal pages acknowledge non-commercial and publisher-specific restrictions; the repository also has no root code license despite README/site claims.
- Public API examples materially disagree with live jurisdictions, facts, score vintages, ranks, and totals; embed provenance is derived from a small unrelated fact set rather than all fields actually shown.
- Runtime, README, content, memory, and plans contain stale disagreements about Pulse cadence/classifier design and current routes.
- A prior preview deployment remains discoverable and the current `robots.txt` blocks multiple AI/search user agents; both are deliberate-policy questions that should be resolved as part of distribution readiness.
- “Civica” is used by established organizations in adjacent public-sector/academic spaces. This does not prove infringement or require a rename, but it warrants professional confusion/trademark review before broad launch.

### Visual system and assets

- The 197 country dark engravings are not one color family. Japan is a strong warm/orange outlier, and country, territory, and page-hero batches show materially different shadow palettes.
- A separate blind OKLab palette-coverage pass found the corpus broadly low-chroma/on-palette but missed the known hue-balance problem; it independently found two nominal light territory assets that are nighttime images, seven mismatched country-pair dimensions, and multiple dark-edge vignette outliers. Color QA therefore needs both palette-distance and hue/shadow-balance tests rather than one global saturation test.
- Color drift is correctable through a deterministic, piloted split-tone grade; regenerating 197 images is not justified by color alone.
- The country engraving caption and Map/Images tile row occupy the same desktop hero region and measurably overlap at common widths.
- A blind boundary sweep independently reproduced the caption collision from 769–1440px, with a severe 768/769 layout discontinuity; it also found OpenStreetMap/Protomaps links nested inside the map tile's button.
- The Explore menu has sound interaction fundamentals but weak information hierarchy, repeated generic art, oversized source assets, and unnecessary loading of both theme variants.
- The blind menu inventory confirmed only six motifs for eight destinations, weak/duplicate semantic mappings, flat group semantics, and roughly 1.87 MB of active+hidden theme art loaded before the menu opens.
- The country engraving caption file cites a generation manifest that is absent from the repository and its history. The live licensing/disclosure material does not clearly explain that landmark engravings are AI-assisted editorial illustrations rather than documentary evidence.
- Country assets lack a validator comparable to territory assets; final dimensions, fallback format, pair coverage, captions, size, and color-family conformity are not enforced.
- Published medium and large embed presets clip their own attribution/footer content, and embed documents/design/provenance do not meet the main site's semantics or token standards.
- The Atlas map is pointer-dependent and its mobile “tap two to compare” instruction does not match the implemented shift-key selection behavior. The mobile menu lacks complete modal focus/inert behavior.
- The country Constitution tab breaks the shared three-tab shell and introduces a second H1 beneath the country masthead.

### Build, testing, security, and operations

- No canonical CI workflow proves lint, tests, validators, build, data contracts, and browser paths on every relevant change.
- Production adapter orchestration, migrations, and release publication are not currently fail-closed/atomic enough to support clean recovery or independent setup.
- There is no comprehensive Playwright/e2e suite for critical routes, themes, viewports, keyboard behavior, console/network errors, or visual regressions.
- Product error boundaries are absent; country data failures can collapse into `notFound()`, turning a database outage into a false/indexable country 404.
- Pulse changelog currently loads thousands of rows into the initial response for client-side filtering/pagination.
- Pulse has little meaningful automated coverage relative to its methodological complexity.
- Index tests do not yet prove exact clean-room reproduction, deterministic uncertainty, candidate comparisons, or panel-validation results.
- Observability, backup/restore evidence, scheduled-job freshness, release rollback, distributed rate limits, and API contract/version tests require explicit release gates.
- Public chat and model-assisted pipelines need documented model/version/prompt/citation/failure policies even when provider credentials and code paths already exist.
- Admin flows have medium-risk same-origin redirect, brute-force/session-expiry, and unsigned audit-identity gaps; dependency scanning reports a reachable high production vulnerability path and no automated update/audit gate.

## Stubbed or placeholder surfaces

- Civica Index replication package: promised contents, not a shipped reproducible artifact.
- Academic/advisory governance: an application/target-roster surface exists, but a named independent board and published review process do not yet exist.
- Advisory recruitment copy/CTA state is contradictory, applicant privacy is missing from the privacy policy, form errors lack accessible semantics/focus, and the public intake relies on process-local limiting without monitored acknowledgement/team notification.
- Several Pulse source adapters or published source claims do not correspond to active production data.
- Some research-facing differentiators are shells or absent: source-native long-run trend exploration is thinner than the underlying data permits; cross-corpus constitutional keyword search and research-grade bulk releases are not yet available.

## Blind-audit recall and precision check

The full ledger is `plan/civica-academic-readiness-blind-audit-2026-07-09.md`.

- Index validity/redundancy, Pulse validity/calibration, and inaccurate documentation were independently found and expanded.
- The caption collision was found by the deeper blind geometry rerun.
- Explore's repeated/weak motifs, flat grouping, and eager theme loading were independently found; subjective “underwhelming” taste remains an owner/design decision handled through three concepts.
- The Japan-specific orange cast was a genuine recall miss for the broad blind color metric. A prior targeted hue/shadow audit confirmed it. The master plan therefore requires both general palette/dimension/vignette checks and hue/shadow-family checks.
- A–F implementation/drift/precision problems were found, but the normative objection was not independently elevated until the sealed owner decision and Fable review; it remains an explicit approved policy.
- Adversarial skeptics narrowed or excluded overstatements rather than rubber-stamping the finders. No previously fixed July 1 item was retained without current evidence.

## Planning consequence

The master plan prioritizes truth and reproducibility before new breadth:

1. Correct public claims and remove judgmental grading.
2. Produce the reproducible atlas release foundation.
3. Run the Index validation/design tournament and build the Pulse ledger/validation program in parallel.
4. Close data-depth, reader-experience, platform, and QA gaps that affect trust.
5. Reach the agent-complete gate.
6. Recruit and brief qualified external reviewers.
7. Resolve reviews, register the frozen release, and begin bounded outreach.
