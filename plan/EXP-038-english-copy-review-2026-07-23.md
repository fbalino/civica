# EXP-038 — English-first editorial copy review

Status: approved bundle applied and browser-checked; three explicitly gated
copy decisions remain

Owner decision: Fernando Baliño approved the prepared English copy bundle on
2026-07-25.

## Applied or retained

The release applies the approved plain-language edits to:

- the Home country and Atlas introductions;
- About product posture, pipeline framing, and source-ingestion limits;
- the methodology landing and unpublished-working-record language;
- the constitution empty state;
- the Governance Evidence release-provenance sentence;
- the Licensing point-of-use rights guidance;
- Contact title, introduction, and named human accountability; and
- the advisory-board application introduction and non-endorsement boundary.

The country Factbook outage rewrite was approved in the prepared bundle, but
the current Main-aligned route has no equivalent outage-copy branch. This
release does not add new behavior merely to create a place for that sentence.

The existing Home label “Independent & nonpartisan” is retained because
GOV-003 now publishes the owner-confirmed funding, support, affiliation,
vendor-relationship, and editorial-control facts that support it.

## Explicit holds

- **A4 — About narrative naming.** Fernando asked for the rationale but did not
  approve replacing the standing-posture paragraph with language describing
  him as the project's “lead.” The rationale was accountability, not
  promotion: a named responsible publisher avoids an institution-like “we”
  obscuring final authority. The existing paragraph remains unchanged.
- **T3 — response time.** The existing three-business-day wording remains
  unchanged pending an owner choice between a monitored target and
  no-guarantee language.
- **T4 — correction route.** The existing GitHub instruction remains unchanged
  pending an owner choice of interim copy or activation of the dedicated
  production correction flow.

These holds are recorded rather than inferred. No external review, endorsement,
service-level observation, or production correction-flow activation is
claimed.

## Verification

The permanent copy contract is
`scripts/validate-exp-038-copy.ts`. The current browser contract is
`e2e/exp-038-copy-and-disclosure.spec.ts`; its desktop/mobile and light/dark
checks passed on the local Main-aligned candidate on 2026-07-26. Detailed
evidence is in `plan/evidence/EXP-038/`.
