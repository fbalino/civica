# ATL-009 audit-scaffold verification

Verified on 2026-07-12 against the configured live database without writes.

```text
npx tsx scripts/validate-constitution-search-corpus.ts

featureState: not_applied
documents: 186
jurisdictions: 186
structured sections: 96,127
topic excerpts: 30,537
topic keys: 329
sovereign coverage: 183/194 (94.3%)
statement provenance: 20 present / 166 absent
source hashes: 0
stale statement URLs: 2
generated anchor collision groups: 0
failures: 0
```

Focused static validation also passed:

```text
npx eslint scripts/validate-constitution-search-corpus.ts
git diff --check
```

The validator found only the existing primary-key and topic/jurisdiction
excerpt indexes. `public.constitution_search_passages` does not exist. This is
the expected pre-implementation boundary, not ATL-009 completion evidence.
