<!--
  Phase 5 (content templating, runtime) — 2026-05-06: this file is the
  prose source of truth for /civica-index/methodology. The TSX shell
  at src/app/(reader)/civica-index/methodology/page.tsx wraps it via
  multiple <MarkdownContent slice> invocations.

  TSX shell handles, NOT markdown:
    - H1, page-meta line, beta warning callout, abstract pull-quote
    - Section 2 (Dimensions): bespoke weights-bar visualization +
      dimensions-summary table (rendered from civicaIndex.dimensions)
    - Section 6 (Rank bands): bespoke band-scale visualization
    - Section 14 (Versioning): version-strip metadata grid +
      DB-driven revision history (getCIMethodologyHistory()) + cite
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

- **A 90% confidence interval** — e.g. "CI 72 (90% CI: 68–76)". This is the range within which the "true" score is likely to fall, given the uncertainty of the underlying data.
- **A rank band** — A through F, see §6. The band is the primary presentation; the integer is for researchers and API consumers who want it.
- **A vintage / freshness timestamp** per underlying source. So you can see, for any score, exactly how recent each upstream dataset is.
- **A completeness flag** — Full, Partial, or Insufficient. See §7.

Scores are integers, not decimals. The underlying data is not precise enough to support fractional digits, and pretending otherwise misleads readers.

## Section 3 · Normalization {#normalization}

Every source uses a different native scale. Civica normalizes them to 0–100 using **fixed theoretical bounds** rather than observed minimums and maximums, so scores remain comparable across years and aren't shifted by changes elsewhere in the dataset:

| Source | Native scale | Transform to 0–100 |
|---|---|---|
| V-Dem (libdem, polyarchy, rule) | 0.0 – 1.0 | score × 100 |
| World Bank WGI | −2.5 to +2.5 | ((score + 2.5) / 5.0) × 100 |
| Transparency International CPI | 0 – 100 | score (already on target scale) |
| Freedom House (PR + CL) | 2 – 14 (sum, inverted) | ((14 − score) / 12) × 100 |
| RSF Press Freedom | 0 – 100 (varies by year) | see annual RSF methodology |

For sources without natural theoretical bounds, the methodology uses an **anchored z-score transform**: compute z-scores against the global distribution of a fixed reference period (2020–2024), then convert via the cumulative normal distribution to 0–100. The reference period, mean, and standard deviation are documented and frozen — never re-anchored — so historical scores remain comparable.

## Section 4 · Weight determination {#weights}

Weights are derived from the data itself rather than asserted, using two standard statistical techniques:

- **Principal component analysis (PCA)** on the full country-year panel of normalized indicators (V-Dem components, WGI, CPI, Freedom House, RSF) for 2000–2024. PCA tells us how many genuinely distinct dimensions exist in the data.
- **Factor analysis with varimax rotation** to map each source onto its primary latent factor. This is what tells us whether Administrative Capacity is its own dimension or just another face of Rule of Law.
- **Source-substitution sensitivity testing**: swap each primary source for its secondary, recompute, and confirm that scores stay stable within their published uncertainty intervals.

The full PCA results — eigenvalues, scree plot, factor loadings, and decision rationale — are published as a separate appendix at [/civica-index/methodology/pca-appendix](/civica-index/methodology/pca-appendix). Headline finding: the {{state.civicaIndex.dimensionCount}} governance dimensions are highly correlated (r = {{ctx.corrLow}} to {{ctx.corrHigh}}), one dominant latent factor explains {{ctx.pc1VariancePct}}% of the variance, and weights proportional to the squared first-component loadings come out near-equal — close enough to the provisional values that rankings barely move under the revision.

## Section 5 · Uncertainty intervals {#uncertainty}

Every score publishes a 90% confidence interval. The interval is computed via **Monte Carlo simulation**:

```
for each country:
  for sim in 1 .. 10,000:
    sample each indicator from its
      published-uncertainty distribution
    recompute the CI

  90% CI  =  [5th percentile, 95th percentile]
                of the 10,000 simulated CIs
```

Most academic sources (V-Dem in particular) publish uncertainty information directly. For sources that do not, a conservative ±5% of the normalized range is used as the indicator's spread. This will be documented in the replication package (in preparation, targeted for Q3 2026).

## Section 7 · Missing data {#missing}

Different countries have different data coverage. Civica enforces three rules to handle missing data without distorting the score:

- **Mandatory dimensions.** Democratic Quality and Rule of Law are required. If either is missing, no CI is published for that country — the page reads "Insufficient data for governance index" with an explanation of which dimensions are missing.
- **Partial CI.** If the mandatory dimensions are present but one of the others (Freedoms & Rights or Corruption Control) is missing, a partial CI is published — flagged visually, with the confidence interval widened by 20% to reflect the added uncertainty.
- **Complete CI.** All {{state.civicaIndex.dimensionCount}} dimensions present. No flag.

Re-proportioning weights to fill in missing data is explicitly avoided — that approach silently biases the scores of fragile states upward, since the dimensions most likely to be missing are the ones that would have scored lowest.

## Section 8 · Civica Conditions {#conditions}

