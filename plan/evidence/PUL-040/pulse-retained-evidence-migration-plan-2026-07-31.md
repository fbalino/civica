# Migration plan — retained publisher evidence gate

No database migration or historical row rewrite is required. New classifier and
subject-attribution responses must include exact retained evidence quotes.
Existing retained events remain historical evidence; this change governs new
automatic publication decisions.

Before release:

1. Regenerate and validate the checked Pulse runtime contract.
2. Run the retained-evidence, jurisdiction-attribution, agreement,
   classification-state, claims, and Index change-control gates.
3. Run the scan fixtures and confirm they remain unpublished without contacting
   a model provider.
4. Use a later authorized shadow run to measure parse, abstention, retry, and
   review rates before enabling the changed provider response contract in
   production.

Rollback means reverting the code and appending a new change-control record;
the append-only v55 record and historical evidence are never rewritten.

