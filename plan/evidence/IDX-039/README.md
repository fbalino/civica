# IDX-039 evidence — practice-specific K4 inputs

`ci-k4-practice-panel-2000-2024-v1` freezes three practice-specific V-Dem Country-Year Core v15 series for the constitution-to-practice prototype. The exact publisher archive SHA-256 is `bd6430d6b78785c7422acee7d75bef1b852f2ce1baa5f673ae40ffca64ffe51b`; its embedded codebook SHA-256 is `2cc3da9b641bbca47d75524555c3631bc4585d18d61cbb003061a0aad4863175`.

The mapping contract was fixed before K4 outcomes were calculated: expression, press, and opinion excerpts map to `v2x_freexp_altinf`; judicial-independence excerpts map to `v2juhcind`; and free-election excerpts map to `v2xel_frefair`.

The private immutable release contains 14,550 cells across 194 sovereign jurisdictions, 25 years, and three indicators. It has 12,867 observed cells and 1,683 explicit missing cells. Every observed cell retains the publisher's lower and upper credible bounds. There is no imputation. Twenty-two sovereign microstates have no V-Dem row in the captured period and remain visibly missing.

The row SHA-256 is `840e3d4bf4dbd0b045afc201048db4072b1a4109ecaa29a357774925d6ee83ea`. Exact values remain private pending public-redistribution review. Checked artifacts expose source identity, definitions, native units, rights posture, coverage, missingness, mappings, temporal caveats, and hashes without publishing the upstream dataset.

The contract rejects V-Dem LDI, Freedom House total, and WGI Rule of Law as substitutes for these practice constructs. It also records that V-Dem repeats or backfills clean-election estimates within election-regime periods.

`npm run validate:k4-practice-inputs`, `npm run validate:k4-practice-inputs:live`, the focused contract tests, and `npx tsc --noEmit` pass. The live validator also confirms release immutability.
