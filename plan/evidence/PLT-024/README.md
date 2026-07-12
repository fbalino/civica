# PLT-024 — operational runbooks

Completed 2026-07-12. Runbooks live at `data/OPERATIONAL-RUNBOOKS.md`.

- Seven runbooks — upstream data-source breakage, bad release, compromised
  credential, model/provider outage, stale map/assets, legal takedown,
  incorrect country fact — each naming detection, containment, owner (Fernando
  Balino), rollback/correction, user communication, evidence preservation, and
  recovery verification. Every step references the actual mechanism
  (markSourcesSynced freshness, immutable vintages, the PLT-007 scanner + Neon
  rotation, PULSE_CLASSIFY_ENSEMBLE degradation, PMTiles/OpenFreeMap fallback,
  the BRD-015 complaint flow, DAT-029 quarantine + vintage supersession).
- A dated tabletop review records the real gaps rather than asserting
  readiness: the **live unrotated leaked Neon credential (#3)**, detection that
  still depends on unbuilt monitoring (PLT-017/018/020), pull-only user
  communication (no subscriber push, by design), manual rollback, and the
  counsel-gated legal path.

Doc-only; the master-plan integrity validator passes.
