# PLT-012 protected Index API release note

The protected Civica Index API routes now validate every query and path value through closed, bounded schemas before database work. Undocumented keys, duplicate scalar values, malformed encoding, and invalid or out-of-range values receive a fixed noncacheable error. Successful and deprecated Index response envelopes are unchanged.

Error responses now carry stable machine codes and never include exception, provider, database, or validation-library detail. Public response projection is explicit, so future internal columns cannot silently enter an Index response through object spreading.

This is an operational presentation-contract change only. No Index input, transform, model, missingness rule, uncertainty rule, score, band, rank, or research row changes. The Index product-contract label advances to `civica-index-route-io-contract-v31` solely to preserve the append-only presentation audit trail.
