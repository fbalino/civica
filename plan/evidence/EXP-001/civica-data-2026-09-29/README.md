# EXP-001 review: country Civica Data page (2026-09-29)

This folder records the rendered-module review of the country **Civica Data** tab on the live production site. It covers one route of EXP-001; EXP-001 itself stays open because it covers every route.

## Scope

- **Route:** `/country/[slug]/civica-data` on https://civicaatlas.org (production), reviewed 29 September 2026.
- **Countries (8):** Uruguay, Japan, Switzerland, United Kingdom, Saudi Arabia, Somalia, Kosovo and Monaco. They were chosen to cover a presidential republic, parliamentary and constitutional monarchies, an absolute monarchy, a fragile state, a limited-recognition entity, a microstate and the one country with bill coverage.
- **Views (4):** desktop light and desktop dark at 1440×900; phone light and phone dark at 390×844 (touch emulation). The phone views fill the ledger's `small_mobile_light` and `small_mobile_dark` columns.
- **Context:** four fixes shipped on this route today (majority line ATL-033, unattributed seats ATL-034, CIA cabinet roster integrity DAT-037, publisher attribution CLM-020). All four were seen working as intended. Nothing below is caused by them except the two findings marked *new today*.

## Method

- Four independent reviewers, one per view, loaded each country with ordinary sequential page loads (Playwright in headless Chromium), declined the analytics banner, and opened the page's own disclosures, panels, menus, gallery and map explorer. No forms were submitted, the Ask-Civica box was never sent, and no admin routes or database writes were involved.
- Each reviewer located every rendered source module of the route in a screenshot and classified it per view.
- Every reported issue was then checked by a separate skeptic pass against the live site and the code on `origin/main`. The skeptics corrected several claims (listed under *Claims dropped during verification*). Where the headless browser met Vercel's bot checkpoint, the skeptic used an ordinary browser window or the served HTML instead of trying to get past it.
- **Ledger rule:** a module is `finding` in a view when a confirmed issue affects it there; `clean` only when a reviewer saw it and no confirmed issue applies; `not_observed` when that state was never opened in that view. Issues that are the same at every size and theme (copy, data and code-level faults) count in all four views; layout, touch and theme-specific issues count only where they occur.
- The durable records live in `data/rendered-module-evidence.v1.json` (272 exact-module records for this route); `data/rendered-module-ledger.v1.json` is regenerated from them.

Result: 157 finding cells, 99 clean cells and 16 not-observed cells across 68 modules × 4 views. 73 confirmed findings.

Screenshots are downscaled WebP copies of the reviewers' captures. File names read `<view>-<country>-<shot>.webp`; `crops-*` and `zoom-*` are close-ups.

## Module table

