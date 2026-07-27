# Project disclosure owner confirmation v1

Status: all seven owner fields confirmed; published through the canonical record

Prepared: 2026-07-11

Task: GOV-003

## Why confirmation is required

The repository establishes that Fernando Baliño controls publication. On
2026-07-25 Fernando confirmed all funding, support, outside-affiliation,
source/vendor relationship, third-party control, publication, and review-cadence
facts recorded below.

## Confirmed disclosure

> **Funding and sponsorship.** Civica Atlas is personally funded by Fernando
> Baliño. As of 2026-07-25, it has received no grants, sponsorships, donations,
> employer support, or outcome-contingent funding. No outside funder or sponsor
> exists.
>
> **Services and in-kind support.** The project uses commercial and free-tier
> software, hosting, database, model, research, and developer services.
> Fernando pays the project's costs. It has received no donated or discounted
> services, credits, waived fees, free professional work, equipment, datasets
> beyond ordinary published access, or other material in-kind support. Routine
> public free tiers and generally available open-source packages are disclosed
> by category rather than assigned a monetary value.
>
> **Political independence and affiliations.** Civica Atlas is not affiliated
> with or directed by any political party, campaign, government, lobbying
> organization, advocacy organization, university, research institute, NGO, or
> commercial governance-data provider. Fernando has confirmed no relevant
> outside affiliations or interests. The project takes no institutional
> position on parties, governments, or regime outcomes.
>
> **Editorial control.** Fernando Baliño has final authority over data inclusion,
> methodology, copy, corrections, releases, security, source rights, reviewer
> process, conflicts, and emergency action under
> `civica-research-publication-governance/v1`. No third party has exceptional
> approval, veto, advance-access, publication-timing, messaging, hiring,
> reviewer-selection, or data-removal rights. Contractors, agents, model
> providers, source publishers, prospective reviewers, and advisory-board
> applicants have no publication veto or automatic approval role. Any future
> delegation, funder condition, sponsor right, or exceptional third-party
> control right will be named and dated.
>
> **Source and vendor relationships.** Civica has no formal or privileged
> source or vendor relationships beyond ordinary paid-customer or public-access
> terms. It obtains data under the source-by-source access and rights conditions
> in its manifests. Citation, payment, public access, or technical integration
> does not imply endorsement by either party.
>
> **Conflict handling.** Relevant project, author, contributor, reviewer,
> source-provider, funder, vendor, political, personal, and competitive
> interests are disclosed before the affected decision. They are managed,
> recused, or excluded under the governance charter. An unmanageable conflict
> held by the sole owner blocks the affected claim until a qualified independent
> decision-maker is appointed.

## Confirmation fields

1. Legal/personal payer(s) and funding sources: **confirmed 2026-07-25 —
   Fernando Baliño personally funds Civica Atlas**
2. Grants, sponsors, donations, crowdfunding, or employer/institutional
   support: **confirmed 2026-07-25 — none**
3. Donated/discounted services, credits, professional work, equipment, or
   privileged data access: **confirmed 2026-07-25 — none**
4. Relevant political, government, campaign, advocacy, academic, NGO,
   source-provider, or commercial affiliations/interests: **confirmed
   2026-07-25 — no outside affiliations or relevant interests reported**
5. Formal or paid relationships with data publishers, hosting/database
   providers, model providers, research tools, or developer platforms:
   **confirmed 2026-07-25 — no formal or privileged source or vendor
   relationships beyond ordinary paid-customer or public-access terms**
6. Any third party with approval, veto, advance access, publication timing,
   messaging, hiring, reviewer-selection, or data-removal rights: **confirmed
   2026-07-25 — none**
7. Owner approval to publish the corrected disclosure on `/about`, include it
   unchanged in reviewer packets, and review it every six months and after any
   material change: **confirmed 2026-07-25 — authorized for `/about`, unchanged
   Atlas/Index/Pulse reviewer-packet reuse, and the stated review cadence**

Personal voting history and unrelated personal political-donation history are
outside this disclosure. They are sensitive personal political data and do not
change the project's funding, institutional affiliations, or editorial-control
facts. A political donation, office, campaign role, paid affiliation, or
financial interest that created a relevant project conflict would instead be
disclosed under fields 4–6.

## Publication contract after confirmation

The confirmation is implemented as
`civica-project-disclosure/v1` in
`data/research/project-disclosure-v1.json`. The public `/about` section renders
from the same typed record. The Atlas and Index packet manifests bind that exact
artifact and its SHA-256; the future Pulse reviewer packet fails closed unless
it binds the same path. The record carries an effective date, next-review date,
change history, named approver, and a correction link.
