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

Semantic SHA-256: `5a09283d9fbd16abf8517fd5959d77c2c86d74da79175d3d04d25e9faafa4cbb`.
