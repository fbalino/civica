# GOV-003 — project funding, independence, and control disclosure

Status: complete

Date: 2026-07-25

Fernando Baliño confirmed all seven fields in
`plan/research/project-disclosure-owner-confirmation-v1.md`. The implementation
does not infer personal political history or undisclosed relationships:

- Civica is personally funded by Fernando Baliño and has no outside funder,
  grant, sponsor, donation, employer support, or outcome-contingent funding.
- It has received no donated or discounted material support.
- It has no relevant outside affiliation or interest.
- It has no formal or privileged source or vendor relationship beyond ordinary
  paid-customer or public-access terms.
- No third party has exceptional approval, veto, advance-access,
  publication-timing, messaging, hiring, reviewer-selection, or data-removal
  rights.
- Fernando authorized publication on `/about`, unchanged Atlas/Index/Pulse
  reviewer-packet reuse, and review every six months and after a material
  change.

`civica-project-disclosure/v1` is the canonical typed record. Its generated
machine artifact is `data/research/project-disclosure-v1.json`; `/about`
renders its six public sections directly from that record. The current Atlas
and Index packet inventories bind the exact artifact path, bytes, and SHA-256.
GOV-015 has not assembled a Pulse review packet, so the canonical record marks
the same artifact as mandatory at assembly rather than pretending that packet
or review exists.

The record names Fernando as approver, is effective 2026-07-25, schedules its
next review for 2027-01-25, adds a material-change trigger and correction link,
and starts an explicit change history.

Focused verification:

- `npm run validate:project-disclosure`
- `npm run validate:atlas-review-packet`
- `npm run validate:index-review-packet`
- `npm run validate:content-templates`
- `npm run typecheck`

No deployment, outreach, independent review, endorsement, or database change is
claimed.

The rendered `/about#project-disclosure` section was checked in a real browser:
all six headings and their canonical text were visible, both record/correction
links resolved in the DOM, and the page had no horizontal overflow. The only
captured warnings came from a browser extension, not the Civica application.
