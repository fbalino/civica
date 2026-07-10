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

Every Civica Index score is an integer between 0 and 100. Higher means stronger governance institutions. Every published score is accompanied by:

- **A Monte Carlo input-variation range** — e.g. "central 90% of simulations: 68–76". This is a sensitivity summary under the current perturbation assumptions. It is not a confidence interval for a latent "true" country score.
- **A neutral numeric position** — the estimate is plotted on a 0–100 line without a letter grade or qualitative country verdict. See §6.
- **A vintage / freshness timestamp** per underlying source. So you can see, for any score, exactly how recent each upstream dataset is.
- **A completeness flag** — Full, Partial, or Insufficient. See §7.

Scores are integers, not decimals. The underlying data is not precise enough to support fractional digits, and pretending otherwise misleads readers.

## Section 3 · Normalization {#normalization}

Every source uses a different native scale. Civica normalizes them to 0–100 using **fixed theoretical bounds** rather than observed minimums and maximums, so scores remain comparable across years and aren't shifted by changes elsewhere in the dataset. The current implementation is a hard-coded lookup table, one row per source actually ingested into the four headline dimensions — there is no fallback transform for a source outside this table; the dimension is simply skipped:

| Dimension | Source | Native scale | Transform to 0–100 |
|---|---|---|---|
| Democratic quality | V-Dem Liberal Democracy Index | 0.0 – 1.0 | score × 100 |
| Rule of law | World Bank WGI Rule of Law | −2.5 to +2.5 | ((score + 2.5) / 5.0) × 100 |
| Freedoms & rights | Freedom House (PR + CL, combined) | 2 – 14 (sum, inverted) | ((14 − score) / 12) × 100 |
| Corruption control | Transparency International CPI | 0 – 100 | score (already on target scale) |

## Section 4 · Weight determination {#weights}

The current beta weights are PCA-informed estimates, not externally reviewed parameters. The completed analysis uses a single-year, {{state.civicaIndex.pca.panelSize}}-country panel; the planned historical and substitution tests below have not yet been completed:

- **Completed:** principal component analysis (PCA) on the currently ingested complete-case panel. The appendix reports its sample, data vintage, and limitations.
- **Planned:** a longitudinal country-year panel and factor analysis with varimax rotation to test whether Administrative Capacity is distinct from Rule of Law.
- **Planned:** source-substitution sensitivity testing that swaps primary and secondary indicators and measures how much results move.

The full PCA results — eigenvalues, scree plot, factor loadings, and decision rationale — are published as a separate appendix at [/civica-index/methodology/pca-appendix](/civica-index/methodology/pca-appendix). Headline finding: the {{state.civicaIndex.dimensionCount}} governance dimensions are highly correlated (r = {{ctx.corrLow}} to {{ctx.corrHigh}}), one dominant latent factor explains {{ctx.pc1VariancePct}}% of the variance, and weights proportional to the squared first-component loadings come out near-equal — close enough to the provisional values that rankings barely move under the revision.

## Section 5 · Input-variation ranges {#uncertainty}

Every score can publish a Monte Carlo input-variation range. The current code perturbs inputs under declared assumptions and reports the central 90% of simulated composite values:

```
for each country:
  for sim in 1 .. 10,000:
    sample each indicator from its
      published-uncertainty distribution
    recompute the weighted composite

  input-variation range = [5th percentile, 95th percentile]
                          of the 10,000 simulated composites
```

The published point estimate is the **median** of those simulated composites, rounded to the nearest integer — not the raw (unperturbed) weighted sum. The displayed input-variation range uses the lower and upper percentiles described above from that same simulated distribution.

Some inputs, including V-Dem, publish uncertainty information directly. For sources that do not, the current implementation applies a fixed ±5% perturbation on the normalized range. That fallback is a heuristic sensitivity assumption, not an estimated sampling distribution. Until a defensible statistical model is specified and validated, Civica does not describe these bounds as confidence intervals or as the probable location of a true score.

## Section 7 · Missing data {#missing}

Different countries have different data coverage. Civica enforces three rules to handle missing data without distorting the score:

- **Mandatory dimensions.** Democratic Quality and Rule of Law are required. If either is missing, no CI is published for that country — the page reads "Insufficient data for governance index" with an explanation of which dimensions are missing.
- **Partial estimate.** If the mandatory dimensions are present but one of the others (Freedoms & Rights or Corruption Control) is missing, a partial estimate is published and flagged visually. The weights of the dimensions actually present are re-proportioned to carry the full composite weight, and the simulation range receives a fixed 20% widening; the widening is an explicit heuristic sensitivity adjustment, not a statistical confidence correction.
- **Complete estimate.** All {{state.civicaIndex.dimensionCount}} dimensions present. No missing-dimension flag.

**Upward-bias risk.** Re-proportioning weights onto the dimensions that are present can push a partial score upward, because the dimension most likely to be missing for a fragile or low-capacity state is often the one that would have scored lowest. The 20% widened range is a heuristic mitigation, not a validated statistical correction for this bias — see §12.

## Section 8 · Civica Conditions {#conditions}

Human development, security, and economic stability are **not part of the Civica Index headline score**. They are essential context for understanding a country, but they measure something different — material conditions, shaped by governance but also by geography, economy, and external factors.

Civica publishes these as the **Civica Conditions** companion layer at [/civica-conditions](/civica-conditions). Each Conditions dimension is shown separately on country pages — never merged into a single number, and never combined with the CI.

| Conditions dimension | Source |
|---|---|
| Human Development | UNDP Human Development Index |
| Peace & Security | Institute for Economics and Peace, Global Peace Index |
| Economic Stability | World Bank composite (inflation, unemployment, GDP growth) |

