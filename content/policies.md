<!--
  CLM-016 — this file is the prose source of truth for /policies, the
  single canonical correction / retraction / versioning /
  known-limitations policy for every Civica research artifact.

  TSX shell: src/app/(reader)/policies/page.tsx (H1, subtitle,
  page-meta line, cite section, footer nav). This file covers every
  section body, in document order, with stable `## Heading {#anchor}`
  ids.

  Every SLA day-count and version string below is a {{state.*}}
  interpolation from src/lib/content/site-state.ts — never a literal
  number or version string. Validate with:
    npm run validate:content-templates
    npm run validate:policy-surface

  Registry markers (kept in this stripped authoring banner):
  PUBLIC_CLAIM: policy.corrections
  PUBLIC_CLAIM: policy.retractions
  PUBLIC_CLAIM: policy.versioning
  PUBLIC_CLAIM: policy.known-limitations
-->

## Corrections {#corrections}

A **correction** changes a published value or statement that was wrong,
without withdrawing the artifact it appears in. Submissions marked public
appear in the [corrections log](/civica-index/corrections); submissions whose
authors request privacy are retained for review but omitted from that public
log. This page states the policy that governs dispositions and publication
records.

Civica records five mutually exclusive dispositions:

- **Correction** — a published value or statement was wrong; the corrected
  value replaces it going forward.
- **Clarification** — the published value stands; wording or context is
  improved so it can't be misread. No numeric change, no version bump.
- **No change** — reviewed, and the published output is correct as submitted;
  the rationale is recorded.
