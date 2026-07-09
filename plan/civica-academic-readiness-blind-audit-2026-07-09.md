# Civica Academic Publication Readiness — Blind Audit Ledger

**Date:** 2026-07-09
**Protocol:** Blind Audit FIND → adversarial VERIFY → sealed recall/precision check → synthesis
**Scope:** Academic methodology/data, platform/release integrity, reader experience/design/accessibility/trust
**Mutation policy:** Read-only; no sync, migration, deploy, admin mutation, external message, or database write

## Protocol integrity

Three finders were started without conversation history. They were explicitly forbidden from reading `plan/`, `.orchestrator/`, project histories/memory, Downloads, or the owner's examples. They received only the project root and the canonical standard for their surface class. Each finder tried to refute its own findings.

After the FIND stage, a platform skeptic rechecked the experience ledger and an academic skeptic rechecked selected platform findings while defaulting each claim to false. Overstatements were narrowed or excluded. The owner's known examples were opened only after the initial ledgers were returned; missed surface classes received one deeper blind enumeration.

## Confirmed critical/high ledger

The task column is the canonical remediation; its `Done when` is the acceptance test.

### Release, data, and provenance

| ID | Severity | Confirmed finding and evidence | Verification | Task(s) |
|---|---|---|---|---|
| BA-001 | Critical | Published Index inputs cannot be reproduced from `main`: six adapters such as `scripts/ingest-ci-vdem.ts:13-27` are small hardcoded reference maps while live 2024 rows have no canonical producer/input artifact. | Independently found by academic and platform lanes. | DAT-001, DAT-002, IDX-002 |
| BA-002 | Critical | The migration journal lists only `0000`–`0011` and creates 28 unique tables while `schema.ts` and live DB contain 49; unjournaled SQL cannot be replayed by the migrator. | Adversarially confirmed. | DAT-013, DAT-026, QA-017 |
| BA-003 | Critical | All six CI adapters end in `main().catch(console.error)`, so `ingest-ci-all.ts:22-32` can count a failed child as success. Publication is not staged/atomic. | Adversarially confirmed. | DAT-012, DAT-030 |
| BA-004 | Critical | Reconciliation and CI “frozen” rows are mutable upserts. `snapshot-vintage.ts:503-541` can overwrite a named vintage; composite upserts can rewrite a quarter/method row. | Independently found; code paths inspected. | DAT-023, DAT-024, IDX-003 |
| BA-005 | Critical | The Q1 Factbook label defaults to `v0.2-beta` while the resolver stamps `v0.1-beta`; all 17,506 live vintage rows carry the mismatch. | Academic lane live DB/code confirmation. | DAT-023, CLM-017 |
| BA-006 | Critical | Live API/export rows can be current resolver values carrying static frozen-Q1 metadata; there is no clean live-versus-vintage selector. | Academic lane; export behavior independently confirmed/narrowed by skeptic. | DAT-024, DAT-027, DAT-031 |
| BA-007 | High | Bulk exports' `facts` collection is raw and duplicated; live US had six population and six life-expectancy rows without enough source/status/release semantics. | Adversarially confirmed, narrowed: summary fields are canonical but `facts[]` is not. | DAT-027, ATL-021 |
| BA-008 | High | Statement provenance has false subject semantics and duplicates: 4,998 `terms` statements point to people, 351 `legislature_parties` statements point to bodies, 29 jurisdiction pointers are orphaned, and 352 duplicate groups add 1,121 excess rows. | Adversarially confirmed from writers/schema/live queries. | DAT-028 |
| BA-009 | High | Public canonical/alternate provenance omits license and exact freshness needed to follow Civica's reuse guidance. | Platform API/live confirmation. | DAT-009, DAT-027, EXP-035 |
| BA-010 | High | Score-driving source usages include null `last_sync_at`; production data appears to predate or bypass the sanctioned freshness path. | Platform live query; code validator itself is clean. | DAT-008, PLT-017 |
| BA-011 | High | One global population minimum necessarily rejects valid sub-1,000 entities; persistence does not cleanly distinguish active versus rejected/quarantined numeric evidence. | Static portion adversarially confirmed; live microstate/DPRK specifics require recheck. | DAT-015, DAT-029 |
| BA-012 | Critical | BR/CGV/QoG reference-year semantics are false: official Jan-2026 rows are 2022 cross-section observations but the importer/UI stamps and displays 2025. | Academic lane verified against official QoG CSV. | DAT-025, ATL-017, ATL-032 |

