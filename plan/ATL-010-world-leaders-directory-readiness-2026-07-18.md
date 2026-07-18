# ATL-010 — World leaders directory readiness

**Status:** blocked on a source/tenure contract; no public directory is being
published from the present rows.

## Scope tested

The proposed directory is a sovereign-state list of current principal offices
(`head_of_state` and `head_of_government`). An entry must carry a source-backed
office, person, and tenure start date; each displayed source must retain its
retrieval time and URL.

## Read-only evidence (2026-07-18)

A read-only live query found:

- 308 current source-backed principal-office terms;
- 289 with a tenure start date and 19 without one;
- 181 jurisdictions with at least one dated principal term;
- no term statement whose predicate records `acting`, `interim`, `caretaker`,
  temporary, or co-leadership status.

The current `terms` table contains `is_current` but no sourced role-status or
ambiguity field. The officeholder writer also retains one current term per
office, so it cannot represent simultaneous co-holders. A current-term row is
therefore not evidence that the holder is permanent, sole, or uncontested.

The inspected snapshot also contains stale-looking current terms despite a
recent source retrieval. That is a data-quality signal to investigate, not a
reason to convert the data into a public claim.

## Why ATL-010 remains unchecked

Publishing a searchable page now would satisfy its visual mechanics while
failing its truth conditions: it would make unsourced tenure dates disappear,
and would silently convert unknown acting/interim/co-leadership state into a
normal incumbent label. A generic disclaimer cannot make an unknown state
correct.

## Required completion path

1. Adopt a versioned leadership-term contract that stores an explicit sourced
   status (`confirmed`, `acting`, `interim`, `caretaker`, `co_leader`, or
   `unknown`) plus source URL, retrieval time, and ambiguity note.
2. Replace the single-current-term writer invariant where a source documents
   co-leadership, retaining each source record and its release/vintage.
3. Run an audited source refresh and preserve a release query whose count is
   the directory's displayed count. Rows without a verified tenure date remain
   visible only as an explicit incomplete-record state, or outside the dated
   directory.
4. Build the reader directory from that release query with search, filters,
   sort controls, country-profile links, source/vintage disclosure, and a
   portrait fallback that never changes data availability semantics.

## Evidence

The count and status-predicate checks were executed read-only against the
configured database on 2026-07-18. No source sync, migration, or production
database write was run for this assessment.
