# BRD-007 — Explicit code-rights posture

Completed 2026-07-23.

## Outcome

Civica now has an explicit root [`LICENSE`](../../../LICENSE) and
[`NOTICE`](../../../NOTICE). The posture is source-visible but non-open and
all rights reserved: repository availability does not grant a general right to
copy, modify, redistribute, sublicense, sell, or build derivative services.
The notice names Fernando Baliño for his original contributions without
claiming ownership of another contributor's work, and it limits generated or
AI-assisted material to rights that actually exist.

The same posture is rendered or described in the README template and generated
README, `CITATION.cff`, About prose, the typed rights registry, the public-claim
registry, and `/licensing#code`. `CITATION.cff` continues to omit an SPDX
`license` key because one identifier would conflate code, data, assets, and
third-party material.

## Dependency and generated-material review

The dated machine-readable audit is
[`code-rights-audit.v1.json`](code-rights-audit.v1.json). The installed direct
inventory has 25 production and 19 development packages: 30 MIT, five
Apache-2.0, three BSD-3-Clause, three ISC, one BSD-2-Clause, one MPL-2.0, and
one package with a separate supplied notice. No direct GPL, AGPL, or LGPL
package was found.

The separately noticed package is `mapbox-gl` 3.25.0. Its bundled file contains
Mapbox product/account terms, so the earlier description of that package as
permissive was corrected in the PLT-005 policy. Civica uses it only for the
token-gated Mapbox 3D view. The root license does not relicense Mapbox,
MPL-covered files, or any other package; package and file notices remain
controlling.

Generated source, migrations, schemas, reports, release artifacts, and
AI-assisted code do not erase upstream notices or create rights in third-party
inputs. The more specific package, file, source, asset, or release notice
controls its covered material.

## Authorship and limits

The repository authorship record names Fernando Baliño as responsible human
author/publisher. The current Git history contains 974 commits under Fernando's
identity and one under `Frontend Engineer <frontend@paperclip.local>`. No
contributor agreement or assignment record was found. The root terms therefore
preserve other contributors' respective rights instead of making a blanket
ownership claim.

This is an operational posture, not legal advice or clearance. The precise
holder/year wording, the differently named contribution, generated-code
treatment, and Mapbox/MPL deployment and distribution obligations are queued
under BRD-007 in `plan/MANUAL-CHECKS.md` for owner/counsel review. No
open-source grant or third-party reuse was authorized.

## Verification

- `npm run validate:rights-claims`
- `node --import tsx --test src/lib/claims/__tests__/reuse-rights.test.ts`
- `npm run validate:content-templates`
- `npm run validate:claims-docs`
- `npm run validate:deps`
- `node plan/tools/validate-master-plan.mjs`
- `npm run generate:readiness-reports`
- `npm run validate:readiness-reports`

The official GitHub licensing and Terms of Service pages were checked on
2026-07-23 to distinguish default copyright/project permission from
hosting-platform viewing and forking rights. The live npm audit reported nine
production-tree advisories, seven high and two moderate, with zero critical;
the declared critical-only dependency gate passed. Those security findings are
not converted into a license conclusion or release waiver.

The task-scoped rights, public-claim, content-template, README-freshness,
case-study, TypeScript, master-plan, and readiness checks pass. The aggregate
claims/docs runner reaches two already-tracked full-suite failures from
concurrent user-owned Index change-control and shared editorial anchor changes;
neither touches the code-rights implementation. The earlier ATL-023 page typo
that TypeScript exposed during this run was corrected and its focused replay
tests pass.
