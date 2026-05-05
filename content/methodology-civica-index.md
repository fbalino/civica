# The Civica Index methodology.

<!-- Source: src/app/(reader)/civica-index/methodology/page.tsx · Extracted 2026-05-04 -->
<!-- Values below mirror src/lib/content/site-state.ts as of 2026-05-05. Update both when state changes. -->

*Beta — methodology in active development · Apr 2026 · Cut-over target Sept 30, 2026*

> **Beta.** The methodology described on this page is in active development. Civica's published scores will be republished under these rules at cut-over (target Sept 30, 2026). The empirical factor analysis described in §4 has shipped — the dimension weights below are the PCA-derived adopted values, documented in detail at [/civica-index/methodology/pca-appendix](https://civicaatlas.org/civica-index/methodology/pca-appendix). External academic review is still pending.

The Civica Index measures the quality of governing institutions in every country on a 0–100 scale, with explicit uncertainty, rank bands, and full transparency on sources. It is the scoring layer of Civica Atlas — useful for orientation, honestly presented, never oversold as definitive.

---

<a id="scale"></a>
## Section 1 · Scale

Every Civica Index score is an integer between 0 and 100. Higher means stronger governance institutions. Every published score is accompanied by:

- **A 90% confidence interval** — e.g. "CI 72 (90% CI: 68–76)". This is the range within which the "true" score is likely to fall, given the uncertainty of the underlying data.
- **A rank band** — A through F, see §6. The band is the primary presentation; the integer is for researchers and API consumers who want it.
- **A vintage / freshness timestamp** per underlying source. So you can see, for any score, exactly how recent each upstream dataset is.
- **A completeness flag** — Full, Partial, or Insufficient. See §7.

Scores are integers, not decimals. The underlying data is not precise enough to support fractional digits, and pretending otherwise misleads readers.

---

<a id="dimensions"></a>
## Section 2 · Dimensions

