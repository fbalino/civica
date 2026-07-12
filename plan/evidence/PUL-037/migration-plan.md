# PUL-037 migration evidence

Verified on 2026-07-12.

The zero-write production plan for `0028_complex_carlie_cooper` found 4,867
Index dimension rows, 384 Pulse event rows, 68,614 retained history rows, and
no existing absorption table. It classified ten forward statements and zero
destructive statements.

The complete 29-file authoritative chain applied to a clean PostgreSQL 17
database. The result contained 73 public tables and exactly one append-only
trigger on `pulse_event_absorptions`. The production migration then applied as
the sole pending artifact and matched schema fingerprint
`fc08487405140b281d4f13055e12ae2edec78b6352f0a8c149c016aae7a4db31`.

The new table is empty because the current closed Index registry has no
sequential comparable release pair. The migration does not update events,
corroboration weights, decisions, or dimensional outputs. The checked
post-migration preflight covers 47/47 forward and operational artifacts with
zero writes.

Recovery uses an isolated pre-change backup or a reviewed forward
compensation. Absorption evidence rejects updates and deletes; a changed
judgment must append a superseding row.
