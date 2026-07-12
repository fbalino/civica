# EXP-008 — Corpus dark-engraving grade at owner-approved strength 60

**Commit:** this commit (feat(art): grade dark engravings at owner-approved strength 60).

- Scope: all 196 tracked `*-dark.webp` country engravings except
  `gbr-dark.webp` (excluded — already cool; regeneration candidate).
  Light variants untouched. Owner approval trail: EXP-006 pilot v1 (rejected
  as overcorrection, kept in evidence) → v2 interactive strength sheet →
  owner selected 60 (2026-07-12), recorded in MANUAL-CHECKS and the contract.
- Recipe (deterministic): saturation ×0.730, hue −6.0°, brightness ×1.018,
  WebP q88 — `plan/evidence/EXP-006/grade.js` engine, uniform single batch.
- Originals: recoverable exactly via git history (all 394 engravings were
  tracked and clean before the batch).
- Metric report: `plan/evidence/EXP-006/corpus-batch-s60-report.json` —
  per-file before/after orangeFrac and meanSat; corpus mean orangeFrac
  0.548 → 0.454, after-mean saturation 0.341. No exceptions flagged: the
  uniform recipe preserves relative warmth by design, per the owner's
  calibration that the sepia tint is intentional.
- Browser sampling: /country/japan reviewed live in dark mode at 1440×900 —
  graded masthead renders with the repaired hero geometry; pilot-set spot
  images (jpn, dnk) reviewed directly. Single batch, single sampling pass.

## Limitations
- EXP-007 (productionized grading tool with golden-image tests) remains open;
  grade.js is its seed.
- France/UK regeneration and the possible full-color corpus redo are open
  owner considerations under EXP-009 scope.