| Module | Desktop light | Desktop dark | Phone light | Phone dark |
| --- | --- | --- | --- | --- |
| `app/(reader)/country/[slug]/civica-data/page.tsx` | finding: CD-11, CD-34, CD-35, CD-36, CD-47, CD-48, CD-58, CD-59, CD-68 | finding: CD-11, CD-34, CD-35, CD-36, CD-47, CD-48, CD-58, CD-59, CD-68 | finding: CD-11, CD-34, CD-35, CD-36, CD-47, CD-48, CD-58, CD-59, CD-68 | finding: CD-11, CD-34, CD-35, CD-36, CD-47, CD-48, CD-58, CD-59, CD-68 |
| `app/(reader)/country/[slug]/layout.tsx` | clean | clean | finding: CD-71 | finding: CD-71 |
| `app/layout.tsx` | clean | clean | clean | clean |
| `CivicaLogo.tsx` | clean | clean | clean | clean |
| `CountryFlag.tsx` | clean | clean | clean | clean |
| `CountrySearchCombobox.tsx` | clean | clean | finding: CD-73 | finding: CD-73 |
| `DataValueState.tsx` | clean | clean | clean | clean |
| `ExploreMenuPanel.tsx` | finding: CD-30 | not observed | not observed | not observed |
| `GlobalSearch.tsx` | clean | clean | finding: CD-73 | finding: CD-73 |
| `GlobalSearchWrapper.tsx` | clean | clean | clean | clean |
| `MobileNav.tsx` | not observed | not observed | finding: CD-73 | finding: CD-73 |
| `NavLinks.tsx` | finding: CD-30 | clean | clean | clean |
| `SiteFooter.tsx` | finding: CD-67 | finding: CD-67 | finding: CD-67 | finding: CD-67 |
| `SiteHeader.tsx` | finding: CD-30 | clean | clean | clean |
| `SourceDot.tsx` | clean | clean | finding: CD-33 | finding: CD-33 |
| `ThemeProvider.tsx` | clean | clean | clean | clean |
| `ThemeToggle.tsx` | clean | clean | clean | clean |
| `ThemedDecorativeImage.tsx` | clean | clean | clean | clean |
| `analytics/AnalyticsConsent.tsx` | clean | clean | clean | clean |
| `analytics/CookieConsentBanner.tsx` | clean | clean | clean | clean |
| `atlas/AtlasChangeHistoryDisclosure.tsx` | finding: CD-60 | finding: CD-60 | finding: CD-60 | finding: CD-60 |
| `ci/CountryTrendSection.tsx` | finding: CD-11, CD-12, CD-20, CD-46, CD-59 | finding: CD-11, CD-12, CD-20, CD-46, CD-59 | finding: CD-11, CD-12, CD-20, CD-46, CD-59, CD-62 | finding: CD-11, CD-12, CD-46, CD-59, CD-62 |
| `ci/IndicatorTrendChart.tsx` | finding: CD-21, CD-26, CD-46, CD-53 | finding: CD-21, CD-26, CD-46, CD-53 | finding: CD-27, CD-46, CD-53, CD-62 | finding: CD-27, CD-46, CD-53, CD-62 |
| `cite/CiteAccordion.tsx` | finding: CD-48, CD-55, CD-68 | finding: CD-48, CD-55, CD-68 | finding: CD-48, CD-55, CD-68 | finding: CD-48, CD-55, CD-68 |
| `civica-chat/CivicaChatMessage.tsx` | not observed | not observed | not observed | not observed |
| `conditions/CivicaConditionsPanel.tsx` | finding: CD-09, CD-10, CD-40, CD-41, CD-52, CD-54, CD-57 | finding: CD-09, CD-10, CD-40, CD-41, CD-52, CD-54, CD-57 | finding: CD-09, CD-10, CD-40, CD-41, CD-52, CD-54, CD-57 | finding: CD-09, CD-10, CD-40, CD-41, CD-52, CD-54, CD-57 |
| `country/CivicaDataSections.tsx` | finding: CD-47, CD-54 | finding: CD-47, CD-54 | finding: CD-47, CD-54 | finding: CD-47, CD-54 |
| `country/CountryJumpSearch.tsx` | clean | clean | clean | clean |
| `country/CountryTabBar.tsx` | clean | clean | clean | clean |
| `editorial/Banner.tsx` | clean | clean | clean | clean |
| `editorial/BetaChip.tsx` | clean | clean | clean | clean |
| `editorial/Button.tsx` | finding: CD-20 | finding: CD-20 | finding: CD-20 | clean |
| `editorial/DataTable.tsx` | clean | clean | finding: CD-23 | finding: CD-23 |
| `editorial/Pill.tsx` | clean | clean | clean | clean |
| `editorial/ReaderSidebar.tsx` | finding: CD-54, CD-72 | finding: CD-54, CD-72 | finding: CD-54, CD-72 | finding: CD-54, CD-72 |
| `editorial/SegmentedControl.tsx` | clean | clean | clean | clean |
| `editorial/SourceText.tsx` | clean | clean | clean | clean |
| `editorial/Tooltip.tsx` | clean | clean | finding: CD-27, CD-62 | finding: CD-27, CD-62 |
| `factbook/ChamberComposition.tsx` | finding: CD-05, CD-63 | finding: CD-05, CD-63 | finding: CD-05, CD-63 | finding: CD-05, CD-63 |
| `factbook/CivicaAIDrawer.tsx` | finding: CD-32, CD-71 | finding: CD-32, CD-71 | finding: CD-32, CD-71 | finding: CD-32, CD-71 |
| `factbook/Country3DView.tsx` | not observed | not observed | not observed | not observed |
| `factbook/CountryMap.tsx` | finding: CD-18 | finding: CD-18 | finding: CD-18 | finding: CD-18 |
| `factbook/CountryMapTile.tsx` | finding: CD-18, CD-19 | finding: CD-18, CD-19 | finding: CD-18, CD-19 | finding: CD-18, CD-19 |
| `factbook/FactValueDot.tsx` | clean | clean | finding: CD-25, CD-33 | finding: CD-25, CD-33 |
| `factbook/FactValuePanel.tsx` | finding: CD-13, CD-45, CD-60 | finding: CD-13, CD-45, CD-60 | finding: CD-13, CD-25, CD-45, CD-60 | finding: CD-13, CD-25, CD-45, CD-60 |
| `factbook/FactbookBillAskButton.tsx` | finding: CD-55 | finding: CD-55 | finding: CD-55 | finding: CD-55 |
| `factbook/FactbookBills.tsx` | finding: CD-15, CD-49, CD-55, CD-56 | finding: CD-15, CD-49, CD-55, CD-56 | finding: CD-15, CD-24, CD-49, CD-55, CD-56 | finding: CD-15, CD-24, CD-49, CD-55, CD-56 |
| `factbook/FactbookCountrySearch.tsx` | clean | clean | clean | clean |
| `factbook/FactbookGovOrgChart.tsx` | finding: CD-01, CD-02, CD-03, CD-50, CD-64 | finding: CD-01, CD-02, CD-03, CD-50, CD-64 | finding: CD-01, CD-02, CD-03, CD-50, CD-64, CD-70 | finding: CD-01, CD-02, CD-03, CD-50, CD-64, CD-70 |
| `factbook/FactbookHeaderStrip.tsx` | finding: CD-07, CD-08, CD-29, CD-66 | finding: CD-07, CD-08, CD-66 | finding: CD-07, CD-08, CD-29, CD-66 | finding: CD-07, CD-08, CD-66 |
| `factbook/FactbookLeaders.tsx` | finding: CD-01, CD-02, CD-03, CD-04, CD-64, CD-65 | finding: CD-01, CD-02, CD-03, CD-04, CD-64, CD-65 | finding: CD-01, CD-02, CD-03, CD-04, CD-64, CD-65 | finding: CD-01, CD-02, CD-03, CD-04, CD-64, CD-65 |
| `factbook/FactbookLegislature.tsx` | finding: CD-06, CD-36, CD-37, CD-38, CD-63 | finding: CD-06, CD-36, CD-37, CD-38, CD-63 | finding: CD-06, CD-22, CD-36, CD-37, CD-38, CD-63 | finding: CD-06, CD-22, CD-36, CD-37, CD-38, CD-63 |
| `factbook/FactbookLegislatureChart.tsx` | finding: CD-05, CD-06, CD-28, CD-37, CD-38, CD-39, CD-63 | finding: CD-05, CD-06, CD-28, CD-37, CD-38, CD-39, CD-63 | finding: CD-05, CD-06, CD-28, CD-37, CD-38, CD-39, CD-62, CD-63 | finding: CD-05, CD-06, CD-28, CD-37, CD-38, CD-39, CD-62, CD-63 |
| `factbook/FactbookLightbox.tsx` | finding: CD-51, CD-55 | not observed | finding: CD-51, CD-55 | finding: CD-51, CD-55 |
| `factbook/FactbookOrganizations.tsx` | finding: CD-14, CD-59 | finding: CD-14, CD-59 | finding: CD-14, CD-17, CD-59 | finding: CD-14, CD-17, CD-59 |
| `factbook/FactbookSidebar.tsx` | finding: CD-47, CD-54, CD-72 | finding: CD-47, CD-54, CD-72 | finding: CD-47, CD-54, CD-71, CD-72 | finding: CD-47, CD-54, CD-71, CD-72 |
| `factbook/FactbookStickyCountrySearch.tsx` | finding: CD-30, CD-31 | finding: CD-31 | finding: CD-31, CD-71 | finding: CD-31, CD-71 |
| `factbook/LeaderPortrait.tsx` | finding: CD-69 | finding: CD-69 | finding: CD-69 | finding: CD-69 |
| `factbook/LeaderTenureTimeline.tsx` | finding: CD-65 | finding: CD-65 | finding: CD-65 | finding: CD-65 |
| `factbook/MapExplorerModal.tsx` | finding: CD-18 | not observed | finding: CD-18 | not observed |
| `factbook/PartyBrowser.tsx` | finding: CD-05, CD-06, CD-37, CD-39 | finding: CD-05, CD-06, CD-37, CD-39 | finding: CD-05, CD-06, CD-37, CD-39, CD-62 | finding: CD-05, CD-06, CD-37, CD-39, CD-62 |
| `governance-evidence/GovernanceEvidenceTable.tsx` | finding: CD-11, CD-12, CD-28, CD-42, CD-43, CD-44 | finding: CD-11, CD-12, CD-28, CD-42, CD-43, CD-44 | finding: CD-11, CD-12, CD-28, CD-42, CD-43, CD-44 | finding: CD-11, CD-12, CD-28, CD-42, CD-43, CD-44 |
| `jurisdiction/JurisdictionStatusDisclosure.tsx` | finding: CD-61 | finding: CD-61 | finding: CD-16, CD-61 | finding: CD-16, CD-61 |
| `motion/ParallaxImage.tsx` | clean | clean | clean | clean |
| `provenance/CountryEvidenceCoverage.tsx` | finding: CD-13, CD-59 | finding: CD-13, CD-59 | finding: CD-13, CD-59 | finding: CD-13, CD-59 |
| `provenance/ValueOriginNote.tsx` | clean | clean | finding: CD-33 | finding: CD-33 |
| `research/ResearchVisualizationDisclosure.tsx` | finding: CD-38, CD-63 | finding: CD-38, CD-63 | finding: CD-38, CD-63 | finding: CD-38, CD-63 |
| `scores/ScoresAndRankings.tsx` | finding: CD-11, CD-12, CD-58 | finding: CD-11, CD-12, CD-58 | finding: CD-11, CD-12, CD-58 | finding: CD-11, CD-12, CD-58 |

Not-observed notes:

- `civica-chat/CivicaChatMessage.tsx`: No chat message was sent (reviews never submit forms), so message rendering was not seen.
- `factbook/Country3DView.tsx`: The 3D map view was never switched on.
- `factbook/MapExplorerModal.tsx`: The map explorer was not opened in the dark variants (on mobile dark it would not open because the map was unavailable).
- `factbook/FactbookLightbox.tsx`: Only the closed photo tile was seen in desktop dark.
- `ExploreMenuPanel.tsx`: The Explore menu was only opened at desktop light.
- `MobileNav.tsx`: The mobile menu is not shown at desktop width.

## Confirmed findings

IDs run from most to least severe. Each entry says where the problem is, why it matters, and a suggested fix.

### Data accuracy

#### CD-01: Former leaders are shown as current heads of government

- **Severity:** Data accuracy
- **Where:** Somalia and Saudi Arabia, Government and Leaders sections, all four views.
- **Why it matters:** Somalia shows Mohamed Hussein Roble as prime minister "since 2020" with a live-source dot and a six-year tenure; he left in June 2022 and his successor, Hamza Abdi Barre, appears nowhere. Saudi Arabia shows King Salman as head of government, but Mohammed bin Salman has been prime minister since September 2022. Wikidata still carries these stale entries and Civica copies them without a check.
- **Suggested fix:** Correct both entries (upstream on Wikidata or through a reviewed override) and resync. Add a check that flags a head of government for review when a newer dated roster names someone else.
- **Modules:** `factbook/FactbookGovOrgChart.tsx`, `factbook/FactbookLeaders.tsx`
- **Screenshots:** `desktop-light-somalia-t-gov-chart.webp`, `desktop-dark-saudi-arabia-10-sec05-government.webp`

#### CD-02: Out-of-date CIA cabinet lists are counted as current officeholders

