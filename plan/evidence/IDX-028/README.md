# IDX-028 evidence

## Outcome

`data/releases/governance-evidence-review-packet-2026-07-v1/` is the versioned replication and external-review packet for the selected Governance Evidence product. Its semantic SHA-256 is `067310d6227ecea53d6b4b1d60faf6ba7f7d177582c01579b360d62ea7310317`.

The 46-artifact inventory binds:

- the source-native construct, 2024 five-indicator input grid, and exact 970-cell fidelity result;
- implementation code, package command map, dependency lock, and runtime environment;
- five-row codebook, no-aggregation transformations, explicit missingness, and rights-filtered export rule;
- publisher-supplied uncertainty or explicit absence, with no invented Civica interval;
- sensitivity choices, subgroup limits, seven known limitations, citation metadata, and exact commands;
- ten bounded questions with conflict disclosure, no required favorable conclusion, and no implied endorsement;
- all 22 tournament artifacts, preregistration, failure ledger, no-winner decision, adopted disposition, misuse audit, rights contract, and IDX-027 migration evidence.

GOV-014 can consume the bundle unchanged. Human responses, independent execution, archival deposit, and DOI remain later evidence and are not claimed here.

## Reproduction

```sh
npm run reproduce:governance-evidence-review-packet
npm run validate:governance-evidence-review-packet
```

Generation first runs the Governance Evidence source-file fixture, which passes all 970 cells and proves restricted exports fail closed. Validation then compares the manifest, five generated documents, inventory, and checksums byte for byte; verifies all inventory roles; and requires the tournament's `winnerSelected: false` state and misuse artifact.

## Verification

```sh
npm run validate:replication-surface
npm run validate:claims-docs
npx tsc --noEmit
npm run build
node plan/tools/validate-master-plan.mjs
```

The complete production build passed 726 tests and the Next.js 16 build. The only build warning is the pre-existing Turbopack NFT trace warning from `next.config.ts`.

Browser inspection of `/civica-index/replication` confirmed the `Review packet available` state, rights and non-endorsement warning, seven linked packet components, deferred DOI, open independent clean-room evidence, canonical methodology layout, and no console errors beyond React's development informational message.
