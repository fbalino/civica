# Pulse jurisdiction attribution v2

Status: adopted implementation contract for PUL-012.

## Unit and roles

One subject-attribution decision may name one primary jurisdiction and zero or
more additional affected jurisdictions. The primary jurisdiction is the event
projection used by current country pages and experimental scoring. An affected
jurisdiction is materially implicated by the same occurrence but is not
silently scored as though the event were primarily domestic there.

Every named jurisdiction carries its role, canonical name, ISO3, exact Civica
jurisdiction id, a short rationale, evidence references, and the entity snapshot
used at decision time. No model-produced country name is accepted without
resolution against the versioned Civica entity catalog.

## Versioned input

The attribution pass uses `pulse-jurisdiction-entities/v1` and
`pulse-jurisdiction-aliases/v1`. The catalog is built deterministically from the
closed Civica jurisdiction registry plus the checked alias registry. Every
decision stores the catalog hash and each resolved entity snapshot, so later
renames or alias changes cannot rewrite the historical input.

The prompt receives a human-readable provisional jurisdiction and any
human-readable country/entity candidates found in the retained evidence. The
internal UUID is never the only country context shown to the classifier.

## Abstention and publication

Supranational, unclear, unresolvable, and genuinely multi-jurisdiction cases
without a defensible primary jurisdiction remain unresolved and cannot
auto-publish. The provisional ingest guess may remain in the compatibility event
row, but it is not a supported subject decision. Resolved cross-border cases may
publish only when one primary jurisdiction and every affected jurisdiction
resolve to the catalog.

## Projection and public reading

The append-only decision ledger is authoritative. A normalized append-only
jurisdiction relation makes primary and affected roles queryable and preserves
per-jurisdiction rationale. The event row remains a current primary projection.
Country event APIs may include an event for either role and must state the
requested jurisdiction's role; only the primary role is eligible for the current
experimental numeric projection.

## Validation boundary

Cross-border fixtures must cover a bilateral institutional action, a shared
cross-border occurrence with a primary subject, an unresolvable multi-country
case, alias resolution, unknown ISO3 rejection, and disagreement between the
provisional guess and the supported primary subject. Passing fixtures establish
contract behavior, not attribution accuracy. Representative accuracy remains a
later evaluation gate.