- **Severity:** Data accuracy
- **Where:** Monaco, Japan, Switzerland and Saudi Arabia, Government and Leaders sections, all four views.
- **Why it matters:** CIA's own lists are up to four years old, and Civica shows them beside newer leaders without warning. Monaco shows two people in the same top office; Japan pairs Prime Minister Takaichi with her predecessor's ministers; Switzerland shows a central-bank chair who left in 2024; Saudi Arabia shows Mohammed bin Salman in posts he held before 2022. All of them count toward "current officeholders".
- **Suggested fix:** When a roster predates the current head of government (or passes a freshness limit), label it "as listed by CIA on <date>; may predate the current government" or hide it, leave it out of the current counts, and drop roster rows that name a different person for a top office.
- **Modules:** `factbook/FactbookGovOrgChart.tsx`, `factbook/FactbookLeaders.tsx`
- **Screenshots:** `desktop-light-monaco-t-gov.webp`, `desktop-light-japan-v-government-1.webp`

#### CD-03: The same leader appears twice in Kosovo and the UK

- **Severity:** Data accuracy
- **Where:** Kosovo and United Kingdom, Government and Leaders sections.
- **Why it matters:** Albin Kurti appears as "Prime Minister" and again as "Caretaker Prime Min."; Albulena Haxhiu as head of state and again as acting president; Andy Burnham twice as prime minister. The CIA importer fails to recognise leader titles that start with "Caretaker"/"Acting" or carry a comma. The totals are not inflated (they count distinct names). The Japan and Saudi examples in the original report copy the CIA source faithfully and are not Civica duplication.
- **Suggested fix:** Teach the importer to recognise caretaker, acting and qualified leader titles, and merge a roster row with the matching head-of-state or head-of-government entry.
- **Modules:** `factbook/FactbookGovOrgChart.tsx`, `factbook/FactbookLeaders.tsx`
- **Screenshots:** `mobile-light-kosovo-14-government.webp`

#### CD-04: Leaders headline count does not match the people listed

- **Severity:** Data accuracy
- **Where:** Switzerland, Uruguay and Japan, Leaders section, all four views.
- **Why it matters:** Switzerland says 9 current officeholders but lists only the Federal Council and the vice president; the president, five department heads and the central-bank chair are silently missing. Uruguay says 18 and lists 17; Japan says 22 and lists 21. Central-bank and other office types are counted but never shown. Japan's "Cabinet 59" also counts posts, not people.
- **Suggested fix:** List the missing office types under their own headings (for example "Central bank" and "Other offices") and label the headline as people and the group counts as posts.
- **Modules:** `factbook/FactbookLeaders.tsx`
- **Screenshots:** `desktop-light-switzerland-t-leaders.webp`, `mobile-dark-switzerland-16-leaders.webp`

#### CD-05: Japan's upper house shows only half the chamber

- **Severity:** Data accuracy
- **Where:** Japan, Legislature section, House of Councillors.
- **Why it matters:** The 125 party seats shown are only the July 2025 half-election; the other 123 seats appear as "No party reported". As a result the ruling LDP shows 39 seats and 15.7% when it holds roughly 100 seats and about 40%. The importer stores the latest partial election as if it were the whole chamber.
- **Suggested fix:** Import the full sitting membership for chambers elected in halves or thirds, or mark the composition as partial and hide share figures until it is complete. Check other staggered chambers too.
- **Modules:** `factbook/ChamberComposition.tsx`, `factbook/FactbookLegislatureChart.tsx`, `factbook/PartyBrowser.tsx`
- **Screenshots:** `desktop-light-japan-t-upper-house.webp`, `crops-jp-leg-upper.webp`

#### CD-06: Somalia's parliament lists interim governments as parties

- **Severity:** Data accuracy
- **Where:** Somalia, Legislature section, both chambers.
- **Why it matters:** Both chambers show the same four rows, including "independent politician" as the largest party and two former transitional governments as parties, with the rest unassigned. The rows come from a Wikidata fallback that does not check whether an entry is a party, are copied into both chambers, and are wrongly credited to IPU Parline. Colours also swap between chambers.
- **Suggested fix:** Remove Somalia's fallback rows, restrict the fallback to real parties, never copy one list into two chambers, credit the actual source, and show the "no composition" notice when nothing genuine remains.
- **Modules:** `factbook/FactbookLegislature.tsx`, `factbook/FactbookLegislatureChart.tsx`, `factbook/PartyBrowser.tsx`
- **Screenshots:** `desktop-light-somalia-t-lower-house.webp`, `desktop-dark-somalia-26-legislature-table-open.webp`

#### CD-07: "Official names" include foreign-language names and miss real ones

- **Severity:** Data accuracy
- **Where:** Country header, Switzerland, Monaco, Kosovo and Somalia, all four views.
- **Why it matters:** Every Wikidata official-name entry is shown, whatever its language, under "Official names (source language)". Switzerland shows Spanish and Portuguese but no French; Monaco shows Swedish but no French; Kosovo repeats the Serbian form. French disappears because Wikidata has two French values and the sync drops the language as ambiguous. Cyrillic text falls back to a system font because the site font lacks Cyrillic.
- **Suggested fix:** Keep only names in the country's official languages, pick one value per language instead of dropping it, show each name's language, and add Cyrillic font coverage.
- **Modules:** `factbook/FactbookHeaderStrip.tsx`
- **Screenshots:** `desktop-light-kosovo-02-masthead.webp`

#### CD-08: Uruguay's official name is misspelled

- **Severity:** Data accuracy
- **Where:** Uruguay, country header, all four views.
- **Why it matters:** The first fact on the page reads "Repúbilca Oriental del Uruguay" instead of "República". The typo is in Wikidata and Civica copies it; there is no way to correct a known upstream spelling error.
- **Suggested fix:** Fix the entry on Wikidata and resync, and add a reviewed override path for known upstream typos.
- **Modules:** `factbook/FactbookHeaderStrip.tsx`
- **Screenshots:** `mobile-light-uruguay-02-country-masthead.webp`

#### CD-09: Human Development Index is labelled 2023 but shows 2022 figures

- **Severity:** Data accuracy
- **Where:** Civica Conditions, every country with a Human development card.
- **Why it matters:** Conditions shows Switzerland 0.97, Japan 0.92, Saudi Arabia 0.88 as "2023", while the history chart on the same page shows UNDP's 2023 values (0.970, 0.925, 0.900). The Conditions figures are UNDP's 2022 values from a hand-typed list labelled 2023. All 51 countries in the release are affected.
- **Suggested fix:** Rebuild the Conditions HDI inputs from the same UNDP release the history chart uses, and add a check that fails when the two disagree for the same year.
- **Modules:** `conditions/CivicaConditionsPanel.tsx`
- **Screenshots:** `desktop-light-switzerland-v-conditions-1.webp`, `desktop-dark-switzerland-21-chart-tooltip-2023.webp`

#### CD-10: Conditions cards are missing without explanation

- **Severity:** Data accuracy
- **Where:** Civica Conditions, Uruguay, Somalia and Monaco.
- **Why it matters:** Uruguay and Monaco show only the economic card; Somalia has no peace card. For Uruguay and Somalia the publishers do cover the country; Civica's legacy input lists (about 51 countries) simply leave them out. Monaco's gaps are real publisher gaps, but the page does not say so either.
- **Suggested fix:** Load the publishers' complete tables, and always show all three cards with a reason when one is empty ("publisher does not cover this country" or "not in this release").
- **Modules:** `conditions/CivicaConditionsPanel.tsx`
- **Screenshots:** `desktop-light-uruguay-v-conditions-1.webp`

#### CD-11: Kosovo appears to have no governance data although publishers cover it

- **Severity:** Data accuracy
- **Where:** Kosovo, Governance Evidence, Indicator History and Rankings.
- **Why it matters:** The page says nothing is recorded for Kosovo, but V-Dem, the World Bank, Freedom House and Transparency International all publish it. Two sections exclude it on purpose (they cover sovereign states only), and the history chart misses it because publishers use a different country code (XKX) from Civica's (XKS).
- **Suggested fix:** Add one shared Kosovo code mapping for the history and Index imports, and where Kosovo is out of scope say so ("this release covers sovereign states only") instead of "nothing recorded".
- **Modules:** `app/(reader)/country/[slug]/civica-data/page.tsx`, `ci/CountryTrendSection.tsx`, `governance-evidence/GovernanceEvidenceTable.tsx`, `scores/ScoresAndRankings.tsx`
- **Screenshots:** `desktop-light-kosovo-v-governance-evidence-1.webp`, `desktop-dark-kosovo-07-sec02-governance-evidence.webp`

