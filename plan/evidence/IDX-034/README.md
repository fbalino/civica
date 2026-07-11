# IDX-034 evidence — K4 constitution-to-practice prototype (external gates pending)

`k4-constitution-practice-pairings/v1` reproduces 582 jurisdiction-construct candidate rows: three preregistered constructs for each of 194 sovereign jurisdictions. It joins the frozen v15 practice release to full Constitution Explorer excerpt HTML while preserving constitution ID/year, Constitute ID, topic, section, and article context.

The 2024 prototype contains 329 rows with at least one candidate tagged excerpt, 253 with no tagged excerpt, and 516 with an observed practice value. The preregistered geographic split assigns 387 rows to development, 120 to validation, and 75 to final holdout. Every observed practice value carries its V-Dem lower and upper credible bounds. The output SHA-256 is `3be3e129be1bcbc711b61a550d4db60e45cb212d9a4f3b8b0abf9998b59f4092`.

The engine cannot emit a gap, hypocrisy label, score, grade, rank, tier, traffic light, or cross-construct aggregate. Topic tags nominate passages but do not establish that they contain an enforceable commitment. All candidate matches remain `pending_blinded_human_coding`.

`plan/research/k4-mapping-and-blind-coding-codebook-v1.md` freezes the coder fields, blinding, alpha threshold, constitutional-scholar fairness threshold, adjudication order, and display rules. Human coding and scholar review have not run, so IDX-034 remains open and no pairing is validated for public interpretive use.

`npm run validate:k4-pairing-prototype`, the focused unit test, and `npx tsc --noEmit` pass.