- **Rejected** — out of scope, unfounded, or a duplicate submission.
- **Retraction / supersession** — the output is withdrawn or replaced
  wholesale; see [Retractions](#retractions) below.

The intake system stores every submission. Public visibility is a separate
choice: contact details are never displayed, and a privacy request hides the
entire submission from the public log. Under this policy, privacy is not a
reason to erase the internal review record.

### Severity classes and response targets

Policy severity classifies the *impact on a reader's understanding* of a
correction. It is a distinct concept from the numeric material-error severity
buckets used inside the reconciliation dispute queue, which measure a
gap-versus-threshold ratio for factbook data specifically — the two systems
are not unified by this policy.

| Class | Definition | Target initial acknowledgement | Target full disposition |
|---|---|---|---|
| **Critical** | A headline/front-facing value is materially wrong, a country is misidentified, or an output implies a false factual claim about a government. | {{state.disputeSla.initialResponseDays}} calendar days | {{state.disputeSla.group.A}} calendar days |
| **Major** | A non-headline value is wrong, or a methodology decision is materially misapplied and affects comparisons. | {{state.disputeSla.initialResponseDays}} calendar days | {{state.disputeSla.group.B_tier1}} calendar days |
| **Minor** | A localized value, label, or breakdown is off but does not change the headline reading. | {{state.disputeSla.initialResponseDays}} calendar days | {{state.disputeSla.fullDispositionDays}} calendar days |
| **Editorial** | Typo, broken link, wording, or a clarification with no numeric effect. | {{state.disputeSla.initialResponseDays}} calendar days | {{state.disputeSla.fullDispositionDays}} calendar days |

These are best-effort targets for a single-maintainer, pre-launch project,
measured in calendar days — not a round-the-clock service level or a
contractual commitment. Civica is maintained by one person with no formal
help-desk organization behind these numbers.

### Current implementation boundary

The current form stores an open review row and the public page shows rows whose
submitters did not request privacy. Civica does **not currently have an
automated correction-publication job** that creates release notes or writes
supersession markers into every product table. The tested simulator defines the
required record shapes without writing to the database; publishing an actual
disposition remains a manual editorial operation.

When Civica publishes a correction to a versioned artifact, its publication
record must contain a changelog entry and — when a released output changes — a
supersession or retraction marker plus a release-note entry. The record must
identify the correction, affected artifact and version, effective date, and
reason. See [Versioning](#versioning) and [Data & API corrections](#data-api-corrections).

## Retractions {#retractions}

Correction, retraction, supersession, clarification, and a methodological or
version change are frequently conflated. Civica fixes exact meanings for each:

| Term | What withdraws or changes | Historical treatment |
|---|---|---|
| **Correction** | One value or statement, replaced going forward. | The prior value is preserved in the changelog as superseded. |
| **Retraction** | A whole published output — an artifact, a computed release, a Pulse event, a ranking — is withdrawn because it should not have been published or is unsound. It is not replaced by a corrected version. | The output stays visible but is flagged retracted, with a date and reason; access is preserved for auditability. |
| **Supersession** | A published output is replaced by a new version that becomes the current one. | The old version is marked superseded; the new version is marked as its successor. The old version remains addressable. |
| **Clarification** | Wording or context only; no value or version-breaking change. | The original stands; the changelog notes the wording refinement. |
| **Methodological / version change** | The rule that produces outputs changes — weights, normalization, taxonomy, or thresholds. | The prior methodology version is retained in its own version history (for example the Civica Index's methodology-version records, Pulse's taxonomy version history, and the reconciliation version stamp). |

For a frozen, versioned release, Civica's rule is that retraction creates a
visible tombstone rather than deletion, while supersession links the old and
new versions in both directions. Civica has **no frozen public release package
yet**, so historical UI/API values are not currently guaranteed to remain
addressable. That limitation is stated again under [Data & API
corrections](#data-api-corrections); the release-package gate must make this
policy mechanically true before a frozen release is published.

## Authority and emergency action {#authority}

This section follows `civica-release-correction-authority/v1`. Fernando Balino is the approver for data and methodology releases, corrections, retractions, supersessions, emergency suppression, and restoration. A release still has to pass its applicable evidence and review gates; approval cannot turn a failed gate into a passing one. Fernando cannot rewrite an independent report or decide an appeal where he has an unmanageable conflict. That decision stays blocked until a qualified independent decision-maker is appointed and named.

### Emergency action

Fernando may temporarily suppress an affected fact, claim, route, export, job, credential, or release when there is credible material misinformation, an active security compromise, a privacy exposure, a rights breach, or unsafe automated output. The first actions are to stop propagation, preserve the minimum lawful evidence, record the affected release identities, open a dated incident or correction record, and state restoration criteria. The current emergency review window is recorded in the machine-readable authority contract; it is a best-effort governance target rather than a service guarantee.

Restoration requires resolution of the trigger, applicable checks, required notices, and a recorded decision. Security-sensitive details may remain private while disclosure would create further risk. A lawful metadata record or public tombstone remains even when harmful payload bytes must be restricted.

### DOI and frozen-release relationships

A frozen release whose bytes or interpretation change receives a new version and DOI. The new DOI metadata names the old DOI with `IsNewVersionOf`; the old DOI names its successor with `IsPreviousVersionOf`. A retracted DOI continues to resolve to a dated retraction notice and preserved metadata. Civica never reassigns an existing DOI to different release bytes. A spelling or descriptive-metadata correction may update DOI metadata without a new object only when the frozen bytes and their interpretation are unchanged. These are publication rules, not a claim that a DOI has already been registered.

### Notices, reports, and appeals

Material actions are recorded on this policy page, the [public corrections log](/civica-index/corrections), the affected artifact's release notes or changelog, the release/DOI landing page after registration, and affected API metadata or deprecation headers where applicable. Precise Atlas record issues use the [data-report route](/report-data-issue); Index and Pulse issues use the [corrections route](/civica-index/corrections), and general questions may use the [contact form](/contact).

A reporter or affected contributor may request one reconsideration by supplying new evidence or identifying a process error. Civica retains the appeal, response, and final disposition. A material conflict held by the original decision-maker requires a named independent appeal decision-maker. Critical findings, appeals, reviewer disagreement, and recommendations to retract or retire do not reduce an agreed honorarium or access to the response.

### Tabletop verification

The machine-readable authority record runs three fixed incidents: a country assigned to the wrong jurisdiction after a frozen release, a methodology failure that invalidates an interpretation, and a restricted publisher payload entering a public export. Each produces containment, a dated incident, changelog and release-note objects, a version outcome, the applicable DOI action, notice locations, and an appeal route. The fixtures write nothing to production.

## Versioning {#versioning}

Where a Civica artifact exposes a methodology version, it uses a
`vMAJOR.MINOR[-beta]`-style label — for example the current reconciliation
version, {{state.reconciliation.version}}, and the current Pulse taxonomy
version, {{state.pulse.taxonomy.version}}. Not every current page or API result
has an artifact-level version field. For those that do, this policy defines
what each increment means without renaming existing fields:

- **MAJOR** — an incompatible methodology break: outputs are not comparable
  across the boundary (a changed dimension set, a redefined normalization, a
  restructured taxonomy, a changed scale). Requires a supersession of the
  prior version and a release note.
- **MINOR** — a refinement that keeps outputs comparable (a threshold tweak,
  an added source, a computation bug-fix, an added category). Requires a
  changelog entry and a release note; supersedes at the value level only
  where values actually changed.
- **PATCH / editorial** — documentation, wording, or a non-output fix.
  Changelog entry only; no supersession marker.

The `-beta` suffix is orthogonal to increment size — it reflects validation
status, not how large the change was. A methodological or version change (see
[Retractions](#retractions)) always drives at least a MINOR bump; an
incompatible break drives a MAJOR bump.

The DB-free correction simulator defines one common shape for a changelog
entry, supersession marker, and release note. Those shapes are the publication
contract for future versioned releases; they are not a claim that every current
runtime pipeline already emits all three automatically.

## Known limitations {#known-limitations}

This section is an index, not a duplicate. It links the six registered research
artifacts to the most specific limitations or methodology disclosure currently
available. Validation state, uncertainty posture, missingness, and coverage do
not all have the same maturity across artifacts; absence of a dedicated
limitations section is itself a gap, not evidence that an artifact has none.

- [Civica Index methodology — Limitations](/civica-index/methodology#limitations)
- [PCA appendix — Limitations](/civica-index/methodology/pca-appendix#limitations)
- [Peer grouping — Limitations](/civica-index/methodology/peer-grouping#limitations)
- [Pulse methodology — Known limitations](/civica-index/methodology/pulse#known-limitations)
- [Reconciliation methodology](/country/methodology/reconciliation)
- [Civica Conditions — source-native measures and current coverage](/civica-conditions)

For a future frozen release, the policy prohibits hard-deleting published
values, methodology versions, changelog entries, and correction records. A
correction must land in a new release or vintage, with the earlier release
retained and marked. Today the site is a mutable pre-release service: source
snapshots and selected audit logs exist internally, but there is no universal
public archive that can reconstruct every earlier page or API response.

## Data & API corrections {#data-api-corrections}

A corrected value may change the current live page or API after the relevant
pipeline runs. Version and revision metadata currently vary by endpoint; there
is no universal correction field or historical-version query across the public
API. Where an endpoint exposes a methodology version, a correction that changes
its interpretation must update that version under the rules above.

For a frozen release, a corrected dataset or API artifact must be published as
a new version with the old release marked superseded; a retraction must leave a
public tombstone. **Civica does not currently publish a versioned API endpoint
for retrieving a retracted output's historical value.** Until versioned release
and query infrastructure ships, the current response may be corrected and the
public corrections log must explain the change, but historical retrieval is not
available.

Source-freshness stamps are untouched by this policy: a correction is not a
sync, and correcting a value never stamps a source as freshly synced.

## Notification {#notification}

The [public corrections log](/civica-index/corrections) is the current
site-wide notification surface for public submissions and dispositions.
Artifact-specific release notes or changelogs are additional channels only
where they actually exist. The Pulse event ledger is not a general corrections
changelog.

**Civica does not currently operate an email list, subscriber alerts, an
automatic device-alert mechanism, or a versioned historical API endpoint.**
If a machine-readable changelog feed or a subscriber mechanism ships in the
future, this section will say so and link to it; until then, checking the
corrections log and any artifact-specific release notes that exist is the only
public way to learn about a correction, retraction, or version change.

## Deferred boundaries {#deferred}

The following are explicitly out of scope for this policy today, each owned
by a later stage of the master plan:

- **DOI or archival registration** of corrected or superseded releases.
- **External-reviewer notification and advisory-board sign-off** on
  methodology changes — the advisory board itself remains in a
  coming-soon state.
- **A machine-readable changelog feed (RSS/JSON) and subscriber
  notification** — not published as available until it ships.
- **A frozen, versioned API endpoint** for retrieving a retracted output's
  historical value.
- **Clean-room reproduction of a corrected release** — owned by the
  replication-package status surface.
- **Unifying the reconciliation numeric dispute-severity buckets with the
  policy severity classes above** — the two stay separate by design; see
  [Severity classes](#corrections) above.
