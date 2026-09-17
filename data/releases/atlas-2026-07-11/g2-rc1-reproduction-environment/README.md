# G2 RC1 reproduction environment

The adjacent `package-lock.json` preserves the exact dependency lock recorded by the frozen G2 RC1 `environment.v1.json`. Its bytes come from Git commit `c4f61d6abe2788c4ae5fc6e8b3f2924c7f29d4a8` and have SHA-256 `3dd23dfb35d626d88997f6198ad9631737897d59c520a3ede0d0b579bc33469c`.

This sidecar lets the release validator verify the historical environment after the application dependency lock changes. The frozen release directory, checksums, and archival ZIP remain unchanged.
