# EXP-009 generation prompts

Date: 2026-07-23

Tool: `image_gen.imagegen`

Exact model/version: not exposed by the runtime; not inferred.

Seed: not exposed by the runtime.

## France attempt 1 — rejected

Call: `call_QxiHOgEcQBiZ7xMLoKtmlL42`

```text
Use case: historical-scene
Asset type: non-production Civica Atlas country-hero replacement candidate for France, 3:2 landscape
Primary request: Create a factually grounded engraved view of Paris centered on the Eiffel Tower, the Seine, and the Pont d'Iéna, with the landmark relationships and Eiffel Tower structure recognizable and plausible.
Scene/background: wide river-level Paris view with the Seine in the foreground, Pont d'Iéna crossing near the tower, restrained historic city fabric and trees; no impossible collage of unrelated landmarks.
Style/medium: premium nineteenth-century copperplate editorial engraving on warm ivory paper; fine coherent cross-hatching, confident architectural linework, restrained texture, subtle vignette at the outer edges; visually consistent with a scholarly reference atlas, not a photorealistic filter.
Composition/framing: 3:2 horizontal hero, main landmark fully visible with breathing room, stable horizon, readable at wide desktop crop and narrow center crop.
Lighting/mood: clear soft daylight, calm and documentary.
Color palette: near-monochrome graphite and muted warm parchment, low saturation, no dominant orange cast.
Quality: high.
Constraints: no text, captions, logos, watermarks, flags, modern cars, fantasy structures, duplicated tower, distorted bridge, or decorative border. This is illustrative art, not source evidence.
```

Rejected because the bridge approach contained an invented winged monument.

## France light — accepted as a review candidate

Call: `call_QUD9NJyiirJnMdV2Pa1HPOpg`

Input: rejected France PNG from `call_QxiHOgEcQBiZ7xMLoKtmlL42`.

```text
Use case: precise-object-edit
Asset type: non-production Civica Atlas country-hero replacement candidate for France, 3:2 landscape
Primary request: Correct the Pont d'Iéna landmark details in this engraved Paris scene.
Input fidelity: high.
Constraints: preserve the Eiffel Tower, river, five-arch bridge geometry, horizon, boats, crop, perspective, ivory-paper engraving style, fine cross-hatching, and all unaffected composition. Remove the invented winged monument at the left bridge approach. Replace it only with a restrained, historically plausible equestrian warrior sculpture at the end of Pont d'Iéna; do not add any other monument. Keep the bridge visibly five-arched. No text, captions, logos, watermarks, flags, modern cars, fantasy structures, duplicated tower, or decorative border. Do not change the overall style or lighting.
```

Post-process: `cwebp 1.6.0` resize to 1500×1000 and WebP q88, followed
by ImageMagick 7.1.2-18 brightness 102%, saturation 75%, unchanged hue,
metadata stripping, and WebP q88.

## France dark — accepted as a review candidate

Call: `call_KMCYIug6SzOY1DY1qMHj10ka`

Input: corrected France light PNG from
`call_QUD9NJyiirJnMdV2Pa1HPOpg`.

```text
Use case: lighting-weather
Asset type: non-production Civica Atlas dark-theme country-hero candidate for France, paired with the supplied light engraving
Primary request: Re-render this exact scene as a restrained night engraving for a dark interface.
Input fidelity: high.
Lighting/mood: calm night, very subtle warm reflected light on the Seine, enough tonal separation to recognize the Eiffel Tower, Pont d'Iéna, equestrian approach sculpture, boats, and five bridge arches.
Color palette: near-black graphite ground with muted warm sepia and soft gold linework; the warm identity is an accent, not a full orange wash; no blue cast.
Constraints: preserve the exact composition, crop, perspective, Eiffel Tower structure, bridge geometry, equestrian sculpture, horizon, boats, and landmark relationships. Change lighting and paper/ink polarity only. Do not add, remove, move, duplicate, or reinterpret any landmark. No text, captions, logos, watermarks, flags, fantasy structures, or decorative border.
```

Post-process: `cwebp 1.6.0` resize to 1500×1000, metadata stripping, and
WebP q88.

## United Kingdom light — accepted as a review candidate

Call: `call_fKqu6WU6BWx0dYgjLWROX2Q0`

```text
Use case: historical-scene
Asset type: non-production Civica Atlas country-hero replacement candidate for the United Kingdom, 3:2 landscape
Primary request: Create a factually grounded engraved view from the south bank of the River Thames showing the Palace of Westminster and Elizabeth Tower, with Westminster Bridge crossing the river beside them. Keep the landmark arrangement, Gothic architecture, clock tower proportions, and river relationship recognizable and plausible.
Scene/background: broad Thames foreground, Westminster Bridge, Palace of Westminster running along the river, Elizabeth Tower at the palace's north end; quiet historic city background; no collage of Tower Bridge, Tower of London, or unrelated landmarks.
Style/medium: premium nineteenth-century copperplate editorial engraving on warm ivory paper; fine coherent cross-hatching, confident architectural linework, restrained texture, subtle vignette at the outer edges; visually consistent with a scholarly reference atlas, not a photorealistic filter.
Composition/framing: 3:2 horizontal hero, complete tower and palace silhouette with breathing room, stable horizon, readable at wide desktop crop and narrow center crop.
Lighting/mood: clear soft daylight, calm and documentary.
Color palette: near-monochrome graphite and muted warm parchment, low saturation, no blue cast and no dominant orange cast.
Quality: high.
Constraints: no text, captions, logos, watermarks, flags, modern cars, fantasy structures, duplicated clock tower, Tower Bridge, Tower of London, invented spires, distorted bridge, or decorative border. This is illustrative art, not source evidence.
```

Post-process: `cwebp 1.6.0` resize to 1500×1000 and WebP q88, followed
by ImageMagick 7.1.2-18 brightness 115%, saturation 85%, unchanged hue,
metadata stripping, and WebP q88.

## United Kingdom dark — accepted as a review candidate

Call: `call_kS95V8rHsvC0ozieyMJn4d1D`

Input: United Kingdom light PNG from
`call_fKqu6WU6BWx0dYgjLWROX2Q0`.

```text
Use case: lighting-weather
Asset type: non-production Civica Atlas dark-theme country-hero candidate for the United Kingdom, paired with the supplied light engraving
Primary request: Re-render this exact Palace of Westminster scene as a restrained night engraving for a dark interface.
Input fidelity: high.
Lighting/mood: calm night, very subtle warm reflected light on the Thames, enough tonal separation to recognize the Palace of Westminster, Elizabeth Tower, Westminster Bridge, boats, and riverbank.
Color palette: near-black graphite ground with muted warm sepia and soft gold linework; the warm identity is an accent, not a full orange wash; no blue cast.
Constraints: preserve the exact composition, crop, perspective, palace and clock-tower structure, bridge geometry, horizon, boats, and landmark relationships. Change lighting and paper/ink polarity only. Do not add, remove, move, duplicate, or reinterpret any landmark. No Tower Bridge, Tower of London, text, captions, logos, watermarks, flags, fantasy structures, or decorative border.
```

Post-process: `cwebp 1.6.0` resize to 1500×1000, metadata stripping, and
WebP q88.
