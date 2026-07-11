# Pulse jurisdiction-attribution shared-contract v8 transition

Clients that validate the Pulse runtime response must accept runtime schema
`1.7.0`, method `pulse-v2.8-beta`, and the expanded subject-provider contract.
Clients reading `/api/v1/pulse/{country_slug}/events` must accept the required
`subjectAttribution` object with standing, method/catalog/alias identity,
requested-jurisdiction role, primary row, and affected rows.

The additive database migration creates an append-only normalized role table.
New decisions materialize into it transactionally from the authoritative
decision payload. Existing events receive one explicit
`pulse-jurisdiction-attribution/legacy-projection-v1` primary row using their
stored event projection; no historical alias input, model rationale, or
multi-country judgment is invented.

Consumers must not apply an event's experimental numeric effect to an affected
jurisdiction. Affected means materially implicated by the documented occurrence,
not a second domestic classification or an independently validated effect.
