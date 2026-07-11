# PUL-014 evidence

## Outcome

`pulse-evaluation-sampling-frame/v1` was frozen on 2026-07-11 before any gold-label access. It separates three units and frames:

- a census of all 384 retained event-row candidates in the fixed 90-day period;
- a stratified probability sample from 978 mutually exclusive system-negative or unresolved candidates;
- a stratified probability sample from 17,460 sovereign-country-days.

Famous historical cases remain regression fixtures and are excluded from estimation.

## Precision and design

A conservative binary-proportion calculation requires 385 independent cases for a two-sided 95% interval with five-percentage-point half-width. Each probability frame plans for 482 valid cases after a 1.25 design effect and initially draws 536 for up to 10% unusable evidence. The analysis must replace the planning design effect with the observed design and must distinguish frozen-benchmark accuracy from generalized accuracy.

Primary strata determine initial draw fractions and base weights. Separate marginal constraints cover geography, dates, 11 observed languages including unknown, specialist/news source type, six BR/CGV regime families plus unclassified, and three retained media-evidence environments. The frozen country-day population contains 5 multi-family/five-document days, 379 observed-below-threshold days, and 17,076 days with no retained documents. Deterministic repair of those margins requires calibrated analysis weights; the base weights are retained for sensitivity analysis and are not presented as final. Political media context remains missing rather than receiving an invented proxy.

## Reproducibility

The machine-readable protocol, bounded largest-remainder allocator, stable SHA-256 within-stratum ordering, same-stratum reserve rule, weighting rule, and prohibited changes are executable and tested. The checked population artifact has semantic hash `26e3f46b395dc968afeb4803b2eeb7c48aeb94f05f4f1a41c70a6d51eda01e92`.

## Verification

```sh
npm run generate:pulse-evaluation-sampling
npm run validate:pulse-evaluation-sampling
npx tsc --noEmit
npm test
npm run validate:claims-docs
npm run build
```

PUL-015 must create the country-day evidence and search-trace packets. PUL-016 and PUL-017 own independent blinded coding. No accuracy result exists yet.

The complete suite finishes with 808 passing tests, and the production build renders 98 static pages. The existing non-fatal Next.js file-tracing warning remains.