#### CD-12: Sections disagree on which publisher edition and year a figure comes from

- **Severity:** Data accuracy
- **Where:** Governance Evidence, Rankings and Indicator History, all countries with data.
- **Why it matters:** Uruguay's V-Dem score is 0.769 for 2024 in two sections and 0.768 in the history chart, which also has a 2025 value, because the chart uses a newer V-Dem release. Freedom House is described three different ways. Nothing tells readers that the history chart is newer, and the "Civica release · 2024 Q4" chip reads like a date.
- **Suggested fix:** Use one shared label format ("publisher edition · year covered") everywhere, name the actual release in History, and label the frozen sections as Civica's reference release with newer years in History.
- **Modules:** `ci/CountryTrendSection.tsx`, `governance-evidence/GovernanceEvidenceTable.tsx`, `scores/ScoresAndRankings.tsx`
- **Screenshots:** `desktop-light-uruguay-v-rankings-1.webp`, `mobile-dark-uruguay-12-indicator-history.webp`

#### CD-13: "Sources agree" count is always zero

- **Severity:** Data accuracy
- **Where:** Evidence Coverage and the fact source panel, all countries.
- **Why it matters:** Every country reports zero agreement between sources, and the population panel says "Source records differ" while the UN and World Bank both show 3.4M for Uruguay. The counter reads the reason a value was chosen instead of comparing the values, and for fast-changing figures that reason is never "agreement".
- **Suggested fix:** Compare the values themselves against the registered tolerance, report that result in both places, and add a test where two matching sources count as agreement.
- **Modules:** `factbook/FactValuePanel.tsx`, `provenance/CountryEvidenceCoverage.tsx`
- **Screenshots:** `desktop-light-uruguay-h-fact-panel.webp`, `desktop-dark-somalia-06-sec01-evidence-coverage.webp`

#### CD-14: Organization counts are built on an incomplete membership list

- **Severity:** Data accuracy
- **Where:** Organizations section, Switzerland, Uruguay, Monaco, Somalia and United Kingdom.
- **Why it matters:** Switzerland shows 1 current membership and 0 founding memberships while hosting the WHO and WTO; Uruguay, Monaco and Somalia show no UN membership although their headers say "UN member state". The UN list covers only 23 hand-picked countries, and WTO and G20 rows never mark founding members.
- **Suggested fix:** Seed UN membership from the country-status list, fill in founding roles, label the tiles "Recorded memberships" (or hide them while lists are partial) and move the partial-list note above the tiles.
- **Modules:** `factbook/FactbookOrganizations.tsx`
- **Screenshots:** `desktop-light-switzerland-t-orgs.webp`

#### CD-15: UK bill progress bars contradict the stage text

- **Severity:** Data accuracy
- **Where:** United Kingdom, Bills section.
- **Why it matters:** Bills at "2nd reading" are marked at Committee, although second reading comes first; Lords-first [HL] bills are drawn on a Commons-first track. The stage matcher ignores which house a bill is in and the order of UK stages.
- **Suggested fix:** Map UK stages using the house the bill started in and the real stage order (second reading before committee).
- **Modules:** `factbook/FactbookBills.tsx`
- **Screenshots:** `desktop-light-united-kingdom-t-bill1.webp`

### Broken

#### CD-16: "Scope & sources" panel runs off the left edge on phones

- **Severity:** Broken
- **Where:** Country header, phones (seen on Kosovo and Uruguay).
- **Why it matters:** The recognition and sovereignty explanation opens partly off-screen, so lines start mid-word and some source links cannot be reached.
- **Suggested fix:** On narrow screens, keep the panel inside the screen with a 16px margin or show it directly under the chip.
- **Modules:** `jurisdiction/JurisdictionStatusDisclosure.tsx`
- **Screenshots:** `mobile-light-kosovo-32-jurisdiction-disclosure-open.webp`

#### CD-17: Organization summary tiles overlap on phones

- **Severity:** Broken
- **Where:** Organizations section, phones.
- **Why it matters:** Four tiles are squeezed into one row; labels spill under neighbouring tiles and "Commonwealth" runs off the screen. A stylesheet rule from another page with the same class name adds a stray border.
- **Suggested fix:** Use a two-column grid on phones, let labels wrap, and give this band its own class name.
- **Modules:** `factbook/FactbookOrganizations.tsx`
- **Screenshots:** `mobile-light-united-kingdom-crop-18-organizations-top.webp`, `crops-uk-orgs.webp`

#### CD-18: The country map never appears

- **Severity:** Broken
- **Where:** Country header map tile and map explorer, all countries.
- **Why it matters:** In dark mode a colour format the map library rejects triggers errors, the map is marked unavailable, and the "temporarily unavailable" message is hidden under a blank box. In light mode the map silently loads no tiles. Readers see an empty box either way.
- **Suggested fix:** Convert theme colours to a format the map accepts, treat only real load failures as fatal, show the message inside the tile, and investigate why the light-mode map requests no tiles after the map library upgrade.
- **Modules:** `factbook/CountryMap.tsx`, `factbook/CountryMapTile.tsx`, `factbook/MapExplorerModal.tsx`
- **Screenshots:** `desktop-light-uruguay-t-map-tile.webp`, `desktop-dark-japan-02-masthead.webp`

#### CD-19: Map credit box covers the map and hijacks taps on phones

- **Severity:** Broken
- **Where:** Country header map tile, all views; worst on phones.
- **Why it matters:** The credit text uses a font-size token that does not exist, so it renders large in a box covering about half the tile. On phones, tapping the map opens protomaps.com instead of the map explorer.
- **Suggested fix:** Use the 12px token, move the credit below the tile, and make the design-token check fail on undefined tokens.
- **Modules:** `factbook/CountryMapTile.tsx`
- **Screenshots:** `zoom-japan-map.webp`, `mobile-light-japan-combo-42-map.webp`

#### CD-20: CSV download links fire failing background requests

- **Severity:** Broken
- **Where:** Indicator History download buttons, every country with history.
- **Why it matters:** The site pre-loads each download link in the background with an extra parameter the data service rejects, producing errors and using up the reader's download allowance (30 per minute). A reader who opens a few countries can be refused a real download.
- **Suggested fix:** Render downloads as plain links without pre-loading, and have the data service ignore that parameter or check limits after validating the request.
- **Modules:** `ci/CountryTrendSection.tsx`, `editorial/Button.tsx`
- **Screenshots:** `desktop-light-uruguay-v-longitudinal-3.webp`

#### CD-21: Chart hover values are cut off

- **Severity:** Broken
- **Where:** Indicator History chart, desktop.
- **Why it matters:** Long publisher names are forced onto one line, pushing values past the edge of the tooltip, so HDI and Rule of Law values are clipped or missing at any hover position. (The tooltip box itself stays on screen.)
- **Suggested fix:** Let the source name wrap or truncate so the value stays inside the tooltip.
- **Modules:** `ci/IndicatorTrendChart.tsx`
- **Screenshots:** `desktop-light-uruguay-h-chart-hover-late.webp`

#### CD-22: Legislature source labels are cut off on phones

- **Severity:** Broken
- **Where:** Legislature key facts, phones.
- **Why it matters:** The four source labels do not wrap, so "Turnout" is cut off at the screen edge.
- **Suggested fix:** Let that row wrap.
- **Modules:** `factbook/FactbookLegislature.tsx`
- **Screenshots:** `crops-uy-leg-keyfacts.webp`

#### CD-23: Data tables hide columns on phones with no sign they scroll

- **Severity:** Broken
- **Where:** Evidence Coverage, Governance Evidence, Indicator History, Rankings and the party table, phones.
- **Why it matters:** Each table is wider than the screen and scrolls sideways inside its box, but nothing shows that. Meaning, edition, year and download columns are invisible unless the reader thinks to swipe.
- **Suggested fix:** Add a stacked layout for narrow screens to the shared table, or at least an edge fade.
- **Modules:** `editorial/DataTable.tsx`
- **Screenshots:** `mobile-light-uruguay-10-evidence-coverage.webp`, `mobile-dark-uruguay-11-governance-evidence.webp`

