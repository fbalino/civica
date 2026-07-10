# CLM-015 production browser checks

Chrome checks used the final production build with reduced motion.

## Desktop light

- Route: `/glossary` at 1440 × 1000
- The page rendered 72 glossary articles with no horizontal overflow.
- Each of the 14 canonical research-term IDs appeared exactly once, was visible, contained the canonical definition, and linked to relevant methodology.
- The footer count reported 72 terms.
- Screenshot: `glossary-desktop-light.png`

## Deep links

- `/glossary#peer-review` landed with the `Peer Review` heading visible below the sticky header at approximately 136px from the viewport top.
- `/glossary#confidence` behaved equivalently in the mobile dark check.
- Stable `article#term-id` anchors are also enforced by the terminology validator.

## Mobile dark

- Route: `/glossary#confidence` at 390 × 844 after using the site theme control
- The `Confidence` entry was fully visible beneath the sticky header, followed by the surrounding alphabetical glossary context.
- All research entries remained visible; the article width fit the viewport and the document had no horizontal overflow.
- The A–Z navigation rendered all 26 letters without breaking layout.
- No warning or error logs were reported.
- Screenshot: `glossary-mobile-dark.png`
