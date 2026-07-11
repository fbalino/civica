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

The countries are not a random sample. They are the ingested set, weighted toward larger states and places with more governance-research coverage. Small island states and microstates are under-represented. The correlations and loadings below describe these {{state.civicaIndex.pca.panelSize}} observations only; their magnitude and factor structure cannot be generalized to broader coverage from this run.

## Section 6 · The 5th-dimension test {#five-dim}

An earlier methodology proposal considered a fifth dimension, *Administrative Capacity*, using World Bank WGI Government Effectiveness and Regulatory Quality.

**The n={{state.civicaIndex.pca.panelSize}} run did not include either proposed indicator, so it provides no fifth-dimension result.** No public Civica claim says Administrative Capacity is distinct from, or reducible to, Rule of Law. A future test would require a frozen five-indicator panel, a declared factor/rotation method, and a new versioned analysis.

## Section 7 · Limitations {#limitations}

**Sample size.** This weight-derivation run contains {{state.civicaIndex.pca.panelSize}} countries from one 2023 cross-section. It does not support a stable cross-time weighting claim or a population-wide factor claim.

**Later temporal evidence.** Civica subsequently ran a frozen multi-year analysis. It found a strong common component across country levels and a materially weaker one within countries and across annual changes. The defensible claim is narrower: the four publisher ratings share considerable cross-country level variation, while yearly movement does not behave as one dominant change factor. See the [versioned dimensionality summary](/civica-index/methodology#weights).

**Source coverage.** The {{state.civicaIndex.pca.panelSize}} countries with all {{state.civicaIndex.dimensionCount}} dimensions are skewed toward larger states and active governance-research targets. Microstates and small island states are under-represented. The PCA findings should be understood as describing "the kinds of countries we currently have data for."

**No five-variable rotation.** The old run contains four inputs, so rotation cannot answer the proposed Administrative Capacity question. The later four-input temporal PCA also cannot substitute for that unrun test.

See the site-wide [known-limitations policy](/policies#known-limitations) for how this section relates to every other Civica research artifact, and the [versioning policy](/policies#versioning) for how a re-run of this analysis would be published.

## Section 8 · Reproducing this analysis {#reproduction}

The full Python pipeline that produced these numbers is checked into the repository at `analysis/phase-5-3/run_pca.py`. It pulls directly from the production database, applies the same fixed-bound normalization documented in the main methodology, runs PCA via scikit-learn, and writes:

- `eigenvalues.csv` — the table in §4
- `loadings_pca.csv` — the table in §5
- `correlations.csv` — the matrix in §3
- `results.json` — machine-readable summary including the suggested weights

The figure in §4 is now rendered as an inline SVG (`src/components/methodology/EigenvalueChart.tsx`) sourced from the same `eigenvalues.csv` file, replacing the prior prerendered PNG.

To reproduce the historical run against its original database extract: `cd analysis/phase-5-3 && uv run python run_pca.py`. Running the script against today&rsquo;s database would be a new analysis and must not overwrite this record. The separate temporal analysis is reproduced with `npm run validate:index-dimensionality`.