#### CD-24: Bill stage labels run together on phones

- **Severity:** Broken
- **Where:** United Kingdom, Bills section, phones.
- **Why it matters:** The five stage names print as "DRAFTCOMMITTEELOWERUPPER ENACTED" and do not line up with their dots.
- **Suggested fix:** Give each label a fixed cell under its dot with space between, or stack the timeline on phones.
- **Modules:** `factbook/FactbookBills.tsx`
- **Screenshots:** `crops-uk-bills.webp`

### Accessibility

#### CD-25: Fact source panel is hard to close and not keyboard-friendly

- **Severity:** Accessibility
- **Where:** Population and GDP source panel, phones (and keyboard users anywhere).
- **Why it matters:** On phones the panel covers almost the whole screen with no Close button; the only way out is a 12px strip. Focus never moves into it, so keyboard users tab past it. Escape does close it (the original report was wrong on that), but with a mouse it reopens immediately.
- **Suggested fix:** Add a Close button, move focus in and back out, stop hover from reopening it, and show it as a bottom sheet on phones.
- **Modules:** `factbook/FactValueDot.tsx`, `factbook/FactValuePanel.tsx`
- **Screenshots:** `mobile-light-kosovo-33-fact-value-panel-open.webp`

#### CD-26: Keyboard users must tab through every year of the chart

- **Severity:** Accessibility
- **Where:** Indicator History chart.
- **Why it matters:** Each year is its own tab stop: 50 by default and 201 at "Max". These are also the only on-page way for keyboard and screen-reader users to hear yearly values, so they cannot simply be removed.
- **Suggested fix:** Make the chart one tab stop with arrow keys between years, and add an accessible year-by-year table with a skip link.
- **Modules:** `ci/IndicatorTrendChart.tsx`
- **Screenshots:** `desktop-light-uruguay-h-focus-main-51.webp`

#### CD-27: History chart is unreadable and untappable on phones

- **Severity:** Accessibility
- **Where:** Indicator History chart, phones.
- **Why it matters:** Axis labels shrink to about 6px. Year columns are 2–7px wide, and tapping one opens and immediately closes the value tooltip, so phone readers cannot see any yearly value.
- **Suggested fix:** Size labels in screen pixels (at least 12px), use one touch surface that picks the nearest year, and fix the tooltip so a tap opens it.
- **Modules:** `ci/IndicatorTrendChart.tsx`, `editorial/Tooltip.tsx`
- **Screenshots:** `crops-uy-ih-chart.webp`

#### CD-28: Small print below the 12px minimum

- **Severity:** Accessibility
- **Where:** Governance Evidence notes and the hemicycle labels, all views.
- **Why it matters:** Governance Evidence descriptions and notes render at 11.2px. The hemicycle's "ROSTRUM" and "MAJORITY" labels shrink with the chart to about 3–4px on phones and stay under 12px even on desktop.
- **Suggested fix:** Set the table's small print to a 12px-or-larger token and draw the hemicycle labels at a fixed on-screen size.
- **Modules:** `factbook/FactbookLegislatureChart.tsx`, `governance-evidence/GovernanceEvidenceTable.tsx`
- **Screenshots:** `desktop-dark-united-kingdom-07-sec02-governance-evidence.webp`, `mobile-light-united-kingdom-crop-15-legislature-hemicycle.webp`

#### CD-29: Government-type pill text is too faint in light mode

- **Severity:** Accessibility
- **Where:** Country header, light mode (Saudi Arabia, Monaco, Uruguay and others).
- **Why it matters:** Monarchy pills are gold on sand at 2.4:1 and presidential pills 3.9:1, below the 4.5:1 readability minimum. The pill is the header's own component, not the shared Pill.
- **Suggested fix:** Add darker text tokens for each government-type colour and use them for pill text only.
- **Modules:** `factbook/FactbookHeaderStrip.tsx`
- **Screenshots:** `desktop-light-saudi-arabia-02-masthead.webp`, `mobile-light-saudi-arabia-02-country-masthead.webp`

#### CD-30: Menu items hide under the sticky country bar

- **Severity:** Accessibility
- **Where:** Site header menus on country pages, desktop, after scrolling.
- **Why it matters:** The top one or two items of the Explore, Governance Evidence and Methodology menus sit under the sticky "Jump to country" bar, so they cannot be seen or clicked and keyboard focus lands on hidden items.
- **Suggested fix:** Raise the header's layer above the sticky bar (a new design-system layer token), or hide the bar while a menu is open.
- **Modules:** `ExploreMenuPanel.tsx`, `NavLinks.tsx`, `SiteHeader.tsx`, `factbook/FactbookStickyCountrySearch.tsx`
- **Screenshots:** `desktop-light-uruguay-30-focus-tab13.webp`

#### CD-31: An invisible second country search catches keyboard focus

- **Severity:** Accessibility
- **Where:** All country tabs, all widths.
- **Why it matters:** Pressing Tab past the country search lands in a hidden duplicate, which then fades in over the header, so two search boxes show at once. Its name also says "factbook" on the Civica Data tab.
- **Suggested fix:** Make the hidden bar unreachable until it is shown, remove the focus reveal, and give it the same name as the visible field.
- **Modules:** `factbook/FactbookStickyCountrySearch.tsx`
- **Screenshots:** `mobile-light-uruguay-combo-26-input-focus.webp`

#### CD-32: Ask-Civica input shows no focus ring

- **Severity:** Accessibility
- **Where:** "Ask anything about <country>" bar, all views.
- **Why it matters:** An inline style removes the focus outline and nothing replaces it, so keyboard users cannot see they are in the field.
- **Suggested fix:** Remove the inline override or add the same focus border the search fields use.
- **Modules:** `factbook/CivicaAIDrawer.tsx`
- **Screenshots:** `desktop-light-uruguay-t-drawer-focus.webp`

#### CD-33: Source dots are too small to tap and do nothing on touch

- **Severity:** Accessibility
- **Where:** Source dots, fact triggers and info icons, phones.
- **Why it matters:** Dots are 6×6px, fact triggers 26×14px and info icons 15px, well under the recommended touch size. Tapping a dot shows no source details, so phone readers cannot see sources at all.
- **Suggested fix:** Give each trigger at least a 24px (ideally 44px) invisible hit area and make dots open on tap.
- **Modules:** `SourceDot.tsx`, `factbook/FactValueDot.tsx`, `provenance/ValueOriginNote.tsx`
- **Screenshots:** `mobile-dark-uruguay-02-masthead.webp`

### Misleading label

#### CD-34: Government and Leaders credit only Wikidata

- **Severity:** Misleading label
- **Where:** Government and Leaders Sources strips, all countries.
- **Why it matters:** Most officeholders shown come from the CIA World Leaders list, but the strips and the "Cite this page" list name only Wikidata, so anyone citing the page names the wrong publisher.
- **Suggested fix:** Build each strip from the sources of the rows shown and add CIA World Leaders with its roster date.
- **Modules:** `app/(reader)/country/[slug]/civica-data/page.tsx`
- **Screenshots:** `desktop-light-uruguay-v-government-3.webp`

#### CD-35: Sources strips show unexplained dates

- **Severity:** Misleading label
- **Where:** Every Sources strip, all countries.
- **Why it matters:** Dates such as "V-Dem 2026-07-15" are the day Civica last synced the source, but nothing says so, and they look exactly like bill dates on the same page. The page also mixes three date formats.
- **Suggested fix:** Label the date ("Retrieved 15 July 2026") and use one date format across the page.
- **Modules:** `app/(reader)/country/[slug]/civica-data/page.tsx`
- **Screenshots:** `desktop-dark-united-kingdom-07-sec02-governance-evidence.webp`, `mobile-dark-uruguay-11-governance-evidence.webp`

#### CD-36: Legislature has no Sources strip

- **Severity:** Misleading label
- **Where:** Legislature section, all countries.
- **Why it matters:** The section's source list is hard-coded empty, so there is no Sources strip and IPU Parline is also missing from the citation. Where the seats come from another feed (Somalia), the hard-coded IPU credit is wrong.
- **Suggested fix:** Build the strip from the stored source of the composition rows.
- **Modules:** `app/(reader)/country/[slug]/civica-data/page.tsx`, `factbook/FactbookLegislature.tsx`
- **Screenshots:** `desktop-dark-united-kingdom-11-sec06-legislature.webp`

