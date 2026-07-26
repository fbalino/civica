# BRD-011 — visual asset license inventory

Adopted 2026-07-12. Every shipped visual-asset class, its source, license,
required attribution, and enforcement.

| Class | Source | License / basis | Attribution | Enforcement |
|---|---|---|---|---|
| **Editorial engravings** (568, `public/engravings/`) | AI-assisted generation, Civica-directed | Non-documentary editorial illustration; **no third-party reuse license granted** pending BRD-010 review | Every masthead says "Editorial engraving · AI-assisted illustration"; /licensing#imagery | `validate:country-engravings` (EXP-011) + illustration manifest (EXP-010) + disclosure (EXP-012) |
| **Record/blog images** (57, `public/blog/`) | AI-assisted generation | Same as engravings | Same disclosure | Same manifest/gate |
| **Country flags** | `https://flagcdn.com/<code>.svg` (external CDN), emoji fallback (Unicode) | Flag designs are public-domain government insignia; flagcdn serves them freely; emoji are system glyphs | None required | CSP `img-src` now allowlists `flagcdn.com` |
| **Leader portraits** | Wikimedia Commons, hotlinked via `Special:FilePath` (`wikimediaUrl`) | Per-file CC-BY-SA / CC-BY / public domain | **Surfaced** as the required `credit` line beneath each portrait (`LeaderPortrait`) | CSP `img-src` now allowlists `commons.wikimedia.org` + `upload.wikimedia.org`; per-file credit stored on the person row |
| **Fonts** | Source Serif 4 + Inter via `next/font/google`, self-hosted at build | SIL Open Font License 1.1 (both) | Not required by OFL for embedding | Self-hosted; CSP `font-src 'self'` |
| **Map basemap/tiles** | OpenFreeMap (2D fallback), self-hosted Protomaps PMTiles, Mapbox (opt-in 3D) | OSM data under ODbL; Mapbox under its ToS when its token is set | OSM + Protomaps/OpenFreeMap attribution shown as sibling controls in the map UI (EXP-037) | In-UI attribution; CSP allowlists tile origins |
| **Logo / wordmark** | `public/civica-logo.svg` | Civica's own mark (self-created SVG) | N/A (own) | Self-hosted |
| **UI icons** | Inline SVG authored in-repo | Own | N/A | Self-hosted |

## Residuals (honest gaps)
- **Per-file Wikimedia portrait license** is surfaced via the credit line, but a
  file-by-file license-and-attribution verification of the displayed Commons
  images is a data-quality task, not code — the mechanism is correct; the audit
  of each stored `credit` value belongs with the portrait-data pass.
- **Third-party runtime dependencies** (flagcdn.com, Wikimedia Commons) are now
  reflected in the PLT-013 CSP allowlist; if either is retired, flags/portraits
  degrade (flags → emoji fallback; portraits → initials).
- No unknown or license-incompatible files were found; nothing needs removal or
  isolation before release.

## Build checks that enforce credits
- Engravings: `validate:country-engravings` (pair coverage, disclosure).
- Portraits: the `credit` prop is the required attribution, rendered in the UI.
- Maps: attribution rendered as sibling controls (EXP-037 test).