### Civica Index and analysis

| ID | Severity | Confirmed finding and evidence | Verification | Task(s) |
|---|---|---|---|---|
| BA-013 | Critical | Public missing-data prose says weights are never re-proportioned (`content/methodology-civica-index.md:86-93`); `calculate-v2.ts:88-102,117-132` re-proportions them and contains contradictory comments. | Independently found by prior/root and blind academic lanes. | IDX-003, CLM-008 |
| BA-014 | Critical | Calculations/APIs can mix methodology versions: `calculate-v2.ts:179-201` selects quarter rows without method pinning, and API display transforms can apply current rules to legacy rows. | Academic code/live confirmation. | IDX-035, DAT-033 |
| BA-015 | Critical | The 90% interval is an uncalibrated, unseeded assumption: every source receives SD=5, V-Dem intervals are unused, dimensions sample independently, and the random median becomes the point/rank. | Academic and root audits. | IDX-004, IDX-019, QA-008 |
| BA-016 | High | Rounded tied scores receive false sequential ranks through tie-breaking. Live 190 scores had only 75 unique values; score 70 occupied ranks 43–48. | Blind academic finding; root live snapshot consistent. | IDX-005 |
| BA-017 | Critical | Public PCA/factor claims exceed `analysis/phase-5-3/run_pca.py`: mutable freshest cross-section, n=46, no claimed full panel/factor analysis/varimax/source-substitution test. | Academic lane; appendix partially admits limitations. | IDX-006, IDX-014, IDX-037 |
| BA-018 | High | Coverage/cadence language exceeds releases: latest Beta is 2024-Q4, seven otherwise eligible ISO3 entities lack scores, and “every sovereign state and territory” conflicts with sovereign-only queries. | Academic live/code confirmation. | CLM-006, IDX-006, IDX-021 |
| BA-019 | High | Later 2026 calculations over 2023/2024 inputs are presented as historical vintages; no `series_type` separates as-published releases from harmonized backcasts. | Academic live/schema confirmation. | IDX-036, DAT-025 |
| BA-020 | High | Score bands/tiers drift across methodology/runtime/embed, and country A–F language turns uncertain ordinal output into a judgment. | Drift found by audits; normative risk confirmed in independent Fable design study and sealed owner decision. | CLM-005, IDX-001, IDX-023 |

### Civica Conditions

| ID | Severity | Confirmed finding and evidence | Verification | Task(s) |
|---|---|---|---|---|
| BA-021 | Critical | Economic Conditions selects newest years independently, accepts two of three components, then labels the result with the maximum year (`ingest-conditions-economic.ts:68-94,148-167`). | Blind academic code confirmation. | ATL-026 |
| BA-022 | High | Conditions normalization is recomputed from a mutable cross-section and does not persist complete reference parameters/components/years/missingness. | Blind academic code/schema confirmation. | ATL-027, DAT-010 |
| BA-023 | High | “Economic stability” mechanically rewards higher GDP growth without testing rebound/boom/volatility alternatives. | Blind academic construct audit. | ATL-028 |
| BA-024 | Critical | `/civica-conditions` reads generic `country_metrics`, not the sparse versioned Conditions score table described publicly. | Blind academic code/live confirmation. | ATL-029, ATL-030 |

### Civica Pulse

