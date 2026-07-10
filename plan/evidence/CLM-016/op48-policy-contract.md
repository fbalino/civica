# CLM-016 — Correction / Retraction / Version / Known-Limitations Policy Contract

**Owner:** OP48 (independent academic-publication policy architect)
**Status:** contract only — no application or plan files edited by this task
**Scope discipline:** this document is the *specification*. It defines the smallest
honest, executable contract for CLM-016. It states the **current** policy in the
present tense; it contains no "was broken / now fixed" migration narrative, because
Civica is pre-launch with no users and no policy history to remediate.

---

## 0. What CLM-016 requires

> Publish correction, retraction, version, and known-limitations policies linked
> from every research artifact. **Done when:** policies define severity, response
> time, historical preservation, API/data corrections, notification, and version
> increments; a simulated correction produces the expected changelog, supersession
> marker, and release-note entry.

Two deliverables, both closed and mechanically checkable:

1. **A single canonical public policy** covering the four policy families
   (correction, retraction, version, known-limitations), **link-only mirrored**
   from every registered research artifact.
2. **A pure, DB-free correction simulator** whose fixed fixture yields an exact
   changelog entry, supersession marker, and release-note entry — verified by a
   validator/test without any production write.

Nothing here promises staffing, review capacity, notification infrastructure, DOI
registration, or external validation that Civica does not currently have. Where a
capability is future-gated, this contract records it as a **deferred boundary**
(§10), not a published claim.

---

## 1. Current-state anchors (what already exists)

The contract binds to what is already in the repo. It does not reinvent these:

| Concern | Existing anchor | Notes |
|---|---|---|
| Public correction intake + log | `/civica-index/corrections` (page + `POST /api/civica-index/corrections`, `correction_log` table) | Status enum: `open, in_review, resolved_corrected, resolved_no_change, rejected`. `isPublic` PII toggle. `disposition` + `resolvedAt` are the public response. |
| Response/disposition targets | `disputeSla` in `src/lib/content/site-state.ts` | `initialResponseDays: 7`, `fullDispositionDays: 30`, plus reconciliation group A/B_tier1/C/plausibility. |
| Reconciliation dispute severity | `src/lib/factbook/reconcile/dispute-severity.ts` | Numeric gap/threshold buckets `lo/mid/hi/xhi`. **Distinct** from policy severity (§4). |
| Reconciliation disputes log | `/country/methodology/reconciliation/disputes` | Read-only public queue. |
| Version stamps | `site-state.ts`: `reconciliation.version` (`v0.2-beta`), `civicaIndex` (`beta`), `pulse.taxonomy.version` (`v2.0` + `versionHistory`), `peerGrouping.versionHistory` | Already the single source of truth for public version prose. |
| Pulse changelog / corrections | `pulse_changelog`, `pulse_corrections` tables; `/civica-index/pulse-changelog` | Event-ledger revision history. |
| CI methodology versions | `ci_methodology_versions` table | Weight/version history for the Index. |
| Evidence-tier disclosure | `src/lib/claims/claim-tiers.ts` (7 tiers) | `retired-deprecated-output` already mandates "retirement date, last valid version, reason, replacement, sunset behavior." Retraction/supersession language must conform to this tier. |
| Doc-source registry pattern | `src/lib/docs/doc-concepts.ts` + `scripts/validate-doc-sources.ts` | The canonical/relation + fail-closed-validator pattern this contract reuses. |
| Fail-closed status-surface pattern | `src/lib/content/replication-surface.ts` + `scripts/validate-replication-surface.ts` | The pure/DB-free issue-code + prohibited-language-scanner + fixture pattern this contract reuses. |
| Public-claims registry | `src/lib/claims/public-claims.ts` (`PUBLIC_CLAIMS`) | The four policies are **institutional-posture** claims and must be registered there. |

**Design-system constraint (owner mandate):** the policy page is a *sectioned
document page* → it uses `methodology-layout` + `ReaderSidebar` (1200px, left
sidebar), composes `editorial.css` classes, and adds no per-page `<style>` block.
`width="narrow"` is for blog essays only; do not use it here.

---

## 2. Canonical location and mirrors

### 2.1 One canonical policy page

**Canonical:** a new reader route **`/policies`** (top-level, atlas-first — because
corrections/retractions apply to atlas facts, reconciliation, the Index, Pulse, and
peer grouping alike, not only to the Index). Stable section anchors, written
`## Heading {#anchor}`:

- `#corrections` — correction policy (§3–§5)
- `#retractions` — retraction & supersession policy (§6)
- `#versioning` — version-increment policy (§7)
- `#known-limitations` — known-limitations policy (§8)
- `#data-api-corrections` — API/data-correction behavior (§9)
- `#notification` — notification posture (§9.4)

The page's prose numeric/version content interpolates from `site-state.ts`
(`disputeSla`, `reconciliation.version`, `pulse.taxonomy.version`, etc.) — **no new
hardcoded SLA numbers or version strings in the page.**

### 2.2 Link-only mirrors (never re-stated prose)

Every registered research artifact (§8/registry) carries a **link-only** pointer to
the relevant `/policies#anchor`. Mirrors never restate the policy body — they link,
exactly as `content/about.md` links to `/licensing#imagery` rather than duplicating
imagery policy. Specifically:

- `/civica-index/corrections` links `#corrections` and `#data-api-corrections` as
  the *governing policy*; it remains the **intake form + public log** (operational
  surface, not the policy source).
- `/country/methodology/reconciliation` and its disputes log link `#corrections` /
  `#retractions`.
- Each methodology page (`content/methodology-*.md`) links `#known-limitations` and
  `#versioning` from its limitations/version section.
- `README.template.md` links `/policies` in prose only (link-only, no policy body).

This is registered in the doc-source registry (§8.3) so a mirror that grows a
duplicated policy paragraph fails `validate:doc-sources`.

---

## 3. Correction policy — definitions

A **correction** changes a *published value or statement* that was wrong, without
withdrawing the artifact. Five mutually exclusive dispositions (this contract's
canonical vocabulary; it maps onto the existing `correction_log.status` enum):

| Policy disposition | Meaning | `correction_log.status` | Marker produced |
|---|---|---|---|
| **Correction** | A published value/statement was wrong; the corrected value replaces it going forward. | `resolved_corrected` | changelog + supersession marker + release-note |
| **Clarification** | The value stands; wording/labelling/context is improved so it can't be misread. No numeric change. | `resolved_no_change` | changelog only (type `clarification`) |
| **No change** | Reviewed; the published output is correct as-is; rationale recorded. | `resolved_no_change` | changelog only (type `no-change`) |
| **Rejected** | Out of scope, unfounded, or duplicate. | `rejected` | log entry only |
| **Retraction / supersession** | The output is withdrawn or replaced wholesale (see §6). | `resolved_corrected` + retraction flag | changelog + supersession marker + release-note + retraction notice |

Every disposition writes a public `correction_log` row (unless `isPublic=false` for
PII redaction, which still counts internally). **Historical preservation:** a
`correction_log` row is never hard-deleted; a redacted row is hidden, not removed.

---

## 4. Severity classes and response/disposition targets

**Policy severity is editorial, not the reconciliation numeric bucket.** The
`dispute-severity.ts` `lo/mid/hi/xhi` buckets measure a *numeric gap ÷ threshold*
for material-error reconciliation disputes and stay exactly as they are. Policy
severity classifies **impact on a reader's understanding** and drives disposition
targets:

| Class | Definition | Target initial acknowledgement | Target full disposition |
|---|---|---|---|
| **Critical** | A headline/front-facing value is materially wrong, a country is misidentified, or an output implies a false factual claim about a government. | `disputeSla.initialResponseDays` (7) | ≤ `disputeSla.group.A` (7) |
| **Major** | A non-headline value is wrong or a methodology decision is materially misapplied; affects comparisons. | 7 | ≤ `disputeSla.group.B_tier1` (14) |
| **Minor** | A localized value, label, or breakdown is off but does not change the headline reading. | 7 | ≤ `disputeSla.fullDispositionDays` (30) |
| **Editorial** | Typo, broken link, wording, or clarification with no numeric effect. | 7 | ≤ `disputeSla.fullDispositionDays` (30) |

**Anti-overpromise clause (mandatory, published verbatim in intent):** the page must
state these are **targets for a single-maintainer, pre-launch project, measured in
calendar days, not a staffed 24/7 SLA or a contractual guarantee.** The contract
**forbids** any published phrasing implying guaranteed response, round-the-clock
staffing, a support team, or a guaranteed resolution time. (Validator scans for
`24/7`, `guaranteed response`, `support team`, `dedicated staff`, `within N hours`.)
All numeric targets interpolate from `disputeSla`; no new SLA literals.

