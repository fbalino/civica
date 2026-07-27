# PUL-037 — versioned event absorption evidence

Verified on 2026-07-12.

The former decoupling pass selected every earlier published event in a
country/dimension after an aggregate Index movement and set its corroboration
confidence to zero. A later corroboration run could restore the value. That
path is removed.

`pulse-event-absorption/v1` now records an append-only decision for one exact
event. Absorption requires sequential closed Index releases on the same fixed
scale and dimension source identity, a confirmed event link with evidence and
method, threshold-sized movement in the event's direction, and an as-of date.
Model-only candidates cannot confirm a link.

Scoring reads the latest retained absorption decision separately. An absorbed
event receives a zero multiplier without changing its corroboration weight.
Corroboration has no write path to the absorption table. Reversals append and
supersede rather than overwriting history.

The current Index registry contains same-period 2024-Q4 harmonized backcasts,
so no release pair qualifies. Production holds zero absorption decisions and
zero absorbed events. The current score run retains 325 projection rows and
1,300 immutable outputs across four runs.

See [migration-plan.md](migration-plan.md) and
[verification.md](verification.md). The full method note is
[pulse-event-absorption-v1.md](../../research/pulse-event-absorption-v1.md).
