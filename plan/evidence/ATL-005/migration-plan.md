# ATL-005 migration plan

ATL-005 changes presentation and derived evidence reporting only. It requires
no database migration, data rewrite, background job, or API consumer action.

The deployment sequence is the normal application release: ship the new
country module and its checked Atlas surface-matrix artifact together. The
checked DAT-005 and DAT-006 artifacts remain the authoritative snapshot inputs;
the existing resolver query supplies the current agreement counts.

Rollback removes the Evidence Coverage module and restores the preceding
surface-matrix artifact. No stored observation, dispute, resolver decision, or
research output is mutated by either deployment or rollback.