---

## 5. Correction disposition flow (mechanical, no new staffing)

1. Submission → `correction_log` row, `status=open`.
2. Triage assigns a **policy severity class** (§4) and a **disposition intent** (§3).
3. On resolution, `status`, `disposition` (public response text), and `resolvedAt`
   are set; a **changelog entry** is produced (§7.3); if the disposition is a
   correction/retraction affecting a published output, a **supersession marker** and
   a **release-note entry** are produced (§7).
4. Nothing is silently overwritten (§9).

No step in this flow requires a person to be available at any specific hour; the
targets in §4 are the only time commitments and they are explicitly best-effort.

---

## 6. Retraction, supersession, and methodological/version change — precise distinctions

These four are frequently conflated. The contract fixes exact meanings and exact
markers:

| Term | What withdraws/changes | Historical treatment | Marker |
|---|---|---|---|
| **Correction** (§3) | One value/statement, replaced going forward. | Prior value preserved in changelog + superseded release. | `superseded-by` on the specific value's version. |
| **Retraction** | A whole published output (an artifact, a computed release, a Pulse event, a ranking) is withdrawn because it should not have been published or is unsound. It is **not** replaced by a corrected version. | Output stays visible but flagged **RETRACTED** with date, reason, last-valid-version; access preserved for auditability. | `retraction` notice + `retracted-at` + reason; conforms to `retired-deprecated-output` tier disclosure. |
| **Supersession** | A published output is **replaced** by a new version that is the current one. The old version remains addressable. | Old version marked `superseded`, new version marked `supersedes`. | `supersedes` / `superseded-by` version pair. |
| **Clarification** | Wording/context only; no value or version-breaking change. | Original stands; changelog notes the wording refinement. | changelog `clarification` type; **no** version bump. |
| **Methodological / version change** | The rule that *produces* outputs changes (weights, normalization, taxonomy, thresholds). | Prior methodology version retained (`ci_methodology_versions`, `pulse.taxonomy.versionHistory`, `reconciliation.version`). | version increment per §7 + supersession of the prior methodology version. |

**Rule R6.1 — retraction is not deletion.** A retracted or superseded output is
never removed from the historical record; it is marked and kept addressable. This
mirrors the `retired-deprecated-output` claim tier's "keep historical access visibly
separated from current outputs."

**Rule R6.2 — supersession is not silent.** A superseded output must carry a
machine-readable pointer to its successor version and vice-versa.

---

## 7. Version-increment rules, changelog, supersession marker, release note

### 7.1 Version-increment semantics (applies to each versioned artifact's own string)

Civica already uses `vMAJOR.MINOR[-beta]` style strings (`v0.2-beta`, `v2.0`). The
contract fixes what each bump means, **without renaming any existing version field**:

- **MAJOR** — an **incompatible methodology break**: outputs are not comparable
  across the boundary (dimension set changes, normalization redefinition, taxonomy
  restructure, scale change). Requires a supersession of the prior version and a
  release note.
- **MINOR** — a **refinement** that keeps outputs comparable (threshold tweak, added
  source, bug-fix to a computation, added category). Requires a changelog entry and a
  release note; supersedes at the value level only where values changed.
- **PATCH / editorial** — documentation, wording, or non-output fix. Changelog entry
  only; **no** supersession marker.
- The `-beta` suffix is orthogonal and reflects validation status, not increment size.

A **methodological/version change** (§6) always drives at least a MINOR bump; an
incompatible break drives MAJOR.

### 7.2 Supersession marker (canonical shape)

A pure, serializable object (no clock, no DB) — the simulator (§7.5) emits it:

```
SupersessionMarker {
  artifactId: string        // e.g. "civica-index"
  fromVersion: string       // superseded version, e.g. "v2.0"
  toVersion: string         // current version, e.g. "v2.1"
  kind: "correction" | "supersession" | "retraction" | "methodology-change"
  reason: string            // short human reason
  effectiveDate: string     // ISO date PASSED IN, never new Date()
}
```

`kind: "retraction"` sets `toVersion` equal to `fromVersion` and adds a
`retractedAt` field instead of a successor (there is no successor).

### 7.3 Changelog entry (canonical shape)

