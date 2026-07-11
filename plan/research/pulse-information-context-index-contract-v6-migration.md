# Pulse information-context shared-contract v6 transition

Clients of `/api/v1/pulse/:country_slug/dimensions` read the required top-level `informationEnvironmentContext` object. They must preserve `valueStatus: "missing"` and its null fields; they must not impute a score or tier. An observed object is usable only when every provenance and coverage field is present and the declared `useStatus` permits the intended use.

The public changelog exposes only `legacyInformationContextPresent` for historical rows. It does not expose the old unversioned scalar as current country context. Production corroboration applies no information-environment multiplier. Sensitivity tooling must opt in explicitly and must describe the result as an unvalidated scenario.
