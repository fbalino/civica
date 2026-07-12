# ATL-006 migration plan

This is an additive presentation and read-contract migration over the adopted
DAT-004 storage taxonomy. It requires no schema or production-data write.

1. Use `getAllReferenceJurisdictions()` for identity discovery surfaces.
2. Retain `getAllJurisdictions()` as the closed sovereign-state analytical
   universe; never infer scope from route presence or an ISO code.
3. Build every public status object through the fail-closed shared presenter.
4. Add the status object to APIs, JSON/CSV exports, metadata, Compare, and map
   hover state; make Atlas map scope explicit rather than widening overlapping
   map geometry.
5. Roll back by reverting the ATL-006 commit. No stored row or migration needs
   compensation.
