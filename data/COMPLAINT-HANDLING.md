# Civica Atlas — copyright / trademark / data-rights complaint handling (BRD-015)

Accountable owner: **Fernando Balino**. This is the internal process for a
rights complaint (copyright, trademark, database/data rights, or a personality/
likeness objection) and how it connects to correction publication. It composes
existing mechanisms rather than inventing a parallel system; personal data in a
complaint is never exposed publicly.

## Intake channels
- **General / rights complaint:** `/contact` → `/api/contact` (persisted to the
  admin message queue). Also `admin@civicaatlas.org`.
- **Factual data dispute / correction request:** the data-dispute intake
  (`/api/admin/data-disputes`) and the corrections surface
  (`/civica-index/corrections`).
- **Security:** `/accessibility#security` + `/.well-known/security.txt`.

Each submission is timestamped and attributed to its channel on receipt.

## 1. Authenticate the claim
Confirm the complainant's standing and the specifics before acting: the exact
asset/field/entity/release/source, the claimed right, and evidence of ownership
or authority. A bare assertion is logged but not acted on as fact. Do not
disclose one party's contact details to another.

## 2. Preserve evidence
The complaint, its attachments, and the current state of the disputed material
are retained. Data rows are protected by the research-evidence retention
contract (DAT-016) — corrections and withdrawals write append-only before/after
history with reason, actor, and time, so nothing is silently erased. Store the
complaint record with access limited to the owner.

## 3. Temporary containment (if credible)
If the complaint is facially credible and the harm is ongoing, withhold the
specific value/asset immediately without deleting the underlying evidence:
the rights manifest and the `data-value-state` contract support a `withheld`
state, and restricted sources already fail closed. Constitution text and other
non-commercial material can be suspended via the existing commercial/fee flags.
Containment is reversible and is not an admission.

## 4. Legal / editorial review
- **Rights/legal questions** (validity of a copyright/trademark/database claim,
  fair use, safe harbour) are escalated to counsel — a manual/external gate
  (BRD-003/010) — before a substantive legal conclusion.
- **Factual questions** (is the value wrong?) follow the editorial correction
  process: check the source of truth, the reconciliation decision, and the
  vintage.

## 5. Counter-notice / appeal
Where the mechanism applies (e.g. a disputed copyright takedown), the affected
party or an internal reviewer may contest the containment with evidence. The
appeal and its resolution are recorded on the same append-only trail; a
contested item stays contained until resolved.

## 6. Final action
One of: dismiss (unfounded — restore any containment), correct (fix the value/
asset), withhold permanently (rights-incompatible material stays out), or
retract (a whole flawed artifact). Rights-incompatible reuse is resolved by
removal/relicensing, never by ignoring it.

## 7. Requester response
The complainant receives the outcome through the channel they used. No other
party's personal data is shared. Responses are on-screen/return-channel only;
there is no automated subscriber notification (APR-D031).

## 8. Public correction & version history
A substantive change is published per the `/policies` correction/retraction/
supersession contract (CLM-016): the corrections log entry, a new superseding
version where a frozen artifact is involved, and the changelog — with the
*fact* of the correction public but the complainant's identity and contact
details omitted.

## Tabletop note (2026-07-12)
The intake, evidence-retention, containment (withholding), correction-
publication, and version-history mechanisms all exist and are exercised
elsewhere. The two dependencies that are **not** yet engaged are external:
counsel review (BRD-003/010) for a genuine legal determination, and confirmed
real delivery of the intake channels (queued for BRD-014). Until counsel is
engaged, a novel legal claim is contained and escalated, not adjudicated.
