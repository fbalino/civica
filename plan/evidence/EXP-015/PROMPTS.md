# EXP-015 Explore image-generation specification

Date: 2026-07-25

Status: light-master and matched-dark prompts executed

Tool used: Codex native image generation through Civica's installed `imagegen`
workflow. No project API key or direct paid-API call was used.

Use case: `stylized-concept`

Returned master size: 1254×1254

The first pass generated all eight subjects. A 96-pixel screen found three
specific constraint misses. Countries was edited to remove map silhouettes;
Compare was edited to replace literal buildings, people, and a tiny flag with
abstract diagrams; Elections was edited to remove a seal-like medallion. The
other five first-pass compositions were retained. Exact output hashes and
review links are in `GENERATED-LIGHT-MASTERS.md`.

## Shared light-master direction

Use this shared direction for every destination, followed by the
destination-specific subject below:

> Asset type: non-production Civica Atlas Explore-menu motif, square.
> Style/medium: premium nineteenth-century copperplate editorial engraving on
> warm ivory paper; fine coherent cross-hatching, confident architectural and
> instrument linework, restrained paper texture, subtle outer vignette;
> scholarly reference atlas, not photorealistic. Composition: one immediately
> legible civic instrument centered with generous negative space, readable at a
> 96-pixel display size, no scene-wide background and no decorative frame.
> Palette: near-monochrome graphite and muted parchment with one restrained
> terracotta accent. Mood: calm, precise, institutional, inviting.

Shared constraints:

> No text, letters, numbers, labels, logos, watermarks, flags, seals, party
> insignia, national symbols, identifiable people, famous modern buildings,
> glossy 3-D iconography, fantasy ornament, faux-antique clutter, photorealism,
> or decorative border. Do not imply that the image is source evidence.

## Eight light masters

### Countries

Create an open civic atlas index with layered country-profile leaves, a small
compass divider, and a restrained laurel sprig. The book/index must be the
dominant object; do not render a national map or flag.

### World Atlas

Create an elegant terrestrial globe on a precise meridian stand, with abstract
coastlines and latitude/longitude construction. Do not privilege or label a
country.

### Compare

Create two aligned specimen cards separated by a surveyor's divider, with
matching abstract institutional diagrams that invite side-by-side comparison.
Do not add text or numeric scores.

### Constitutions

Create a bound civic charter with a ribbon marker beside one restrained
classical column and a document seal shape with no emblem. The charter must
read as a constitutional document without legible writing.

### Parties

Create a semicircular assembly rosette paired with an abstract coalition table:
several distinct but neutral groupings converging toward a shared chamber. No
real party colors, logos, initials, or flags.

### Elections

Create a civic ballot box with a single unmarked ballot and a separate tally
sheet made only of abstract line groupings. No candidate, country, party, or
campaign marks.

### Rankings

Create a surveyor's balance aligned with a sequence of neutral ordered markers.
The image should communicate measured ordering without trophies, podiums,
medals, grades, traffic lights, or numeric scores.

### Organizations

Create several interlocking geographic rings around a neutral globe grid,
suggesting institutions connecting across borders. Do not use a recognizable
organization logo, emblem, building, or flag arrangement.

## Matched dark variants

After Fernando approved the corrected eight-master light batch on 2026-07-25,
Codex used each accepted master as the sole visual input and applied this
matched-dark instruction:

> Re-render this exact Explore motif for Civica Atlas's dark theme. Preserve
> the object, composition, crop, proportions, negative space, and every
> semantic detail. Change paper/ink polarity and lighting only: near-black navy
> ground, muted warm sepia and soft gold linework, restrained terracotta
> accent, high enough separation for a 96-pixel display. Add, remove, move, or
> reinterpret nothing. Keep every shared constraint from the light master.

## Planned names

Light and dark masters use the stable slugs `countries`, `world-atlas`,
`compare`, `constitutions`, `parties`, `elections`, `rankings`, and
`organizations`. Optimized candidate filenames use the
`public/engravings/navigation/explore-{slug}{-dark}.webp` contract.