| ID | Severity | Confirmed finding and evidence | Verification | Task(s) |
|---|---|---|---|---|
| BA-025 | Critical | Mixed live events do not support “every event used the ensemble/audit” claims; current and legacy run shapes coexist without sufficient strategy/version separation. | Blind academic live counts/code. | PUL-004, PUL-036, CLM-007 |
| BA-026 | Critical | `pulse-apply-classifications.ts:99-145` can label one subscription-agent run `two_of_three` and auto-publish it. | Blind academic code confirmation. | PUL-036 |
| BA-027 | Critical | Clustering considers only the current unclustered batch, often uses lexical fallback, and does not compare new items to persisted clusters. | Independently found; adversarially confirmed. | PUL-006, PUL-007, PUL-031 |
| BA-028 | Critical | One Marine Le Pen ruling produced at least five published score-driving event rows across opposing dimensions; a private Marseille dentist fraud case was published as national corruption improvement despite a model identifying it as non-governance. | Blind academic/platform live evidence; examples establish defects, not population error rate. | PUL-013, PUL-018, PUL-031 |
| BA-029 | High | Corroboration counts ingestion `source_id`, not canonical independent publishers/ownership; all news through GDELT collapses to one adapter identity. | Blind academic code confirmation. | PUL-007, PUL-011 |
| BA-030 | High | Press-freedom context is approximate, defaults unknowns to 50, and can be overwritten on rerun rather than remaining an immutable classification-time pin. | Blind academic live/code confirmation. | PUL-009, PUL-010, PUL-038 |
| BA-031 | Critical | Pulse deltas are current-state upserts without adequate history; a country with no event remaining inside the 365-day window can retain an old nonzero row. | Independently found; expiry mechanism confirmed. | PUL-004, PUL-027, PUL-035 |
| BA-032 | High | Decoupling can zero all earlier event confidence in a country/dimension based on aggregate movement without explicit event evidence; later corroboration can overwrite that mutation. | Blind academic code confirmation. | PUL-037 |
| BA-033 | Critical | Backtest uses one provider/verify path, a small authored corpus, no end-to-end retrieval/duplicate/false-positive penalties, and public 10/10 is from the retired April configuration. | Independently found by academic/platform/root audits. | PUL-014–PUL-026 |
| BA-034 | High | Terminal `none`/failed clusters are not persisted; the same config can retry them indefinitely. Live eligible queue cannot distinguish new from terminal-none. | Mechanism adversarially confirmed; exact repeated spend not recoverable. | PUL-032 |
| BA-035 | High | 170 unpublished pending events included 121 older than seven days and an oldest May 4 row, but no formal review-queue SLA exists. | Adversarially confirmed/narrowed: backlog true, SLA breach not yet a claim. | PUL-033 |
| BA-036 | High | Documented `sort=cp` and embed CP use an abandoned empty scalar table while current Pulse is dimensional v2. | Blind platform API/live confirmation. | PUL-034, CLM-007 |

### Reader experience, licensing, accessibility, and brand

