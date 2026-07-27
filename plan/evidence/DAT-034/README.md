# DAT-034 — published-value fidelity audit

Status: agent preparation and all currently possible publisher checks complete;
the checklist item remains blocked by unavailable CIA publisher evidence.

## Frozen protocol and sample

`plan/research/dat-034-value-fidelity-protocol-v1.md` was written before the
official World Bank/Wikidata retrieval. Its fixed seed selects 300 distinct
canonical facts from `atlas-2026-07-11`:

| Source | Rows |
| --- | ---: |
| CIA World Factbook | 171 |
| World Bank | 120 |
| Wikidata | 9 |

The sample covers all ten released fact categories and Groups A, B, and C.
`data/atlas-value-fidelity-audit.v1.json` retains the full ordered per-fact
ledger, official URL, retrieval time, response hash, observed value/date,
comparison outcome, cause, severity, and repair-task link.

## Results captured 2026-07-23

- 129 World Bank/Wikidata rows reached an official structured publisher
  endpoint.
- 96 matched without an identified fidelity defect.
- 30 World Bank historical values differ on the current official surface and
  remain `publisher_revision_unresolved`; without the exact earlier publisher
  bytes, the audit does not guess whether these are upstream revisions.
- 3 Wikidata rows agree on value but expose false date precision in the release:
  Malaysia and Rwanda turn year precision into January 1; Sweden turns month
  precision into April 1. They are material transformation defects tracked by
  DAT-036.
- No retrieval failed, and no confirmed defect lacks a repair task.

Among the 99 currently assessable rows, the confirmed-defect proportion is
3/99 (3.03%; two-sided 95% Wilson interval 1.04%–8.53%). This is a
verified-stratum diagnostic, not the required full-sample error rate. With 201
rows unresolved, the honest full-sample confirmed-defect bounds are 1%–68%.

## CIA blocker

Firecrawl retrieved the official CIA country URL on 2026-07-23. It redirects
to CIA's February 4, 2026 notice, “Spotlighting The World Factbook as We Bid a
Fond Farewell,” which states that the publication has sunset. Civica's G2
release explicitly records that the upstream publisher bytes were not
retained. The third-party `factbook.json` ingestion mirror is therefore not
accepted as independent publisher evidence.

The 171 selected CIA rows remain frozen in place as
`publisher_surface_unavailable`; none was replaced with an easier row. DAT-034
cannot be checked complete or publish a full-sample error-rate claim unless
eligible retained CIA publisher bytes become available.

## Verification

- `npm run validate:atlas-value-fidelity`
- `node --import tsx --test src/lib/data/value-fidelity.test.ts`
- `npm run typecheck`
- focused ESLint over the audit module, script, and tests

The capture command is networked and read-only:

```sh
npm run audit:atlas-value-fidelity
```

It must never overwrite the checked artifact merely because a current
publisher value changed; any refresh is a new dated audit decision.
