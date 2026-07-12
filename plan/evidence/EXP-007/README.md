# EXP-007 — deterministic engraving grader

## Production interface

Single asset:

```sh
npm run grade:engravings -- --input path/to/original.webp --output path/to/preview.webp --mode preview
npm run grade:engravings -- --input path/to/original.webp --output path/to/final.webp --mode final
```

Manifest:

```json
{
  "contract": "civica-engraving-grade-manifest/v1",
  "entries": [
    { "input": "path/to/original.webp", "output": "path/to/preview.webp", "mode": "preview" },
    { "input": "path/to/original.webp", "output": "path/to/final.webp", "mode": "final" }
  ]
}
```

Run with `npm run grade:engravings -- --manifest path/to/manifest.json`.

## Guarantees and proof

- `civica-engraving-grade/1.0.0` applies the owner-approved strength-60 recipe.
- Source and result dimensions/aspect are identical; Sharp emits WebP without copying source metadata.
- Preview uses q72 and final q88, while color transformation parameters remain identical.
- Every output receives an adjacent `.grade.json` with recipe, hashes, geometry, mode, metadata policy, and before/after color metrics.
- An identical rerun returns `unchanged` after verifying the output hash. An output-sidecar beside an input makes the next grade fail, preventing cumulative processing.
- Conflicting output records fail unless a reviewer deliberately supplies `--force`; duplicate manifest outputs fail.
- `npm run validate:engraving-grader` passes three tests: exact golden output hash and metrics, geometry and repeatability, double-processing refusal, preview/final manifest execution, and duplicate-output rejection.
- `npm run typecheck` and targeted ESLint pass.

The aggregate `npm run validate:editorial-illustrations` includes both the color contract and grader suite.