#### CD-37: Saudi Arabia's appointed council is described as an elected, party-based chamber

- **Severity:** Misleading label
- **Where:** Saudi Arabia, Legislature section.
- **Why it matters:** The King appoints the Shura Council and there are no parties or elections, yet the page shows "Largest party: Appointed Members", "Parties 1", a "2024 Shura Council election" and an estimated 2028 election. The 2024 "election" was a reappointment.
- **Suggested fix:** Add an appointed/non-partisan chamber state that hides the party and election tiles and says "Members appointed by the King".
- **Modules:** `factbook/FactbookLegislature.tsx`, `factbook/FactbookLegislatureChart.tsx`, `factbook/PartyBrowser.tsx`
- **Screenshots:** `desktop-light-saudi-arabia-t-chamber.webp`

#### CD-38: Chambers with no party data draw an empty hemicycle

- **Severity:** Misleading label
- **Where:** Switzerland and Monaco (and about 86 chambers overall), Legislature section.
- **Why it matters:** When no party data exists, the chart draws a full arc of empty seats, although the section's own note promises "no empty hemicycle" and a named data gap. Next to "Compiled results · Available" the page contradicts itself.
- **Suggested fix:** When every seat is unattributed, show the documented data-gap notice in place of the chart, and re-import Swiss and Monegasque composition.
- **Modules:** `factbook/FactbookLegislature.tsx`, `factbook/FactbookLegislatureChart.tsx`, `research/ResearchVisualizationDisclosure.tsx`
- **Screenshots:** `desktop-light-switzerland-v-legislature-2.webp`, `mobile-light-monaco-41-hemicycle-seat-tap.webp`

#### CD-39: "Parties" counts groupings that are not parties

- **Severity:** Misleading label
- **Where:** United Kingdom, Legislature section.
- **Why it matters:** The Lords count of 5 includes Crossbench and "Others"; the Commons count of 15 includes independents and the Speaker.
- **Suggested fix:** Label the count "Groups", or mark and exclude non-party rows.
- **Modules:** `factbook/FactbookLegislatureChart.tsx`, `factbook/PartyBrowser.tsx`
- **Screenshots:** `mobile-light-united-kingdom-crop-15-legislature-hemicycle.webp`

#### CD-40: Conditions calculations cannot be reproduced from the numbers shown

- **Severity:** Misleading label
- **Where:** Civica Conditions, all countries.
- **Why it matters:** The card says Civica multiplied the HDI by 100 to get 96.7, but shows the HDI as 0.97 (which gives 97). The peace card has the same problem. Inputs are rounded to 2 decimals although UNDP and IEP publish 3.
- **Suggested fix:** Show publisher values at the publisher's precision (3 decimals for HDI and GPI).
- **Modules:** `conditions/CivicaConditionsPanel.tsx`
- **Screenshots:** `desktop-light-switzerland-v-conditions-1.webp`

#### CD-41: Economic inputs are credited to a World Bank product that does not exist

- **Severity:** Misleading label
- **Where:** Civica Conditions economic card, all countries.
- **Why it matters:** "World Bank — Economic Stability Indicators" is Civica's own grouping name; the figures come from the World Development Indicators.
- **Suggested fix:** Rename the source to "World Bank — World Development Indicators" in the seed and live table.
- **Modules:** `conditions/CivicaConditionsPanel.tsx`
- **Screenshots:** `desktop-dark-japan-09-sec04-conditions.webp`

#### CD-42: Publisher gaps are labelled "Missing" with database wording