The contrast between CI and Conditions is itself informative. A country can have a higher numeric governance estimate alongside lower material-condition estimates, or the inverse. Reading the source dimensions together tells a fuller story than any single composite can.

## Section 9 · Government type {#gov-type}

Government type is descriptive metadata, not a scoring signal. It does not enter the CI calculation in any form. Constitutional monarchies are not awarded points for being constitutional monarchies; presidential republics are not penalized for being presidential republics. The score measures governance quality directly, regardless of the constitutional shell that produces it.

Empirical observation about how governance scores vary by government type is published as a separate analysis at [/civica-index/government-types](/civica-index/government-types) — average CI per type, distribution spread, twenty-year trajectories. The data is presented as observation, never as ranking.

How Civica chooses peer sets for ranking comparisons — different lenses for material, governance, and descriptive comparisons — is documented in the [peer-grouping methodology](/civica-index/methodology/peer-grouping).

## Section 10 · Civica Pulse (Beta) {#pulse}

The Civica Pulse is a separate experimental event ledger. It publishes **public experimental dimensional deltas** — never a merged Pulse score or ranking. The current production source basket is generated from observed staging rows and enumerated on the [Pulse methodology page](/civica-index/methodology/pulse#sources); a connector's presence in the code does not make it active. A single-source event can currently affect a delta at reduced heuristic weight, so “corroboration” must not be read as proof of independent confirmation.

The Pulse is currently a clearly labelled *Beta* experiment. Its classifications and numeric effects have not completed representative validation or independent review. Its methodology is documented in detail at [/civica-index/methodology/pulse](/civica-index/methodology/pulse), and the event ledger is at [/civica-index/pulse-changelog](/civica-index/pulse-changelog).

## Section 11 · Update frequency & vintages {#vintages}

The Civica Index is designed for **quarterly** vintages aligned with source publication cycles. Mid-quarter source releases are staged for the next published computation. Pulse is designed for scheduled event-ingestion runs, but the public ledger always reflects the most recent completed computation rather than a live or continuous measure.

To reconcile citation stability with longitudinal comparability, every score is preserved in two parallel historical series:

- **As-published vintages.** Every quarterly snapshot is preserved permanently. Cited values like "Civica Index 2026 Q3" resolve to that frozen value forever, regardless of how the methodology evolves afterward.
- **Harmonized back-cast.** Every country's historical CI is recomputed annually under the current methodology and published as a separate time series — for researchers who want apples-to-apples comparisons across years. Always clearly labelled as back-cast.

Both series are accessible via the API. See §13 for citation format.

## Section 12 · Limitations {#limitations}

**Source lag.** The CI is only as current as its slowest-updating source. Some upstream indices publish 12–18 months behind real-world developments. Pulse is a separate experiment testing whether an event ledger can add timely context; its incremental value has not yet been established.

**Coverage gaps.** Some countries have insufficient source coverage to compute even a partial CI. Those pages display "Insufficient data" rather than guess. The full list will accompany the replication package (in preparation, targeted for Q3 2026).

**Partial-estimate upward bias.** Re-proportioning weights over the dimensions present (§7) can bias a partial score upward relative to what the country would score with full coverage, since the missing dimension is often the weakest one for a fragile or low-capacity state. The widened input-variation range is a heuristic sensitivity adjustment, not a validated statistical correction for this bias.

**Construct narrowing.** By design, the CI measures governing institutions only. If a reader wants to ask "is this country a good place to live?" — a different and broader question — the CI alone does not answer that. Read it together with [Civica Conditions](/civica-conditions).

**PCA panel underpowered.** The PCA in §4 was run on n = {{state.civicaIndex.pca.panelSize}} countries from a single year ({{state.civicaIndex.pca.dataVintage}}). The weights must be recomputed and compared when the historical panel is ingested. The current result does not establish that the same structure will hold across years or broader country coverage.

## Section 13 · Citation {#citation}

For published vintages, cite by year and quarter. While the Index is in Beta, include the "Beta" suffix:

```
Civica Index 2026 Q3 (Beta). Civica Atlas. https://civicaatlas.org/civica-index
For a specific country:
  Civica Index for [Country], 2026 Q3 (Beta). Civica Atlas.
    https://civicaatlas.org/civica-index/[country-slug]
```

Once the Beta exits and the Index stabilizes, the "Beta" suffix drops; the year-quarter remains the canonical citation handle.

### 13.1 · API access

```
GET /api/v1/index/{country_slug}
GET /api/v1/index/rankings
GET /api/v1/index/methodology
GET /api/v1/pulse/{country_slug}/dimensions   (Beta — see Pulse spec)
GET /api/v1/pulse/{country_slug}/events       (Beta)
GET /api/v1/pulse/changelog/v2                 (Beta)
```

Every CI API response includes a CI-specific `meta.methodology` block describing the methodology revision date and Beta status. Pulse endpoints carry a separate Pulse runtime-method block because their version, output shape, and experimental status differ.

### 13.2 · Disputes & corrections

Every score is open to dispute. Submit data-error corrections, methodology disagreements, or Pulse event misclassifications at [/civica-index/corrections](/civica-index/corrections). Resolution targets: {{state.disputeSla.initialResponseDays}} days initial response, {{state.disputeSla.fullDispositionDays}} days full disposition. Every dispute and outcome is logged publicly.

### 13.3 · Replication

A full replication package — codebook, processing logic, source references, and downloadable derived outputs — is in preparation, targeted for Q3 2026. Its landing page is at [/civica-index/replication](/civica-index/replication).
