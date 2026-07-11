# IDX-012 evidence — exact K1 tournament candidate

## Contract

`k1-current-composite-tournament/v1` uses the exact current method:

- V-Dem LDI, with WGI Voice & Accountability only when V-Dem is absent
- WGI Rule of Law
- Freedom House PR + CL ratings sum on the inverted 2–14 scale
- Transparency International CPI
- fixed transforms and weights 0.27 / 0.26 / 0.23 / 0.24
- `ci-missingness/v1`, including labelled three-dimension partial estimates
- deterministic rounded point scores with no unsupported lower or upper bound
- competition ranking on the published integer score

The explicit alias contract maps production's internal `fh_pr_cl_sum` and `CPI_SCORE` names to the publisher-facing `pr_cl_total` and `score` identities. It does not map between different measures.

## Longitudinal output

Against panel v3, K1 produces 3,659 private country-year outputs: 2,270 full and 1,389 partial. No score is emitted before 2006 because the exact Freedom House ratings series is absent. Values remain private; the checked manifest stores aggregate coverage and output SHA-256 `9c8a6c2354a40a52b82e7fc782d0df0c9198007496aa0fd035ecc8fa0aadceb3`.

## Exact release reproduction

`npm run validate:k1-tournament-candidate:live` applies the isolated K1 engine to all 745 current Beta-R5 dimension rows. All 190 released composites match on integer score, full or partial status, dimensions available, missing-dimension set, and competition rank.

Focused fixtures prove V-Dem-first fallback behavior, declared aliases, insufficient/partial/full missingness, null uncertainty, and tied competition ranks. `npx tsc --noEmit` and all 688 repository tests pass.
