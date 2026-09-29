# CLM-020 migration plan

CLM-020 changes presentation and API response shapes only. It has no
database, schema, migration, cron, data-release, or dependency change, and it
performs no production write.

## API shapes

| Endpoint | Change | Consumers |
|---|---|---|
| `GET /api/countries/:slug/scores` | `{ country, rows }` becomes `country-publisher-scores/v2`: `{ contract, country, notice, rows }`. Each row carries `id`, `label`, `valueStatus`, `score`, `category`, `scoreFormatted`, `withheldReason`, `valueOrigin`, `source`, `publisherEdition`, `observationPeriod`, `retrievedAt`, `exportPermission`, `termsUrl`, `freshness`, and a `release` of `{ releaseId, quarter, vintageLabel }`. The fields `rank`, `totalRanked`, `trend`, `trendDelta`, `trendFormatted`, and `asOf`, and the RSF, HDI, and CPI rows, are gone. Publisher values are withheld unless the source's verified terms permit public export (currently none of V-Dem and Freedom House), matching the Governance Evidence API. The response is strict-parsed with zod at the boundary. | No in-app consumer. Civica has no API users (APR-D020), so no compatibility shim is kept. |
| `GET /api/v1/conditions` | Each calculation gains `scoreOrigin`: `{ kind: "civica_calculation", transformationId }` when `normalizedScore` is present, otherwise `null`. The strict schema rejects a scored position without it and an unscored one with it. The documented example's positions now replay from their inputs (83 and 90), its Human Development reference year matches its Human Development Report edition, and its Global Peace Index unit is the production unit. | Additive field; the API docs render it from the contract registry. |

## Reader surfaces

- Country Civica Data "Rankings" section: new three-column table built on
  `DataTable`; `src/components/scores/scores.css` is deleted.
- Civica Conditions country cards and explorer: `ValueOriginNote` marker and
  formulas; the comparison view hides Civica positions.
- `/design-system`: a `ValueOriginNote` demo.

## Rollout and rollback

- Rollout: merge and deploy normally. `npm run build` runs the new
  `validate:publisher-attribution` inside `validate:claims-docs`.
- Rollback: revert the commit. No data or schema state needs undoing. The
  Index change-control registry is append-only; a revert that changes
  protected files needs its own change-control record, as any protected-file
  change does.
- QA-013 visual baselines for the country Civica Data tab, compare, the
  Conditions explorer, and `/design-system` change and need owner re-approval.
