# EXP-005 — adopted engraving color and rendering contract

- Human approval: owner selected strength 60 on 2026-07-12; recorded in `plan/MANUAL-CHECKS.md` and preserved through EXP-006/008 evidence.
- Narrative contract: `plan/decisions/engraving-color-contract-v1.md`.
- Machine contract: `plan/decisions/engraving-color-contract-v1.json` (`civica-engraving-color/v1`).
- Canonical anchors: current Japan light and dark assets, bound by SHA-256, dimensions, format, measured tone, saturation, warmth, and contrast.
- Production scope: strength-60 corpus report for 196 dark country engravings; `gbr` remains an explicit outlier rather than being flattened into the batch.
- Failure references: pre-grade Japan (too warm), recipe-B Japan (too cool), France (semantic/style), and United Kingdom (family outlier).
- Automated proof: `npm run validate:engraving-color-contract`; the aggregate `npm run validate:editorial-illustrations` now includes it.

The validator checks adopted status, reference bytes and geometry, Japan light measurement ranges, Japan dark tone contrast, approved recipe parameters, corpus mean saturation/warmth, delivery quality, and the presence of representative pass/fail cases.
