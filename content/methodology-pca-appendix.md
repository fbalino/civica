<!--
  Phase 6+1 amendment (post-Phase-6 follow-up, 2026-05-06): this file
  is the prose source of truth for /civica-index/methodology/pca-
  appendix. The TSX shell at
  src/app/(reader)/civica-index/methodology/pca-appendix/page.tsx
  wraps it via multiple <MarkdownContent slice> invocations.

  The PCA appendix wasn't in the original Phase 5 audit because no
  content/*.md mirror existed for it; this migration adds the file
  retroactively under the same Phase 5 templating discipline. See
  ~/civica/plan/content-templating-implementation-v1.md §11 for the
  amendment record.

  TSX shell handles, NOT markdown:
    - H1, page-meta line, abstract pull-quote
    - Section 1 (Headline finding): prose lead-in + dimensions
      weights table (rendered from civicaIndex.dimensions +
      LOADINGS array of frozen analysis output)
    - Section 3 (Correlation matrix): 4×4 table from CORRELATIONS
    - Section 4 (Eigenvalues + scree): EIGENVALUES table +
      <EigenvalueChart> SVG (replaces the prior <img> reference)
    - Section 5 (PC loadings): 4×4 table from LOADINGS
    - Cite section (CiteAccordion)

  THIS file carries:
    - Section 2 (The panel) — prose-only
    - Section 6 (5th-dimension test) — prose-only
    - Section 7 (Limitations) — prose-only
    - Section 8 (Reproducing this analysis) — prose + bullet list

  Each section uses the numbered-section convention
  `## Section N · <Title> {#anchor}` per the CI methodology page
  precedent. Anchors match the TSX SECTIONS array.

  Substitution markers:
    {{state.X}}                 typed config from site-state.ts
                                (civicaIndex.{dimensionCount, pca.*})
    {{ctx.X}}                   pre-computed helpers from the TSX
                                shell

  Validate with: npm run validate:content-templates
-->

## Section 2 · The panel {#data}

**n = {{state.civicaIndex.pca.panelSize}} countries** with all {{state.civicaIndex.dimensionCount}} governance dimensions present. Data vintage: {{state.civicaIndex.pca.dataVintage}} (the most recent year fully ingested into Civica). Source: `ci_dimension_scores` table, normalized via the Beta fixed-bound transforms documented in the [main methodology](/civica-index/methodology#normalization).

The countries are not a random sample — they are the ingested set, weighted toward larger democracies and authoritarian states with active governance research coverage. Coverage is sparser in small island states and in microstates. This is a known limitation of the panel and does not change the conclusion that the {{state.civicaIndex.dimensionCount}} indicators are highly correlated, but it does mean the absolute magnitude of the loadings might shift slightly with a broader sample.

## Section 6 · The 5th-dimension test {#five-dim}

The methodology spec considers adding a fifth dimension — *Administrative Capacity*, drawn from World Bank WGI Government Effectiveness and Regulatory Quality — if and only if it emerges as empirically distinct from Rule of Law in factor analysis.

**This phase does not test that question.** The WGI Government Effectiveness indicator is not yet ingested into Civica. The high correlation between Rule of Law and Corruption Control (r = {{ctx.corrHigh}}) hints that adding a related governance-quality indicator might simply load on the same factor as Rule of Law — but that's a hypothesis, not a finding. The test is deferred to a follow-up phase (after the indicator is ingested), at which point this appendix will be re-run and, if warranted, the methodology updated.

## Section 7 · Limitations {#limitations}

**Sample size.** The methodology spec envisions a panel of 2000–2024 country-years (thousands of observations). The current panel is {{state.civicaIndex.pca.panelSize}} countries from a single year and is underpowered for a stable cross-time weighting claim. The weights must be recomputed and compared when the historical panel is ingested; the current result does not establish that the same structure will hold across years or broader country coverage.

**Single-year panel.** A cross-sectional PCA captures shared variance at one moment in time. It does not test whether the same factor structure holds over decades. The historical panel will address this.

**Source coverage.** The {{state.civicaIndex.pca.panelSize}} countries with all {{state.civicaIndex.dimensionCount}} dimensions are skewed toward larger states and active governance-research targets. Microstates and small island states are under-represented. The PCA findings should be understood as describing "the kinds of countries we currently have data for."

**No source-substitution sensitivity test.** The spec calls for swapping each primary source with its secondary (e.g., V-Dem Liberal Democracy → V-Dem Polyarchy) and confirming rank stability. This requires the secondary sources to be ingested in parallel. Deferred to the same follow-up.

## Section 8 · Reproducing this analysis {#reproduction}

The full Python pipeline that produced these numbers is checked into the repository at `analysis/phase-5-3/run_pca.py`. It pulls directly from the production database, applies the same fixed-bound normalization documented in the main methodology, runs PCA via scikit-learn, and writes:

- `eigenvalues.csv` — the table in §4
- `loadings_pca.csv` — the table in §5
- `correlations.csv` — the matrix in §3
- `results.json` — machine-readable summary including the suggested weights

The figure in §4 is now rendered as an inline SVG (`src/components/methodology/EigenvalueChart.tsx`) sourced from the same `eigenvalues.csv` file, replacing the prior prerendered PNG.

To re-run the analysis on updated data: `cd analysis/phase-5-3 && uv run python run_pca.py`. The Python environment is managed by [uv](https://docs.astral.sh/uv/) and the lockfile is committed for reproducibility.
