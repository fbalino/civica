# DAT-035 frozen release-identity reconciliation

The regenerated `ci-beta-2024-Q4` source-input manifest is the immutable
input referenced by the three checked Index reproduction manifests. Its byte
hash changed solely because PLT-023's exact adapter implementation hash is
part of the manifest. The release registry must therefore bind the current
manifest bytes: `10fbdb56f5b579c6578786ed937b022be06142415d83fe274a171e93196e3434`.

This is an `input` change-control category because it updates a frozen input
identity, even though the underlying publisher bytes, source artifact hashes,
retrieval times, methodology, dimension rows, composite rows, ranks, and
scores are unchanged. The release-consistency validator checks all three
reproduction manifests against this exact identity.
