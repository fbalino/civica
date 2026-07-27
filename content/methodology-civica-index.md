<!--
  Phase 5 (content templating, runtime) — 2026-05-06: this file is the
  prose source of truth for /civica-index/methodology. The TSX shell
  at src/app/(reader)/civica-index/methodology/page.tsx wraps it via
  multiple <MarkdownContent slice> invocations.

  TSX shell handles, NOT markdown:
    - H1, page-meta line, beta warning callout, abstract pull-quote
    - Section 2 (Dimensions): bespoke weights-bar visualization +
      dimensions-summary table (rendered from civicaIndex.dimensions)
    - Section 6 (Presentation policy): neutral score-position example
    - Section 14 (Versioning): version-strip metadata grid + cite
    - footer-nav

  THIS file carries sections 1, 3, 4, 5, 7-13 (Scale, Normalization,
  Weights, Uncertainty, Missing, Conditions, Government type, Civica
  Pulse, Vintages, Limitations, Citation). Each section uses the
  numbered-section convention `## Section N · <Title> {#anchor}`
  per audit §3.4 user sign-off. Section anchors match the TSX
  SECTIONS array.

  Substitution markers:
    {{state.X}}                 typed config from site-state.ts
    {{ctx.X}}                   pre-computed helpers from the TSX
                                shell (lastRevision, pc1VariancePct,
                                corrLow, corrHigh)

  Validate with: npm run validate:content-templates
-->

## Section 1 · Scale {#scale}

The preserved Beta method produces an integer between 0 and 100. Higher values represent stronger governance institutions under that model. These values are retained as research records and are not Civica's current public comparison product. Each retained record includes:

- **No composite uncertainty band.** The current release retains no usable per-country uncertainty field and has no cross-source covariance model. It therefore publishes the deterministic weighted point estimate without lower or upper bounds.
- **A neutral numeric position** — the estimate is plotted on a 0–100 line without a letter grade or qualitative country verdict. See §6.
- **A vintage / freshness timestamp** per underlying source. So you can see, for any score, exactly how recent each upstream dataset is.
- **A completeness flag** — Full, Partial, or Insufficient. See §7.

Scores are integers, not decimals. The underlying data is not precise enough to support fractional digits, and pretending otherwise misleads readers.

The archived pipeline ordered integer estimates using **competition ranking**. Countries with the same published score shared the same rank; the next rank skipped the positions occupied by the tie. Jurisdiction identity stabilized display order inside a tied group but did not break the tie. The rank was only an ordering of rounded estimates. It was not evidence that adjacent countries were meaningfully different. The research record has no valid score-uncertainty model, does not publish rank intervals, and does not claim estimated rank stability.

## Section 3 · Normalization {#normalization}

Every source uses a different native scale. Civica normalizes them to 0–100 using **fixed theoretical bounds** rather than observed minimums and maximums, so scores remain comparable across years and aren't shifted by changes elsewhere in the dataset. The current implementation uses the explicit source paths below. A source outside this table is skipped rather than receiving an invented transform:

