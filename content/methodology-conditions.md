<!-- Conditions codebook: prose source for /civica-conditions/methodology. -->

## Scope and nonclaims {#scope}

Civica Conditions is a companion ledger of material indicators. It is not a governance score, a country ranking, or a combined verdict. Human Development, Peace & Security, and Economic Stability remain separate dimensions and are never added to the Civica Index.

Every public result names one immutable Conditions release. A release records its identifier, methodology version, manifest hash, calculation rows, source-native components, alignment outcome, and the coverage derived from those rows. A reader must not combine values from different releases.

## Dimensions and inputs {#inputs}

| Dimension | Declared input | Native unit | Current public treatment |
| --- | --- | --- | --- |
| Human Development | UNDP Human Development Index | index 0–1 | Separate, release-versioned position when its one declared component is observed |
| Peace & Security | Institute for Economics & Peace, Global Peace Index | publisher index | Separate, release-versioned position when its one declared component is observed |
| Economic Stability | World Bank inflation, unemployment, and real GDP growth | percentage inputs | Source-native component ledger only; no composite or ranking is published |

Each component retains its source identifier, publisher indicator identifier, upstream release, license URL, transformation identifier, reference year, value state, missingness reason, and inclusion decision.

## Alignment, transformations, and reference distributions {#transformations}

The alignment policy is `all-components-same-reference-year/v1`. A multi-component calculation is aligned only when every declared component is observed for the same reference year. An aligned Human Development or Peace & Security calculation may use its release-recorded transformation and frozen reference set. The release stores the exact eligible population, reference period, included components, direction, transformation identifier, and parameters or fixed bounds.

There is no imputation. A component that is unavailable remains visible with its closed value state and reason. Mixed observed years produce `mixed_year_refused`; unavailable components produce `missing_component`. Neither result receives a score, a reference year, or an implied zero.

Economic Stability is deliberately different: the frozen longitudinal construct study has not authorized a scalar transformation. Its direction is `not_ranked`, its source-native inputs remain separate, and a current GDP-growth observation does not establish stability.

## Coverage and uncertainty {#coverage}

Coverage is calculated from the calculation rows in the selected release, by dimension and alignment outcome. It is not a claim about a general country universe. The explorer and API display calculations, aligned rows, scored rows, mixed-year refusals, missing-component rows, and component availability from that exact release.

The Conditions ledger does not publish uncertainty intervals, causal claims, or a cross-dimension aggregate. Publisher uncertainty, comparability limits, different source calendars, and source rights remain material limitations. A more recent value cannot silently replace an older release result.

## Reproduction and fixtures {#reproduction}

The release writer validates every calculation and component before it writes: declared components must be complete, value states and missingness reasons must agree, aligned inputs must share a reference year, and the release manifest must be immutable. The dedicated fixture command is:

```sh
npm run validate:conditions-components
```

It runs decomposition, migration, release-writer, economic-construct, and public-read fixtures, then checks the Conditions contract. The economic construct study can also be rerun without a database or network access:

```sh
npm run analyze:economic-stability-construct -- --input=<frozen-study-input.json> --output=<result.json>
```

The input must carry its release and source-input hashes. A staged or production Conditions release is not considered reproduced until its own captured inputs, manifest, and output are checked together in an isolated environment.

## Corrections and limits {#limits}

To report a source, component, year, or release issue, use the [data correction path](/civica-index/corrections). Public access does not grant reuse rights for upstream data; consult [Licensing](/licensing#rights-manifest) before redistributing values or source materials.
