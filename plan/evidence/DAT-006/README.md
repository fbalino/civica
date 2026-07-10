# DAT-006 evidence — reconciliation coverage and source independence

Status: implementation complete on 2026-07-10.

## Outcome

`reconciliation-coverage/v1` assigns all 129 canonical fact keys one explicit
operating policy:

- 37 single-source passthrough
- 27 multi-source resolver
- 24 manual review
- 41 unsupported

The checked live audit maps 172 active source/fact/family relationships with no
unverified active relationship. “Unsupported” means the key is registered but
has no active observation; it is not presented as covered.

## Independence rule

Independent evidence means a distinct producing family for the claim, not a
distinct database source ID. World Bank, UN Data, UNDP, and Eurostat
republisher rows collapse into the named upstream family where the relationship
is registered. Projected values do not corroborate measurements. CIA Factbook
and Wikidata compilation rows cannot create source independence by themselves.
An unknown relationship fails closed and cannot add an independent family.

The shared rule changes the current fact coverage count from the DAT-005
provisional 2,349 source-ID/native-publisher screen to 458 jurisdiction/fact-key
groups with two or more distinct producing families.

## Executable contract

- `src/lib/factbook/reconcile/source-independence.ts` — claim lineage and
  independent-family count
- `src/lib/factbook/reconcile/reconciliation-audit.ts` — policy/audit builder
- `src/lib/factbook/reconcile/reconciliation-audit.generated.json` — checked
  live snapshot
- `scripts/generate-reconciliation-audit.ts` — live database generator
- `scripts/validate-reconciliation-audit.ts` — DB-free closure/public-surface
  gate
- `src/lib/factbook/reconcile/source-independence.test.ts` — ten worked and
  adversarial lineage fixtures
- `src/lib/factbook/reconcile/__tests__/worked-examples.test.ts` — eight live
  resolver examples
- `src/app/api/reconciliation-audit/route.ts` — machine-readable report
- `/methodology/provenance-coverage#reconciliation` — reader explanation

## Verification

- `npm run validate:reconciliation-audit` passed.
- The eight live database resolver examples passed with zero failures.
- Ten claim-lineage fixtures cover common upstreams, genuine independence,
  projections, secondary compilations, NSO republication, and unknown lineage.
- `npm run validate:claims-docs`, design-token validation, TypeScript, 398
  tests, and the full production build passed.
- Desktop and 390×844 Playwright screenshots rendered the reader page; both
  page and machine-readable API returned HTTP 200.
