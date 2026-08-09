# Civica premium typeface options

- **Date:** 2026-07-13
- **Status:** Three-direction research set; not approved, purchased, or implemented
- **Current system:** Source Serif 4 for display/editorial roles; Inter for body, interface, tables, and charts

## Comparison set

No pair should be selected until all three are tested privately on representative Civica screens.

| Direction | Serif | Sans | Foundries | Character |
| --- | --- | --- | --- | --- |
| **1. The Reference** | Lyon Display | Atlas Grotesk | Commercial Type | Classical, composed, definitive |
| **2. The Archive** | Signifier | Suisse Int’l | Klim + Swiss Typefaces | Sharp, intellectual, distinctive |
| **3. The Civic Modernist** | Noort | ABC Diatype | TypeTogether + Dinamo | Warm, contemporary, information-first |

## Direction 1 — The Reference

Use **Lyon Display** for Civica's serif voice and **Atlas Grotesk** for its sans-serif system.

Both are by [Commercial Type](https://commercialtype.com/). The combination gives Civica a deliberate tension that matches the product: Lyon supplies the cultivated, historical voice of a fine-press reference work; Atlas supplies the clarity and restraint of a modern data product.

### Serif — Lyon Display

[Lyon Display](https://commercialtype.com/catalog/lyon_display) is a contemporary oldstyle serif based on the Robert Granjon tradition. It has enough contrast and detail to make Civica's 56px page titles, country names, and major section headings feel authored and memorable, without drifting into fashion-magazine Didone territory.

Why it fits Civica:

- Scholarly and archival, but not antiquarian.
- More visibly refined than Source Serif 4 at headline sizes.
- Warm terminals and sharper serifs complement the ivory paper, navy ink, terracotta accent, and engraved illustration system.
- The family supports Latin, Greek, and Cyrillic, which is valuable for a global reference product and for proper names.
- Oldstyle and lining figures, small caps, fractions, and related OpenType features support editorial details when they are genuinely useful.

Recommended use:

- Regular for page H1s, country mastheads, and large editorial headings.
- Medium for smaller display headings where Regular becomes too delicate.
- Keep it out of body copy, controls, charts, and dense data tables.

### Sans — Atlas Grotesk

[Atlas Grotesk](https://commercialtype.com/catalog/atlas/atlas_grotesk) is a restrained 1950s-influenced grotesk with relatively long ascenders and short descenders. Commercial Type describes those proportions as comfortable for extended reading with tight leading, which maps well to Civica's dense reference layouts.

Why it fits Civica:

- Less generic and less startup-coded than Inter, while remaining calm enough for evidence-heavy UI.
- Clear in body copy, navigation, chips, filters, tables, chart labels, and provenance metadata.
- Tabular lining figures support scores, dates, rankings, and aligned numeric columns.
- Latin, Greek, and Cyrillic coverage matches Lyon's published script coverage.
- Commercial Type explicitly demonstrates Atlas Grotesk paired with Lyon Text. Using the more expressive Lyon Display optical family for Civica's existing display-only serif role is a project-specific adaptation of that proven pairing.

Recommended use:

- Regular for body and interface copy.
- Medium for controls, tabs, and compact emphasis.
- Bold for strong UI emphasis only.
- Regular Italic only if Civica decides to render real italics in reader prose rather than synthesized forms.

## Why this direction is the control

| Criterion | Lyon Display + Atlas Grotesk |
| --- | --- |
| Civica character | Fine-press authority plus modern information design |
| Difference from today | Noticeable upgrade from Source Serif 4 + Inter without redesigning the whole brand |
| Data usability | Atlas has tabular figures and a comfortable reading texture |
| Global-name coverage | Published Latin, Greek, and Cyrillic support in both families |
| System coherence | Same foundry; related licensing workflow; foundry demonstrates Atlas with the Lyon family |
| Risk | Lyon Display must be tested at Civica's smaller serif usages; those may need Medium or reassignment to Atlas |

## Shortlist considered

### Signifier + Söhne

The most dramatic option. [Signifier](https://klim.co.nz/fonts/signifier/) has a striking 17th-century/digital-Brutalist construction, and [Söhne](https://klim.co.nz/fonts/soehne/) is an exceptionally polished wayfinding grotesk. The pair is beautiful, but it pushes Civica toward luxury editorial plus premium technology. Signifier could make a sober comparative reference feel self-consciously fashionable, while Söhne is now a familiar visual signal in high-end software branding.

### Tiempos Headline + Söhne

[Tiempos Headline](https://klim.co.nz/fonts/tiempos-headline/) is an excellent editorial workhorse and Söhne is highly capable. This is the safest premium choice, but it is structurally close to Civica's current serif-plus-neutral-grotesk formula. The result would be better, yet may not feel transformed enough to justify the license and migration.

## Licensing and implementation constraints

Commercial Type's catalog currently shows each complete family at **US$325** and individual styles from **US$50**, but that catalog price should not be treated as Civica's web quote. Its [licensing FAQ](https://commercialtype.com/faqs) says web licenses are priced by domain and expected monthly unique visitors. The web license is perpetual within the purchased limits, and the foundry supplies WOFF/WOFF2 files for self-hosting.

Important constraints:

- Free trial fonts are for private evaluation only. A public preview or production deployment requires the correct web license.
- Commercial Type requires self-hosting and prohibits converting desktop OTF files into webfonts.
- Civica's repository is publicly cloneable. Do not commit licensed font binaries to the public repository until Commercial Type confirms the intended source-control and deployment arrangement in writing. A private build artifact or separately controlled asset store may be required.
- Switching away from OFL Google fonts changes Civica's asset-rights posture. Update the font entry in the BRD-011 asset inventory, licensing disclosures where applicable, `DESIGN.md`, and the implementation from `next/font/google` to an approved local-font path only after purchase.

## Validation before purchase

Use the foundry's private trial files to prepare a non-public typography proof covering:

1. `/design-system` in light and dark themes.
2. Homepage and one country masthead at desktop and mobile widths.
3. A dense data table, a chart, filters, chips, and tabular figures.
4. A methodology page with long paragraphs and real italics.
5. Difficult names and diacritics: Côte d’Ivoire, Curaçao, São Tomé and Príncipe, Türkiye, Kyrgyzstan, and Bosnia and Herzegovina.
6. Line-wrap and layout-shift comparisons against the current fonts.

The purchase gate should be visual approval of that proof plus written confirmation of the public-repository deployment arrangement.

## Direction 2 — The Archive

Use [Signifier](https://klim.co.nz/fonts/signifier/) by Klim for Civica’s display serif and [Suisse Int’l](https://www.swisstypefaces.com/fonts/suisse/) by Swiss Typefaces for the sans system.

### Why it belongs in the trial

- Signifier translates seventeenth-century forms through crisp digital construction. Its sharpness would make the engravings, warm paper, and navy typography feel intentional rather than nostalgic.
- Suisse Int’l is quieter than Söhne and less recognisably tied to premium-software branding. It gives the expressive serif a disciplined institutional counterweight.
- Suisse Int’l publishes 18 styles, tabular figures, a slashed zero, fractions, scientific inferiors, and Latin/Cyrillic/Arabic support.
- Signifier includes a 100–900 variable weight axis, tabular figures, small caps, and carefully specified minimum sizes for web use.

### Character and risk

This is the most distinctive option. Civica would feel like a serious archive with a modern digital layer, not a newspaper or generic data dashboard. The risk is that Signifier’s sharp forms may become mannered when repeated across hundreds of country cards and smaller section headings. Its script coverage must also be checked against Civica’s complete proper-name corpus during the trial.

Recommended trial cuts:

- Signifier Regular and Medium.
- Suisse Int’l Regular, Book or Medium, Semibold, and Regular Italic.

## Direction 3 — The Civic Modernist

Use [Noort](https://www.type-together.com/noort-font) by TypeTogether for the serif and [ABC Diatype](https://abcdinamo.com/typefaces/diatype) by Dinamo for the sans system.

### Why it belongs in the trial

- TypeTogether describes Noort as an information architect’s typeface: easily read, capable of layering complex information, and detailed with an analogue warmth. It won a 2018 TDC Certificate of Typographic Excellence.
- Noort has real editorial tools rather than display-only decoration: tabular and oldstyle figures, small caps, a slashed zero, fractions, swashes, and multiple stylistic sets.
- Dinamo describes Diatype as a warm yet sharp grotesk designed for text and screen reading. It has more personality than Inter while remaining highly usable in UI.
- Diatype has an unusually broad global system, with separate Arabic, Armenian, Cyrillic, Devanagari, Georgian, Greek, Hebrew, Hangul, and Thai families available alongside Latin.

### Character and risk

This is the least conventional luxury option and potentially the best product-design option. It would make Civica feel contemporary, human, and highly considered without borrowing the familiar visual language of financial newspapers or premium SaaS. The risk is that its quality is subtler in a static specimen; it needs to be judged in real pages, especially the 56px H1, country directory, methodology prose, and dense tables.

Recommended trial cuts:

- Noort Regular or Book plus Semibold.
- ABC Diatype Regular, Medium, Bold, and Regular Italic.

## Three-way private site proof

The correct next step is one private, non-production comparison page using legally supplied trial files. It should render the same Civica content in all three directions, with no other visual changes:

1. Homepage hero and navigation.
2. Japan country masthead and one dense fact section.
3. Country directory rows with short and long names.
4. Methodology heading, two paragraphs, a citation, and italics.
5. A table containing dates, decimals, percentages, ranks, and missing-value states.
6. Desktop/mobile and light/dark screenshots.

The proof must use each foundry’s official trial package. Do not extract demo webfonts from foundry websites or publish the comparison page. Commercial Type, Klim, Swiss Typefaces, TypeTogether, and Dinamo all have their own trial or evaluation workflow; some require an account or email request.
