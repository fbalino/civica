# Atlas domain coverage thresholds v2

**Contract:** `atlas-domain-coverage/v1`

**Checked report:** `src/lib/provenance/domain-coverage.generated.json`

**Snapshot:** 2026-07-12

## Domain closure

The generated report now covers every data class named in ATL-002:

1. countries and entity status;
2. canonical facts;
3. government bodies;
4. offices;
5. people linked to office terms;
6. legislatures;
7. legislature-party snapshots;
8. elections;
9. constitutions;
10. international organizations and memberships;
11. bills;
12. indicators;
13. country images and officeholder portraits;
14. statement-level citations.

Country coverage uses the 194 rows currently classified as
`sovereign_state` under `jurisdiction-status/v1`. The other entity classes
remain in the full 253-row catalog but do not enter this denominator. Each
domain states what counts as one covered jurisdiction, so a record count is
not mistaken for complete subject coverage.

## Declared minimums

The operational floor is the same across domains so it is easy to audit:

- warn below 80% of eligible jurisdictions;
- warn when any measured required/diagnostic field is below 80% complete;
- warn when a domain or one of its source families has no successful-run time;
- warn when the latest successful run is more than 180 days old.

These are publication and disclosure thresholds, not statistical validity
claims. A domain below the floor remains visible with `Attention`, its exact
alerts, its source-family timestamps, and its known gaps. Civica may publish
the available records, subject to rights, but cannot describe that domain as
complete or use another domain's stronger coverage to conceal the shortfall.
Bulk-export inclusion remains a separate row/source-rights decision.

## Current result

Five domains meet every declared minimum: countries/entities, government
bodies, constitutions, indicators, and images. Nine require attention:

- canonical facts: observation/reference dates are incomplete;
- offices: stable Wikidata identifiers are sparse;
- people: stable identifiers and birth dates are sparse;
- legislatures: electoral-system family is below the field threshold;
- parties: country coverage and stable identifiers are below threshold;
- elections: turnout is incomplete;
- organizations: the curated seed has no registered run timestamp;
- bills: six-country coverage plus sparse status/introduction dates;
- statement citations: source hashes are absent even though source id,
  license, retrieval time, and most URLs are present.

The checked snapshot contains 14 alerts across those nine domains. The public
methodology page and `/api/source-coverage` expose the same generated report.

## Maintenance

Run `npm run generate:source-coverage` after changing any covered pipeline or
table, inspect the diff, then run both `npm run validate:source-coverage` and
`npm run audit:source-coverage:live`. A checked report that disagrees with the
live database fails the audit. Changing a threshold requires a documented
policy decision and regenerated alerts; it cannot be adjusted to make a weak
domain appear current.
