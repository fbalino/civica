# Civica v2 future proposals

> Forward-looking ideas not in v1 scope. New entries get appended; nothing
> ships from this file without becoming its own proposal/resolution doc
> first.

---

## 1. Composition charts (pie / donut / pyramid) for breakdown fields

**Origin:** 2026-05-04 conversation. User: "in the future it might be nice to have a gorgeous pie chart that shows that breakdown (for gdp the pie chart is great) and other charts for other sub-sections."

**The idea.** For factbook fields that are part-of-whole compositions, render a
chart in addition to (or instead of) the text breakdown. Common candidates:

| Breakdown | Tier-1 source | Chart type |
|---|---|---|
| GDP composition by sector (agriculture / industry / services) | World Bank WDI, UN, OECD | pie / donut |
| Energy mix (oil / gas / coal / nuclear / renewables) | IEA (scrapped), IRENA, WB partial | pie / stacked bar |
| Age structure (0–14, 15–64, 65+) | UN World Population Prospects, WB | population pyramid (age × sex) |
| Urban vs rural population | UN WPP, WB | pie |
| Trade by partner (top 5 export destinations) | UN Comtrade, WTO | bar / treemap |
| Trade by commodity | UN Comtrade | treemap |
| Religion breakdown | Pew Research, ARDA (CIA prose currently) | pie |
| Labor force by sector | ILO, WB | pie / bar |
| Education attainment levels | UNESCO UIS | stacked bar |
| Government revenue by source | IMF GFS, OECD | pie |

Population pyramids are the highest-leverage single-country visualization in
demography and UN WPP publishes age-and-sex data in the right shape already.

**What v1 ships in this space:** nothing. Composition fields render as plain
CIA prose (e.g., "agriculture: 5%, industry: 30%, services: 65%"). The Augment
design (v1) only wraps depth-0 leaves; depth-1 children inside composition
groups stay un-augmented.

**What v2 needs:**

1. Per-component fact-keys declared in `fact-keys.ts` (e.g.
   `gdp_composition_agriculture_pct`, `gdp_composition_industry_pct`,
   `gdp_composition_services_pct`).
2. Sync orchestrators ingest the components from structured Tier-1 sources
   (WB WDI is the most direct path for GDP composition; UN WPP for age
   structure; UN Comtrade for trade composition).
3. A small chart component with the project's design tokens (no new color
   ramps; reuse `--gov-*`, `--tier-*`, or a dedicated `--chart-*` set).
4. A "composition-aware" rendering pattern in `FactbookSection.tsx` that
   detects when N child fact-keys form a part-of-whole and renders them
   together as a chart.

**Methodology consideration.** Different sources slice the whole differently:
- WB uses 3 buckets (Agriculture / Industry / Services).
- UN ISIC has 10+ categories.
- OECD ISIC Rev.4 has 21 categories.

These are NOT directly comparable. Likely pattern: a canonical 3-bucket
"summary" composition (WB-style) for the headline chart, plus per-source
detailed breakdowns available in alternates / expansion panels for power
users. Same shape as the R.12 trade-aggregate split — different sources
measuring "the same thing" with genuinely different category schemes.

When this graduates to scoped work, write it up as
`~/civica/plan/composition-charts-resolution-v1.md` with citations to OWID's
chart conventions and the source-by-source category schema decisions. ~3–5
days of agent work for the GDP-composition end-to-end (declare fact-keys,
extend WB WDI sync, build the chart component, wire to the page).
