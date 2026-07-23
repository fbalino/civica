# DAT-034 published-value fidelity protocol v1

Status: preregistered before publisher-value retrieval

Release under audit: `atlas-2026-07-11`

Seed: `dat-034|atlas-2026-07-11|publisher-fidelity-v1`

## Question and unit

The audit asks whether a published canonical Atlas fact agrees with the exact
upstream publisher evidence it cites. The sampling unit is one canonical fact
row in the frozen G2 release, not a country, source page, or current database
row.

## Frozen sample

The sample contains exactly 300 distinct canonical facts:

- 171 CIA World Factbook facts;
- 120 World Bank facts; and
- all 9 Wikidata facts present in the release.

Within each source, deterministic SHA-256 ordering allocates rows across every
available `category × fact_group` stratum by proportional largest remainder
with a minimum of one row per nonempty stratum. The algorithm and seed are
fixed in `src/lib/data/value-fidelity.ts`. No row may be replaced because it is
difficult or unavailable.

## Independent evidence

Evidence must be either retained exact publisher bytes or the current official
publisher surface. A Civica database row, the frozen Civica export, a
third-party mirror, search snippet, or another compilation cannot verify the
sampled value.

World Bank indicator observations are checked against the official v2 API for
the exact country, indicator, and reference year. GDP values stored in USD
billions are compared after the declared `÷ 1,000,000,000` transformation.
World Bank region and income rows use the official country endpoint.

Wikidata population rows are checked against official entity JSON and require
an exact P1082 value with the matching P585 point in time. An unqualified
current population claim cannot replace the cited dated statement.

CIA facts require retained CIA bytes or a live CIA country field. The
`factbook.json` ingestion mirror is explicitly ineligible as independent
publisher evidence.

## Outcomes

Each row receives exactly one status:

- `match`;
- `confirmed_defect`;
- `publisher_revision_unresolved`;
- `publisher_value_unavailable`;
- `publisher_surface_unavailable`; or
- `verification_error`.

A difference on a current surface is not automatically a Civica defect:
upstream revisions remain `publisher_revision_unresolved` unless retained
publisher evidence proves the released value or transformation wrong.
Confirmed defects are classified as transcription, transformation, unit,
vintage, entity, source-link, or other, and as low, material, or critical.
Every confirmed defect must receive a repair task before the audit can close.

## Estimation and stop rule

The primary estimate is the confirmed-defect proportion with a two-sided 95%
Wilson interval among all 300 sampled rows. It is reportable only when every
row is independently assessable. Before then, the artifact may report:

- the verified-stratum confirmed-defect rate and Wilson interval;
- the number and share not assessable; and
- full-sample lower and upper defect bounds, treating every unresolved row as
  respectively nondefective and defective.

No sample substitution, post-hoc stratum removal, imputation, or silent
exclusion is allowed. The audit remains incomplete until all 300 rows have
eligible evidence and every confirmed defect has a repair task.