The CI measures **governing institutions and practices** — and only those. Material conditions like human development, security, and economic stability live on the separate [Civica Conditions](#conditions) layer. The 4 governance dimensions:

<!-- Dimension weight bar visualization: 27% Democratic quality / 26% Rule of law / 23% Freedoms & rights / 24% Corruption control (PCA-derived, adopted Apr 2026) -->

| Dimension | Weight | Primary source | Secondary / cross-check |
|---|---|---|---|
| Democratic quality | 27% | V-Dem Liberal Democracy Index | V-Dem Electoral Democracy Index |
| Rule of law | 26% | V-Dem Rule of Law | World Bank WGI Rule of Law |
| Freedoms & rights | 23% | Freedom House (PR + CL combined) | RSF Press Freedom Index |
| Corruption control | 24% | Transparency International CPI | World Bank WGI Control of Corruption |

**The weights above are PCA-derived and adopted.** They come from the empirical factor analysis described in §4 and documented in full at [/civica-index/methodology/pca-appendix](https://civicaatlas.org/civica-index/methodology/pca-appendix). A fifth dimension — *Administrative Capacity*, drawn from World Bank WGI Government Effectiveness and Regulatory Quality — is added if and only if it emerges as empirically distinct from Rule of Law in a future re-run of that analysis once the WGI indicator is ingested.

---

<a id="normalization"></a>
## Section 3 · Normalization

Every source uses a different native scale. Civica normalizes them to 0–100 using **fixed theoretical bounds** rather than observed minimums and maximums, so scores remain comparable across years and aren't shifted by changes elsewhere in the dataset:

| Source | Native scale | Transform to 0–100 |
|---|---|---|
| V-Dem (libdem, polyarchy, rule) | 0.0 – 1.0 | score × 100 |
| World Bank WGI | −2.5 to +2.5 | ((score + 2.5) / 5.0) × 100 |
| Transparency International CPI | 0 – 100 | score (already on target scale) |
| Freedom House (PR + CL) | 2 – 14 (sum, inverted) | ((14 − score) / 12) × 100 |
| RSF Press Freedom | 0 – 100 (varies by year) | see annual RSF methodology |

For sources without natural theoretical bounds, the methodology uses an **anchored z-score transform**: compute z-scores against the global distribution of a fixed reference period (2020–2024), then convert via the cumulative normal distribution to 0–100. The reference period, mean, and standard deviation are documented and frozen — never re-anchored — so historical scores remain comparable.

---

<a id="weights"></a>
## Section 4 · Weight determination

Weights are derived from the data itself rather than asserted, using two standard statistical techniques:

- **Principal component analysis (PCA)** on the full country-year panel of normalized indicators (V-Dem components, WGI, CPI, Freedom House, RSF) for 2000–2024. PCA tells us how many genuinely distinct dimensions exist in the data.
- **Factor analysis with varimax rotation** to map each source onto its primary latent factor. This is what tells us whether Administrative Capacity is its own dimension or just another face of Rule of Law.
- **Source-substitution sensitivity testing**: swap each primary source for its secondary, recompute, and confirm that scores stay stable within their published uncertainty intervals.

The full PCA results — eigenvalues, scree plot, factor loadings, and decision rationale — are published as a separate appendix at [/civica-index/methodology/pca-appendix](https://civicaatlas.org/civica-index/methodology/pca-appendix). Headline finding: the 4 governance dimensions are highly correlated (r = 0.74 to 0.98), one dominant latent factor explains 90.7% of the variance, and weights proportional to the squared first-component loadings come out near-equal — close enough to the provisional values that rankings barely move under the revision.

---

<a id="uncertainty"></a>
## Section 5 · Uncertainty intervals

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

Most academic sources (V-Dem in particular) publish uncertainty information directly. For sources that do not, a conservative ±5% of the normalized range is used as the indicator's spread. This is documented in the replication package.

---

<a id="bands"></a>
## Section 6 · Rank bands

The difference between rank 42 and rank 44 is, in any honest reading, nothing — it's well within the uncertainty interval of either country. Civica publishes **rank bands** instead of exact ranks as the primary presentation:

| Band | Score range | Label |
|---|---|---|
| A | 85 – 100 | Exceptional |
| B | 70 – 84 | Strong |
| C | 55 – 69 | Mixed |
| D | 40 – 54 | Weak |
| E | 25 – 39 | Very weak |
| F | 0 – 24 | Failed / authoritarian |

Country pages display the band prominently: e.g. "CI 72 — Strong (B)." Within a band, countries are sorted alphabetically or by region rather than by exact integer score. The exact integer remains available via the API for researchers who want it.

---

<a id="missing"></a>
## Section 7 · Missing data

Different countries have different data coverage. Civica enforces three rules to handle missing data without distorting the score:

- **Mandatory dimensions.** Democratic Quality and Rule of Law are required. If either is missing, no CI is published for that country — the page reads "Insufficient data for governance index" with an explanation of which dimensions are missing.
- **Partial CI.** If the mandatory dimensions are present but one of the others (Freedoms & Rights or Corruption Control) is missing, a partial CI is published — flagged visually, with the confidence interval widened by 20% to reflect the added uncertainty.
- **Complete CI.** All 4 dimensions present. No flag.

Re-proportioning weights to fill in missing data is explicitly avoided — that approach silently biases the scores of fragile states upward, since the dimensions most likely to be missing are the ones that would have scored lowest.

---

<a id="conditions"></a>
## Section 8 · Civica Conditions

Human development, security, and economic stability are **not part of the Civica Index headline score**. They are essential context for understanding a country, but they measure something different — material conditions, shaped by governance but also by geography, economy, and external factors.

Civica publishes these as the **Civica Conditions** companion layer at [/civica-conditions](https://civicaatlas.org/civica-conditions). Each Conditions dimension is shown separately on country pages — never merged into a single number, and never combined with the CI.

| Conditions dimension | Source |
|---|---|
| Human Development | UNDP Human Development Index |
| Peace & Security | Institute for Economics and Peace, Global Peace Index |
| Economic Stability | World Bank composite (inflation, unemployment, GDP growth) |

The contrast between CI and Conditions is itself informative. A poor, well-governed democracy like Botswana shows a strong CI alongside moderate Conditions. A wealthy autocracy like the UAE shows the inverse. Reading the two together tells a fuller story than either could alone.

---

<a id="gov-type"></a>
## Section 9 · Government type

Government type is descriptive metadata, not a scoring signal. It does not enter the CI calculation in any form. Constitutional monarchies are not awarded points for being constitutional monarchies; presidential republics are not penalized for being presidential republics. The score measures governance quality directly, regardless of the constitutional shell that produces it.

Empirical observation about how governance scores vary by government type is published as a separate analysis at [/civica-index/government-types](https://civicaatlas.org/civica-index/government-types) — average CI per type, distribution spread, twenty-year trajectories. The data is presented as observation, never as ranking.

How Civica chooses peer sets for ranking comparisons — different lenses for material vs governance vs descriptive comparisons — is documented in [the peer-grouping methodology page](https://civicaatlas.org/civica-index/methodology/peer-grouping). That page replaces the retired `structural_family` heuristic per the 2026-05-02 peer-grouping resolution.

---

<a id="pulse"></a>
## Section 10 · Civica Pulse (Beta)

The Civica Pulse is the real-time, event-sensitive layer that sits on top of the structural CI. It publishes **dimensional deltas** — separate impact values on each CI dimension — driven by classified events from specialist feeds (ACLED, CIVICUS, RSF alerts, V-Dem pulse, HRW / Amnesty) corroborated by general news. Decay is category-specific: a coup persists for a year; a journalist arrest decays in two months. Positive events require stronger corroboration than negative events to resist gaming.

The Pulse is currently a clearly labelled *Beta* — experimental, not yet citable as authoritative. Its methodology is documented in detail at [/civica-index/methodology/pulse](https://civicaatlas.org/civica-index/methodology/pulse). That page is the sister document to this one and should be read alongside. The full event feed is at [/civica-index/pulse-changelog](https://civicaatlas.org/civica-index/pulse-changelog).

---

<a id="vintages"></a>
## Section 11 · Update frequency & vintages

The Civica Index updates **quarterly** — March, June, September, December — to align with source publication cycles and to avoid spurious between-quarter movement. Mid-quarter source releases are staged for the next quarterly publication. Only the Pulse moves daily.

To reconcile citation stability with longitudinal comparability, every score is preserved in two parallel historical series:

- **As-published vintages.** Every quarterly snapshot is preserved permanently. Cited values like "Civica Index 2026 Q3" resolve to that frozen value forever, regardless of how the methodology evolves afterward.
- **Harmonized back-cast.** Every country's historical CI is recomputed annually under the current methodology and published as a separate time series — for researchers who want apples-to-apples comparisons across years. Always clearly labelled as back-cast.

Both series are accessible via the API. See §13 for citation format.

---

<a id="limitations"></a>
## Section 12 · Limitations

**Source lag.** The CI is only as current as its slowest-updating source. Some upstream indices publish 12–18 months behind real-world developments. Quarterly updates partially smooth this, but the Pulse exists specifically to fill the gap between structural updates.

**Coverage gaps.** Some countries have insufficient source coverage to compute even a partial CI. Those pages display "Insufficient data" rather than guess. The list is published in the replication package.

**Construct narrowing.** By design, the CI measures governing institutions only. If a reader wants to ask "is this country a good place to live?" — a different and broader question — the CI alone does not answer that. Read it together with [Civica Conditions](https://civicaatlas.org/civica-conditions).

**PCA panel underpowered.** The PCA in §4 was run on n = 46 countries from a single year (2023). Final weights will be re-validated when the historical panel is ingested. The structural decision (4-dim core, near-equal weights) is unlikely to change because the underlying correlation structure is well-documented in the literature, but precise magnitudes might shift.

---

<a id="citation"></a>
## Section 13 · Citation

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
GET /api/v1/pulse/{country_slug}              (Beta — see Pulse spec)
GET /api/v1/pulse/changelog                   (Beta)
```

Every CI API response includes a `meta.methodology` block describing the methodology revision date and the Beta status — so machine consumers can detect the development phase programmatically.

### 13.2 · Disputes & corrections

Every score is open to dispute. Submit data-error corrections, methodology disagreements, or Pulse event misclassifications at [/civica-index/corrections](https://civicaatlas.org/civica-index/corrections). Resolution targets: 7 days initial response, 30 days full disposition (mirrored from `state.disputeSla` in `src/lib/content/site-state.ts`). Every dispute and outcome is logged publicly.

### 13.3 · Replication

Full codebook, processing logic, source references, and downloadable derived outputs at [/civica-index/replication](https://civicaatlas.org/civica-index/replication).

---

<a id="versioning"></a>
## Section 14 · Versioning

| Status | Last revision | Cut-over target | Quarterly update |
|---|---|---|---|
| Beta | Apr 2026 | Sept 30, 2026 | Mar / Jun / Sep / Dec |

The methodology is versioned: every change to weights, sources, or formulas creates a new methodology snapshot. Vintages — the actual published scores — are frozen against the methodology that produced them. Cited values resolve to the original score under its original methodology, regardless of how the methodology evolves afterward.

<!-- Dynamic content: revision history from DB — rendered as a list of dated snapshots with notes when the DB is seeded -->
