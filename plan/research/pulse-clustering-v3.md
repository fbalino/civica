# Pulse clustering v3 resolution

**Status:** adopted for production clustering
**Method:** `pulse-cluster/normalized-global-union-find-v3`
**Event identity:** `pulse-event-identity/multilingual-v1`
**Runtime method:** `pulse-v2.2-beta`
**Date:** 2026-07-11

## Problem

The previous clustering pass divided new reports by the country guessed during ingest. Reports with no country were excluded. Reports about the same event could therefore remain separate when outlets used different languages or when the cheap country resolver disagreed. Later subject-country attribution could not repair a split that had already happened.

## Adopted method

The clustering pass now considers every unclustered report inside a bounded run. It normalizes Unicode, removes common function words, maps a small declared set of governance terms across several languages, and creates a deterministic report identity. Candidate pairs must fall inside a 48-hour window and meet either the multilingual embedding cosine threshold or the canonical-token Jaccard threshold. A shared non-generic anchor, an exact normalized match, or a stricter same-jurisdiction lexical match is also required.

The ingest-time jurisdiction remains attached to the evidence snapshot, but it does not partition clustering. Classification loads one row per cluster rather than one row per cluster and provisional jurisdiction. When several provisional jurisdictions exist, a deterministic majority with a lexical tie-break supplies context until the separate subject-country pass decides the event jurisdiction.

The semantic path uses `Xenova/paraphrase-multilingual-MiniLM-L12-v2`. Its [official model card](https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2), checked on 2026-07-11, describes a 384-dimensional sentence-transformer for clustering and semantic search across 50 languages. That description supports the implementation choice; it does not establish Pulse-specific clustering accuracy. When the embedding runtime is unavailable, the pipeline uses the normalized lexical path and records the run as partial.

## Error posture

The identity guard is intentionally conservative. Missing a duplicate is preferable to joining distinct institutional events without evidence. The fixture suite therefore includes two similar same-day Mexican court rulings with different state anchors and requires them to remain separate. It also requires English and Spanish reports of the same ruling, from different source families and with conflicting provisional countries, to merge.

This task does not claim that a recorded source family is editorially independent. Wire copies, common ownership, syndication, and mirrored reports remain PUL-007 work. Held-out pairwise and cluster-level accuracy remains PUL-023 work.

## Production release

The zero-write production audit examined the 203 reports that the old country-partitioned pass had left unclustered. It proposed 191 clusters. The bounded title sample showed repeated or closely paraphrased reports in the multi-member groups, including the same Myanmar house-arrest report and repeated Montenegro EU report. Applying the clustering stage assigned all 203 reports without classifying, publishing, or scoring them.

The frozen `/api/v1/pulse/cluster-coverage` release describes all retained stored clusters. It separates 915 legacy clusters from 191 v3 clusters by immutable stage identity and publishes cluster-size, source-ID, source-family, language, and provisional-jurisdiction distributions. Its standing is `descriptive_not_validation`.

## Falsification and revision

PUL-023 will test overmerge and undermerge performance on held-out gold pairs and events. Failure of its preregistered thresholds requires a new algorithm and identity version; thresholds or aliases may not be changed under the existing version. PUL-007 may add source-family and republication evidence, but it must not convert family labels into assumed independence.
