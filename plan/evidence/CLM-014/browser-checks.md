# CLM-014 production browser checks

Chrome/Playwright checks used the final production build with reduced motion.

## Country and territory captions

- Routes: Japan, United States, Bolivia, and Greenland
- Widths: 1024, 1280, and 1440 desktop; 390 mobile
- Themes: desktop light and mobile dark, including the United States' distinct dark caption
- Every route returned HTTP 200.
- The disclosure link was visible on every route and viewport.
- Caption bounding boxes had zero overlap with `.factbook-hero-left` and `.factbook-hero-boxes` at every desktop width.
- Bolivia's longer caption remained one restrained row without overflow.
- Mobile placed the caption after the art and before the masthead; the dark caption displayed while the light variant was hidden.
- No document had horizontal overflow.
- The dark mobile disclosure link measured **6.57:1** contrast after alpha compositing.
- Keyboard focus produced the shared visible accent outline; clicking reached `/licensing#imagery`.

## Licensing and About

- `/licensing#imagery` rendered the complete policy and landed at 72px from the viewport top, below the sticky header rather than behind it.
- `/about` rendered the short imagery-policy pointer.
- Both routes remained visible without horizontal overflow at 390px dark mode and 1440px light mode.

## Console and evidence

- A fresh production browser context reported zero console or page errors.
- `japan-caption-desktop-light.png` — dedicated caption row with no tile obstruction
- `usa-caption-mobile-dark.png` — mobile dark disclosure and correct dark engraving caption
- `licensing-policy-desktop-light.png` — canonical policy with visible anchored heading