```
ChangelogEntry {
  artifactId: string
  version: string           // the version this entry belongs to
  date: string              // ISO date PASSED IN
  type: "correction" | "clarification" | "no-change" | "retraction"
       | "supersession" | "methodology-change"
  severity: "critical" | "major" | "minor" | "editorial" | null   // null for no-change/methodology
  summary: string           // one line, present tense, no before/after theater
  correctionLogId: string | null   // links to the public correction_log row when applicable
}
```

### 7.4 Release-note entry (canonical shape)

```
ReleaseNote {
  artifactId: string
  version: string
  date: string
  headline: string          // reader-facing one-liner
  changes: string[]         // bullet summaries
  supersedes: string | null // prior version, or null for a first release
}
```

### 7.5 The pure simulated correction (the CLM-016 acceptance fixture)

A pure function — proposed `simulateCorrection(input, clock)` in
`src/lib/policy/correction-simulator.ts` — takes a fully specified fixture and a
**passed-in ISO date** (never `new Date()`, per the repo's no-clock rule) and returns
`{ changelog, supersession, releaseNote }`. **No DB, no network, no write.**

**Canonical fixture (the frozen test input):**

```
FIXTURE_CORRECTION = {
  artifactId: "civica-index",
  fromVersion: "v2.0",
  toVersion: "v2.1",
  disposition: "correction",
  severity: "major",
  country: "Example Republic",
  field: "rule_of_law",
  summary: "Correct an over-counted Rule of Law input for Example Republic.",
  correctionLogId: "00000000-0000-0000-0000-000000000000",
  effectiveDate: "2026-07-10"
}
```

**Expected outputs (exact — the test asserts deep equality):**

```
changelog = {
  artifactId: "civica-index",
  version: "v2.1",
  date: "2026-07-10",
  type: "correction",
  severity: "major",
  summary: "Correct an over-counted Rule of Law input for Example Republic.",
  correctionLogId: "00000000-0000-0000-0000-000000000000"
}

supersession = {
  artifactId: "civica-index",
  fromVersion: "v2.0",
  toVersion: "v2.1",
  kind: "correction",
  reason: "Correct an over-counted Rule of Law input for Example Republic.",
  effectiveDate: "2026-07-10"
}

releaseNote = {
  artifactId: "civica-index",
  version: "v2.1",
  date: "2026-07-10",
  headline: "Civica Index v2.1 — corrected Rule of Law input for Example Republic.",
  changes: [
    "Correct an over-counted Rule of Law input for Example Republic."
  ],
  supersedes: "v2.0"
}
```

A second frozen fixture `FIXTURE_RETRACTION` (`disposition: "retraction"`) asserts
`supersession.kind === "retraction"`, `toVersion === fromVersion`, a `retractedAt`
field, and a `releaseNote.supersedes === null` with a `RETRACTED` headline. A third
`FIXTURE_CLARIFICATION` asserts a changelog entry with `type: "clarification"`,
`severity: "editorial"`, and **no** supersession marker and **no** version bump
(`toVersion === fromVersion`).

The simulator is **the** executable proof of the CLM-016 Done-when clause.

---

## 8. "Every research artifact" as a closed, mechanically registered set

### 8.1 The registry

A proposed `src/lib/policy/research-artifacts.ts` exporting `RESEARCH_ARTIFACTS`, one
row per public research artifact, each declaring its route, the policy anchors it must
link, and its current version-field source in `site-state.ts`:

```
ResearchArtifact {
  id: string                      // "civica-index", "pulse-ledger", ...
  label: string
  route: string                   // canonical reader route
  requiredPolicyAnchors: string[] // subset of #corrections/#retractions/#versioning/#known-limitations
  versionSource: string           // dotted site-state path, or null for none
}
```

**Closed launch set (the initial inventory — adding one is a code change, caught as
"missing" if a page exists without registration, exactly like the replication
inventory):**

1. `civica-index` — `/civica-index` — all four anchors — `civicaIndex.status`
2. `pulse-ledger` — `/civica-index` (Pulse section) / pulse-changelog — corrections, retractions, versioning, known-limitations — `pulse.taxonomy.version`
3. `reconciliation` — `/country/methodology/reconciliation` — all four — `reconciliation.version`
4. `peer-grouping` — `/civica-index/methodology/peer-grouping` — versioning, known-limitations — `peerGrouping.version`
5. `pca-appendix` — `/civica-index/methodology/pca-appendix` — versioning, known-limitations — `civicaIndex.pca` (label only)
6. `civica-conditions` — `/civica-conditions` — known-limitations, corrections — (n/a)

The registry is the **closed set**. "Linked from every research artifact" means:
`validate:policy-surface` fails if any registered artifact's page does not contain a
link to each of its `requiredPolicyAnchors`, and (inverse) if a reader page that
renders a registered-artifact output exists but is not in the registry. This is the
same "independent required-inventory list, drift = missing" guarantee as
`REQUIRED_REPLICATION_COMPONENT_IDS`.

### 8.2 Known-limitations policy (§8 content)

The `#known-limitations` policy states: (a) every research-beta / experimental output
already carries per-artifact limitations via its claim tier
(`research-beta-estimate`, `experimental-heuristic`), (b) `/policies#known-limitations`
is the umbrella that names, per artifact, the *categories* of limitation (validation
state, uncertainty posture, missingness, coverage), and (c) each artifact's own page
carries the specific limitations. The umbrella links to each artifact; each artifact
links back. No limitation prose is duplicated — the umbrella is an index.

### 8.3 Registration in the two existing registries

- **`PUBLIC_CLAIMS`**: add four `institutional-posture` claims
  (`policy.corrections`, `policy.retractions`, `policy.versioning`,
  `policy.known-limitations`), each requiring the tier's disclosures (name current
  status + effective date, distinguish shipped vs planned, link the governing policy).
