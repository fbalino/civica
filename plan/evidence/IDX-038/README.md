# IDX-038 evidence — corrected Freedom House input identity

Panel v1 carried Freedom House `fh_total_score` on a 0–100 scale. The live Index and K1 use `pr_cl_total`, the combined Political Rights and Civil Liberties ratings on an inverted 2–14 scale. They are different publisher fields and cannot be substituted.

`ci-research-panel-2000-2024-v2` preserves v1 and replaces only that series. Panel v3 preserves both predecessors and adds WGI Voice & Accountability as the exact fallback where V-Dem is absent. The Freedom House workbook matches SHA-256 `d6ac861af6e7dcea7e870e39ddbcd2925730a653c1466f8992a7d0005f53be88`; the WGI workbook matches `25a2f9eabb90b0092973392c0b31571aa58b691cc5786292e504b52f693e1eb8`. Freedom House 2000–2005 and WGI 2001 remain structural gaps.

- Panel v3 row SHA-256: `7da2d4cfd58b671957c0c88cd043467563edd2cda8e8fbd6442aae6201d4bb72`
- Coverage SHA-256: `fbca1142e428702ee868514ae7ade422dc2b58af5496fa38f3f0a0b2539c1195`
- Temporal-break SHA-256: `db2ae9eef23196e294807261738840b40c88caf4cd436ac1c4a49aed66d6a4b7`
- 29,100 cells: 23,911 observed and 5,189 missing

Candidate set, preregistration, and baselines are v3. The baseline implementation keys WGI indicators separately and applies V-Dem-first fallback selection; B2 and B3 now cover 2,270 units, including 64 valid units recovered by the fallback.

`npm run validate:ci-tournament-panel:v3:live`, `npm run validate:index-tournament-preregistration`, and `npm run validate:index-tournament-baselines:live` pass. All prior panel, protocol, and baseline artifacts remain at their original paths.
