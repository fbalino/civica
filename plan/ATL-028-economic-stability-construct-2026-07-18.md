# ATL-028 — Economic stability construct review

## Status

**Unvalidated candidate; do not treat the current composite as an established
measure of economic stability.** The review is intentionally staged behind the
frozen Conditions release work in ATL-027.

## Theory boundary

The IMF's *Macroeconomic Stability and Economic Growth* distinguishes
instability/disequilibrium, a transition through stabilization, and
stability/steady growth. It describes external shocks and policy failures as
sources of instability, and explains why a temporary contraction during
adjustment is not evidence of worse long-run stability. It also identifies low
and stable inflation, sustainable debt, and shock resilience as relevant
conditions. It does not support treating a high one-year GDP-growth rate as
itself a stability outcome. Source reviewed 2026-07-18:
<https://www.elibrary.imf.org/display/book/9781589060173/ch003.xml>.

The World Bank's [*Volatility and Growth*](https://documents.worldbank.org/curated/en/154121468765320854/pdf/WPS3184.pdf)
and the OECD's [*Growth Policies and Macroeconomic Stability*](https://www.oecd.org/content/dam/oecd/en/publications/reports/2014/02/growth-policies-and-macroeconomic-stability_g17a2460/5jz8t849335d-en.pdf)
are retained as independent review sources for the relation between volatility
and growth, and for policy/structural conditions that are not equivalent to the
direction of a single annual growth observation.

## Candidate definitions

1. **Source-native separate indicators (default pending validation):** annual
   inflation, unemployment, and real GDP growth retain their own units,
   reference years, sources, and missingness. There is no composite claim.
2. **Macro-stability pressure profile (research only):** inflation level and
   volatility, unemployment level and volatility, real-growth volatility, and
   a clearly separate downside/recession flag. This profile cannot use growth
   direction alone as stability.
3. **Recovery/boom descriptor (research only):** a time-labelled growth change
   around a documented shock. It is never joined to the stability profile or
   ranked as a country-quality outcome.

## Required frozen-data comparison

Before a candidate can replace the default separate-indicator presentation:

- build a named longitudinal Conditions release from observed annual source
  rows, with no mixed-year substitutions;
- compare current-growth, volatility-aware, and no-composite alternatives with
  all transformation/direction/missingness choices frozen beforehand;
- report sensitivity to five-year versus ten-year windows, leave-one-component
  removal, source-vintage changes, and a recovery/boom counterexample set;
- compare every component against its native World Bank baseline, including
  whether a candidate merely reproduces growth or an external volatility
  series; and
- retain the results, failures, and a resolution. A failed candidate leaves
  only source-native separate indicators public.

## Current implementation consequence

ATL-027 stores the inputs and release-level parameters needed for this study,
but it does **not** validate a composite. New economic releases retain aligned,
source-native component ledgers and explicitly emit no score. The reproducible
study command is:

```sh
npm run analyze:economic-stability-construct -- --input=<frozen-study-input.json> --output=<result.json>
```

It requires a hash-pinned Conditions release and source-input manifest, both
five- and ten-year profiles, a documented recovery and boom counterexample,
and (when supplied) an external volatility-baseline comparison. Its resolution
is deliberately `source_native_separate_indicators` / `not_authorized`; no
numeric result can silently turn into a public economic-stability composite.
ATL-029 must not present an economic score as a stable measure until this
plan's frozen-data comparison passes and an independently reviewed construct
supersedes that explicit resolution.
