# PUL-038 verification

## Official input

The private `.firecrawl/rsf-index-2026.csv` capture matched SHA-256
`65ec7bd9b9740e0f51e9b4eea585030b2226c1a96938ec06a4cbbdbd2639aae2`
and parsed as 180 unique publisher ISO rows. The dry-run planned 176 direct
matches and 75 explicit missing rows over 251 supported non-aggregate Civica
jurisdictions. The applied rows reproduce those counts.

## Database

- Authoritative ledger: 30/30
- Public tables: 76
- Release rows: 1
- Release coverage: 176 observed + 75 missing = 251
- Event pins: 384/384
- Invented missing scores/tiers: 0
- Event/pin jurisdiction, run, and classification-time mismatches: 0
- Information-context append-only/insert triggers: 4/4

## Automated checks

The task-specific suite covers official CSV parsing, decimal commas, duplicate
and invalid publisher rows, complete coverage, explicit missingness, stable pin
identity, provenance requirements, production no-effect, sensitivity-only
effects, idempotent corroboration, and malformed fixtures. Live validation
checks exact source hash/counts, complete values, one pin per event, no
invented values, lineage equality, trigger presence, and disabled rights/use
standing.

The authoritative migration chain replayed cleanly on PostgreSQL 17. Static
TypeScript, source-input manifest, production-adapter, rights, retention,
data-dictionary, runtime-method, claims, and full unit gates pass. The complete
production build and reader browser check are recorded before closure.
