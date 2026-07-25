# EXP-015 replacement concept preparation

Date: 2026-07-25

Status: light masters generated and screened; owner review, dark variants, and
browser concept pending

## Owner decision

Fernando Baliño rejected all three EXP-014 directions. The required replacement
is a substantially larger, more beautiful Explore mega menu with custom images
created specifically for the menu.

This is a direction decision, not approval of a replacement and not authority
to change production navigation.

## Prepared replacement

The replacement will use one image-led identity for each of the eight shared
destinations:

1. Countries — atlas index and laurel;
2. World Atlas — terrestrial globe;
3. Compare — paired dividers and specimen cards;
4. Constitutions — charter and civic column;
5. Parties — assembly rosette and coalition table;
6. Elections — ballot box and tally sheet;
7. Rankings — surveyor's balance and ordered markers; and
8. Organizations — interlocking geographic rings.

Desktop will use a near-page-width panel with two explicit registers: “Start
with a place” and “Research tools.” Mobile will retain the same order, labels,
descriptions, and art in a single scrollable menu. Images are decorative; the
destination name remains the accessible identity.

The native generator returned eight 1254×1254 light masters. The checked review
derivatives are 384×384 WebP files, displayed at 96 pixels during the first
menu-scale screen. Together they weigh 79,622 bytes, below the provisional
96 KB active-theme budget. The closed menu must request no Explore art; opening
it may load only the active theme. No separate decorative hero image is planned
because it would compete with the destinations.

Exact prompt specifications are in `PROMPTS.md`. The generated files, hashes,
screening record, and remaining limitations are in
`GENERATED-LIGHT-MASTERS.md`. None is owner-approved, published, or represented
as production art.

## Generation correction

The initial preparation record incorrectly treated the installed workflow as
requiring a project API key and separate paid-API authority. Fernando corrected
that assumption on 2026-07-25. Codex then used the native image-generation tool;
no project `OPENAI_API_KEY`, provider/model approval, or direct API-spend
authority was required.

The returned native tool record did not expose a model version, seed, or exact
provider/account terms. Those fields remain unavailable rather than being
inferred, and the rights contract therefore blocks production release of these
files. The full-resolution masters remain in ignored local output; small review
derivatives are committed under this evidence directory.

The production menu, design contract, illustration manifest, and checked public
asset inventory remain unchanged.

## Remaining acceptance sequence

1. Fernando reviews the eight light masters and approves, revises, or rejects
   each image or the batch.
2. Generate matched dark variants only from accepted light masters.
3. Record all exposed tool/version/account terms, prompts, parameters, human
   direction, exact hashes/dimensions, and all five rights-screening
   dispositions required by `data/EDITORIAL-ILLUSTRATION-RIGHTS.md`.
4. Create the non-production replacement on
   `/design-system#explore-concepts`.
5. Verify keyboard/focus, mobile behavior, theme pairs, overflow, console
   health, and the asset budget in a real browser.
6. Ask Fernando to approve, revise, or reject the rendered replacement.
7. Only after approval, canonize the component/tokens/assets and let EXP-016
   change production navigation.