- **Severity:** Misleading label
- **Where:** Monaco, Governance Evidence.
- **Why it matters:** V-Dem and Transparency International do not cover Monaco, but the rows say "Missing" (which by Civica's own definition means Civica lost data) and print raw codes such as "retained before DAT-033".
- **Suggested fix:** Show "V-Dem does not cover Monaco" and drop the empty detail cells.
- **Modules:** `governance-evidence/GovernanceEvidenceTable.tsx`
- **Screenshots:** `desktop-light-monaco-v-governance-evidence-1.webp`

#### CD-43: Freedom House row shows a Civica-made sum under Freedom House's name

- **Severity:** Misleading label
- **Where:** Governance Evidence, all countries with data.
- **Why it matters:** "Combined rating 2.0 (2–14)" is Civica adding Freedom House's two ratings; Freedom House does not publish it, and the row carries no "Civica calculation" marker. This was knowingly deferred in today's attribution fix.
- **Suggested fix:** Show the published ratings ("PR 1 · CL 1"), or mark the sum as a Civica calculation and rename it.
- **Modules:** `governance-evidence/GovernanceEvidenceTable.tsx`
- **Screenshots:** `desktop-light-uruguay-v-governance-evidence-2.webp`

#### CD-44: Governance Evidence rows mislabel the edition and data year

- **Severity:** Misleading label
- **Where:** Governance Evidence, all countries with data.
- **Why it matters:** "Exact 2024 publisher release" is wrong for the World Bank (2025 edition) and V-Dem (v15); 2024 is the data year. Integers show a false ".0", minus signs are mixed, and a World Bank revision is not explained. On phones the column is off-screen.
- **Suggested fix:** Store and show each source's real edition next to an explicit data year, format values at publisher precision, and use proper minus signs.
- **Modules:** `governance-evidence/GovernanceEvidenceTable.tsx`
- **Screenshots:** `mobile-light-saudi-arabia-11-governance-evidence.webp`

#### CD-45: Fact panel dates slip back a month for readers in the Americas

- **Severity:** Misleading label
- **Where:** Fact source panel, all countries.
- **Why it matters:** "(2025 est.) As of Dec 2024" appears because dates are shown in the reader's time zone. Anyone west of London sees the previous month and year for every source, and year-only estimates are given a false month.
- **Suggested fix:** Format these dates in UTC and show only the year when the source gives a year.
- **Modules:** `factbook/FactValuePanel.tsx`
- **Screenshots:** `mobile-dark-japan-08-fact-value-panel.webp`

#### CD-46: History chart renames publisher measures and says "higher is better"

- **Severity:** Misleading label
- **Where:** Indicator History chart, all countries with history.
- **Why it matters:** The legend says "Corruption Control" for Transparency International's CPI (easily confused with the World Bank indicator of that name) while the table below uses publisher names. "Higher is better" is a verdict the page otherwise avoids.
- **Suggested fix:** Use the publisher measure names and replace the verdict with neutral wording.
- **Modules:** `ci/CountryTrendSection.tsx`, `ci/IndicatorTrendChart.tsx`
- **Screenshots:** `desktop-light-uruguay-h-chart-hover-late.webp`

#### CD-47: "Rankings" section ranks nothing *(new today)*

- **Severity:** Misleading label
- **Where:** Section 10 and its sidebar link, all countries.
- **Why it matters:** Since today's attribution fix removed the rank column, the section holds two publisher measures and no ranks.
- **Suggested fix:** Rename the label (for example "Publisher measures"); keep the anchor so links still work.
- **Modules:** `app/(reader)/country/[slug]/civica-data/page.tsx`, `country/CivicaDataSections.tsx`, `factbook/FactbookSidebar.tsx`
- **Screenshots:** `desktop-dark-japan-15-sec10-rankings.webp`

#### CD-48: Citation gives the wrong year, author and sources

- **Severity:** Misleading label
- **Where:** "Cite this page", all countries.
- **Why it matters:** The year is one section's data year ("2024", or "n.d." for Kosovo). The author is "Civica", although the project's authorship rule requires naming Fernando Baliño with Civica Atlas as publisher. The source list leaves out IPU Parline, CIA World Leaders, the Conditions publishers and Wikimedia Commons.
- **Suggested fix:** Date the citation to the page's release (or n.d.), use the recorded author and publisher, and build the source list from every section shown.
- **Modules:** `app/(reader)/country/[slug]/civica-data/page.tsx`, `cite/CiteAccordion.tsx`
- **Screenshots:** `desktop-light-uruguay-h-cite-open.webp`

#### CD-49: AI-written bill summaries look like Parliament's text

- **Severity:** Misleading label
- **Where:** United Kingdom, Bills section.
- **Why it matters:** Each summary is written by Claude Haiku from little more than the bill's name, but it sits above a "UK Parliament" tag with no AI label. Some are guesses.
- **Suggested fix:** Add a visible "AI-written summary" label linked to the AI-use policy, or show the official long title.
- **Modules:** `factbook/FactbookBills.tsx`
- **Screenshots:** `desktop-dark-united-kingdom-13-sec08-bills.webp`

#### CD-50: Central-bank heads are filed under the executive branch

- **Severity:** Misleading label
- **Where:** Government chart, most countries.
- **Why it matters:** The Bank of England, Bank of Japan and others appear as ordinary cabinet cards under "Executive", implying they are part of government.
- **Suggested fix:** Show them in a separately labelled group.
- **Modules:** `factbook/FactbookGovOrgChart.tsx`
- **Screenshots:** `desktop-dark-united-kingdom-10-sec05-government.webp`

#### CD-51: Photo credits leave out the photographer

- **Severity:** Misleading label
- **Where:** Photo gallery, all countries with photos.
- **Why it matters:** Captions say "CC BY-SA 4.0 · Wikimedia Commons" with no author or link, which the licence requires. (The reported blank thumbnail did not reproduce.)
- **Suggested fix:** Store the Commons author field and show author, licence and file link in each caption.
- **Modules:** `factbook/FactbookLightbox.tsx`
- **Screenshots:** `desktop-light-uruguay-t-lightbox-open.webp`

### Design system

#### CD-52: "No composite published" is styled like a headline number

- **Severity:** Design system
- **Where:** Civica Conditions, all countries.
- **Why it matters:** The status message uses the same large display style as "94 / 100", so it reads like a result; positions also mix "94" and "83.3".
- **Suggested fix:** Use the existing empty-state style and one fixed precision.
- **Modules:** `conditions/CivicaConditionsPanel.tsx`
- **Screenshots:** `desktop-dark-united-kingdom-09-sec04-conditions.webp`

#### CD-53: History chart lines are hard to tell apart

- **Severity:** Design system
- **Where:** Indicator History chart, all countries with history.
- **Why it matters:** Three lines share near-identical warm colours with no dashes or labels, and the colours come from tokens reserved for status displays.
- **Suggested fix:** Add a neutral, colour-blind-safe series palette to the design system and add dashes or end labels.
- **Modules:** `ci/IndicatorTrendChart.tsx`
- **Screenshots:** `desktop-dark-japan-08-sec03-indicator-history.webp`

#### CD-54: Decorative numbers and repeated labels above every heading

- **Severity:** Design system
- **Where:** Every section and the sidebar.
- **Why it matters:** "01 · EVIDENCE COVERAGE" repeats the heading below it, the sidebar is numbered 01–11 although the sections are not a sequence, and Conditions shows its name three times. The design rules forbid both.
- **Suggested fix:** Remove the numbered eyebrows, the sidebar numbers and Conditions' inner label.
- **Modules:** `conditions/CivicaConditionsPanel.tsx`, `country/CivicaDataSections.tsx`, `editorial/ReaderSidebar.tsx`, `factbook/FactbookSidebar.tsx`
- **Screenshots:** `desktop-light-uruguay-06-sidebar.webp`, `mobile-light-saudi-arabia-13-conditions.webp`

#### CD-55: Square uppercase buttons instead of design-system controls

- **Severity:** Design system
- **Where:** Bills, Cite this page and the photo gallery.
- **Why it matters:** These use their own square, uppercase, letter-spaced buttons, tags and tabs instead of the rounded Button, Chip and SegmentedControl.
- **Suggested fix:** Swap in the design-system controls and drop the bill index numbers.
- **Modules:** `cite/CiteAccordion.tsx`, `factbook/FactbookBillAskButton.tsx`, `factbook/FactbookBills.tsx`, `factbook/FactbookLightbox.tsx`
- **Screenshots:** `desktop-light-uruguay-h-cite-open.webp`, `mobile-light-united-kingdom-crop-17-bills-top.webp`

#### CD-56: Bills coverage note uses the warning colour

- **Severity:** Design system
- **Where:** Bills section for the 7 countries without bill coverage.
- **Why it matters:** A routine "not covered" note uses the amber warning banner, which elsewhere means an outage.
- **Suggested fix:** Use the info banner for coverage states.
- **Modules:** `factbook/FactbookBills.tsx`
- **Screenshots:** `desktop-dark-japan-13-sec08-bills.webp`

### Copy

#### CD-57: Conditions inputs show raw unit codes

- **Severity:** Copy
- **Where:** Civica Conditions, all countries.
- **Why it matters:** Values read "4.36 percent_labor_force" or "1.34 index_1_5_inverted"; the GPI one is also wrong, since the value shown is not inverted.
- **Suggested fix:** Map codes to reader labels such as "% of labour force" and "GPI score 1–5, lower is more peaceful".
- **Modules:** `conditions/CivicaConditionsPanel.tsx`
- **Screenshots:** `desktop-dark-united-kingdom-09-sec04-conditions.webp`

#### CD-58: "forKosovo" typo and "the country" wording

- **Severity:** Copy
- **Where:** Kosovo, Governance Evidence and Rankings banners.
- **Why it matters:** A missing space reads "recorded forKosovo", and both banners call a limited-recognition entity "the country".
- **Suggested fix:** Add the space and use the place name or "this jurisdiction".
- **Modules:** `app/(reader)/country/[slug]/civica-data/page.tsx`, `scores/ScoresAndRankings.tsx`
- **Screenshots:** `mobile-light-kosovo-11-governance-evidence.webp`

#### CD-59: Internal task IDs and database jargon in reader copy

- **Severity:** Copy
- **Where:** Evidence Coverage, Indicator History and Organizations, all countries.
- **Why it matters:** Readers see "DAT-005 snapshot", "DAT-006/DAT-007 resolver", "freedom_house historical series retained before DAT-033" and "organization-membership-release/2026-07-v1", plus "for United Kingdom" without "the". The Organizations strip also credits Wikidata while the rows credit Civica's roster.
- **Suggested fix:** Replace IDs with plain labels ("the August 10, 2026 coverage snapshot", publisher and edition names) and fix the Organizations credit.
- **Modules:** `app/(reader)/country/[slug]/civica-data/page.tsx`, `ci/CountryTrendSection.tsx`, `factbook/FactbookOrganizations.tsx`, `provenance/CountryEvidenceCoverage.tsx`
- **Screenshots:** `desktop-light-united-kingdom-v-evidence-coverage-1.webp`, `desktop-dark-japan-08-sec03-indicator-history.webp`

#### CD-60: Fact source panel shows raw keys and a vague explanation

- **Severity:** Copy
- **Where:** Fact source panel, all countries.
- **Why it matters:** It prints "population_total", "un wpp", "ons_uk" and "ATL-020", and its "Why this value" line lists three possible rules instead of the one that applied (the system does not record which).
- **Suggested fix:** Hide keys, map IDs to publisher names, record and show the deciding rule, and drop the task ID.
- **Modules:** `atlas/AtlasChangeHistoryDisclosure.tsx`, `factbook/FactValuePanel.tsx`
- **Screenshots:** `desktop-light-uruguay-h-fact-panel.webp`

#### CD-61: Status panel shows an internal contract ID

- **Severity:** Copy
- **Where:** Country-status panel, all countries.
- **Why it matters:** "Reviewed 2026-07-10 under jurisdiction-status/v1" means nothing to readers.
- **Suggested fix:** Write "Status reviewed 10 July 2026" and drop the ID.
- **Modules:** `jurisdiction/JurisdictionStatusDisclosure.tsx`
- **Screenshots:** `desktop-light-uruguay-h-status-open.webp`

#### CD-62: "Hover" instructions on phones, and seat details unreachable

- **Severity:** Copy
- **Where:** Legislature and Indicator History, phones.
- **Why it matters:** Phone readers are told to "hover a seat" or "hover a year", but tapping a seat or year shows nothing.
- **Suggested fix:** Use "Tap or hover" wording and make taps open seat and year details.
- **Modules:** `ci/CountryTrendSection.tsx`, `ci/IndicatorTrendChart.tsx`, `editorial/Tooltip.tsx`, `factbook/FactbookLegislatureChart.tsx`, `factbook/PartyBrowser.tsx`
- **Screenshots:** `mobile-dark-saudi-arabia-15-legislature.webp`

#### CD-63: Legislature repeats its stats and uses developer language

- **Severity:** Copy
- **Where:** Legislature section, all views.
- **Why it matters:** Majority line and largest party appear above and below the chart, and the note says "second native-document route" and "ingest gap".
- **Suggested fix:** Keep one stats block and rewrite the note plainly.
- **Modules:** `factbook/ChamberComposition.tsx`, `factbook/FactbookLegislature.tsx`, `factbook/FactbookLegislatureChart.tsx`, `research/ResearchVisualizationDisclosure.tsx`
- **Screenshots:** `crops-uy-leg-foot.webp`

#### CD-64: CIA name formatting leaks onto the page

- **Severity:** Copy
- **Where:** Government and Leaders, several countries.
- **Why it matters:** "Pat McFADDEN", "al-QASABI", lowercase nicknames like "“robow”", abbreviations like "Min." and missing accents appear next to correctly written names. Two of these are bugs in Civica's clean-up; the rest come from CIA.
- **Suggested fix:** Fix the casing and nickname bugs, expand abbreviations for display, and prefer the Wikidata name when the person is matched.
- **Modules:** `factbook/FactbookGovOrgChart.tsx`, `factbook/FactbookLeaders.tsx`
- **Screenshots:** `desktop-light-saudi-arabia-v-government-1.webp`, `mobile-dark-uruguay-14-government.webp`

#### CD-65: Tenure is counted and worded inconsistently

- **Severity:** Copy
- **Where:** Leaders section.
- **Why it matters:** The same tenure reads "0 yrs" and "< 1 yr"; "1 yrs" appears; years are counted by subtracting calendar years, so 11 months shows as 1 year and 6.9 years as 7.
- **Suggested fix:** Count completed years from the full start date and use one formatter everywhere.
- **Modules:** `factbook/FactbookLeaders.tsx`, `factbook/LeaderTenureTimeline.tsx`
- **Screenshots:** `desktop-light-united-kingdom-v-leaders-1.webp`

#### CD-66: Switzerland's government type is badly capitalised

- **Severity:** Copy
- **Where:** Switzerland, country header.
- **Why it matters:** "Federal Republic (Formally A Confederation)": every word is capitalised. (The reported Beta-chip spacing did not reproduce.)
- **Suggested fix:** Title-case only the main label, or use a curated display label.
- **Modules:** `factbook/FactbookHeaderStrip.tsx`
- **Screenshots:** `desktop-dark-switzerland-02-masthead.webp`

#### CD-67: Footer repeats a link and uses a three-word slogan

- **Severity:** Copy
- **Where:** Site footer, every page.
- **Why it matters:** "Evidence Dashboard" is listed twice, and "Accessible. Traceable. Nonpartisan." is the three-adjective pattern the copy rules ban.
- **Suggested fix:** Keep the link once and replace the slogan with one concrete sentence.
- **Modules:** `SiteFooter.tsx`
- **Screenshots:** `desktop-light-uruguay-t-footer-search-focus.webp`

### Cosmetic

#### CD-68: "Cite this page" appears twice

- **Severity:** Cosmetic
- **Where:** Citation footer.
- **Why it matters:** A heading and the accordion directly under it both say "Cite this page".
- **Suggested fix:** Let the accordion drop its own label when a heading exists.
- **Modules:** `app/(reader)/country/[slug]/civica-data/page.tsx`, `cite/CiteAccordion.tsx`
- **Screenshots:** `desktop-dark-japan-16-cite.webp`

#### CD-69: Initials tiles show quote marks

- **Severity:** Cosmetic
- **Where:** Somalia, Leaders cabinet list.
- **Why it matters:** Four ministers without photos get initials such as "A"" or "M“" because the last word of the name is a quoted nickname.
- **Suggested fix:** Skip quoted nicknames and punctuation when taking initials.
- **Modules:** `factbook/LeaderPortrait.tsx`
- **Screenshots:** `desktop-light-somalia-t-leaders-others.webp`

#### CD-70: Government chart footnote splits into cramped columns on phones *(new today)*

- **Severity:** Cosmetic
- **Where:** Government chart, phones.
- **Why it matters:** Today's roster-date addition turned the footnote into three narrow columns with the source dot stranded at the edge.
- **Suggested fix:** Let the footnote flow as one paragraph.
- **Modules:** `factbook/FactbookGovOrgChart.tsx`
- **Screenshots:** `mobile-dark-uruguay-14-government.webp`

#### CD-71: Fixed bars and a long link list take up the phone screen

- **Severity:** Cosmetic
- **Where:** All country tabs; mainly phones.
- **Why it matters:** Header, country bar and Ask-Civica bar together fill about 23% of a phone screen and cover the map, photos and footer; an 11-link list comes before any data. On desktop the Ask bar floats over headings and table rows.
- **Suggested fix:** Collapse the Ask bar on phones, add bottom padding for it, and fold the phone link list into one "On this page" control.
- **Modules:** `app/(reader)/country/[slug]/layout.tsx`, `factbook/CivicaAIDrawer.tsx`, `factbook/FactbookSidebar.tsx`, `factbook/FactbookStickyCountrySearch.tsx`
- **Screenshots:** `desktop-dark-uruguay-20-first-viewport.webp`, `mobile-light-uruguay-31-viewport-sidebar-list.webp`

#### CD-72: Sidebar highlights the wrong section after a jump

- **Severity:** Cosmetic
- **Where:** "On this page" list, after jumping back to the top.
- **Why it matters:** After an instant jump (for example re-tapping the Civica Data tab) the list keeps highlighting "Legislature". Normal scrolling works. (Reported as broken; the verification judged it minor.)
- **Suggested fix:** Fall back to the nearest section above, or the first, when no section is in view.
- **Modules:** `editorial/ReaderSidebar.tsx`, `factbook/FactbookSidebar.tsx`
- **Screenshots:** `mobile-dark-uruguay-05-sidebar.webp`

#### CD-73: Phone menu shows a ⌘K keyboard hint

- **Severity:** Cosmetic
- **Where:** Mobile menu search, every page.
- **Why it matters:** Phones have no Command key.
- **Suggested fix:** Hide the hint on touch devices.
- **Modules:** `CountrySearchCombobox.tsx`, `GlobalSearch.tsx`, `MobileNav.tsx`
- **Screenshots:** `mobile-dark-uruguay-01b-mobile-menu-open.webp`

## Claims dropped during verification

No reported finding was refuted outright. These parts of confirmed findings did not hold up and are excluded above:

- Roster duplicates inflate officeholder totals: refuted; totals count distinct names. The Japan and Saudi "duplicates" copy the CIA source faithfully.
- Escape does not close the fact source panel: refuted; it closes on touch and keyboard (a mouse reopens it by hover).
- The Beta chip leaves a gap inside the reconciliation line's parentheses: not reproduced (0px gap).
- The photo gallery has a blank thumbnail: not reproduced; all 8 thumbnails loaded.
- The chart tooltip box runs off screen: refuted as stated; the box stays on screen, its contents overflow it.
- History's "1825–2025" contradicts the captured release's "1789/2025": refuted; one is Uruguay's series, the other the release's global coverage.
- The government-type contrast failure is in the shared Pill primitive: refuted; it is the header's own pill.
- Monaco is covered by HDI and GPI: refuted; Monaco's missing Conditions cards are genuine publisher gaps (still unexplained on the page).
- "Missing" is a DataValueState primitive defect: refuted; the table picks the wrong state.
- The sidebar scroll-spy is "broken": downgraded to cosmetic; only an instant jump leaves a stale highlight.

## Known items (from before this review)

The four items already known before this review were all confirmed: the Freedom House Civica sum (CD-43), the "Rankings" title (CD-47), raw Conditions unit codes (CD-57) and unlabeled Sources dates (CD-35). The cramped `/compare` chamber cards on phones belong to a different route and were not re-reviewed here.