- **`DOC_CONCEPTS`**: add a `policy-page` concept whose **canonical** is
  `/policies` (reader-tsx) and whose relations are the link-only mirrors (§2.2),
  so a mirror that duplicates policy prose fails `validate:doc-sources`.

---

## 9. Historical preservation, API/data corrections, notification

### 9.1 Historical preservation (mandatory rules)

- **R9.1** No published value, output, methodology version, changelog entry, or
  correction-log row is ever hard-deleted. Redaction (PII) hides; it does not remove.
- **R9.2** Every superseded/retracted output stays addressable with its marker.
- **R9.3** Frozen vintages (`reconciliation.currentVintage`, quarterly cuts) are
  immutable once cut; a correction lands in the *next* vintage, and the changelog
  records which vintage first carries it.

### 9.2 API / data correction behavior

- **R9.4 No silent overwrite.** A corrected value propagates on the next computation
  / vintage; the API response's `meta` carries the methodology/reconciliation version
  and last-revised date (the Index API already exposes `meta.methodology.last_revised`
  and every value carries a `SourceDot`). A correction that changes an API value must
  bump the version surfaced in `meta` (§7).
- **R9.5** Retracted outputs disappear from *current* API results but remain queryable
  under their historical version where a versioned endpoint exists; where no versioned
  endpoint exists yet, the retraction is recorded in the changelog and the value is
  removed from the current response with the version bumped — never mutated in place
  under the same version.
- **R9.6** `last_sync_at` freshness is untouched by this policy — corrections are not
  syncs and must not stamp freshness (the `markSourcesSynced()` invariant stands).

### 9.3 Version increments and API

The public version string an API returns is the artifact's `site-state.ts` version
field; §7 governs when it increments. The API contract layer
(`src/lib/api/contract/`) is where the `meta.version` surface is asserted — the policy
does not add a second version source.

### 9.4 Notification posture (honest, no infrastructure promised)

- **The changelog + public corrections log are the notification channel.** The policy
  states plainly: Civica notifies by **publishing** to `/policies` change history, the
  per-artifact changelog, and the public corrections log.
- The contract **forbids** claiming an email list, subscriber alerts, push
  notifications, or individual notification of affected parties **unless that
  infrastructure exists** (it does not, pre-launch). Validator scans `#notification`
  for `we will email you`, `subscribe to alerts`, `notify all affected`,
  `push notification` and fails closed.
- A machine-readable changelog feed (JSON/RSS) is **allowed language only if the feed
  actually ships**; otherwise it is a §10 deferred boundary, not a published promise.

---

## 10. Deferred boundaries (explicitly NOT in CLM-016)

Recorded so the policy page does not overclaim. Each is owned by a later task:

- **DOI / archival registration** of corrected/superseded releases → GOV-021 (G4/G5).
- **External-reviewer notification & advisory-board sign-off** on methodology
  changes → IDX-028 / G4; `advisoryBoard.status` stays `coming-soon`.
