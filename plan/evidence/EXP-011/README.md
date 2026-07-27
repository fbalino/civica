# EXP-011 — country engraving release gate

`npm run validate:country-engravings` validates the current 394 WebPs as 197 exact light/dark pairs.

The gate enforces:

- lowercase three-letter entity keys with only `.webp` and `-dark.webp` variants;
- no raw PNG/JPEG files and no runtime PNG fallback in the country route;
- one light and one dark asset per key, with no duplicate rows;
- approved exact 3:2 production sizes (1500×1000 or 1536×1024);
- 75KB–750KB per-file release bounds;
- caption-registry and generated-manifest coverage;
- `strength-60-batch-pass` for graded dark assets and only the explicit `gbr` family-outlier state;
- equal live-file and manifest counts.

`src/lib/illustrations/country-engraving-validation.test.ts` seeds and catches missing pair, wrong format, oversize, wrong dimensions/aspect, absent caption, absent manifest row, invalid color state, duplicate row, and source-code raw-fallback failures. The production route now ignores raw PNG drops, and `public/engravings/README.md` instructs conversion and manifest capture before commit.

The gate is part of `validate:editorial-illustrations`, which runs during `npm run build`.

Browser regression: `/country/japan` returned 200 and loaded the exact light and dark WebP assets at 1500×1000. Light mode displayed only `jpn.webp`; switching to dark displayed only `jpn-dark.webp`. The required editorial-art disclosure remained present and the browser console reported no warnings or errors.
