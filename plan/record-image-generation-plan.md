# The Record Image Generation Plan

Date: 2026-06-29

Goal: Generate every pending illustration in the 10 most recent published `content/blog/*.mdx` posts and save them under `public/blog/<slug>/`.

Rules:
- Use the post's `Codex prompt` as the visual basis.
- Do not render the caption inside the image.
- Add very restrained color, even when the prompt asks for monochrome or no color.
- Use a caption-derived filename.
- Preserve the fine-press antique engraving / almanac aesthetic.
- Final files must all use one consistent aspect ratio: 16:9 landscape.
- Final public assets should use the caption-derived stem; this repo converts blog images to `.webp`, so verification should accept the `.webp` final file for each listed stem.

## Posts And Targets

1. `anatomy-of-a-modern-coup` — 3 images
   - `the-seat-of-power-between-one-occupant-and-the-next.png`
   - `the-guard-at-the-door-is-the-guard-who-opens-it.png`
   - `the-transition-clock-periodically-wound-back.png`

2. `what-makes-a-constitution-last` — 5 images
   - `most-founding-documents-wear-out-faster-than-the-people-who-sign-them.png`
   - `one-countrys-single-volume-anothers-stack-of-thirty-nine.png`
   - `a-document-that-bends-survives-the-storm-that-breaks-a-rigid-one.png`
   - `documents-written-by-many-hands-outlive-those-written-by-few.png`
   - `too-thin-to-settle-a-dispute-or-too-thick-to-leave-anything-alone.png`

3. `the-quiet-power-of-the-second-chamber` — 5 images
   - `a-second-chamber-at-rest-what-it-can-actually-do-varies-more-than-the-architecture-suggests.png`
   - `asymmetric-bicameralism-two-chambers-one-of-them-allowed-only-to-wait.png`
   - `the-bundesrat-seats-governments-not-legislators-sixteen-state-cabinets-voting-in-blocs.png`
   - `going-unicameral-new-zealand-1951-denmark-1953-and-sweden-1971-each-decided-one-chamber-was-enough.png`
   - `three-upper-chambers-three-different-jobs-the-architecture-rarely-tells-you-which.png`

4. `term-limits-and-the-men-who-broke-them` — 4 images
   - `the-clock-that-would-not-run-out.png`
   - `the-amendment-that-erases-one-clause-and-leaves-the-rest-intact.png`
   - `zeroing-the-clock-the-terms-already-served-are-declared-not-to-count.png`
   - `more-than-thirty-leaders-since-2000-have-tried-to-outlast-their-own-deadlines-about-twenty-managed-it.png`

5. `how-democracies-measure-themselves` — 4 images
   - `the-same-object-measured-four-ways-rarely-gives-the-same-number-twice.png`
   - `four-scales-four-spans-0-100-0-10-0-1-and-10-to-10.png`
   - `three-gauges-one-country-the-needles-rarely-line-up.png`
   - `an-index-is-only-as-current-as-the-hands-still-maintaining-it.png`

6. `the-worlds-last-absolute-monarchies` — 4 images
   - `a-gallery-of-surviving-crowns-governing-and-ceremonial-alike.png`
   - `omans-2021-decree-fixed-succession-in-writing-a-first-for-the-sultanate.png`
   - `gulf-consultative-chambers-exist-most-cannot-make-law.png`
   - `same-object-opposite-power-a-governing-crown-beside-a-ceremonial-one.png`

7. `why-the-voting-system-is-the-whole-game` — 4 images
   - `the-machinery-between-a-vote-and-a-seat-is-where-most-of-the-politics-happens.png`
   - `evenly-spread-support-wins-nothing-under-first-past-the-post-concentrated-support-wins-everything.png`
   - `when-seats-mirror-votes-closely-no-one-rules-alone-governing-means-assembling-a-coalition.png`
   - `two-votes-on-one-ballot-a-local-face-and-a-national-party-reconciled-into-one-parliament.png`

8. `backsliding-without-tanks` — 4 images
   - `the-machinery-of-justice-rebuilt-from-the-inside-while-court-is-in-session.png`
   - `hungary-cut-the-judicial-retirement-age-to-62-in-2012-clearing-roughly-one-in-ten-judges-at-a-stroke.png`
   - `hungarys-pro-government-outlets-were-folded-into-one-foundation-kesma-in-2018.png`
   - `polands-2023-winners-found-the-captured-courts-could-block-their-own-undoing.png`

9. `who-actually-runs-a-country` — 5 images
   - `two-seats-of-executive-authority-only-one-of-them-governs.png`
   - `the-presidential-model-fuses-ceremony-and-administration-in-one-office.png`
   - `reigning-versus-ruling-the-head-of-state-above-the-head-of-government-at-the-table.png`
   - `cohabitation-a-president-and-prime-minister-from-rival-camps-sharing-one-executive.png`
   - `switzerlands-federal-council-seven-equals-one-rotating-chair-no-single-chief.png`

10. `governing-the-very-small` — 4 images
    - `five-states-none-larger-than-a-city-and-each-governed-by-very-different-rules.png`
    - `liechtensteins-25-seat-landtag-one-legislator-for-roughly-every-1-600-residents.png`
    - `tuvalus-highest-natural-point-is-about-four-metres-above-sea-level.png`
    - `naurus-interior-after-phosphate-mining-roughly-four-fifths-of-the-island-stripped-to-bare-rock.png`

Total: 42 images.