- **Machine-readable changelog feed (RSS/JSON) + subscriber notification** → deferred;
  do not publish as available until it ships.
- **Frozen versioned API endpoints** for retracted-output retrieval → DAT-022 / API
  cleanup; §9.5 states the interim behavior honestly.
- **Clean-room reproduction of a corrected release** → DAT-022 / QA-020 (the
  replication surface, CLM-010, already owns this inventory).
- **Reconciliation numeric-severity ↔ policy-severity unification** → not attempted;
  the two severity systems stay separate by design (§4).

The policy page states, for each, "planned — see [gate]", using the
`institutional-posture` tier's required "distinguish shipped from planned" disclosure.

---

## 11. Fail-closed validator rules

A proposed `scripts/validate-policy-surface.ts` + pure core
`src/lib/policy/policy-surface.ts` (mirrors `replication-surface.ts`): pure, DB-free,
issue-code list, exits non-zero on any issue.

**Rules (each an issue code):**

- `missing-policy-page` — `/policies` route/file absent.
- `missing-policy-anchor` — a required anchor (`#corrections` … `#notification`) absent from the page.
- `artifact-missing-policy-link` — a registered artifact's page does not link each of its `requiredPolicyAnchors`.
- `unregistered-artifact` — a reader page rendering a registered-artifact output is not in `RESEARCH_ARTIFACTS`.
- `duplicated-policy-prose` — a mirror restates policy body instead of linking (formula/phrase fingerprint, via `validate:doc-sources`).
- `overpromise-staffing` — §4 forbidden phrases present (`24/7`, `guaranteed response`, `support team`, `dedicated staff`, `within \d+ hours?`).
- `overpromise-notification` — §9.4 forbidden phrases present.
- `hardcoded-sla` — a numeric day-count in policy prose not sourced from `disputeSla` interpolation.
- `hardcoded-version` — a version string in policy prose not sourced from `site-state.ts` interpolation.
- `simulator-drift` — `simulateCorrection(FIXTURE_*)` output ≠ the frozen expected objects (§7.5).
- `migration-theater` — before/after remediation phrasing in policy prose (`used to`, `previously wrong`, `now fixed`, `was broken`).

**Fail-closed:** unknown artifact status, missing registry row, or a
simulator-output mismatch are errors, not warnings. The validator returns issues; the
CLI wrapper exits 1 if the list is nonempty.

### 11.1 False-positive / false-negative fixtures (required)

Test file `src/lib/policy/__tests__/policy-surface.test.ts`:

- **True-negative (clean):** a fixture policy surface with all anchors, all mirrors
  link-only, interpolated SLAs/versions, no forbidden phrases → **0 issues**.
- **False-negative guard (must be caught):**
  - an artifact registered but its page missing a `#corrections` link → `artifact-missing-policy-link`.
  - a mirror containing a verbatim SLA sentence → `duplicated-policy-prose` + `hardcoded-sla`.
  - policy prose saying "guaranteed response within 24 hours" → `overpromise-staffing`.
  - `simulateCorrection(FIXTURE_CORRECTION)` mutated by one field → `simulator-drift`.
- **False-positive guard (must NOT fire):**
  - the word "correction" appearing in an artifact's ordinary prose (not a policy body) → no `duplicated-policy-prose`.
  - a legitimate `disputeSla.fullDispositionDays`-interpolated "30 days" → no `hardcoded-sla`.
  - a version string rendered from `reconciliation.version` → no `hardcoded-version`.
  - the noun "limitation" inside a methodology paragraph → no `overpromise-*`.

---

## 12. File-by-file implementation map (for the later build task — NOT executed here)

