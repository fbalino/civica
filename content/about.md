<!--
  Phase 5 (content templating, runtime) — 2026-05-06: this file is now
  the source of truth for /about. The TSX shell at
  src/app/about/page.tsx wraps it via <MarkdownContent>.

  IMPORTANT — only the prose sections live here. The "What we do"
  3-card grid (Country Profiles / Civica Index / Civica Pulse), the DB-driven
  data-sources grid populated from getAllSources(), and the
  source-dot provenance legend stay in TSX. Edit those there. Edit
  prose HERE.

  Substitution markers:
    {{state.X}}                 typed config from site-state.ts
    {{stats.X | "fallback"}}    live counters from getSiteStats()
                                (about doesn't currently use any)

  Heading anchors are explicit via the `{#anchor}` token —
  see src/lib/content/markdown/remark-civica-anchors.ts.

  Validate with: npm run validate:content-templates

  Registry markers (kept in this stripped authoring banner):
  PUBLIC_CLAIM: about.atlas-positioning
  PUBLIC_CLAIM: about.provenance-coverage
-->

Civica Atlas is a provenance-first comparative reference to how every country is governed. It brings country profiles, political institutions, constitutions, elections, and source-linked facts into one browsable atlas.

The atlas is the primary product. Civica's original Index and Pulse outputs are secondary research experiments: they remain beta while their constructs, methods, sensitivity, incremental value, and failure modes are tested. The project publishes its methods and aims to expose source disagreement rather than hiding it, without claiming that every value is already reconciled or independently reviewed.

## How it works {#how-it-works}

The data pipeline has three layers, each addressing a known failure mode in single-source reference works.

**Sync orchestrators (one per source).** A dedicated module per upstream publisher pulls fresh data on a documented cadence and writes into the canonical `country_facts` table with statement-level provenance.

**Reconciliation resolver.** When two or more sources publish a value for the same country and fact-key, the resolver picks a canonical based on freshness rules, editorial assertions, and forecast-vs-measurement distinctions. When sources disagree by more than a configurable threshold, it creates a dispute record routed to human review rather than silently picking.

**Reader surfaces.** Country pages consume the resolver for supported fact keys. Values backed by a canonical resolver record can render a *FactValueDot* — a small chevron that opens a panel showing the selected source, available alternatives, freshness dates, and licenses. Coverage is incomplete and will be published explicitly rather than implied to be universal.

For a plain-English walkthrough, see [How we approach data](/methodology/approach). For the deep technical specification, see [Methodology — Reconciliation](/country/methodology/reconciliation).

## Methodology {#methodology}

Civica maintains versioned methodology records for load-bearing research and reconciliation decisions. Published pages currently cover composite scoring (the Civica Index), event classification (the Civica Pulse), peer grouping (the V-Dem RoW + World Bank region/income lens architecture), reconciliation rules, forecast-vs-measurement, and regime classification. Documentation does not substitute for independent review.

Browse the full set at [/methodology](/methodology).

## Standing posture {#standing-posture}

Civica's approach is shaped by the institutions and data publishers it cites. Our World in Data is an important reference for transparent public-data presentation. V-Dem supplies a widely used comparative-politics regime classification. The World Bank, IMF, UN agencies, OECD, and other established publishers form the backbone of the data layer.

We are not these institutions. We do not have their funding, their staff, their decades of accumulated trust, or their formal review processes. Civica instead keeps versioned methodology records, labels novel work as beta, and aims to surface disagreement rather than hiding it.

## Language scope {#language}

Civica Atlas has an English interface and English editorial copy. It does not currently offer a translated interface. Upstream names or passages can appear in another language when a source-form record is retained; those strings are displayed in their recorded form and are not a Civica translation unless a visible label explicitly says so.

Entity-name records distinguish English display, source, native, official, and transliterated forms only when the source supplies enough evidence to identify the language, script, role, source, vintage, and translation or transliteration status. Missing name-form metadata remains missing rather than being inferred from spelling or script. Constitution search currently covers the English-language version supplied by Constitute Project; its original-language and translation status remain unknown and are labelled that way.

## Access and reuse {#open-and-free}

Civica Atlas is free to access without an account. The repository is publicly viewable on GitHub, but its root license records a non-open, all-rights-reserved code posture and grants no general right to copy, modify, redistribute, or build derivative services. Public-domain (CIA Factbook archive) and CC0 (Wikidata) source data is generally reusable; other sources carry non-commercial or publisher-specific terms. Per-source licenses are preserved where disclosed on reader surfaces, but that coverage is not yet complete everywhere. See [Licensing](/licensing#reuse) for the current code, notice, and source-by-source posture. If you are an academic interested in reviewing the methodology, citing the data, or collaborating on extensions, please [get in touch](/contact). External review is an explicit goal of the project, not a hypothetical.

Country and territory hero images are AI-assisted editorial illustrations, not photographs; see the [imagery policy](/licensing#imagery) for tools, records, review, and reuse rights.

## Use of models and agents {#ai-use}

This disclosure follows `civica-ai-use-disclosure/v1`. Models and agents assist with several parts of Civica; Fernando Balino remains responsible for what the project publishes.

**Code, planning, and internal audits.** OpenAI Codex and Anthropic Claude/Claude Code have drafted code and documentation, inspected the repository, run tests, researched candidates, and criticized methods. Fable 5 is used for consequential design choices. These systems can find defects and propose changes. Their work stays subject to version control, tests, data and claims checks, and human acceptance. Agent agreement is not independent peer review or academic validation. Historical sessions do not all have complete model/version transcripts, and missing session metadata is left unknown.

**Production research systems.** Pulse currently uses DeepSeek V4 Flash, GLM 4.7, and Claude Haiku 4.5 as cross-vendor classification voters. A separate Claude Haiku 4.5 pass supplies an adversarial verification signal, and Claude Sonnet 4.6 handles jurisdiction attribution. Model agreement does not establish truth; Pulse remains experimental while prospective, method-matched human evaluation is pending. Two GPT-5.3 Codex Spark dry runs tested the independent-coding instructions and workspace. Their labels are diagnostic, permanently non-gold, and cannot measure human reliability or validity. Claude Haiku 4.5 also supports bounded summaries and selected structured extraction; generated output retains the evidentiary standing of its validated pipeline.

**Reader assistance.** Ask Civica uses Claude Sonnet 4.6 to generate answers from supplied site context. Those answers are not canonical facts, citations, corrections, or research results.

**Prose and illustrations.** Codex and Claude have assisted with drafts and audits of blog, product, policy, and methodology text. The historical corpus does not have sentence-level model attribution. Country, territory, and editorial engravings use Codex-driven image generation; the launch corpus lacks complete prompt, reference-image, and model-version records. The [imagery policy](/licensing#imagery) explains that limitation and the correction route. Fernando is the named author because authorship records human responsibility; tools are disclosed as assistance and are not authors.

The machine-readable [AI-use record](https://github.com/fbalino/civica/blob/main/data/research/ai-use-disclosure-v1.json) lists each material role, system, control, and limitation. It is updated when a production model, provider, role, publication boundary, or record-retention policy changes.
