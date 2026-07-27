# Engraving color and rendering contract — v1 (EXP-005)

**Status:** ADOPTED 2026-07-12. The owner approved strength 60 through the
EXP-006 calibration sheet and the approved country corpus was graded under
EXP-008. The machine-readable contract is
`plan/decisions/engraving-color-contract-v1.json`; validation is
`npm run validate:engraving-color-contract`.

## Problem statement (owner review, 2026-07-11)
Dark-variant country engravings carry a heavy uniform orange-brown cast. The
owner flagged Japan, Bahrain, Barbados, Denmark, Guinea, Guyana, and Vatican
City as grading candidates; France (style off beyond color) and the United
Kingdom (palette outlier — already cool/blue) as regeneration candidates.
The possible full-color regeneration of the corpus remains a separate owner
consideration. If it is chosen later, this contract still governs the color
acceptance of regenerated assets.

## Measurable metrics (implemented in plan/evidence/EXP-006/grade.js)
- **orangeFrac** — share of pixels with HSV hue 20–55°, saturation > 0.25,
  value > 0.08, measured at 400px width. The cast metric.
- **meanSat** — mean HSV saturation at 400px width.

Measured baseline on the pilot set: flagged originals run orangeFrac
0.46–0.80 (France 0.80, Denmark 0.67, Bahrain 0.52, Japan 0.50) with meanSat
0.47–0.77. The UK outlier measures orangeFrac 0.17 — confirming its problem
is family consistency, not cast.

## Reference anchors and measurable ranges

Japan light is the canonical look named by the owner. Its checked asset is
1500×1000 sRGB WebP with SHA-256
`693729476e81c56fa6eb48ad7aead2da32d53aaaae5bf94fcfb40b1cbdd41ba2`.
At the contract's 400px measurement width it has mean saturation 0.0975,
95th-percentile saturation 0.1739, 5th/50th/95th luminance
0.3750/0.8380/0.9540, and tone range 0.5790. An accepted light reference must
remain within the deliberately narrow family around those measurements:

- mean saturation 0.06–0.16; 95th-percentile saturation 0.10–0.28;
- luminance P05 0.25–0.50, P50 0.72–0.90, P95 0.90–0.99;
- P95−P05 tone range 0.45–0.72; strong-orange fraction no more than 0.05;
- warm parchment may occupy 0.15–0.55 of measured pixels, but orange cannot
  become the dominant high-chroma field.

The approved Japan dark reference is also 1500×1000 sRGB WebP, SHA-256
`3e04f2c96c62ede82441366e60b8ea3fa5b4558d4ed19f4e2b9035621675eaa7`.
Its measured luminance P05/P50/P95 is 0.0101/0.0629/0.2592, preserving a
0.2491 tone range for linework against the dark surface. Dark assets retain
the intentionally warm sepia family. The corpus acceptance range is measured
at batch level rather than forcing unlike scenes to imitate one histogram:
mean saturation 0.30–0.38 and mean strong-orange fraction 0.40–0.50 after the
approved transform. Individual semantic/style outliers are reviewed rather
than hidden by a permissive color threshold.

## Tone, warmth, and contrast behavior

- **Light tone curve:** keep a high-key paper field, midtone linework, and a
  nonclipped highlight shoulder. Do not crush the lower five percent or wash
  the linework into the paper.
- **Dark tone curve:** preserve relative luminance while lifting output
  brightness by 1.018. Shadows remain ink/graphite-dark; warm gold and sepia
  remain accents and illuminated fields, not a new full-frame orange overlay.
- **Cool-shadow / gold-highlight target:** the rejected v1 split-tone recipe
  (`rgb(176,184,202)` shadows and `rgb(224,178,110)` highlights) records the
  maximum cool direction, not the production grade. Production may retain
  source-native cool shadows and gold highlights, but cannot invent either by
  recoloring semantic regions. Recipe B is therefore a fail example for
  excessive cooling.
- **Contrast:** P95−P05 must not fall below 0.45 for the canonical light
  reference or 0.18 for the canonical dark reference. The transform may not
  clip more than 0.5% of pixels at either luminance endpoint.
- **Line preservation:** grading is pixel-local modulation only—no resize,
  blur, sharpen, denoise, redraw, crop, or generative edit. Width, height,
  aspect ratio, and geometry are invariant. This preserves the source edge
  map and engraving line placement by construction.
- **Landmark fidelity:** color grading cannot add, remove, move, or reinterpret
  a landmark. A semantic/compositional defect fails grading and enters
  regeneration review under EXP-009.
- **Delivery:** 1500×1000 (3:2) sRGB WebP at quality 88 for the current country
  corpus; metadata is stripped consistently. Light originals remain untouched.

## Pass/fail examples

- **PASS — light:** current `jpn.webp`, the canonical owner-named reference.
- **PASS — dark:** current `jpn-dark.webp` and the owner-approved strength-60
  corpus report in `plan/evidence/EXP-006/corpus-batch-s60-report.json`.
- **FAIL — too warm:** pre-grade Japan, retained as Git blob
  `3c88f2709132b2b809eecbeb30006736576c4254`, documents the direction that
  prompted the correction.
- **FAIL — too cool:** recipe-B Japan in the preserved v1 pilot sheet removes
  the intentional sepia identity.
- **FAIL — semantic/style:** France remains a style-regeneration candidate;
  color compliance alone cannot make it pass.
- **FAIL — family outlier:** United Kingdom is already cool and was excluded
  from the uniform grade; it requires regeneration or an explicit exception.

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
