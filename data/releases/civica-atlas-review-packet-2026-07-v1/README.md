# Civica Atlas external data-curation review packet

This versioned wrapper binds the frozen G2 Atlas release candidate to its codebook, complete schema dictionary, rights and source-input manifests, checksums, clean-room evidence, coverage and quality reports, limitations, citation metadata, correction policy, and bounded review questions.

Status: ready for independent review, not endorsed. No review has yet occurred.

Run from the repository root:

```sh
npm run validate:atlas-review-packet
npm run validate:g2-atlas
npm run validate:clean-room
```

The manifest contains exact repository-relative paths, byte counts, and SHA-256 hashes. The frozen archive remains at `data/releases/atlas-2026-07-11-g2-rc1.zip`; restricted publisher payloads are not added to this wrapper.

Semantic SHA-256: `8f9550adab6efb8e9217c330b50001b4251b086f2e49418e43ce89898d03d6d0`.