Human development, security, and economic stability are **not part of the Civica Index headline score**. They are essential context for understanding a country, but they measure something different — material conditions, shaped by governance but also by geography, economy, and external factors.

Civica publishes these as the **Civica Conditions** companion layer at [/civica-conditions](/civica-conditions). Each Conditions dimension is shown separately on country pages — never merged into a single number, and never combined with the CI.

| Conditions dimension | Source |
|---|---|
| Human Development | UNDP Human Development Index |
| Peace & Security | Institute for Economics and Peace, Global Peace Index |
| Economic Stability | World Bank composite (inflation, unemployment, GDP growth) |

The contrast between CI and Conditions is itself informative. A poor, well-governed democracy like Botswana shows a strong CI alongside moderate Conditions. A wealthy autocracy like the UAE shows the inverse. Reading the two together tells a fuller story than either could alone.

## Section 9 · Government type {#gov-type}

Government type is descriptive metadata, not a scoring signal. It does not enter the CI calculation in any form. Constitutional monarchies are not awarded points for being constitutional monarchies; presidential republics are not penalized for being presidential republics. The score measures governance quality directly, regardless of the constitutional shell that produces it.

Empirical observation about how governance scores vary by government type is published as a separate analysis at [/civica-index/government-types](/civica-index/government-types) — average CI per type, distribution spread, twenty-year trajectories. The data is presented as observation, never as ranking.

How Civica chooses peer sets for ranking comparisons — different lenses for material vs governance vs descriptive comparisons — is documented in [the peer-grouping methodology page](/civica-index/methodology/peer-grouping). That page replaces the retired `structural_family` heuristic per the 2026-05-02 peer-grouping resolution.

## Section 10 · Civica Pulse (Beta) {#pulse}

The Civica Pulse is the event-sensitive layer that sits on top of the structural CI. It publishes **dimensional deltas** — separate impact values on each CI dimension — driven by classified events from specialist feeds (ACLED, CIVICUS, RSF alerts, V-Dem pulse, HRW / Amnesty) corroborated by general news. Decay is category-specific: a coup persists for a year; a journalist arrest decays in two months. Positive events require stronger corroboration than negative events to resist gaming.

The Pulse is currently a clearly labelled *Beta* — experimental, not yet citable as authoritative. Its methodology is documented in detail at [/civica-index/methodology/pulse](/civica-index/methodology/pulse). That page is the sister document to this one and should be read alongside. The full event feed is at [/civica-index/pulse-changelog](/civica-index/pulse-changelog).

## Section 11 · Update frequency & vintages {#vintages}

The Civica Index updates **quarterly** — March, June, September, December — to align with source publication cycles and to avoid spurious between-quarter movement. Mid-quarter source releases are staged for the next quarterly publication. The Pulse is the only layer designed to move daily, but its automated daily refresh is currently paused, so it reflects the most recent computation rather than a live feed.

To reconcile citation stability with longitudinal comparability, every score is preserved in two parallel historical series:

- **As-published vintages.** Every quarterly snapshot is preserved permanently. Cited values like "Civica Index 2026 Q3" resolve to that frozen value forever, regardless of how the methodology evolves afterward.
- **Harmonized back-cast.** Every country's historical CI is recomputed annually under the current methodology and published as a separate time series — for researchers who want apples-to-apples comparisons across years. Always clearly labelled as back-cast.

Both series are accessible via the API. See §13 for citation format.

## Section 12 · Limitations {#limitations}

**Source lag.** The CI is only as current as its slowest-updating source. Some upstream indices publish 12–18 months behind real-world developments. Quarterly updates partially smooth this, but the Pulse exists specifically to fill the gap between structural updates.

**Coverage gaps.** Some countries have insufficient source coverage to compute even a partial CI. Those pages display "Insufficient data" rather than guess. The full list will accompany the replication package (in preparation, targeted for Q3 2026).

**Construct narrowing.** By design, the CI measures governing institutions only. If a reader wants to ask "is this country a good place to live?" — a different and broader question — the CI alone does not answer that. Read it together with [Civica Conditions](/civica-conditions).

**PCA panel underpowered.** The PCA in §4 was run on n = {{state.civicaIndex.pca.panelSize}} countries from a single year ({{state.civicaIndex.pca.dataVintage}}). Final weights will be re-validated when the historical panel is ingested. The structural decision ({{state.civicaIndex.dimensionCount}}-dim core, near-equal weights) is unlikely to change because the underlying correlation structure is well-documented in the literature, but precise magnitudes might shift.

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

Every CI API response includes a `meta.methodology` block describing the methodology revision date and the Beta status — so machine consumers can detect the development phase programmatically.

### 13.2 · Disputes & corrections

Every score is open to dispute. Submit data-error corrections, methodology disagreements, or Pulse event misclassifications at [/civica-index/corrections](/civica-index/corrections). Resolution targets: {{state.disputeSla.initialResponseDays}} days initial response, {{state.disputeSla.fullDispositionDays}} days full disposition. Every dispute and outcome is logged publicly.

### 13.3 · Replication

A full replication package — codebook, processing logic, source references, and downloadable derived outputs — is in preparation, targeted for Q3 2026. Its landing page is at [/civica-index/replication](/civica-index/replication).
