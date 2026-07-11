# Reproduction and verification

Run from the repository root with the Node/npm versions recorded in `manifest.v1.json`:

```sh
npm run reproduce:governance-evidence-review-packet
npm run validate:governance-evidence-review-packet
```

Expected result: The generated manifest, inventory, codebook, questions, citation, and checksums match byte-for-byte; dashboard fixtures pass 970/970 cells.

The workflow validates the rights-safe 970-cell dashboard fixture and every referenced tournament artifact. It does not download or republish restricted publisher values. Exact observations remain at `private_neon_ci_research_panel_rows` or at the publisher URLs named in the selected-input manifest. Citation is not a reuse grant.
