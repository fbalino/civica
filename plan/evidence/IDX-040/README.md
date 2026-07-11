# IDX-040 evidence — longitudinal labels and revision vintages

`ci-longitudinal-validation-labels-2000-2022-v2` freezes 4,357 observed and 105 explicitly missing BR/CGV democracy-state labels across a 4,462-cell sovereign-state grid. The exact QoG Jan26 time-series SHA-256 is `f8e140b706106e211460db54cf094de0d36eae0003e81c0f01c9427d0f756de0`.

Revision sensitivity is pinned to official QoG Jan24, Jan25, and Jan26 time-series editions and V-Dem Core v14/v15 archives, each with exact URL and SHA-256. Values stay private under the academic/noncommercial posture.

The first attempted release accepted only literal `0/1`, while QoG serializes `0.0/1.0`; it therefore froze zero observed labels. That v1 release remains immutable failed-ingestion evidence. V2 corrects the parser without rewriting history and has row hash `1a4e1cc444f18ce0f61d373dc8dfc601cad22f5e74b209f57d97bb7232a022ec`.

`npm run validate:longitudinal-validation-inputs` confirms exact coverage, hashes, live database closure, failed-v1 preservation, and completed-release immutability. No label was used to tune K1.
