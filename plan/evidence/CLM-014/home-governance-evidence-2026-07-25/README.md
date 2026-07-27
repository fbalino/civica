# Homepage Governance Evidence artwork

Date: 2026-07-25

Status: implementation and local browser verification complete; no production
deployment is claimed here.

The homepage Governance Evidence feature previously reused the 850 × 850
`spot-globe` pair. At the measured desktop layout, the 575.375 × 365.219 card
therefore contained an isolated 315.219 × 315.219 square at 60% width.

The replacement is a dedicated light/dark 5:3 pair:

- `public/engravings/home-governance-evidence.webp`
- `public/engravings/home-governance-evidence-dark.webp`

Both assets are 1250 × 750 WebP files. The full native-generation, provider
terms, prompts, source-output hashes, deterministic crop/encoding,
human-direction boundary, five screening dispositions, review, release
identity, and correction history live in
`data/illustration-generation-records.v1.json`. The generated illustration
manifest verifies both final hashes and file dimensions.

## Browser result

The live local route was checked at 1440 × 1000 and 390 × 844 in both light and
dark modes. The active theme fetched the matching asset, the rendered image
used the declared 5:3 geometry with `background-size: cover`, and the document
had zero horizontal overflow.

| Case | Rendered art box | Card box | Screenshot |
| --- | --- | --- | --- |
| Desktop light | 525.375 × 315.219 | 575.375 × 365.219 | `desktop-light.png` |
| Desktop dark | 525.375 × 315.219 | 575.375 × 365.219 | `desktop-dark.png` |
| Mobile light | 300 × 180 | 350 × 230 | `mobile-light.png` |
| Mobile dark | 300 × 180 | 350 × 230 | `mobile-dark.png` |

The image remains decorative and carries no source-evidence role. The adjacent
copy names the actual source-native product and `/licensing#imagery` remains
the canonical public imagery disclosure.

No independent professional review, production deployment, or owner approval
of this exact generated pair is inferred from the implementation request.
