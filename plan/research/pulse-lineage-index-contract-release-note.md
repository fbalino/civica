# Pulse lineage API-contract release note

Date: 2026-07-11
Task: PUL-004
Change-control version: `civica-index-api-contract-pulse-lineage-v1`

The shared API schema and example registries now describe the immutable Pulse
pipeline-run identity returned by Pulse endpoints. This is a presentation-
contract change only. It does not alter any Civica Index input, transform,
weight, missing-data rule, uncertainty treatment, score, rank, or disposition.

Pulse responses identify the applicable methodology, ontology, pipeline,
algorithm, prompt, source basket, source IDs, provider/model set, and upstream
runs. A response containing more than one version identity is explicitly marked
as a mixed version set and cannot present itself as one comparable series.
