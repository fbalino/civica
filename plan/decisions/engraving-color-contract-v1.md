# Engraving color and rendering contract — v1 draft (EXP-005)

**Status:** DRAFT — thresholds are measured and specified but PROVISIONAL until
the owner approves the EXP-006 pilot references. Do not batch-process the
corpus against this contract before that approval (MANUAL-CHECKS).

## Problem statement (owner review, 2026-07-11)
Dark-variant country engravings carry a heavy uniform orange-brown cast. The
owner flagged Japan, Bahrain, Barbados, Denmark, Guinea, Guyana, and Vatican
City as grading candidates; France (style off beyond color) and the United
Kingdom (palette outlier — already cool/blue) as regeneration candidates.
Owner observations recorded, not yet decisions: most dark variants "look too
fake" and a full-color regeneration of the corpus is under consideration; the
About-page dark art is also flagged. If a regeneration wave is chosen later,
this contract still governs the color acceptance of regenerated dark assets.

## Measurable metrics (implemented in plan/evidence/EXP-006/grade.js)
- **orangeFrac** — share of pixels with HSV hue 20–55°, saturation > 0.25,
  value > 0.08, measured at 400px width. The cast metric.
- **meanSat** — mean HSV saturation at 400px width.

Measured baseline on the pilot set: flagged originals run orangeFrac
0.46–0.80 (France 0.80, Denmark 0.67, Bahrain 0.52, Japan 0.50) with meanSat
0.47–0.77. The UK outlier measures orangeFrac 0.17 — confirming its problem
is family consistency, not cast.

## Dark-variant targets (provisional)
- orangeFrac ≤ 0.05; meanSat 0.15–0.30.
- Cool-shadow / gold-highlight split: chroma is rebuilt from luminance —
  graphite-slate base `rgb(176,184,202)`, warm gold `rgb(224,178,110)`
  restored only above the highlight mask `clamp(2.6·L − 220)`. Warmth may
  appear in lantern glow, skies at the horizon, and specular linework only.
- **Line preservation by construction:** the transform is luminance-preserving
  (duotone from the luma channel); engraved linework cannot be blurred,
  sharpened, or redrawn by grading. No generative step; landmark fidelity is
  therefore unchanged from the source asset.
- Dimensions and aspect unchanged; output WebP quality 88; light variants
  untouched by this pass (their contract lands with the pilot review).

## Pass/fail examples (EXP-006 pilot outputs)
- PASS candidates: recipe-B outputs for jpn, bhr, brb, dnk, gin, guy, vat —
  all reach orangeFrac ≤ 0.003, meanSat 0.20–0.25 (see
  plan/evidence/EXP-006/pilot-sheet.html and graded/).
- FAIL example: recipe A (global desaturation, jpn) leaves orangeFrac 0.27 —
  visibly muddy; global desaturation alone is rejected.
- OUT OF SCOPE for grading: fra (style), gbr (palette outlier) — regeneration
  candidates; graded versions retained for reference only.

## Owner calibration (2026-07-12)
- The corpus-wide warm/sepia tint is intentional identity, not a defect. v1's
  split-tone targets overcorrected toward cool monochrome and are withdrawn;
  recipe-B outputs stay in evidence as the recorded overcorrection example
  (recipe A remains the under-correction example).
- The active recipe family is the gentle ladder: strength s (0–100) maps to
  saturation 1−0.0045·s, hue −0.10·s°, brightness 1+0.0003·s. Even at s=100
  the sepia character survives. The owner's stated intent is a "very slight"
  reduction; the interactive sheet defaults to s=25 (saturation ×0.888,
  hue −2.5°).
- Final orangeFrac/meanSat thresholds derive from the owner-selected strength
  on `plan/evidence/EXP-006/pilot-sheet-v2.html`, superseding the withdrawn
  v1 numbers.

## Adopted setting (owner decision, 2026-07-12)
- **Strength 60**: saturation ×0.730, hue −6.0°, brightness ×1.018, WebP q88.
- Applied to all 196 tracked dark engravings except `gbr-dark.webp` (palette
  outlier; regeneration candidate — grading would flatten it). Corpus measured
  result: mean orangeFrac 0.548 → 0.454, mean saturation 0.341 after; warm
  sepia identity retained by design. Full per-file record:
  `plan/evidence/EXP-006/corpus-batch-s60-report.json`.
- Acceptance for graded dark assets is recipe-determinism, not a hard hue
  ceiling: an asset passes when it is byte-reproducible from its git-history
  original through the strength-60 recipe. Originals recoverable via git.
- France remains a regeneration candidate (style); its graded version is an
  approved interim. This contract governs color acceptance of any future
  regenerated dark assets as well.
