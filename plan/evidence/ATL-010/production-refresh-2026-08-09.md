# ATL-010 — authorized production officeholder refresh (2026-08-09/10 UTC)

Authority: `plan/evidence/QA-018/OWNER-SIGNOFF-2026-08-09.md` (named-release
Wikidata refresh). Named Atlas release: `atlas-wikidata-refresh-20260809-v1`.
Adapter: `scripts/sync-wikidata-officeholders.ts` →
`src/lib/factbook/officeholders-sync.ts` (rank-following resolver,
`wikidata-officeholder-sync/v1` history methodology).

## Run sequence and defects surfaced

1. **First apply attempt failed cleanly before any write.** The office
   history statement carried two parameters used only in `IS NULL`
   predicates; PostgreSQL over the Neon HTTP driver cannot type them
   (`42P18`). Explicit `::uuid`/`::integer`/`::text` casts were added in
   `src/lib/factbook/government-entity-history-writer.ts`; all three entity
   statement shapes were then probed against the live database and stopped at
   foreign keys (type analysis proven). One probe person row
   (`Q999999999999`, "Probe Person") was inserted and immediately deleted;
   the research-evidence retention ledger recorded both operations, and one
   stray append-only `atlas_entity_change_history` event with release id
   `type-probe` remains for the deleted person.
2. **Second apply completed but surfaced a jurisdiction-identity clobber.**
   The Wikidata sovereign-state feed includes historical states. "Russian
   Empire" (Q34266, short name "Russia") matched the current Russia row via
   the name fallback, stamped Q34266 over Russia's retained QID, and retired
   Putin/Mishustin as "unselected". Fixes:
   - the sovereign-state SPARQL query now excludes dissolved states
     (`FILTER NOT EXISTS { ?state wdt:P576 ?dissolved }`);
   - the sync now fails closed instead of rewriting a differing retained
     jurisdiction QID (identity corrections are deliberate repairs, never
     sync side effects);
   - Russia's QID was repaired to Q159 by a targeted evidenced update
     (retention trigger captured before/after state).
   - A bulk audit compared all 197 stored jurisdiction QIDs against
     Wikidata P297: Russia was the only wrong identity. Denmark's
     `Q756617` (Kingdom of Denmark) was reviewed and deliberately retained —
     it is the sovereign entity and its roster reconciles.
3. **Third apply is the accepted production run**: 197 source states synced,
   0 skipped, 0 further retirements, roster convergent. The prior accepted
   run had already retired 23 stale principal terms (Australia's Cosgrove-era
   rows among them) and written the enrichment set (343 real office titles,
   16 parties, 50 portraits, 24 birthdates; 654 rows). Freshness was stamped
   only through `markSourcesSynced("wikidata")` after committed writes.

## Source ambiguity retained, not hidden

Samoa's head of government has two un-ended normal-rank P6 claims upstream
(Fiamē Naomi Mataʻafa and Tuilaʻepa Saʻilele Malielegaoi; verified directly
against query.wikidata.org). The resolver fails closed, the previously
retained stale row is retired, and the role is published as explicit
noncoverage. The refresh-plan contract now distinguishes a disclosed
upstream-ambiguous exclusion (nothing published for the role) from a blocked
release; an ambiguous role with a retained current row still blocks.

## Release and audit state

- Recaptured zero-write audit (`production-refresh-plan.json`): 211 source
  bindings, 197 source states, 389 source-selected records, 389 retained
  records, **0 discrepancies**, 1 disclosed ambiguous role (Samoa HoG,
  nothing retained), 0 rows without source identity, `releaseReady: true`.
- Regenerated checked release `leaders-2026-08-10`
  (`data/leaders-directory-release.v1.json`): 389 records, 327 people,
  197 jurisdictions, `publicationStatus: "ready"`;
  `validate:leaders-directory:live` reproduces it exactly from the live
  query.
- `/leaders` activated: footer Explore column link and sitemap static route.
  The Explore megamenu is deliberately unchanged — the owner-approved
  EXP-015 composition has exactly eight art-backed destinations; adding a
  ninth requires owner-approved artwork.