[//]: # "GEN:START normalization-table (source: scripts/generate-ci-normalization-table.ts)"

| Dimension | Source | Native scale | Transform to 0–100 |
|---|---|---|---|
| Democratic quality | V-Dem Liberal Democracy Index | 0.0 – 1.0 | score × 100 |
| Democratic quality (coverage fallback) | World Bank WGI Voice & Accountability | −2.5 to +2.5 | ((score + 2.5) / 5.0) × 100 |
| Rule of law | World Bank WGI Rule of Law | −2.5 to +2.5 | ((score + 2.5) / 5.0) × 100 |
| Freedoms & rights | Freedom House (PR + CL, combined) | 2 – 14 (sum, inverted) | ((14 − score) / 12) × 100 |
| Corruption control | Transparency International CPI | 0 – 100 | score (already on target scale) |

[//]: # "GEN:END normalization-table"

The frozen 2024-Q4 Beta release uses **World Bank WGI Voice & Accountability as a coverage fallback only where V-Dem has no democratic-quality row**. The stored row keeps `worldbank_wgi` as its source and uses WGI's fixed bounds. This is a construct substitution, not a claim that Voice & Accountability is equivalent to V-Dem's Liberal Democracy Index. It is a named limitation that must be tested in the later Index candidate tournament; readers comparing countries should inspect the source indicator rather than assume one uniform democratic-quality input.

## Section 4 · Weight determination {#weights}

The deployed beta weights came from a single-year, {{state.civicaIndex.pca.panelSize}}-country PCA and remain externally unreviewed. Civica subsequently froze a private native-scale historical panel and completed the preregistered dimensionality, substitution, and sensitivity analyses:

- **Deployed-weight record:** the appendix preserves the complete-case cross-sectional PCA that produced the current near-equal weights.
- **Historical panel:** the frozen country-year panel retains source identity, vintage, native unit, uncertainty status, missingness reason, revision state, temporal breaks, and semantic hashes. Exact observations remain private because source rights are mixed.
- **Dimensionality result:** governance ratings share a strong between-country level factor, but the factor is materially weaker for within-country variation and annual changes. The level result cannot validate one longitudinal change construct.
- **Sensitivity result:** source inclusion, normalization, and aggregation choices move country positions much more than small changes among the near-equal weights. The public inputs also reproduce the composite almost exactly.

The deployed PCA record — eigenvalues, scree plot, factor loadings, and decision rationale — is published at [/civica-index/methodology/pca-appendix](/civica-index/methodology/pca-appendix). In that cross-section, the {{state.civicaIndex.dimensionCount}} dimensions are highly correlated (r = {{ctx.corrLow}} to {{ctx.corrHigh}}), and the first component explains {{ctx.pc1VariancePct}}% of the variance. The later tournament evidence shows why that result is too narrow to justify an original Civica measurement or a recommended country ranking.

## Section 5 · Uncertainty posture {#uncertainty}

The current release publishes **no composite uncertainty or input-variation range**. Its point estimate is the rounded weighted sum of the normalized source values. No random draw enters that estimate.

This is a data limitation, not evidence that the estimate is precise. V-Dem publishes posterior intervals for its modeled indicators, and the World Bank publishes model-based standard errors for WGI. Civica's current release adapters retain neither quantity. Freedom House publishes consensus-reviewed scores without a per-country probability distribution. Transparency International publishes source-agreement and significance information, but Civica currently retains only the CPI point score. Across the released Index input table, usable uncertainty coverage is {{state.civicaIndex.uncertainty.usableReleasedUncertaintyRows}} of {{state.civicaIndex.uncertainty.releasedDimensionRows}} rows.

The four source families also overlap in concepts, expert communities, and underlying evidence. Civica has not estimated a covariance model for those dependencies. Treating the inputs as independent and assigning the same invented spread to each one would understate some dependencies and manufacture precision elsewhere. A future range may return only with retained source-specific uncertainty, an explicit dependence model, empirical calibration checks where a repeated-observation target exists, and a new methodology version.

## Section 7 · Missing data {#missing}

Different countries have different data coverage. Civica enforces three rules to handle missing data without distorting the score:

- **Mandatory dimensions.** Democratic Quality and Rule of Law are required. Democratic Quality uses V-Dem when present and the disclosed WGI Voice & Accountability coverage fallback otherwise. If either mandatory dimension is still missing, no CI is published for that country.
- **Publication threshold.** A composite requires at least {{state.civicaIndex.missingness.minimumDimensionsForPublication}} of the {{state.civicaIndex.dimensionCount}} dimensions, including both mandatory dimensions. A country with the mandatory dimensions alone receives no composite; the page identifies the missing dimensions rather than substituting a score.
- **Partial estimate.** If both mandatory dimensions are present and exactly one optional dimension (Freedoms & Rights or Corruption Control) is missing, a partial estimate is published and flagged visually. The weights of the dimensions actually present are re-proportioned to carry the full composite weight. Partial estimates retain their missing-dimension label and should not be compared with full estimates as if coverage were equal.
- **Complete estimate.** All {{state.civicaIndex.dimensionCount}} dimensions present. No missing-dimension flag.

**Upward-bias risk.** Re-proportioning weights onto the dimensions that are present can push a partial score upward, because the dimension most likely to be missing for a fragile or low-capacity state is often the one that would have scored lowest. No generic range is shown as a correction for this bias — see §12.

## Section 8 · Civica Conditions {#conditions}

Human development, security, and economic stability are **not part of the Civica Index headline score**. They are essential context for understanding a country, but they measure something different — material conditions, shaped by governance but also by geography, economy, and external factors.

Civica publishes these as the **Civica Conditions** companion layer at [/civica-conditions](/civica-conditions). Each Conditions dimension is shown separately on country pages — never merged into a single number, and never combined with the CI.

| Conditions dimension | Source                                                     |
| -------------------- | ---------------------------------------------------------- |
| Human Development    | UNDP Human Development Index                               |
| Peace & Security     | Institute for Economics and Peace, Global Peace Index      |
| Economic Stability   | World Bank source-native inflation, unemployment, and GDP-growth inputs; no composite is currently published |

The contrast between CI and Conditions is itself informative. A country can have a higher numeric governance estimate alongside different material indicators, or the inverse. Reading the source dimensions together tells a fuller story than any single composite can. The versioned inputs, transformations, missingness rules, and replication boundary are documented in the [Conditions codebook](/civica-conditions/methodology).

## Section 9 · Government type {#gov-type}

Government type is descriptive metadata, not a scoring signal. It does not enter the archived CI calculation. Constitutional monarchies received no bonus for being constitutional monarchies, and presidential republics received no penalty for being presidential republics.

The former government-type score explorer has been removed from public navigation because it depended on the superseded composite. Source-native governance observations remain available in the [Governance Evidence Dashboard](/governance-evidence); descriptive regime classifications remain available in country profiles and the Atlas.

How Civica chooses peer sets for ranking comparisons — different lenses for material, governance, and descriptive comparisons — is documented in the [peer-grouping methodology](/civica-index/methodology/peer-grouping).

## Section 10 · Civica Pulse (Beta) {#pulse}

The Civica Pulse is a separate experimental event ledger. It publishes **public experimental dimensional deltas** — never a merged Pulse score or ranking. The live [source-coverage contract](/api/v1/pulse/source-coverage) decides whether a connector is operating, degraded, or inactive from retained retrieval telemetry, evidence, jurisdiction scope, and rights; a connector's presence in code does not make it active. A one-group event can currently affect a delta at reduced heuristic weight, so “corroboration” must not be read as proof of independent confirmation.

The Pulse is currently a clearly labelled _Beta_ experiment. Its classifications and numeric effects have not completed representative validation or independent review. Its methodology is documented in detail at [/civica-index/methodology/pulse](/civica-index/methodology/pulse), and the event ledger is at [/civica-index/pulse-changelog](/civica-index/pulse-changelog).

## Section 11 · Update frequency & vintages {#vintages}

The archived Civica Index pipeline was designed for **quarterly** vintages aligned with source publication cycles. Mid-quarter source releases were staged for the next computation. Pulse is designed for scheduled event-ingestion runs, and its public ledger reflects the most recent completed computation rather than a live measure.

The version contract distinguishes two historical series:

- **As-published release.** A frozen result must retain its actual publication cut, calculation time, and method. The reference period remains a separate field.
- **Harmonized backcast.** A later computation applies a named method to historical reference periods. It has no original historical publication cut.

The stored 2023 and 2024 Index records were calculated in 2026. They are harmonized backcasts, including Beta-R3, Beta-R4, and Beta-R5; none is a Civica score published in 2023 or 2024. Civica currently has no genuine historical as-published Index series. Requests for that series return an explicit unavailable result instead of relabelling a backcast.

Every preserved Beta read now names one closed release rather than asking for a methodology or “latest” quarter independently. The release contract binds the quarter, methodology, five permitted source-indicator identities, publisher artifact hashes, ingestion transform, composite algorithm, display transform, `series_type`, calculation time, publication cut, and citation label. When V-Dem and the disclosed WGI coverage fallback both exist, the contract selects V-Dem deterministically. Rows from another Beta revision can coexist in storage but cannot enter the requested release. Unknown sources, artifacts, transforms, and unregistered release coordinates fail closed.

## Section 12 · Limitations {#limitations}

**Source lag.** The CI is only as current as its slowest-updating source. Some upstream indices publish 12–18 months behind real-world developments. Pulse is a separate experiment testing whether an event ledger can add timely context; its incremental value has not yet been established.

**Coverage gaps.** Some countries lacked enough source coverage to compute even a partial CI. The public country pages now show source-native evidence instead of filling those gaps with a composite.

**Partial-estimate upward bias.** Re-proportioning weights over the dimensions present (§7) can bias a partial score upward relative to what the country would score with full coverage, since the missing dimension is often the weakest one for a fragile or low-capacity state. The partial label identifies this limitation; no generic uncertainty band is presented as a correction.

**Construct narrowing.** By design, the CI measures governing institutions only. If a reader wants to ask "is this country a good place to live?" — a different and broader question — the CI alone does not answer that. Read it together with [Civica Conditions](/civica-conditions).

**Level/change mismatch.** The deployed weights still come from the single-year PCA described in §4. The completed historical analysis finds a much weaker common structure in annual changes than in between-country levels. A strong pooled level factor therefore cannot establish that yearly composite movement tracks one coherent longitudinal construct.

## Section 13 · Citation {#citation}

Do not cite the current website as publishing an endorsed Civica country score or ranking. To discuss the preserved Beta method, cite the methodology and identify the versioned research artifact:

```
Civica Atlas. Civica Index research methodology and disposition,
version civica-index-disposition-2026-07-v1.
https://civicaatlas.org/civica-index/methodology
```

If a future candidate passes the preregistered validation gates, it will receive a new methodology version and its own citation instructions. The archived Beta values do not inherit that standing.

### 13.1 · API access

The generated endpoint list lives at [/api-docs](/api-docs). Before sunset, legacy score, ranking, comparison, and history reads accept only a registered exact `release` id; a methodology label or latest-quarter lookup cannot assemble a mixed result. The endpoints name the [Governance Evidence Dashboard](/governance-evidence) as their successor and return `410 Gone` after the announced sunset. Pulse endpoints remain separate and carry their own experimental runtime-method contract.

### 13.2 · Disputes & corrections

Submit source-data errors, methodology disagreements, or Pulse event misclassifications at [/civica-index/corrections](/civica-index/corrections). Best-effort targets are {{state.disputeSla.initialResponseDays}} calendar days for initial review and {{state.disputeSla.fullDispositionDays}} calendar days for full disposition. Public submissions can be followed in the corrections log; privacy-requested submissions are omitted. The governing rules are in the [corrections and versioning policy](/policies#corrections).

### 13.3 · Replication

The [replication status page](/civica-index/replication) records the available artifacts and remaining rights constraints. The frozen tournament package preserves code, manifests, diagnostics, and decision outputs in the repository; restricted source observations are not republished where upstream terms do not permit it.