| ID | Severity | Confirmed finding and evidence | Verification | Task(s) |
|---|---|---|---|---|
| BA-037 | High | Footer/about universal “open/free to use” language conflicts with active non-commercial/publisher-specific inputs; no repository license exists despite MIT/repository-license claims. | Adversarially confirmed. | CLM-018, BRD-007–BRD-009 |
| BA-038 | High | Licensing page lacks exact source-by-source license/version/link/attribution/commercial/redistribution details. | Adversarially confirmed, scoped to the page and API/export gaps. | DAT-003, BRD-008 |
| BA-039 | High | API examples use stale/future score vintages, countries, totals, and fact values; embeds cite generic factbook sources while displaying CI/taxonomy/Pulse fields. | Adversarially confirmed. | CLM-012, EXP-031 |
| BA-040 | High | Universal per-value provenance copy is false; home, Atlas, government-type/score and other values lack the claimed resolver/dot/rights/freshness affordance. | Adversarially confirmed. | CLM-019, DAT-005, EXP-035 |
| BA-041 | High | Medium/large advertised embed heights clip their own attribution/footer; embed documents/parallel CSS also lack main-site semantics/tokens. | Adversarially confirmed/narrowed to proven presets. | EXP-030, EXP-031 |
| BA-042 | High | Atlas countries are mouse-only SVG paths, the page lacks an H1, and mobile says “tap two” although only Shift-click pins. | Adversarially confirmed. | EXP-033, QA-010/012 |
| BA-043 | High | Mobile menu declares a modal but has no complete focus trap, initial focus, inert background, or focus restoration. | Statically adversarially confirmed. | EXP-020, EXP-034 |
| BA-044 | High | Country Constitution nests a second full editorial page/H1 under the shared country masthead. | Adversarially confirmed. | EXP-032 |
| BA-045 | High | Advisory page is “coming soon” while CTA/API accept applications; applicant data/privacy is absent from the policy; form error focus/announcement and intake limiting/notification are incomplete. | Adversarially confirmed with form-accessibility wording narrowed. | GOV-006–GOV-012, BRD-012 |
| BA-046 | High | Same-name GovTech adjacency with established Civica is factual; this is a confusion signal, not a legal conclusion. | Adversarially confirmed and explicitly narrowed. | BRD-001–BRD-006 |
| BA-047 | High | Both theme images are rendered/fetched across navigation/heroes/cards/footer; unopened Explore loads 16 images/12 URLs, about 1.87 MB. | Adversarially confirmed; deeper asset/network enumeration. | EXP-017, EXP-026 |
| BA-048 | High | Pulse changelog issues two 2,500-row queries and can serialize up to 2,500 unique full events; current production HTML measured ~1.73 MB for 376 events. | Adversarially confirmed/narrowed from “5,000 client rows.” | PLT-028, QA-014 |
| BA-049 | High | No App Router `error.tsx` or `global-error.tsx` exists; soft-failing pages do not cover unexpected failures. | Adversarially confirmed. | PLT-026, QA-010 |

### Art and navigation recall rerun

| ID | Severity | Confirmed finding and evidence | Verification | Task(s) |
|---|---|---|---|---|
| BA-050 | High | Country art lacks reproducible prompt/tool/date/reference/license/hash review manifest; the cited country manifest is absent. | Adversarially confirmed/narrowed: some blog art has a visible Civica Desk credit, but not reproducible provenance. | CLM-014, EXP-010–EXP-012 |
| BA-051 | High | Targeted hue analysis placed Japan dark around the 95th–98th percentile for warmth/red/yellow/chroma, while blind palette-distance analysis found the broader corpus low-chroma/on-palette. The metrics answer different questions. | Known example confirmed independently before blind recall; blind metric missed it. | EXP-005–EXP-009 |
| BA-052 | High | Blind asset enumeration found two nominal light territory files that are nighttime images, seven mismatched country-pair dimensions, and multiple dark-edge vignette outliers. | Deeper blind recall pass, all 266 pairs enumerated. | EXP-005, EXP-011 |
| BA-053 | High | Blind geometry sweep reproduced caption/tile overlap from 769–1440px, severe 768/769 discontinuity, invalid orphan `figcaption`, and nested attribution links inside the map button. | Deeper blind recall pass with measured bounding boxes. | EXP-013, EXP-019, EXP-037 |
| BA-054 | High/Medium | Explore uses six motifs for eight destinations with weak/duplicate mappings, flat group semantics, and both themes eagerly loaded before opening. | Deeper blind recall pass; route meaning remains understandable, so art uniqueness/group semantics are medium while loading is high. | EXP-014–EXP-018 |

## Medium findings retained through broader tasks

- Header/nav/main/heading landmark problems, sticky Compare offset, leaderboard link semantics, unlabeled Ask Civica, methodology heading order, and advisory error linkage → EXP-020/034 and QA-012.
- Blog nested main, social-cover mismatch, raw image dimensions/bytes → EXP-036 and QA-013/014.
- Sitemap omissions/request-time fake last-modified, 404 internal canonical, stale preview/domain policy → CLM-013, QA-015, GOV-027.
- Build tracing pulls unrelated repository files → PLT-003.
- No CI, operational lint, Node pin, e2e suite, or dependency audit gate; one high production vulnerability path was reported → PLT-001/002/005 and QA area.
- Operations lack durable job health/alert ledger; reconciliation WARN can still return HTTP success → PLT-017/018/020/024.
- Peer lenses can use the wrong domain/universe/fallback/vintage; government trajectories reuse current classifications → ATL-031/032.
- Exact source freshness can collapse to month/year in `SourceDot` → EXP-035.

