# PUL-036 — stored-run agreement and publication eligibility

Verified on 2026-07-12.

Pulse now derives classifier agreement from the exact classify votes retained
on each event. A qualifying panel contains at least two provider-distinct
votes and records the provider, model, prompt version, method version,
configuration hash, and configured panel size. Duplicate providers, mixed
versions, legacy evidence, and one-run results resolve to `none`.

Automatic publication requires a qualifying stored ensemble, the publication
gate, and a resolved primary jurisdiction. The subscription-agent path is
single-run and therefore always queues for review. Human approval remains a
separate publication authority and does not manufacture ensemble agreement.

The production repair examined 384 events. It cleared 355 unsupported
agreement labels, quarantined 191 automatic publications that lacked the
required stored evidence, and preserved 13 human-reviewed publications. The
second repair rehearsal found zero remaining changes. DAT-016 retention
records the prior and repaired projections.

The public runtime contract is `pulse-v2.13-beta`, with contract hash
`e4b3e0c2b51b99a0e49f31716c90d6fe9cd5df5a6d09d9138b54fe11640ee7b3`.
Pulse event, dimension, and changelog routes all publish Pulse-specific
methodology metadata. The changelog contract exposes the stored vote identity
needed to interpret agreement.

See [repair-plan.md](repair-plan.md) for the production data change and
[verification.md](verification.md) for the final gate results.
