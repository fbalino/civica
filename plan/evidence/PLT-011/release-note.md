# PLT-011 protected Index API release note

The protected governance-evidence and Civica Index API routes now use the same durable rate-limit boundary as the rest of the public API. Requests are counted atomically in PostgreSQL across application instances using opaque HMAC subjects. Successful and deprecated Index response envelopes are unchanged.

Clients may now receive the documented shared `429` response when a budget is exhausted and a distinct fail-closed `503` response when the counter cannot be verified. This is an operational presentation-contract change only; no Index input, transform, model, score, band, rank, or research row changes.

The public API registry, API documentation, Terms surface, and closed rate-limit policy registry bind this behavior. The Index product-contract label advances to `civica-index-distributed-rate-limit-v30` solely to preserve the append-only presentation audit trail.