| File | Action | Purpose |
|---|---|---|
| `content/policies.md` (+ TSX shell `src/app/(reader)/policies/page.tsx`) | **new** | Canonical policy page; `methodology-layout` + `ReaderSidebar`; sections/anchors per §2.1; all numbers/versions interpolated. |
| `src/lib/policy/correction-simulator.ts` | **new** | Pure `simulateCorrection(input, clock)` (§7.5); no DB/clock. |
| `src/lib/policy/policy-surface.ts` | **new** | Pure issue-code validator core (§11) + prohibited-phrase scanners. |
| `src/lib/policy/research-artifacts.ts` | **new** | `RESEARCH_ARTIFACTS` closed registry + `REQUIRED_ARTIFACT_IDS` (§8.1). |
| `src/lib/policy/__tests__/policy-surface.test.ts` | **new** | Fail-closed + FP/FN fixtures (§11.1). |
| `src/lib/policy/__tests__/correction-simulator.test.ts` | **new** | Deep-equality assertions on the three frozen fixtures (§7.5). |
| `scripts/validate-policy-surface.ts` | **new** | CLI wrapper; exit 1 on any issue. Wire `validate:policy-surface` into `package.json` and the pre-commit validator sweep. |
| `src/lib/claims/public-claims.ts` | **edit** | Register 4 `institutional-posture` policy claims (§8.3). |
| `src/lib/docs/doc-concepts.ts` | **edit** | Register `policy-page` concept: canonical `/policies`, link-only mirrors (§8.3). |
| `content/methodology-*.md`, `content/about.md`, `README.template.md`, `/civica-index/corrections`, reconciliation pages | **edit (link-only)** | Add link-only mirrors to `/policies#…` (§2.2). |
| `src/lib/content/site-state.ts` | **no new numbers** | Reuse `disputeSla` etc.; add only per-artifact `versionHistory` if an artifact lacks one. |

**Validators to run before commit:** `validate:policy-surface`, `validate:doc-sources`,
`validate:public-claims`, `validate:content-templates`, `validate:design-tokens`,
`validate:terminology`, plus `tsc`/tests/build.

---

## 13. ACCEPT / REJECT checklist (independent reviewer)

Mark each. **ACCEPT the contract only if all are ✅.**

**Canonicalization**
- [ ] Exactly one canonical policy location (`/policies`); all other mentions are link-only mirrors, none restate policy body.
- [ ] Policy page is a sectioned document page on `methodology-layout` + `ReaderSidebar`, no per-page `<style>`, stable `{#anchor}` ids.

**Definitions & severity**
- [ ] Correction, clarification, no-change, rejected, retraction, supersession, and methodological/version change are each defined distinctly and mapped to a marker.
- [ ] Policy severity (Critical/Major/Minor/Editorial) is defined and kept separate from the reconciliation numeric `lo/mid/hi/xhi` bucket.
- [ ] Every response/disposition target interpolates from `disputeSla`; no new SLA literals.
- [ ] The page cannot claim 24/7 staffing, a support team, or guaranteed response time (validator-enforced).

**Version / preservation / API / notification**
- [ ] MAJOR/MINOR/PATCH increment semantics are fixed and tied to existing version fields without renaming them.
- [ ] Historical preservation rules R9.1–R9.3 (no hard delete, addressable supersession, immutable vintages) are stated.
- [ ] API/data correction behavior R9.4–R9.6 (no silent overwrite, version bump in `meta`, freshness untouched) is stated.
- [ ] Notification posture is "publish to changelog/log"; email/subscriber/push claims are forbidden unless the feed ships.

**Closed set + registries**
- [ ] "Every research artifact" is a closed `RESEARCH_ARTIFACTS` registry with a required-id inventory; an unregistered artifact page or a missing policy link fails closed.
- [ ] Four policy claims registered in `PUBLIC_CLAIMS` as `institutional-posture`; a `policy-page` concept registered in `DOC_CONCEPTS`.

**Simulated correction (the Done-when proof)**
- [ ] A pure, DB-free, clock-injected `simulateCorrection` is specified.
- [ ] Frozen `FIXTURE_CORRECTION` → the exact changelog + supersession marker + release-note objects in §7.5.
- [ ] Retraction and clarification fixtures assert the distinct marker behavior (retraction: no successor; clarification: no supersession, no bump).

**Validator & boundaries**
- [ ] Fail-closed validator with the §11 issue codes and both false-positive and false-negative fixtures is specified.
- [ ] Deferred boundaries (DOI, external review, RSS/subscriber notification, versioned retraction endpoints, clean-room) are explicitly out of scope with owning gates.
- [ ] No migration-theater: policy prose is present-tense current truth; no "was wrong / now fixed" narrative (validator-enforced).

**REJECT** if any box is unchecked, if the policy introduces a second canonical
location, if any target implies staffing Civica lacks, if the simulator touches a DB
or a live clock, or if "every research artifact" is left as an open/uncounted set.