## Sealed recall check

| Owner-known item | Blind result | Action |
|---|---|---|
| Dark Japan is much more orange than the intended canonical look | **Missed by initial and broad palette-distance audit.** Targeted hue/shadow analysis performed before the sealed recall had confirmed it. | Marked a recall miss. EXP-005 must include hue balance and dark-shadow direction, not only chroma/palette distance. |
| Country caption obscured by Map/Images boxes | **Found on deeper blind geometry rerun.** | BA-053; exact boundary regression added. |
| Explore menu/art feels weak and underwhelming | **Partially found initially; structurally found on rerun.** Repeated/weak motifs, flat grouping, and eager load were confirmed; subjective taste itself is not a defect claim. | BA-054; three-concept owner choice remains required. |
| Pulse validity/calibration doubts | **Found independently and expanded substantially.** | BA-025–036. |
| Index redundancy/validity doubts | **Found independently.** The blind academic lane established deterministic third-party dependence, method/validation defects, and false precision. | BA-013–020 plus tournament. |
| Inaccurate/stale docs/methodology | **Found independently across all lanes.** | CLM area. |
| A–F grading is judgmental | **Partially found.** Implementation/drift/precision problems were found; the normative objection was not independently elevated until the sealed decision/Fable review. | Recorded as a blind recall limitation; CLM-005 remains owner-approved policy. |

**Recall conclusion:** The blind process caught the methodological examples and found many extras, but its first visual metric was insufficient for a hue-specific art problem. The deeper module/geometry/menu pass recovered two of the three visual examples; future visual blind audits must combine module ledgers, boundary measurements, hue-family metrics, and sealed examples.

## Precision / negative-control check

- No confirmed ledger item simply resurrected the already-fixed July 1 sanitizer, stale-route, timing-safe cron-auth, or prior data-label findings without current evidence.
- The platform skeptic narrowed four experience claims: clipping to medium/large presets; art credit versus reproducible provenance; advisory basic labels versus incomplete error semantics; and 5,000 fetched rows versus at most 2,500 unique serialized events.
- The academic skeptic excluded unverified country-error/admin claims from the adversarial subset and narrowed the review backlog (backlog true; no prior SLA) and numeric-envelope claim (static flaw true; live examples require a dedicated check).
- Concrete Pulse false positives/duplicates prove specific defects, not a population error rate. Population claims remain gated on representative validation.

## Highest-value extras not supplied by the owner

1. Nonreproducible production adapters and false-success orchestration.
2. Broken migration history for a fresh database.
3. Mutable/mislabeled frozen releases and live values carrying frozen labels.
4. False/duplicate statement-level provenance pointers.
5. Conditions mixing years and a public UI disconnected from its stated dataset.
6. Confirmed Pulse duplicate/false-positive events, terminal retry loop, review backlog, stale backtest, and abandoned public sort.
7. API/embed provenance and example drift.
8. Advisory privacy/operations contradictions.
9. Accessibility failures in Atlas, mobile menu, document structure, and embeds.
10. Factual same-sector name collision requiring professional review.

## Limitations

- No mutating pipeline, migration, deployment, admin action, valid advisory submission, destructive restore, or paid model call was run.
- Official provider configuration, backups/PITR, Vercel project settings, and production database roles were not externally inspected.
- The second longest-country-caption sweep was stopped; Japan covered the full module set and breakpoint matrix.
- Brand evidence establishes adjacency only; legal risk remains a professional manual check.
- The broad art audit used palette-distance/chroma/vignette metrics; the known Japan hue issue required a separate targeted warmth/shadow metric.
