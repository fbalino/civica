# BRD-002 — official registry search and professional-review notes

**Status:** Complete as an agent-prepared search packet
**Search date:** 2026-07-23
**Snapshot contract:** `brand-registry-search/v1`

## Outcome

The official-record packet documents:

- the project/service description used for searching;
- priority jurisdictions and Nice classes;
- exact and variant search strings;
- dated UKIPO, WIPO Madrid Monitor, UK Companies House, and RDAP results;
- official US, EU, WIPO Global Brand Database, and Uruguay search-access
  limitations;
- bounded record extracts and capture hashes; and
- exact questions for professional review.

The packet is not a clearance opinion. A result set can be incomplete because
of figurative marks, translations, transliterations, common-law rights,
pending/unpublished applications, registry indexing, and technical access
limits.

## Files

- `official-registry-records-2026-07-23.md` — human-readable search protocol,
  record archive, limitations, and counsel queue.
- `official-registry-snapshot.v1.json` — machine-readable bounded facts,
  source URLs, retrieval dates, and capture hashes.
- `plan/research/brand-confusion-landscape-2026-07-23.md` — BRD-001 synthesis.
- `plan/MANUAL-CHECKS.md` — BRD-003 owner/counsel handoff.

## Completed official records

- UKIPO exact `CIVICA` word mark, **UK00002285308**, registered in classes
  9, 16, 35, 41, and 42.
- UKIPO Civica UK Limited owner result: 14 marks, including exact and compound
  `CIVICA` marks.
- UKIPO `civica digital`, **UK00003201410**, registered in classes 9, 35, 38,
  41, 42, and 45.
- WIPO Madrid Monitor `CIVICA ideas into action`, **1560925**, active and
  designated in Australia, Canada, Ireland, New Zealand, Singapore, and the
  United States.
- UK Companies House **01628868**, CIVICA UK LIMITED, active.
- Official RDAP observations for `civica.com` and `civicaatlas.org`.

## Access limitations retained, not papered over

- USPTO Trademark Search and TSDR landing pages were accessible, but automated
  record retrieval returned an API-key notice and interactive result capture
  did not yield a durable official result set.
- EUIPO eSearch was identified and attempted, but no durable result record was
  retrievable through the approved contact-free workflow.
- WIPO Global Brand Database presented a bot challenge. Known-record access
  through official Madrid Monitor worked and is archived.
- Uruguay DNPI’s official public-search service and PAMP endpoint were
  identified, but the interactive query result could not be archived through
  the approved workflow.

These limitations are explicit professional-review inputs. They are not
negative search results.

## Verification

```text
node -e "JSON.parse(require('fs').readFileSync(
  'plan/evidence/BRD-002/official-registry-snapshot.v1.json','utf8'))"
exit 0

node plan/tools/validate-master-plan.mjs
ok=true
```

BRD-003 remains open until counsel validates the unavailable/ambiguous
jurisdictions, analyzes confusion risk, and the owner records a disposition.
