# EXP-038 — English-first editorial copy review

Status: approved bundle applied and browser-checked; two explicitly gated
copy decisions remain (T3, T4)

Owner decision: Fernando Baliño approved the prepared English copy bundle on
2026-07-25. In a later late-July 2026 session he additionally approved naming
himself in the About narrative (“about page can mention me, yes”); that
follow-up was first recorded with an incorrect 2026-08-09 date.

## Applied or retained

The release applies the approved plain-language edits to:

- the Home country and Atlas introductions;
- About product posture, pipeline framing, and source-ingestion limits;
- the methodology landing and unpublished-working-record language;
- the constitution empty state;
- the Governance Evidence release-provenance sentence;
- the Licensing point-of-use rights guidance;
- Contact title, introduction, and named human accountability; and
- the advisory-board application introduction and non-endorsement boundary; and
- the About standing-posture paragraph, which now uses the approved naming
  alternative — “Civica is independently maintained by Fernando Baliño, who
  has final editorial responsibility.” — followed by the review-boundary and
  inspectability sentences (A4).

The country Factbook outage rewrite was approved in the prepared bundle, but
the current Main-aligned route has no equivalent outage-copy branch. This
release does not add new behavior merely to create a place for that sentence.

The existing Home label “Independent & nonpartisan” is retained because
GOV-003 now publishes the owner-confirmed funding, support, affiliation,
vendor-relationship, and editorial-control facts that support it.

## Explicit holds

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
