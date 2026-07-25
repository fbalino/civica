# EXP-015 replacement concept preparation

Date: 2026-07-25

Status: owner rejection recorded; replacement art and browser concept pending

## Owner decision

Fernando Balino rejected all three EXP-014 directions. The required replacement
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

The planned batch is eight 1024×1024 light masters followed by eight matched
dark-theme variants. Release candidates will be 384×384 WebP derivatives,
displayed at 96–120 CSS pixels. The closed menu must request no Explore art;
opening it may load only the active theme, capped at 96 KB across eight files.
No separate decorative hero image is planned because it would compete with the
destinations.

Exact prompt specifications are in `PROMPTS.md`. No image has been generated,
selected, screened, published, or represented as approved.

## Current execution boundary

The explicitly requested image-generation workflow requires the OpenAI Image
API. In this checkout:

- `OPENAI_API_KEY` is not configured; and
- `.orchestrator/state.json` records subscription-only mode, no approved API
  provider or model, and a hard API cap of US$0.

Generating the batch therefore requires a separate owner authorization naming
the provider/model and a hard USD cap, followed by secure key setup. Until that
authority exists, only preparation is complete. The production menu, design
contract, illustration manifest, and checked asset inventory remain unchanged.

## Acceptance sequence after authorization

1. Generate the eight light masters as one batch and retain the call metadata.
2. Screen composition and meaning before generating matched dark variants.
3. Record model/tool/version/account terms, prompts, parameters, human
   direction, exact hashes/dimensions, and all five rights-screening
   dispositions required by `data/EDITORIAL-ILLUSTRATION-RIGHTS.md`.
4. Create the non-production replacement on
   `/design-system#explore-concepts`.
5. Verify keyboard/focus, mobile behavior, theme pairs, overflow, console
   health, and the asset budget in a real browser.
6. Ask Fernando to approve, revise, or reject the rendered replacement.
7. Only after approval, canonize the component/tokens/assets and let EXP-016
   change production navigation.
